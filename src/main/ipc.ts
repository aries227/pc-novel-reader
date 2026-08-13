import { BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'node:path'
import type { Progress, Settings } from '../shared/book'
import { LibraryStore } from './library'
import { parseTxt } from './parsers/txt'
import { SettingsStore } from './settings'

export function registerIpc(library: LibraryStore, settings: SettingsStore): void {
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
  ipcMain.handle('book:open', async (_e, id: string) => {
    const item = await library.get(id)
    if (!item) return null
    if (item.meta.format === 'txt' && item.meta.path) {
      const parsed = await parseTxt(item.meta.path)
      return { meta: { ...item.meta, title: parsed.meta.title }, chapters: parsed.chapters }
    }
    return { meta: item.meta, chapters: [] }
  })
  ipcMain.handle('book:saveProgress', (_e, p: Progress) => library.saveProgress(p))
  ipcMain.handle('book:listBookmarks', async (_e, id: string) => (await library.get(id))?.bookmarks ?? [])
  ipcMain.handle('book:addBookmark', (_e, b) => library.addBookmark(b))
  ipcMain.handle('book:removeBookmark', (_e, id: string) => library.removeBookmark(id))
  ipcMain.on('app:quit', () => BrowserWindow.getFocusedWindow()?.close())
}
