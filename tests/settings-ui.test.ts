// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { ReaderApi } from '../src/shared/ipc'
import { openSettingsModal } from '../src/renderer/components/settings'

function mockReader(): void {
  ;(window as unknown as { reader: ReaderApi }).reader = {
    library: {
      list: async () => [],
      addFiles: async () => [],
      addFolder: async () => [],
      remove: async () => undefined,
      clear: async () => undefined,
      import: async () => undefined,
      export: async () => null
    },
    book: {
      open: async () => null,
      saveProgress: async () => undefined,
      listBookmarks: async () => [],
      addBookmark: async (b) => ({ ...b, id: 'x', createdAt: 1 }),
      removeBookmark: async () => undefined
    },
    settings: {
      get: async () => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文', aiProviders: [{ id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: '', models: ['deepseek-chat'] }], aiDefaults: { translateProviderId: 'deepseek', translateModel: 'deepseek-chat', quizProviderId: 'deepseek', quizModel: 'deepseek-chat' } }),
      set: async (patch) => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文', aiProviders: [{ id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: '', models: ['deepseek-chat'] }], aiDefaults: { translateProviderId: 'deepseek', translateModel: 'deepseek-chat', quizProviderId: 'deepseek', quizModel: 'deepseek-chat' }, ...patch }),
      uploadBackground: async () => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文', aiProviders: [{ id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: '', models: ['deepseek-chat'] }], aiDefaults: { translateProviderId: 'deepseek', translateModel: 'deepseek-chat', quizProviderId: 'deepseek', quizModel: 'deepseek-chat' } }),
      clearBackground: async () => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文', aiProviders: [{ id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: '', models: ['deepseek-chat'] }], aiDefaults: { translateProviderId: 'deepseek', translateModel: 'deepseek-chat', quizProviderId: 'deepseek', quizModel: 'deepseek-chat' } }),
      uploadFont: async () => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文', aiProviders: [{ id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: '', models: ['deepseek-chat'] }], aiDefaults: { translateProviderId: 'deepseek', translateModel: 'deepseek-chat', quizProviderId: 'deepseek', quizModel: 'deepseek-chat' } }),
      clearFont: async () => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文', aiProviders: [{ id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: '', models: ['deepseek-chat'] }], aiDefaults: { translateProviderId: 'deepseek', translateModel: 'deepseek-chat', quizProviderId: 'deepseek', quizModel: 'deepseek-chat' } })
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
      examples: async () => []
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

describe('openSettingsModal', () => {
  it('渲染当前设置并可切换主题', async () => {
    mockReader()
    const container = document.createElement('div')
    await openSettingsModal(container)
    const theme = container.querySelector('[data-set="theme"]') as HTMLSelectElement
    expect(theme.value).toBe('sepia')
    theme.value = 'dark'
    theme.dispatchEvent(new Event('change'))
    await new Promise((r) => setTimeout(r, 0))
    expect(document.body.dataset.theme).toBe('dark')
    container.querySelector('[data-act="close"]')?.dispatchEvent(new Event('click'))
    expect(container.querySelector('.modal')).toBeNull()
  })

  it('可新增并保存 AI 供应商', async () => {
    mockReader()
    const patches: unknown[] = []
    const orig = window.reader.settings.set
    ;(window.reader.settings as { set: typeof orig }).set = async (patch) => {
      patches.push(patch)
      return orig(patch)
    }
    const container = document.createElement('div')
    await openSettingsModal(container)
    ;(container.querySelector('[data-act="add-provider"]') as HTMLButtonElement).click()
    await new Promise((r) => setTimeout(r, 0))
    const cards = container.querySelectorAll('.ai-provider')
    expect(cards.length).toBe(2)
    const card = cards[1] as HTMLElement
    ;(card.querySelector('[data-provider-input="name"]') as HTMLInputElement).value = 'OpenAI'
    ;(card.querySelector('[data-provider-input="baseUrl"]') as HTMLInputElement).value = 'https://api.openai.com/v1'
    ;(card.querySelector('[data-provider-input="apiKey"]') as HTMLInputElement).value = 'sk-test'
    ;(card.querySelector('[data-provider-input="models"]') as HTMLInputElement).value = 'gpt-4o-mini, gpt-4o'
    ;(card.querySelector('[data-provider-input="apiKey"]') as HTMLInputElement).dispatchEvent(new Event('change'))
    await new Promise((r) => setTimeout(r, 0))
    const savePatch = [...patches].reverse().find((p) => (p as { aiProviders?: unknown[] }).aiProviders)
    const providers = (savePatch as { aiProviders: { name: string; apiKey: string; models: string[] }[] }).aiProviders
    expect(providers).toHaveLength(2)
    expect(providers[1].name).toBe('OpenAI')
    expect(providers[1].apiKey).toBe('sk-test')
    expect(providers[1].models).toEqual(['gpt-4o-mini', 'gpt-4o'])
  })

  it('测试连接会调用 ai.test 并显示结果', async () => {
    mockReader()
    let tested: unknown = null
    ;(window.reader.ai as { test: typeof window.reader.ai.test }).test = async (p) => {
      tested = p
      return { ok: true, message: '连接成功', models: ['m1'] }
    }
    const container = document.createElement('div')
    await openSettingsModal(container)
    ;(container.querySelector('[data-provider-act="test"]') as HTMLButtonElement).click()
    await new Promise((r) => setTimeout(r, 0))
    expect(tested).toMatchObject({ id: 'deepseek' })
    expect((container.querySelector('.ai-provider-status') as HTMLElement).textContent).toContain('连接成功')
  })
})
