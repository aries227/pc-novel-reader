export interface SourceRequest {
  url: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  charset?: 'utf-8' | 'gbk' | 'auto'
}

export interface SourceStep {
  url: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  charset?: 'utf-8' | 'gbk' | 'auto'
  list?: string
  title?: string
  author?: string
  bookUrl?: string
  cover?: string
  intro?: string
  chapterUrl?: string
  content?: string
  remove?: string[]
}

export interface BookSource {
  id: string
  name: string
  version: number
  baseUrl: string
  enabled: boolean
  search?: SourceStep
  detail?: SourceStep
  chapters?: SourceStep
  content?: SourceStep
}

export interface SourceSearchResult { title: string; author: string; bookUrl: string; cover?: string; intro?: string }
export interface SourceChapter { id: string; title: string; url: string }
