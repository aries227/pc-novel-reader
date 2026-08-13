import type { Bookmark, Chapter, LibraryItem, Progress, Settings } from './book'
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
