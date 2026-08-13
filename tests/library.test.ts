import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LibraryStore } from '../src/main/library'
import { SettingsStore } from '../src/main/settings'

let dir: string
beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), 'reader-lib-')) })
afterAll(async () => { await rm(dir, { recursive: true, force: true }) })

describe('LibraryStore', () => {
  it('添加 txt 文件并持久化', async () => {
    const bookPath = join(dir, 'a.txt')
    await writeFile(bookPath, '第一章 开始\n内容\n', 'utf8')
    const items = await new LibraryStore(dir).addFiles([bookPath])
    expect(items).toHaveLength(1)
    expect(items[0].meta.title).toBe('a.txt')
    const again = await new LibraryStore(dir).list()
    expect(again).toHaveLength(1)
  })
  it('跳过不支持的扩展名', async () => {
    const bad = join(dir, 'x.exe')
    await writeFile(bad, 'MZ')
    const items = await new LibraryStore(dir).addFiles([bad])
    expect(items).toHaveLength(0)
  })
  it('保存进度与书签', async () => {
    const store = new LibraryStore(dir)
    const items = await store.list()
    const id = items[0].meta.id
    await store.saveProgress({ bookId: id, chapterIndex: 1, charOffset: 10, updatedAt: Date.now() })
    const bookmark = await store.addBookmark({ bookId: id, chapterIndex: 1, paragraphIndex: 0, excerpt: '内容' })
    const loaded = await store.list()
    expect(loaded[0].progress?.chapterIndex).toBe(1)
    expect(loaded[0].bookmarks[0].id).toBe(bookmark.id)
  })
})

describe('SettingsStore', () => {
  it('合并补丁并持久化', async () => {
    const store = new SettingsStore(dir)
    const s1 = await store.get()
    expect(s1.theme).toBe('sepia')
    const s2 = await store.set({ theme: 'dark', fontSize: 20 })
    expect(s2.theme).toBe('dark')
    expect((await new SettingsStore(dir).get()).theme).toBe('dark')
  })
})
