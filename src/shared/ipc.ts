import type { AiProvider, Bookmark, Chapter, LibraryItem, Progress, Settings } from './book'
import type { BookSource, SourceChapter, SourceSearchResult } from './source'

export interface UploadStatus {
  running: boolean
  port?: number
  url?: string
  qrDataUrl?: string
}

export interface BookOpenResult {
  meta: import('./book').BookMeta
  chapters: Chapter[]
  pdfUrl?: string
}

export interface AiChatRequest {
  providerId?: string
  model?: string
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  jsonMode?: boolean
}

export interface DictEntry {
  word: string
  translation: string
  phonetic?: string
}

export interface ExamplePair {
  en: string
  cn: string
}

export type QuizQuestionType = 'reading' | 'choice' | 'translation' | 'grammar'

export interface QuizQuestion {
  id: string
  type: QuizQuestionType
  question: string
  options?: string[]
  answer: string
  explanation: string
}

export interface Quiz {
  title: string
  questions: QuizQuestion[]
}

export type ReviewState = 'new' | 'learning' | 'mastered'

export interface VocabEntry {
  id: string
  word: string
  phonetic?: string
  translation?: string
  examples: string[]
  contextSentence?: string
  sourceBook?: string
  sourceChapter?: string
  addedAt: number
  reviewState: ReviewState
  note?: string
}

export interface ReaderApi {
  library: {
    list(): Promise<LibraryItem[]>
    addFiles(paths: string[]): Promise<LibraryItem[]>
    addFolder(): Promise<LibraryItem[]>
    remove(id: string): Promise<void>
    clear(): Promise<void>
    import(): Promise<void>
    export(): Promise<string | null>
  }
  book: {
    open(id: string): Promise<BookOpenResult | null>
    saveProgress(p: Progress): Promise<void>
    listBookmarks(id: string): Promise<Bookmark[]>
    addBookmark(b: Omit<Bookmark, 'id' | 'createdAt'>): Promise<Bookmark>
    removeBookmark(id: string): Promise<void>
  }
  settings: {
    get(): Promise<Settings>
    set(patch: Partial<Settings>): Promise<Settings>
    uploadBackground(): Promise<Settings>
    clearBackground(): Promise<Settings>
    uploadFont(): Promise<Settings>
    clearFont(): Promise<Settings>
  }
  translate: {
    translate(text: string): Promise<string>
  }
  ai: {
    test(provider: AiProvider): Promise<{ ok: boolean; message: string; models: string[] }>
    fetchModels(provider: AiProvider): Promise<string[]>
    chat(req: AiChatRequest): Promise<string>
    quiz(req: { bookId: string; chapterTitle: string; chapterText: string }): Promise<Quiz>
  }
  dictionary: {
    lookup(word: string): Promise<DictEntry | null>
    examples(word: string): Promise<ExamplePair[]>
  }
  vocab: {
    list(): Promise<VocabEntry[]>
    add(input: Omit<VocabEntry, 'id' | 'addedAt' | 'reviewState' | 'examples'> & { examples?: string[] }): Promise<VocabEntry>
    remove(id: string): Promise<void>
    update(id: string, patch: Partial<Pick<VocabEntry, 'reviewState' | 'note' | 'translation'>>): Promise<VocabEntry>
  }
  upload: {
    status(): Promise<UploadStatus>
    start(): Promise<UploadStatus>
    stop(): Promise<void>
    onUploaded(cb: (path: string) => void): () => void
  }
  sources: {
    list(): Promise<BookSource[]>
    importDialog(): Promise<BookSource[]>
    importUrl(url: string): Promise<BookSource[]>
    save(s: BookSource): Promise<void>
    remove(id: string): Promise<void>
    export(id: string): Promise<string | null>
    search(sourceId: string, keyword: string): Promise<SourceSearchResult[]>
    chapters(sourceId: string, bookUrl: string): Promise<SourceChapter[]>
    content(sourceId: string, chapterUrl: string): Promise<string>
    addBook(args: { sourceId: string; bookUrl: string; title: string; author?: string; cover?: string }): Promise<LibraryItem>
  }
  web: { parse(url: string): Promise<LibraryItem> }
  update: {
    check(): Promise<void>
    install(): Promise<void>
    onStatus(cb: (status: { phase: string; version?: string; percent?: number; message?: string }) => void): () => void
  }
  dialog: { openFiles(): Promise<string[]> }
  app: { quit(): void }
}
