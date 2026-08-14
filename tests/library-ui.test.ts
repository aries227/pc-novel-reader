// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import type { ReaderApi } from '../src/shared/ipc'
import type { LibraryItem } from '../src/shared/book'
import { renderLibrary } from '../src/renderer/components/library'

function mockReader(): void {
  ;(window as unknown as { reader: ReaderApi }).reader = {
    library: {
      list: async () => [],
      addFiles: async () => [],
      addFolder: async () => [],
      remove: async () => undefined,
      rename: async (id, title) => ({ meta: { id, title, author: '', format: 'txt', addedAt: 1 }, bookmarks: [] }),
      clear: async () => undefined,
      import: async () => undefined,
      export: async () => null
    },
    book: {
      open: async () => null,
      saveProgress: async () => undefined,
      getProgress: async () => null,
      listBookmarks: async () => [],
      addBookmark: async (b) => ({ ...b, id: 'x', createdAt: 1 }),
      removeBookmark: async () => undefined,
      listHighlights: async () => [],
      addHighlight: async (b) => ({ ...b, id: 'x', createdAt: 1 }),
      removeHighlight: async () => undefined
    },
    settings: {
      get: async () => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文', aiProviders: [{ id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: '', models: ['deepseek-chat'] }], aiDefaults: { translateProviderId: 'deepseek', translateModel: 'deepseek-chat', quizProviderId: 'deepseek', quizModel: 'deepseek-chat', quizCount: 4, quizDifficulty: '通用' }, examColors: { enabled: true, colors: {} } }),
      set: async (patch) => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文', aiProviders: [{ id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: '', models: ['deepseek-chat'] }], aiDefaults: { translateProviderId: 'deepseek', translateModel: 'deepseek-chat', quizProviderId: 'deepseek', quizModel: 'deepseek-chat', quizCount: 4, quizDifficulty: '通用' }, examColors: { enabled: true, colors: {} }, ...patch }),
      uploadBackground: async () => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文', aiProviders: [{ id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: '', models: ['deepseek-chat'] }], aiDefaults: { translateProviderId: 'deepseek', translateModel: 'deepseek-chat', quizProviderId: 'deepseek', quizModel: 'deepseek-chat', quizCount: 4, quizDifficulty: '通用' }, examColors: { enabled: true, colors: {} } }),
      clearBackground: async () => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文', aiProviders: [{ id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: '', models: ['deepseek-chat'] }], aiDefaults: { translateProviderId: 'deepseek', translateModel: 'deepseek-chat', quizProviderId: 'deepseek', quizModel: 'deepseek-chat', quizCount: 4, quizDifficulty: '通用' }, examColors: { enabled: true, colors: {} } }),
      uploadFont: async () => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文', aiProviders: [{ id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: '', models: ['deepseek-chat'] }], aiDefaults: { translateProviderId: 'deepseek', translateModel: 'deepseek-chat', quizProviderId: 'deepseek', quizModel: 'deepseek-chat', quizCount: 4, quizDifficulty: '通用' }, examColors: { enabled: true, colors: {} } }),
      clearFont: async () => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文', aiProviders: [{ id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: '', models: ['deepseek-chat'] }], aiDefaults: { translateProviderId: 'deepseek', translateModel: 'deepseek-chat', quizProviderId: 'deepseek', quizModel: 'deepseek-chat', quizCount: 4, quizDifficulty: '通用' }, examColors: { enabled: true, colors: {} } })
    },
    translate: { translate: async (t: string) => `译文:${t}` },
    ai: {
      test: async () => ({ ok: true, message: '连接成功', models: ['m1'] }),
      fetchModels: async () => ['m1'],
      chat: async () => '',
      quiz: async () => ({ title: '测试练习', questions: [] })
    },
    dictionary: {
      lookup: async () => ({ word: 'hello', translation: '你好' }),
      examples: async () => [],
      import: async () => ({ added: 1, total: 1 }),
      stats: async () => 0, examTags: async () => ({})
    },
    vocab: {
      list: async () => [],
      add: async (i) => ({ ...i, examples: [], id: 'v1', addedAt: 1, reviewState: 'new' }),
      remove: async () => undefined,
      update: async (id, patch) => ({ id, word: 'hello', examples: [], addedAt: 1, reviewState: 'new', ...patch })
    },
    upload: {
      status: async () => ({ running: false }),
      start: async () => ({ running: false }),
      stop: async () => undefined,
      onUploaded: () => () => undefined
    },
    sources: {
      list: async () => [],
      importDialog: async () => [],
      importUrl: async () => [],
      save: async () => undefined,
      remove: async () => undefined,
      export: async () => null,
      search: async () => [],
      chapters: async () => [],
      content: async () => '',
      addBook: async () => ({ meta: { id: 'x', title: 'x', author: '', format: 'source', addedAt: 1 }, bookmarks: [] })
    },
    web: { parse: async () => ({ meta: { id: 'x', title: 'x', author: '', format: 'web', addedAt: 1 }, bookmarks: [] }) },
    update: {
      check: async () => undefined,
      install: async () => undefined,
      onStatus: () => () => undefined
    },
    dialog: { openFiles: async () => [] },
    app: { quit: () => undefined }
  }
}

