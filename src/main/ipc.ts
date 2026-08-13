import { BrowserWindow, dialog, ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Chapter, Progress, Settings } from '../shared/book'
import type { BookSource } from '../shared/source'
import { LibraryStore } from './library'
import { fetchHtml } from './network'
import { parseDocx } from './parsers/docx'
import { parseEbook } from './parsers/ebook'
import { parseHtmlFile } from './parsers/html'
import { parseTxt } from './parsers/txt'
import { parseWebPage } from './readability'
import { toReaderFileUrl } from './protocol-utils'
import { SettingsStore } from './settings'
import { createCachedEngine, fetchChapterList, searchSource } from './sources/engine'
import { normalizeSource } from './sources/validate'
import type { UploadManager } from './upload-server'

export function registerIpc(
  library: LibraryStore,
  settings: SettingsStore,
  uploadManager: UploadManager,
  booksDir: string,
  sourcesFile: string,
  sourceCacheDir: string
): void {
  const sourceEngine = createCachedEngine(sourceCacheDir)

  async function readSources(): Promise<BookSource[]> {
    try { return JSON.parse(await readFile(sourcesFile, 'utf8')) } catch { return [] }
  }
  async function writeSources(list: BookSource[]): Promise<void> {
    await writeFile(sourcesFile, JSON.stringify(list, null, 2), 'utf8')
  }

  ipcMain.handle('dialog:openFiles', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      title: '选择书籍文件',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '书籍', extensions: ['txt', 'epub', 'mobi', 'azw3', 'fb2', 'pdf', 'html', 'htm', 'docx'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    return result.canceled ? [] : result.filePaths
  })
  ipcMain.handle('library:list', () => library.list())
  ipcMain.handle('library:addFiles', (_e, paths: string[]) => library.addFiles(paths))
  ipcMain.handle('library:addFolder', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const r = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] })
    if (r.canceled || r.filePaths.length === 0) return []
    const { readdir } = await import('node:fs/promises')
    const files = (await readdir(r.filePaths[0], { withFileTypes: true }))
      .filter((d) => d.isFile())
      .map((d) => join(r.filePaths[0], d.name))
    return library.addFiles(files)
  })
  ipcMain.handle('library:remove', (_e, id: string) => library.remove(id))
  ipcMain.handle('library:clear', () => library.clear())
  ipcMain.handle('library:import', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const r = await dialog.showOpenDialog(win!, { properties: ['openFile'], filters: [{ name: '书架备份', extensions: ['json'] }] })
    if (r.canceled || r.filePaths.length === 0) return
    await library.import(r.filePaths[0])
  })
  ipcMain.handle('library:export', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const r = await dialog.showSaveDialog(win!, {
      defaultPath: `简阅书架-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: '书架备份', extensions: ['json'] }]
    })
    if (r.canceled || !r.filePath) return null
    await library.export(r.filePath)
    return r.filePath
  })
  ipcMain.handle('settings:get', () => settings.get())
  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => settings.set(patch))
  ipcMain.handle('upload:status', () => uploadManager.status())
  ipcMain.handle('upload:start', () => uploadManager.start())
  ipcMain.handle('upload:stop', () => { uploadManager.stop() })
  ipcMain.handle('web:parse', async (_e, url: string) => {
    const { title, html } = await parseWebPage(url)
    const file = join(booksDir, `${randomUUID()}.html`)
    await writeFile(file, html, 'utf8')
    const items = await library.addFiles([file])
    items[0].meta.title = title
    return items[0]
  })
  ipcMain.handle('sources:list', () => readSources())
  ipcMain.handle('sources:importDialog', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const r = await dialog.showOpenDialog(win!, { properties: ['openFile'], filters: [{ name: '书源', extensions: ['json'] }] })
    if (r.canceled || r.filePaths.length === 0) return readSources()
    const raw = JSON.parse(await readFile(r.filePaths[0], 'utf8'))
    const { source, errors } = normalizeSource(raw)
    if (errors.length) throw new Error(errors.join('；'))
    const list = await readSources()
    list.push(source)
    await writeSources(list)
    return list
  })
  ipcMain.handle('sources:importUrl', async (_e, url: string) => {
    const raw = JSON.parse(await fetchHtml({ url }))
    const { source, errors } = normalizeSource(raw)
    if (errors.length) throw new Error(errors.join('；'))
    const list = await readSources()
    list.push(source)
    await writeSources(list)
    return list
  })
  ipcMain.handle('sources:save', async (_e, s: BookSource) => {
    const list = await readSources()
    const i = list.findIndex((x) => x.id === s.id)
    if (i >= 0) list[i] = s
    else list.push(s)
    await writeSources(list)
  })
  ipcMain.handle('sources:remove', async (_e, id: string) => writeSources((await readSources()).filter((s) => s.id !== id)))
  ipcMain.handle('sources:export', async (_e, id: string) => {
    const s = (await readSources()).find((x) => x.id === id)
    if (!s) return null
    const r = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow()!, { defaultPath: `${s.name}.json` })
    if (r.canceled || !r.filePath) return null
    await writeFile(r.filePath, JSON.stringify(s, null, 2), 'utf8')
    return r.filePath
  })
  ipcMain.handle('sources:search', async (_e, sourceId: string, keyword: string) => {
    const src = (await readSources()).find((s) => s.id === sourceId)
    if (!src) throw new Error('书源不存在')
    return searchSource(src, keyword)
  })
  ipcMain.handle('sources:chapters', async (_e, sourceId: string, bookUrl: string) => {
    const src = (await readSources()).find((s) => s.id === sourceId)
    if (!src) throw new Error('书源不存在')
    return fetchChapterList(src, bookUrl)
  })
  ipcMain.handle('sources:content', async (_e, sourceId: string, chapterUrl: string) => {
    const src = (await readSources()).find((s) => s.id === sourceId)
    if (!src) throw new Error('书源不存在')
    return sourceEngine.content(src, chapterUrl)
  })
  ipcMain.handle('sources:addBook', (_e, args: { sourceId: string; bookUrl: string; title: string; author?: string; cover?: string }) =>
    library.addSourceBook(args)
  )
  uploadManager.onUploaded((p) => {
    void library.addFiles([p])
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('upload:uploaded', p)
    }
  })
  ipcMain.handle('book:open', async (_e, id: string) => {
    const item = await library.get(id)
    if (!item) return null
    if (item.meta.format === 'txt' && item.meta.path) {
      const parsed = await parseTxt(item.meta.path)
      return { meta: { ...item.meta, title: parsed.meta.title }, chapters: parsed.chapters }
    }
    if (item.meta.format === 'pdf' && item.meta.path) {
      return { meta: item.meta, chapters: [], pdfUrl: toReaderFileUrl(item.meta.path) }
    }
    if (item.meta.format === 'epub' || item.meta.format === 'mobi' || item.meta.format === 'azw3' || item.meta.format === 'fb2') {
      const parsed = await parseEbook(item.meta.path!, item.meta.format)
      return { meta: { ...item.meta, ...parsed.meta }, chapters: parsed.chapters }
    }
    if (item.meta.format === 'docx') {
      const parsed = await parseDocx(item.meta.path!)
      return { meta: { ...item.meta, ...parsed.meta }, chapters: parsed.chapters }
    }
    if (item.meta.format === 'html') {
      const parsed = await parseHtmlFile(item.meta.path!)
      return { meta: { ...item.meta, ...parsed.meta }, chapters: parsed.chapters }
    }
    if (item.meta.format === 'source' && item.meta.sourceId && item.meta.bookUrl) {
      const src = (await readSources()).find((s) => s.id === item.meta.sourceId)
      if (!src) throw new Error('书源已删除')
      const chapters = await fetchChapterList(src, item.meta.bookUrl)
      const loaded: Chapter[] = []
      for (const c of chapters) {
        loaded.push({ id: c.id, title: c.title, html: await sourceEngine.content(src, c.url) })
      }
      return { meta: item.meta, chapters: loaded }
    }
    return { meta: item.meta, chapters: [] }
  })
  ipcMain.handle('book:saveProgress', (_e, p: Progress) => library.saveProgress(p))
  ipcMain.handle('book:listBookmarks', async (_e, id: string) => (await library.get(id))?.bookmarks ?? [])
  ipcMain.handle('book:addBookmark', (_e, b) => library.addBookmark(b))
  ipcMain.handle('book:removeBookmark', (_e, id: string) => library.removeBookmark(id))
  ipcMain.on('app:quit', () => BrowserWindow.getFocusedWindow()?.close())
}
