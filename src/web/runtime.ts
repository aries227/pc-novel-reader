import { randomUUID } from '../main/uuid-web'
import { chatCompletion } from '../main/ai'
import { generateQuiz } from '../main/quiz'
import { translateText } from '../main/translate'
import type { Bookmark, Chapter, Highlight, LibraryItem, Progress, Settings } from '../shared/book'
import { DEFAULT_SETTINGS, ensureAiSettings, formatFromPath } from '../shared/book'
import type { BookSource } from '../shared/source'
import type { AiChatRequest, DictEntry, Quiz, ReaderApi, VocabEntry } from '../shared/ipc'
import * as dict from './dictionary'
import { idbDelete, idbGet, idbSet } from './idb'
import { httpText } from './http'
import { parseDocxWeb, parseEbookWeb, parseHtmlWeb, parseTxtWeb } from './parsers'
import { buildEpub, convertWebToEpub } from './webtoepub-web'

const WEB_FLAG = '__jianyueWeb'

export function isWebPlatform(): boolean {
  return Boolean((window as unknown as Record<string, unknown>)[WEB_FLAG])
}

export async function installWebRuntime(): Promise<void> {
  ;(window as unknown as Record<string, unknown>)[WEB_FLAG] = true
  ;(window as { reader?: ReaderApi }).reader = createWebApi()
}

interface PendingFile {
  name: string
  blob: Blob
}