describe('renderLibrary', () => {
  beforeEach(() => mockReader())

  it('空书架显示提示与操作按钮', async () => {
    const container = document.createElement('div')
    await renderLibrary(container, () => undefined)
    expect(container.querySelector('.lib-empty')?.textContent).toContain('书架为空')
    expect(container.querySelectorAll('.lib-actions button').length).toBeGreaterThanOrEqual(6)
  })

  it('改名按钮弹出输入框并保存新书名', async () => {
    mockReader()
    const item: LibraryItem = { meta: { id: 'b1', title: '旧名', author: '', format: 'txt', addedAt: 1 }, bookmarks: [] }
    const renames: [string, string][] = []
    ;(window.reader.library as { list: typeof window.reader.library.list }).list = async () => [item]
    ;(window.reader.library as { rename: typeof window.reader.library.rename }).rename = async (id, title) => {
      renames.push([id, title])
      item.meta.title = title
      return item
    }
    const container = document.createElement('div')
    await renderLibrary(container, () => undefined)
    ;(container.querySelector('.book-act-rename') as HTMLButtonElement).click()
    await new Promise((r) => setTimeout(r, 0))
    const input = container.querySelector('.book-rename-input') as HTMLInputElement
    expect(input).not.toBeNull()
    input.value = '新书名'
    ;(container.querySelector('.book-rename-form [data-act="ok"]') as HTMLButtonElement).click()
    await new Promise((r) => setTimeout(r, 0))
    expect(renames).toEqual([['b1', '新书名']])
    expect(container.querySelector('.book-title')?.textContent).toBe('新书名')
  })

  it('删除按钮确认后移除书籍', async () => {
    mockReader()
    const item: LibraryItem = { meta: { id: 'b1', title: '旧名', author: '', format: 'txt', addedAt: 1 }, bookmarks: [] }
    let list = [item]
    const removed: string[] = []
    ;(window.reader.library as { list: typeof window.reader.library.list }).list = async () => list
    ;(window.reader.library as { remove: typeof window.reader.library.remove }).remove = async (id) => {
      removed.push(id)
      list = []
    }
    const container = document.createElement('div')
    await renderLibrary(container, () => undefined)
    ;(container.querySelector('.book-act-delete') as HTMLButtonElement).click()
    await new Promise((r) => setTimeout(r, 0))
    ;(document.querySelector('.confirm-modal [data-act="ok"]') as HTMLButtonElement).click()
    await new Promise((r) => setTimeout(r, 0))
    expect(removed).toEqual(['b1'])
    expect(container.querySelector('.lib-empty')?.textContent).toContain('书架为空')
  })
})
