// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import type { ReaderApi } from '../src/shared/ipc'
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
      listBookmarks: async () => [],
      addBookmark: async (b) => ({ ...b, id: 'x', createdAt: 1 }),
      removeBookmark: async () => undefined,
      listHighlights: async () => [],
      addHighlight: async (b) => ({ ...b, id: 'x', createdAt: 1 }),
      removeHighlight: async () => undefined
    },
    settings: {
      get: async () => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文', aiProviders: [{ id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: '', models: ['deepseek-chat'] }], aiDefaults: { translateProviderId: 'deepseek', translateModel: 'deepseek-chat', quizProviderId: 'deepseek', quizModel: 'deepseek-chat', quizCount: 4, quizDifficulty: '通用' } }),
      set: async (patch) => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文', aiProviders: [{ id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: '', models: ['deepseek-chat'] }], aiDefaults: { translateProviderId: 'deepseek', translateModel: 'deepseek-chat', quizProviderId: 'deepseek', quizModel: 'deepseek-chat', quizCount: 4, quizDifficulty: '通用' }, ...patch }),
      uploadBackground: async () => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文', aiProviders: [{ id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: '', models: ['deepseek-chat'] }], aiDefaults: { translateProviderId: 'deepseek', translateModel: 'deepseek-chat', quizProviderId: 'deepseek', quizModel: 'deepseek-chat', quizCount: 4, quizDifficulty: '通用' } }),
      clearBackground: async () => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文', aiProviders: [{ id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: '', models: ['deepseek-chat'] }], aiDefaults: { translateProviderId: 'deepseek', translateModel: 'deepseek-chat', quizProviderId: 'deepseek', quizModel: 'deepseek-chat', quizCount: 4, quizDifficulty: '通用' } }),
      uploadFont: async () => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文', aiProviders: [{ id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: '', models: ['deepseek-chat'] }], aiDefaults: { translateProviderId: 'deepseek', translateModel: 'deepseek-chat', quizProviderId: 'deepseek', quizModel: 'deepseek-chat', quizCount: 4, quizDifficulty: '通用' } }),
      clearFont: async () => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文', aiProviders: [{ id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: '', models: ['deepseek-chat'] }], aiDefaults: { translateProviderId: 'deepseek', translateModel: 'deepseek-chat', quizProviderId: 'deepseek', quizModel: 'deepseek-chat', quizCount: 4, quizDifficulty: '通用' } })
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
})