function createWebApi(): ReaderApi {
  const pendingImports: PendingFile[] = []
  const pdfUrls = new Map<string, string>()
  const quizListeners = new Set<(s: { message: string; percent: number; current: number; total: number }) => void>()
  const updateListeners = new Set<(s: { phase: string; version?: string; percent?: number; message?: string }) => void>()

  // ---------- settings ----------
  function loadSettings(): Settings {
    try {
      return ensureAiSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem('jianyue.settings') ?? '{}') as Partial<Settings>) })
    } catch {
      return ensureAiSettings({ ...DEFAULT_SETTINGS })
    }
  }
  async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
    const next = ensureAiSettings({ ...loadSettings(), ...patch })
    localStorage.setItem('jianyue.settings', JSON.stringify(next))
    return next
  }

  // ---------- library ----------
  async function readLibrary(): Promise<LibraryItem[]> {
    return (await idbGet<LibraryItem[]>('kv', 'library')) ?? []
  }
  async function writeLibrary(items: LibraryItem[]): Promise<void> {
    await idbSet('kv', 'library', items)
  }
  async function findItem(id: string): Promise<LibraryItem | undefined> {
    return (await readLibrary()).find((i) => i.meta.id === id)
  }
  async function updateItem(id: string, fn: (i: LibraryItem) => LibraryItem): Promise<LibraryItem> {
    const items = await readLibrary()
    const idx = items.findIndex((i) => i.meta.id === id)
    if (idx < 0) throw new Error('书籍不存在')
    items[idx] = fn(items[idx])
    await writeLibrary(items)
    return items[idx]
  }

  async function importPending(): Promise<LibraryItem[]> {
    const files = pendingImports.splice(0)
    const items = await readLibrary()
    const added: LibraryItem[] = []
    for (const f of files) {
      const format = formatFromPath(f.name)
      if (!format) continue
      const id = randomUUID()
      await idbSet('files', `file:${id}`, f.blob)
      const item: LibraryItem = { meta: { id, title: f.name, author: '', format, addedAt: Date.now() }, bookmarks: [], highlights: [] }
      items.push(item)
      added.push(item)
    }
    await writeLibrary(items)
    return added
  }

  function openFilePicker(accept: string, multiple: boolean): Promise<File[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = accept
      input.multiple = multiple
      input.style.display = 'none'
      document.body.appendChild(input)
      input.onchange = () => {
        resolve([...(input.files ?? [])])
        input.remove()
      }
      input.click()
    })
  }

  // ---------- parsers ----------
  async function openBook(id: string): Promise<{ meta: LibraryItem['meta']; chapters: Chapter[]; pdfUrl?: string } | null> {
    const item = await findItem(id)
    if (!item) return null
    const meta = { ...item.meta }
    if (item.meta.format === 'pdf') {
      const blob = toBlob(await idbGet<unknown>('files', `file:${id}`))
      if (!blob) return { meta, chapters: [] }
      const url = URL.createObjectURL(blob)
      pdfUrls.set(id, url)
      return { meta, chapters: [], pdfUrl: url }
    }
    const blob = toBlob(await idbGet<unknown>('files', `file:${id}`))
    if (!blob) return { meta, chapters: [] }
    const file = new File([blob], item.meta.title)
    let parsed
    if (item.meta.format === 'txt') parsed = await parseTxtWeb(blob, item.meta.title)
    else if (item.meta.format === 'html' || item.meta.format === 'web') parsed = await parseHtmlWeb(blob, item.meta.title)
    else if (item.meta.format === 'docx') parsed = await parseDocxWeb(blob, item.meta.title)
    else if (item.meta.format === 'epub' || item.meta.format === 'mobi' || item.meta.format === 'azw3' || item.meta.format === 'fb2') {
      parsed = await parseEbookWeb(file, item.meta.format)
    } else {
      return { meta, chapters: [] }
    }
    await updateItem(id, (i) => ({
      ...i,
      meta: { ...i.meta, title: parsed.meta.title, author: parsed.meta.author || i.meta.author, ...(parsed.meta.cover ? { cover: parsed.meta.cover } : {}) }
    }))
    return { meta: { ...meta, title: parsed.meta.title }, chapters: parsed.chapters }
  }

  // ---------- vocab ----------
  function loadVocab(): VocabEntry[] {
    try {
      const raw = JSON.parse(localStorage.getItem('jianyue.vocab') ?? '[]') as VocabEntry[]
      return Array.isArray(raw) ? raw : []
    } catch {
      return []
    }
  }
  function saveVocab(list: VocabEntry[]): void {
    localStorage.setItem('jianyue.vocab', JSON.stringify(list))
  }

  // ---------- quiz history ----------
  function loadQuizMap(): Record<string, Quiz> {
    try {
      return JSON.parse(localStorage.getItem('jianyue.quiz') ?? '{}') as Record<string, Quiz>
    } catch {
      return {}
    }
  }

  // ---------- sources ----------
  function loadSources(): BookSource[] {
    try {
      return JSON.parse(localStorage.getItem('jianyue.sources') ?? '[]') as BookSource[]
    } catch {
      return []
    }
  }
  function saveSources(list: BookSource[]): void {
    localStorage.setItem('jianyue.sources', JSON.stringify(list))
  }

  // ---------- AI helpers ----------
  async function resolveProvider(purpose: 'translate' | 'quiz'): Promise<{ baseUrl: string; apiKey: string; model: string }> {
    const s = loadSettings()
    const def = s.aiDefaults
    const id = purpose === 'translate' ? def.translateProviderId : def.quizProviderId
    const model = purpose === 'translate' ? def.translateModel : def.quizModel
    const provider = s.aiProviders.find((p) => p.id === id) ?? s.aiProviders[0]
    if (!provider) throw new Error('请先在设置中配置 AI 供应商')
    if (!provider.apiKey?.trim()) throw new Error('请先在设置中填写 API Key')
    return { baseUrl: provider.baseUrl, apiKey: provider.apiKey, model: model || provider.models[0] || '' }
  }

  async function importDictFile(file: File): Promise<{ added: number; total: number }> {
    const text = await file.text()
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'txt'
    const kind = ext === 'json' ? 'json' : ext === 'csv' ? 'csv' : 'txt'
    return dict.importUserDict(text, kind)
  }

  return {
    library: {
      list: () => readLibrary().then((l) => l.slice().sort((a, b) => (b.meta.lastReadAt ?? 0) - (a.meta.lastReadAt ?? 0))),
      addFiles: async (paths) => (paths[0] === 'web-import' ? importPending() : []),
      addFolder: async () => {
        const files = await openFilePicker('.txt,.epub,.mobi,.azw3,.fb2,.pdf,.html,.htm,.docx', true)
        pendingImports.push(...files.map((f) => ({ name: f.name, blob: f })))
        return importPending()
      },
      remove: async (id) => {
        await writeLibrary((await readLibrary()).filter((i) => i.meta.id !== id))
        await idbDelete('files', `file:${id}`)
        const url = pdfUrls.get(id)
        if (url) URL.revokeObjectURL(url)
        pdfUrls.delete(id)
      },
      rename: async (id, title) => updateItem(id, (i) => ({ ...i, meta: { ...i.meta, title: title.trim() } })),
      clear: async () => {
        await writeLibrary([])
        pdfUrls.forEach((u) => URL.revokeObjectURL(u))
        pdfUrls.clear()
      },
      import: async () => {
        const files = await openFilePicker('.json', false)
        if (!files[0]) return
        const data = JSON.parse(await files[0].text()) as LibraryItem[]
        await writeLibrary(data.filter((i) => i.meta?.id))
      },
      export: async () => {
        const blob = new Blob([JSON.stringify(await readLibrary(), null, 2)], { type: 'application/json' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `简阅书架-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        return null
      }
    },
    book: {
      open: (id) => openBook(id),
      saveProgress: async (p) => {
        await updateItem(p.bookId, (i) => ({ ...i, progress: p, meta: { ...i.meta, lastReadAt: p.updatedAt } }))
      },
      getProgress: async (id) => (await findItem(id))?.progress ?? null,
      listBookmarks: async (id) => (await findItem(id))?.bookmarks ?? [],
      addBookmark: async (b) => {
        const mark: Bookmark = { ...b, id: randomUUID(), createdAt: Date.now() }
        await updateItem(b.bookId, (i) => ({ ...i, bookmarks: [...i.bookmarks, mark] }))
        return mark
      },
      removeBookmark: async (id) => {
        await writeLibrary((await readLibrary()).map((i) => ({ ...i, bookmarks: i.bookmarks.filter((b) => b.id !== id) })))
      },
      listHighlights: async (id) => (await findItem(id))?.highlights ?? [],
      addHighlight: async (b) => {
        const mark: Highlight = { ...b, id: randomUUID(), createdAt: Date.now() }
        await updateItem(b.bookId, (i) => ({ ...i, highlights: [...(i.highlights ?? []), mark] }))
        return mark
      },
      removeHighlight: async (id) => {
        await writeLibrary((await readLibrary()).map((i) => ({ ...i, highlights: (i.highlights ?? []).filter((h) => h.id !== id) })))
      }
    },
    settings: {
      get: async () => loadSettings(),
      set: saveSettings,
      uploadBackground: async () => {
        const files = await openFilePicker('.png,.jpg,.jpeg,.webp', false)
        if (files[0]) {
          const dataUrl = await fileToDataUrl(files[0])
          return saveSettings({ backgroundImage: dataUrl })
        }
        return loadSettings()
      },
      clearBackground: async () => saveSettings({ backgroundImage: undefined }),
      uploadFont: async () => {
        const files = await openFilePicker('.ttf,.otf,.woff,.woff2', false)
        if (files[0]) {
          const dataUrl = await fileToDataUrl(files[0])
          return saveSettings({ customFont: dataUrl })
        }
        return loadSettings()
      },
      clearFont: async () => saveSettings({ customFont: undefined })
    },
    translate: {
      translate: async (text) => {
        const p = await resolveProvider('translate')
        const s = loadSettings()
        return translateText({ text, target: s.translateTarget, apiKey: p.apiKey, baseUrl: p.baseUrl, model: p.model })
      }
    },
    ai: {
      test: async (provider) => {
        try {
          const models = await chatModels(provider)
          return { ok: true, message: '连接成功', models }
        } catch (err) {
          return { ok: false, message: err instanceof Error ? err.message : '连接失败', models: [] }
        }
      },
      fetchModels: (provider) => chatModels(provider),
      chat: async (req: AiChatRequest) => {
        const s = loadSettings()
        const fallback = await resolveProvider('quiz')
        const provider = s.aiProviders.find((p) => p.id === req.providerId) ?? { baseUrl: fallback.baseUrl, apiKey: fallback.apiKey, models: [fallback.model] }
        return chatCompletion({
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey ?? '',
          model: req.model || fallback.model,
          messages: req.messages,
          jsonMode: req.jsonMode
        })
      },
      quiz: async (req) => {
        const p = await resolveProvider('quiz')
        const s = loadSettings()
        const count = req.count ?? s.aiDefaults.quizCount ?? 4
        const difficulty = req.difficulty ?? s.aiDefaults.quizDifficulty ?? '通用'
        const key = `${req.bookId}:${req.chapterIndex ?? 0}:${count}:${difficulty}`
        const map = loadQuizMap()
        if (!req.force && map[key]) return map[key]
        const quiz = await generateQuiz({
          apiKey: p.apiKey,
          baseUrl: p.baseUrl,
          model: p.model,
          chapterTitle: req.chapterTitle,
          chapterText: req.chapterText,
          count,
          difficulty,
          customPrompt: s.aiDefaults.customQuizPrompt
        })
        map[key] = quiz
        localStorage.setItem('jianyue.quiz', JSON.stringify(map))
        return quiz
      }
    },
    dictionary: {
      lookup: (word: string) => dict.lookup(word),
      examples: (word: string) => dict.examples(word),
      import: async () => {
        const files = await openFilePicker('.json,.csv,.txt', false)
        if (!files[0]) return { added: 0, total: dict.userStats() }
        return importDictFile(files[0])
      },
      stats: async () => dict.userStats(),
      examTags: () => dict.examTags()
    },
    vocab: {
      list: async () => loadVocab(),
      add: async (input) => {
        const list = loadVocab()
        const key = input.word.trim().toLowerCase()
        const existing = list.find((e) => e.word.toLowerCase() === key)
        if (existing) {
          const merged: VocabEntry = {
            ...existing,
            phonetic: existing.phonetic ?? input.phonetic,
            translation: existing.translation ?? input.translation,
            examples: existing.examples.length ? existing.examples : input.examples ?? [],
            contextSentence: existing.contextSentence ?? input.contextSentence,
            sourceBook: existing.sourceBook ?? input.sourceBook,
            sourceChapter: existing.sourceChapter ?? input.sourceChapter
          }
          list[list.indexOf(existing)] = merged
          saveVocab(list)
          return merged
        }
        const entry: VocabEntry = { id: randomUUID(), word: input.word.trim(), phonetic: input.phonetic, translation: input.translation, examples: input.examples ?? [], contextSentence: input.contextSentence, sourceBook: input.sourceBook, sourceChapter: input.sourceChapter, addedAt: Date.now(), reviewState: 'new' }
        list.push(entry)
        saveVocab(list)
        return entry
      },
      remove: async (id) => saveVocab(loadVocab().filter((e) => e.id !== id)),
      update: async (id, patch) => {
        const list = loadVocab()
        const i = list.findIndex((e) => e.id === id)
        if (i < 0) throw new Error('生词不存在')
        list[i] = { ...list[i], ...patch }
        saveVocab(list)
        return list[i]
      }
    },
    upload: {
      status: async () => ({ running: false }),
      start: async () => ({ running: false, url: '' }),
      stop: async () => undefined,
      onUploaded: () => () => undefined
    },
    sources: {
      list: async () => loadSources(),
      importDialog: async () => {
        const files = await openFilePicker('.json', false)
        if (!files[0]) return loadSources()
        const list = loadSources()
        list.push(JSON.parse(await files[0].text()) as BookSource)
        saveSources(list)
        return list
      },
      importUrl: async (url) => {
        const raw = JSON.parse(await httpText(url)) as BookSource
        const list = loadSources()
        list.push(raw)
        saveSources(list)
        return list
      },
      save: async (s) => {
        const list = loadSources()
        const i = list.findIndex((x) => x.id === s.id)
        if (i >= 0) list[i] = s
        else list.push(s)
        saveSources(list)
      },
      remove: async (id) => saveSources(loadSources().filter((s) => s.id !== id)),
      export: async () => {
        const list = loadSources()
        if (!list[0]) return null
        const blob = new Blob([JSON.stringify(list[0], null, 2)], { type: 'application/json' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${list[0].name}.json`
        a.click()
        return null
      },
      search: async () => {
        throw new Error('安卓版暂不支持书源在线搜索，请用「网页转EPUB」导入')
      },
      chapters: async () => {
        throw new Error('安卓版暂不支持书源在线阅读，请用「网页转EPUB」导入')
      },
      content: async () => {
        throw new Error('安卓版暂不支持书源在线阅读')
      },
      addBook: async (args) => {
        const items = await readLibrary()
        const meta = { id: randomUUID(), title: args.title, author: args.author ?? '', cover: args.cover, format: 'source' as const, sourceId: args.sourceId, bookUrl: args.bookUrl, addedAt: Date.now() }
        const item: LibraryItem = { meta, bookmarks: [], highlights: [] }
        items.push(item)
        await writeLibrary(items)
        return item
      }
    },
    web: {
      parse: async (url) => {
        const raw = await httpText(url)
        const doc = new DOMParser().parseFromString(raw, 'text/html')
        const { Readability } = await import('@mozilla/readability')
        const article = new Readability(doc).parse()
        if (!article?.textContent?.trim()) throw new Error('页面没有可提取的正文')
        const blob = new Blob([`<html><body>${article.content}</body></html>`], { type: 'text/html' })
        const id = randomUUID()
        await idbSet('files', `file:${id}`, blob)
        const items = await readLibrary()
        const item: LibraryItem = { meta: { id, title: article.title || url, author: '', format: 'web', addedAt: Date.now() }, bookmarks: [], highlights: [] }
        items.push(item)
        await writeLibrary(items)
        return item
      },
      toEpub: async (url) => {
        const book = await convertWebToEpub(url)
        return saveEpub(book.title, book.chapters)
      },
      toEpubBatch: async (urls) => {
        const results: LibraryItem[] = []
        const list = urls.map((u) => u.trim()).filter(Boolean)
        for (let i = 0; i < list.length; i++) {
          const s = { message: `正在转换 ${i + 1}/${list.length}`, percent: Math.round((i / list.length) * 100), current: i + 1, total: list.length }
          quizListeners.forEach((cb) => cb(s))
          const book = await convertWebToEpub(list[i])
          results.push(await saveEpub(book.title, book.chapters))
        }
        const done = { message: '全部完成', percent: 100, current: list.length, total: list.length }
        quizListeners.forEach((cb) => cb(done))
        return results
      },
      onToEpubProgress: (cb) => {
        quizListeners.add(cb)
        return () => quizListeners.delete(cb)
      }
    },
    update: {
      check: async () => updateListeners.forEach((cb) => cb({ phase: 'error', message: '安卓版请手动安装新版 APK' })),
      install: async () => undefined,
      onStatus: (cb) => {
        updateListeners.add(cb)
        return () => updateListeners.delete(cb)
      }
    },
    dialog: {
      openFiles: async () => {
        const files = await openFilePicker('.txt,.epub,.mobi,.azw3,.fb2,.pdf,.html,.htm,.docx', true)
        pendingImports.push(...files.map((f) => ({ name: f.name, blob: f })))
        return files.length ? ['web-import'] : []
      }
    },
    app: { quit: () => undefined }
  }

  async function saveEpub(title: string, chapters: { title: string; html: string }[]): Promise<LibraryItem> {
    const bytes = buildEpub({ title, chapters })
    const blob = new Blob([(bytes as Uint8Array<ArrayBuffer>).buffer], { type: 'application/epub+zip' })
    const id = randomUUID()
    await idbSet('files', `file:${id}`, blob)
    const items = await readLibrary()
    const item: LibraryItem = { meta: { id, title, author: '', format: 'epub', addedAt: Date.now() }, bookmarks: [], highlights: [] }
    items.push(item)
    await writeLibrary(items)
    return item
  }
}

async function chatModels(provider: { baseUrl: string; apiKey?: string }): Promise<string[]> {
  if (!provider.apiKey?.trim()) throw new Error('请先填写 API Key')
  const base = provider.baseUrl.trim().replace(/\/+$/, '')
  const url = /\/v1$/.test(base) ? `${base}/models` : `${base}/v1/models`
  const text = await httpText(url, { headers: { Authorization: `Bearer ${provider.apiKey}` } })
  const data = JSON.parse(text) as { data?: { id?: string }[] }
  return (data.data ?? []).map((m) => m.id).filter((x): x is string => Boolean(x))
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

function toBlob(raw: unknown): Blob {
  if (raw instanceof Blob) return raw
  if (raw instanceof ArrayBuffer) return new Blob([raw])
  if (ArrayBuffer.isView(raw)) return new Blob([raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer])
  return new Blob([String(raw)])
}
