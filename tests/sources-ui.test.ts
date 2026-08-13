// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { ReaderApi } from '../src/shared/ipc'
import type { BookSource } from '../src/shared/source'
import { openSourcesModal } from '../src/renderer/components/sources'

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
    settings: { get: async () => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50 }), set: async () => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50 }) },
    upload: {
      status: async () => ({ running: false }),
      start: async () => ({ running: false }),
      stop: async () => undefined,
      onUploaded: () => () => undefined
    },
    sources: {
      list: async () => [{
        id: 's1', name: '示例书源', version: 1, baseUrl: 'https://example.com', enabled: true
      } as BookSource],
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

describe('openSourcesModal', () => {
  it('列出书源并展开搜索区', async () => {
    mockReader()
    const container = document.createElement('div')
    await openSourcesModal(container)
    expect(container.querySelectorAll('.source-row').length).toBe(1)
    expect(container.querySelector('.source-row span')?.textContent).toContain('示例书源')
    const searchBtn = container.querySelector('[data-search="s1"]') as HTMLButtonElement
    searchBtn.click()
    expect(container.querySelector('.source-search')?.classList.contains('hidden')).toBe(false)
    container.querySelector('[data-act="close"]')?.dispatchEvent(new Event('click'))
    expect(container.querySelector('.modal')).toBeNull()
  })
})
