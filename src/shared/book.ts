export type BookFormat =
  | 'txt' | 'epub' | 'mobi' | 'azw3' | 'fb2' | 'pdf' | 'html' | 'docx' | 'source' | 'web'

export interface ChapterMeta { id: string; title: string }
export interface Chapter extends ChapterMeta { html: string }

export interface BookMeta {
  id: string
  title: string
  author: string
  cover?: string
  format: BookFormat
  path?: string
  sourceId?: string
  bookUrl?: string
  addedAt: number
  lastReadAt?: number
  parseError?: string
}

export interface Progress {
  bookId: string
  chapterIndex: number
  charOffset?: number
  paragraphIndex?: number
  textHash?: string
  page?: number
  updatedAt: number
}

export interface Bookmark {
  id: string
  bookId: string
  chapterIndex: number
  paragraphIndex: number
  excerpt: string
  createdAt: number
}

export interface LibraryItem { meta: BookMeta; progress?: Progress; bookmarks: Bookmark[] }

export interface Settings {
  theme: 'light' | 'sepia' | 'dark' | 'green'
  fontSize: number
  lineHeight: number
  fontFamily: string
  customFont?: string
  backgroundImage?: string
  backgroundOpacity: number
  mode: 'paged' | 'scroll'
  uploadPortMode: 'random' | 'fixed'
  uploadPort?: number
  maxUploadMb: number
  sourceCacheLimit: number
  translateApiKey?: string
  translateBaseUrl: string
  translateModel: string
  translateTarget: string
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'sepia',
  fontSize: 18,
  lineHeight: 1.9,
  fontFamily: 'system',
  backgroundOpacity: 0.8,
  mode: 'paged',
  uploadPortMode: 'random',
  maxUploadMb: 100,
  sourceCacheLimit: 50,
  translateBaseUrl: 'https://api.deepseek.com',
  translateModel: 'deepseek-chat',
  translateTarget: '英文'
}

export const SUPPORTED_EXTENSIONS = ['txt', 'epub', 'mobi', 'azw3', 'fb2', 'pdf', 'html', 'htm', 'docx'] as const

export function formatFromPath(path: string): BookFormat | null {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'txt': return 'txt'
    case 'epub': return 'epub'
    case 'mobi': return 'mobi'
    case 'azw3': return 'azw3'
    case 'fb2': return 'fb2'
    case 'pdf': return 'pdf'
    case 'html':
    case 'htm': return 'html'
    case 'docx': return 'docx'
    default: return null
  }
}
