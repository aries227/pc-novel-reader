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
      get: async () => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文' }),
      set: async (patch) => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文', ...patch }),
      uploadBackground: async () => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文' }),
      clearBackground: async () => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文' }),
      uploadFont: async () => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文' }),
      clearFont: async () => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文' })
    },
    translate: { translate: async (t: string) => `译文:${t}` },
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
})
