// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { ReaderApi } from '../src/shared/ipc'
import { openQuizModal, openVocabModal } from '../src/renderer/components/study'

function baseMock(): ReaderApi {
  return {
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
      get: async () => ({ theme: 'sepia', fontSize: 18, lineHeight: 1.9, fontFamily: 'system', backgroundOpacity: 0.8, mode: 'paged', uploadPortMode: 'random', maxUploadMb: 100, sourceCacheLimit: 50, translateBaseUrl: 'https://api.deepseek.com', translateModel: 'deepseek-chat', translateTarget: '英文', aiProviders: [{ id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: '', models: ['deepseek-chat'] }], aiDefaults: { translateProviderId: 'deepseek', translateModel: 'deepseek-chat', quizProviderId: 'deepseek', quizModel: 'deepseek-chat', quizCount: 4, quizDifficulty: '通用' }, examColors: { enabled: true, colors: {}, enabledTags: {} }, shortcuts: { next: 'ArrowRight,PageDown,space', prev: 'ArrowLeft,PageUp', back: 'Escape' } }),
      set: async (patch) => ({ ...(await baseMock().settings.get()), ...patch }),
      uploadBackground: async () => baseMock().settings.get(),
      clearBackground: async () => baseMock().settings.get(),
      uploadFont: async () => baseMock().settings.get(),
      clearFont: async () => baseMock().settings.get()
    },
    translate: { translate: async (t) => `译文:${t}` },
    ai: {
      test: async () => ({ ok: true, message: '连接成功', models: [] }),
      fetchModels: async () => [],
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
    web: { parse: async () => ({ meta: { id: 'x', title: 'x', author: '', format: 'web', addedAt: 1 }, bookmarks: [] }), toEpub: async () => ({ meta: { id: 'x', title: 'x', author: '', format: 'epub', addedAt: 1 }, bookmarks: [] }) },
    update: {
      check: async () => undefined,
      install: async () => undefined,
      onStatus: () => () => undefined
    },
    dialog: { openFiles: async () => [] },
    app: { quit: () => undefined }
  }
}

function install(reader: ReaderApi): void {
  ;(window as unknown as { reader: ReaderApi }).reader = reader
}

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('openVocabModal', () => {
  it('渲染生词并可更新掌握状态与删除', async () => {
    const mock = baseMock()
    let list = [
      { id: 'v1', word: 'hello', phonetic: 'həˈloʊ', translation: '你好', examples: ['Say hello.'], contextSentence: 'Hello world.', sourceBook: '测试书', sourceChapter: '第一章', addedAt: 1, reviewState: 'new' as const }
    ]
    const updates: unknown[] = []
    mock.vocab.list = async () => list
    mock.vocab.update = async (id, patch) => { updates.push(patch); return { ...list[0], ...patch } }
    mock.vocab.remove = async (id) => { list = []; expect(id).toBe('v1') }
    install(mock)

    const container = document.createElement('div')
    await openVocabModal(container)
    expect(container.querySelectorAll('.vocab-entry')).toHaveLength(1)
    expect(container.querySelector('.vocab-entry')?.textContent).toContain('hello')
    const sel = container.querySelector('[data-vocab-state]') as HTMLSelectElement
    sel.value = 'mastered'
    sel.dispatchEvent(new Event('change'))
    await tick()
    expect(updates).toEqual([{ reviewState: 'mastered' }])
    ;(container.querySelector('[data-vocab-act="delete"]') as HTMLButtonElement).click()
    await tick()
    expect(container.querySelector('.vocab-list')?.textContent).toContain('还没有生词')
  })
})

describe('openQuizModal', () => {
  it('渲染题目、提交判分并显示解析', async () => {
    const mock = baseMock()
    mock.ai.quiz = async () => ({
      title: '第一章练习',
      questions: [
        { id: 'q1', type: 'reading', question: '主人公去了哪里？', options: ['公园', '学校'], answer: '公园', explanation: '第一段提到。' },
        { id: 'q2', type: 'translation', question: '翻译：Hello.', answer: '你好。', explanation: 'hello 意为你好。' }
      ]
    })
    install(mock)
    const container = document.createElement('div')
    await openQuizModal(container, { bookId: 'b1', chapterTitle: '第一章', chapterText: '正文' })
    await tick()
    expect(container.querySelector('.quiz-body')?.textContent).toContain('主人公去了哪里')
    const radios = container.querySelectorAll<HTMLInputElement>('[data-quiz-answer]')
    radios[0].checked = true
    radios[0].dispatchEvent(new Event('change'))
    const input = container.querySelector<HTMLInputElement>('input[type="text"][data-quiz-answer]')
    expect(input).not.toBeNull()
    input!.value = '你好。'
    input!.dispatchEvent(new Event('change'))
    ;(container.querySelector('[data-act="submit"]') as HTMLButtonElement).click()
    expect(container.querySelector('.quiz-body h3')?.textContent).toContain('得分 2/2')
    expect(container.querySelectorAll('.quiz-feedback:not(.hidden)')).toHaveLength(2)
    expect(container.querySelector('.quiz-feedback')?.textContent).toContain('第一段提到')
  })

  it('重新生成会再次调用 AI', async () => {
    const mock = baseMock()
    let calls = 0
    const flags: { force?: boolean }[] = []
    mock.ai.quiz = async (req) => {
      calls++
      flags.push({ force: req.force })
      return { title: `第${calls}套`, questions: [{ id: 'q1', type: 'choice', question: 'Q', options: ['A', 'B'], answer: 'A', explanation: 'E' }] }
    }
    install(mock)
    const container = document.createElement('div')
    await openQuizModal(container, { bookId: 'b1', chapterTitle: '第一章', chapterText: '正文' })
    await tick()
    ;(container.querySelector('[data-act="regenerate"]') as HTMLButtonElement).click()
    await tick()
    expect(calls).toBe(2)
    expect(flags[0].force).toBe(false)
    expect(flags[1].force).toBe(true)
    expect(container.querySelector('.quiz-body h3')?.textContent).toContain('第2套')
  })
  it('修改题量会保存到设置', async () => {
    const mock = baseMock()
    const patches: unknown[] = []
    const orig = mock.settings.set
    mock.settings.set = async (patch) => {
      patches.push(patch)
      return orig(patch)
    }
    install(mock)
    const container = document.createElement('div')
    await openQuizModal(container, { bookId: 'b1', chapterTitle: '第一章', chapterText: '正文' })
    await tick()
    const sel = container.querySelector('[data-quiz-count]') as HTMLSelectElement
    sel.value = '8'
    sel.dispatchEvent(new Event('change'))
    await tick()
    const patch = [...patches].reverse().find((p) => (p as { aiDefaults?: unknown }).aiDefaults) as { aiDefaults: { quizCount: number } }
    expect(patch.aiDefaults.quizCount).toBe(8)
  })
})
