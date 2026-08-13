import { randomUUID } from 'node:crypto'
import type { BookSource, SourceStep } from '../../shared/source'

const RULE_PREFIX = /^(css:|regex:)/
const HTTP_RE = /^https?:\/\//i

function checkStep(step: unknown, name: string, errors: string[]): void {
  if (!step || typeof step !== 'object') return
  const s = step as Record<string, unknown>
  if (typeof s.url !== 'string' || !s.url.includes('{{')) errors.push(`${name}.url 必须是含模板变量的字符串`)
  for (const key of ['list', 'title', 'author', 'bookUrl', 'cover', 'intro', 'chapterUrl', 'content']) {
    const v = s[key]
    if (v !== undefined && (typeof v !== 'string' || !RULE_PREFIX.test(v))) {
      errors.push(`${name}.${key} 规则必须以 css: 或 regex: 开头`)
    }
  }
}

export function normalizeSource(raw: unknown): { source: BookSource; errors: string[] } {
  const errors: string[] = []
  const r = (raw ?? {}) as Record<string, unknown>
  if (typeof r.name !== 'string' || !r.name.trim()) errors.push('name 缺失')
  if (typeof r.baseUrl !== 'string' || !HTTP_RE.test(r.baseUrl)) errors.push('baseUrl 必须是 http/https 地址')
  checkStep(r.search, 'search', errors)
  checkStep(r.detail, 'detail', errors)
  checkStep(r.chapters, 'chapters', errors)
  checkStep(r.content, 'content', errors)
  const source: BookSource = {
    id: typeof r.id === 'string' ? r.id : randomUUID(),
    name: typeof r.name === 'string' ? r.name.trim() : '未命名书源',
    version: typeof r.version === 'number' ? r.version : 1,
    baseUrl: typeof r.baseUrl === 'string' ? r.baseUrl.replace(/\/+$/, '') : '',
    enabled: r.enabled !== false,
    search: r.search as SourceStep | undefined,
    detail: r.detail as SourceStep | undefined,
    chapters: r.chapters as SourceStep | undefined,
    content: r.content as SourceStep | undefined
  }
  return { source, errors }
}
