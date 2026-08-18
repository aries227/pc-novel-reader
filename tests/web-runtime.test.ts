// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LibraryItem } from '../src/shared/book'
import type { ReaderApi } from '../src/shared/ipc'
import { idbSet } from '../src/web/idb'
import { installWebRuntime } from '../src/web/runtime'

function reader(): ReaderApi {
  return (window as unknown as { reader: ReaderApi }).reader
}

beforeEach(async () => {
  localStorage.clear()
  delete (window as unknown as Record<string, unknown>).__jianyueWeb
  delete (window as unknown as { reader?: ReaderApi }).reader
  await installWebRuntime()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('web runtime', () => {
  it('设置读写并持久化', async () => {
    await reader().settings.set({ theme: 'dark', fontSize: 20 })
    const s = await reader().settings.get()
    expect(s.theme).toBe('dark')
    expect(s.fontSize).toBe(20)
    expect(JSON.parse(localStorage.getItem('jianyue.settings') ?? '{}').theme).toBe('dark')
  })

  it('书架增删改、进度、书签与高亮', async () => {
    const item: LibraryItem = { meta: { id: 'b1', title: '旧名', author: '', format: 'txt', addedAt: 1 }, bookmarks: [], highlights: [] }
    await idbSet('kv', 'library', [item])
    await idbSet('files', 'file:b1', new TextEncoder().encode('第一章\n正文内容'))

    expect(await reader().library.list()).toHaveLength(1)
    await reader().library.rename('b1', '新名')
    expect((await reader().library.list())[0].meta.title).toBe('新名')

    await reader().book.saveProgress({ bookId: 'b1', chapterIndex: 1, updatedAt: 123 })
    expect((await reader().book.getProgress('b1'))?.chapterIndex).toBe(1)

    const hl = await reader().book.addHighlight({ bookId: 'b1', chapterIndex: 0, text: '正文', color: 'yellow' })
    expect((await reader().book.listHighlights('b1'))[0].id).toBe(hl.id)
    await reader().book.removeHighlight(hl.id)
    expect(await reader().book.listHighlights('b1')).toHaveLength(0)

    const bm = await reader().book.addBookmark({ bookId: 'b1', chapterIndex: 0, paragraphIndex: 0, excerpt: '正文' })
    await reader().book.removeBookmark(bm.id)
    expect(await reader().book.listBookmarks('b1')).toHaveLength(0)
  })

  it('打开 TXT 书解析章节', async () => {
    const item: LibraryItem = { meta: { id: 'b1', title: '测试书.txt', author: '', format: 'txt', addedAt: 1 }, bookmarks: [], highlights: [] }
    await idbSet('kv', 'library', [item])
    await idbSet('files', 'file:b1', new TextEncoder().encode('第一章 开始\n正文内容\n第二章 继续\n更多内容'))
    const opened = await reader().book.open('b1')
    expect(opened?.chapters).toHaveLength(2)
    expect(opened?.chapters[0].title).toContain('第一章')
  })

  it('生词本增删改', async () => {
    const e = await reader().vocab.add({ word: 'hello', translation: '你好' })
    expect((await reader().vocab.list())[0].word).toBe('hello')
    const updated = await reader().vocab.update(e.id, { reviewState: 'mastered' })
    expect(updated.reviewState).toBe('mastered')
    await reader().vocab.remove(e.id)
    expect(await reader().vocab.list()).toHaveLength(0)
  })

  it('离线词典查词与考试标签', async () => {
    const dictFixture = { words: { hello: { t: '你好；喂', p: 'həˈloʊ' }, run: { t: '跑' } }, forms: { ran: 'run' } }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () => (url.includes('dictionary.json') ? dictFixture : url.includes('examples.json') ? {} : { college: 'cet6' })
      }))
    )
    await expect(reader().dictionary.lookup('hello')).resolves.toMatchObject({ translation: '你好；喂' })
    await expect(reader().dictionary.lookup('Ran')).resolves.toMatchObject({ word: 'run' })
    await expect(reader().dictionary.examTags()).resolves.toMatchObject({ college: 'cet6' })
  })
})
