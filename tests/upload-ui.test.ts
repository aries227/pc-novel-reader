// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { ReaderApi } from '../src/shared/ipc'
import { openUploadModal } from '../src/renderer/components/upload'

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
      start: async () => ({ running: true, port: 8888, url: 'http://192.168.1.2:8888/?token=abc', qrDataUrl: 'data:image/png;base64,xxx' }),
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
    dialog: { openFiles: async () => [] },
    app: { quit: () => undefined }
  }
}

describe('openUploadModal', () => {
  it('点击启动后显示二维码与地址', async () => {
    mockReader()
    const container = document.createElement('div')
    await openUploadModal(container, () => undefined)
    const startBtn = container.querySelector('[data-act="start"]') as HTMLButtonElement
    startBtn.click()
    await new Promise((r) => setTimeout(r, 0))
    expect(container.querySelector('.upload-qr img')?.getAttribute('src')).toContain('data:image/png')
    expect(container.querySelector('.upload-url')?.textContent).toContain('http://192.168.1.2')
    container.querySelector('[data-act="close"]')?.dispatchEvent(new Event('click'))
    expect(container.querySelector('.modal')).toBeNull()
  })
})
