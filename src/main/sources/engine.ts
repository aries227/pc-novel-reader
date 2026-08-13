import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { BookSource, SourceChapter, SourceSearchResult } from '../../shared/source'
import { fetchHtml } from '../network'
import { applyRemoveRules, createDoc, evalRule, queryRule } from './extract'
import { renderTemplate, resolveUrl } from './template'

function stepUrl(step: { url: string }, vars: Record<string, string>): string {
  return renderTemplate(step.url, vars)
}

export async function searchSource(src: BookSource, keyword: string): Promise<SourceSearchResult[]> {
  const step = src.search
  if (!step) throw new Error('该书源未配置搜索')
  const url = stepUrl(step, { keyword, baseUrl: src.baseUrl })
  const html = await fetchHtml({ ...step, url })
  const doc = createDoc(html)
  const items = queryRule(doc, step.list ?? 'body')
  return items.map((el) => ({
    title: evalRule(el, step.title ?? 'css:@text'),
    author: evalRule(el, step.author ?? ''),
    bookUrl: resolveUrl(src.baseUrl, evalRule(el, step.bookUrl ?? 'css:@text')),
    cover: step.cover ? resolveUrl(src.baseUrl, evalRule(el, step.cover)) : undefined,
    intro: step.intro ? evalRule(el, step.intro) : undefined
  })).filter((r) => r.title && r.bookUrl)
}

export async function fetchChapterList(src: BookSource, bookUrl: string): Promise<SourceChapter[]> {
  const step = src.chapters
  if (!step) throw new Error('该书源未配置章节列表')
  const url = stepUrl(step, { bookUrl, baseUrl: src.baseUrl })
  const html = await fetchHtml({ ...step, url })
  const doc = createDoc(html)
  const items = queryRule(doc, step.list ?? 'body')
  return items.map((el, i) => ({
    id: `src-${i}`,
    title: evalRule(el, step.title ?? 'css:@text'),
    url: resolveUrl(src.baseUrl, evalRule(el, step.chapterUrl ?? 'css:@text'))
  })).filter((c) => c.title && c.url)
}

export async function fetchChapterContent(src: BookSource, chapterUrl: string): Promise<string> {
  const step = src.content
  if (!step?.content) throw new Error('该书源未配置正文规则')
  const url = stepUrl(step, { chapterUrl, baseUrl: src.baseUrl })
  const html = await fetchHtml({ ...step, url })
  const doc = createDoc(html)
  const node = doc.querySelector(step.content.slice(4))
  if (!node) throw new Error('正文规则未匹配到内容')
  const wrapper = doc.createElement('div')
  wrapper.innerHTML = node.innerHTML
  applyRemoveRules(wrapper, step.remove)
  return wrapper.innerHTML
}

export function createCachedEngine(cacheDir: string) {
  return {
    async content(src: BookSource, chapterUrl: string): Promise<string> {
      const key = encodeURIComponent(chapterUrl)
      const file = join(cacheDir, src.id, `${key}.html`)
      try {
        return await readFile(file, 'utf8')
      } catch {
        const html = await fetchChapterContent(src, chapterUrl)
        await mkdir(join(cacheDir, src.id), { recursive: true })
        await writeFile(file, html, 'utf8')
        return html
      }
    }
  }
}
