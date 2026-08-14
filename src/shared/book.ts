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

export type HighlightColor = 'yellow' | 'green' | 'pink' | 'blue'

export interface Highlight {
  id: string
  bookId: string
  chapterIndex: number
  text: string
  color: HighlightColor
  createdAt: number
}

export interface LibraryItem { meta: BookMeta; progress?: Progress; bookmarks: Bookmark[]; highlights?: Highlight[] }

export interface AiProvider {
  id: string
  name: string
  baseUrl: string
  apiKey?: string
  models: string[]
}

export interface AiDefaults {
  translateProviderId: string
  translateModel: string
  quizProviderId: string
  quizModel: string
  quizCount: number
  quizDifficulty: string
  customQuizPrompt?: string
}

export interface ExamColorSettings {
  enabled: boolean
  colors: Record<string, string>
}

export interface Settings {
  theme: 'light' | 'sepia' | 'dark' | 'green' | 'sunset' | 'ocean' | 'forest' | 'paper'
  fontSize: number
  lineHeight: number
  fontFamily: string
  customFont?: string
  backgroundImage?: string
  backgroundOpacity: number
  mode: 'paged' | 'vertical' | 'scroll' | 'hscroll'
  uploadPortMode: 'random' | 'fixed'
  uploadPort?: number
  maxUploadMb: number
  sourceCacheLimit: number
  translateApiKey?: string
  translateBaseUrl: string
  translateModel: string
  translateTarget: string
  aiProviders: AiProvider[]
  aiDefaults: AiDefaults
  examColors: ExamColorSettings
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
  translateTarget: '英文',
  aiProviders: [
    { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', apiKey: '', models: ['deepseek-chat'] }
  ],
  aiDefaults: {
    translateProviderId: 'deepseek',
    translateModel: 'deepseek-chat',
    quizProviderId: 'deepseek',
    quizModel: 'deepseek-chat',
    quizCount: 4,
    quizDifficulty: '通用'
  },
  examColors: {
    enabled: true,
    colors: {
      zk: '#2e7d32',
      gk: '#1565c0',
      cet4: '#6a1b9a',
      cet6: '#f9a825',
      ky: '#ef6c00',
      ielts: '#00838f',
      toefl: '#c2185b',
      gre: '#b71c1c'
    }
  }
}

export function ensureAiSettings(s: Settings): Settings {
  const providers = s.aiProviders?.length ? [...s.aiProviders] : []
  if (providers.length === 0) {
    providers.push({
      id: s.translateApiKey ? 'legacy' : 'deepseek',
      name: 'DeepSeek',
      baseUrl: s.translateBaseUrl || 'https://api.deepseek.com',
      apiKey: s.translateApiKey ?? '',
      models: [s.translateModel || 'deepseek-chat']
    })
  } else if (s.translateApiKey && !providers.some((p) => p.apiKey === s.translateApiKey)) {
    const first = { ...providers[0], apiKey: s.translateApiKey, baseUrl: s.translateBaseUrl || providers[0].baseUrl }
    if (s.translateModel && !first.models.includes(s.translateModel)) first.models = [s.translateModel, ...first.models]
    providers[0] = first
  }
  const def: AiDefaults = {
    translateProviderId: s.aiDefaults?.translateProviderId ?? '',
    translateModel: s.aiDefaults?.translateModel ?? '',
    quizProviderId: s.aiDefaults?.quizProviderId ?? '',
    quizModel: s.aiDefaults?.quizModel ?? '',
    quizCount: s.aiDefaults?.quizCount ?? 4,
    quizDifficulty: s.aiDefaults?.quizDifficulty ?? '通用',
    customQuizPrompt: s.aiDefaults?.customQuizPrompt
  }
  const first = providers[0]
  const pick = (id: string, model: string): { id: string; model: string } => {
    const ok = providers.some((p) => p.id === id)
    return { id: ok ? id : first.id, model: model || first.models[0] || '' }
  }
  const t = pick(def.translateProviderId, def.translateModel)
  const q = pick(def.quizProviderId, def.quizModel)
  return {
    ...s,
    aiProviders: providers,
    aiDefaults: {
      ...def,
      translateProviderId: t.id,
      translateModel: t.model,
      quizProviderId: q.id,
      quizModel: q.model
    }
  }
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
