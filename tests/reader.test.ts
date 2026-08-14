// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import type { ReaderApi } from '../src/shared/ipc'
import { renderReader } from '../src/renderer/components/reader'
import { sanitizeHtml } from '../src/renderer/reader/sanitize'

const settings = {
  theme: 'sepia' as const,
  fontSize: 18,
  lineHeight: 1.9,
  fontFamily: 'system',
  backgroundOpacity: 0.8,
  mode: 'paged' as const,
  uploadPortMode: 'random' as const,
  maxUploadMb: 100,
  sourceCacheLimit: 50,
  translateBaseUrl: 'https://api.deepseek.com',
  translateModel: 'deepseek-chat',
  translateTarget: '英文',
  aiProviders: [{ id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: '', models: ['deepseek-chat'] }],
  aiDefaults: { translateProviderId: 'deepseek', translateModel: 'deepseek-chat', quizProviderId: 'deepseek', quizModel: 'deepseek-chat', quizCount: 4, quizDifficulty: '通用' }
}

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
      open: async () => ({
        meta: { id: 'b1', title: '测试书', author: '', format: 'txt', addedAt: 1 },
        chapters: [
          { id: 'c0', title: '第一章', html: '<h2>第一章</h2><p onclick="x()">正文</p><script>bad()</script>' },
          { id: 'c1', title: '第二章', html: '<h2>第二章</h2><p>内容二</p>' }
        ]
      }),
      saveProgress: vi.fn(async () => undefined),
      listBookmarks: async () => [],
      addBookmark: async (b) => ({ ...b, id: 'bm1', createdAt: 1 }),
      removeBookmark: async () => undefined,
      listHighlights: async () => [],
      addHighlight: async (b) => ({ ...b, id: 'x', createdAt: 1 }),
      removeHighlight: async () => undefined
    },
    settings: {
      get: async () => settings,
      set: async (patch) => ({ ...settings, ...patch }),
      uploadBackground: async () => settings,
      clearBackground: async () => settings,
      uploadFont: async () => settings,
      clearFont: async () => settings
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
      stats: async () => 0
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

describe('sanitizeHtml', () => {
  it('移除脚本与事件属性', () => {
    const out = sanitizeHtml('<script>bad()</script><p onclick="x()">ok</p>')
    expect(out).not.toContain('script')
    expect(out).not.toContain('onclick')
    expect(out).toContain('ok')
  })
})

describe('renderReader', () => {
  it('渲染章节并保存进度', async () => {
    mockReader()
    const container = document.createElement('div')
    await renderReader(container, 'b1', () => undefined)
    expect(container.querySelector('.reader-title')?.textContent).toContain('第一章')
    expect(container.querySelector('.reader-page')?.textContent).toContain('正文')
    expect(container.querySelector('.reader-page')?.querySelector('script')).toBeNull()
    expect(window.reader.book.saveProgress).toHaveBeenCalled()
  })
})
