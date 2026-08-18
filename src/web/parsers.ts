import iconv from 'iconv-lite'
import mammoth from 'mammoth/mammoth.browser'
import { Readability } from '@mozilla/readability'
import { initEpubFile } from '@lingo-reader/epub-parser'
import { initFb2File } from '@lingo-reader/fb2-parser'
import { initKf8File, initMobiFile } from '@lingo-reader/mobi-parser'
import type { BookMeta, Chapter } from '../shared/book'

export interface ParsedBook {
  meta: Omit<BookMeta, 'id' | 'addedAt' | 'path'>
  chapters: Chapter[]
}

function decodeBytes(buf: Uint8Array): string {
  const utf8 = iconv.decode(buf as unknown as Buffer, 'utf8')
  if (!utf8.includes('\uFFFD')) return utf8
  try {
    const gbk = iconv.decode(buf as unknown as Buffer, 'gbk')
    if (!gbk.includes('\uFFFD')) return gbk
  } catch {
    // ignore
  }
  return utf8
}

export async function parseTxtWeb(blob: Blob, name: string): Promise<ParsedBook> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  const text = decodeBytes(buf)
  const lines = text.split(/\r?\n/)
  const chapters: Chapter[] = []
  let current: { title: string; lines: string[] } | null = null
  const push = (): void => {
    if (!current) return
    const body = current.lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')
    chapters.push({ id: `c${chapters.length}`, title: current.title, html: `<h2>${escapeHtml(current.title)}</h2>${body}` })
  }
  for (const line of lines) {
    const t = line.trim()
    if (/^第[一二三四五六七八九十百千0-9]+[章节卷部].*/.test(t)) {
      push()
      current = { title: t, lines: [] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  push()
  if (chapters.length === 0) {
    chapters.push({ id: 'c0', title: name, html: `<p>${escapeHtml(text.slice(0, 200000).replace(/\r?\n/g, '<br/>'))}</p>` })
  }
  return { meta: { title: name, author: '', format: 'txt' }, chapters }
}

export async function parseHtmlWeb(blob: Blob, name: string): Promise<ParsedBook> {
  const text = decodeBytes(new Uint8Array(await blob.arrayBuffer()))
  const doc = new DOMParser().parseFromString(text, 'text/html')
  const article = new Readability(doc).parse()
  const html = article?.content ?? '<p>（无法解析正文）</p>'
  return {
    meta: { title: article?.title ?? name, author: '', format: 'html' },
    chapters: [{ id: 'c0', title: article?.title ?? name, html }]
  }
}

export async function parseDocxWeb(blob: Blob, name: string): Promise<ParsedBook> {
  const arrayBuffer = await blob.arrayBuffer()
  const result = await mammoth.convertToHtml({ arrayBuffer })
  const html = result.value || '<p>（无法解析正文）</p>'
  return {
    meta: { title: name.replace(/\.docx$/i, ''), author: '', format: 'docx' },
    chapters: [{ id: 'c0', title: name.replace(/\.docx$/i, ''), html }]
  }
}

interface ParserLike {
  getMetadata(): { title?: unknown; author?: unknown }
  getSpine(): { id: string }[]
  loadChapter(id: string): Promise<{ html: string } | undefined> | { html: string } | undefined
  getToc(): { label: string; href: string; children?: { label: string; href: string }[] }[]
  getCoverImage(): string
  resolveHref?(href: string): { id: string } | undefined
  destroy(): void
}

export async function parseEbookWeb(file: File, format: 'epub' | 'mobi' | 'azw3' | 'fb2'): Promise<ParsedBook> {
  let parser: ParserLike
  if (format === 'epub') parser = (await initEpubFile(file)) as unknown as ParserLike
  else if (format === 'mobi') parser = (await initMobiFile(file)) as unknown as ParserLike
  else if (format === 'azw3') parser = (await initKf8File(file)) as unknown as ParserLike
  else parser = (await initFb2File(file)) as unknown as ParserLike

  const spine = parser.getSpine()
  const toc = parser.getToc()
  const tocTitles = new Map<string, string>()
  const walk = (items: { label: string; href: string; children?: { label: string; href: string }[] }[]): void => {
    for (const t of items) {
      const r = parser.resolveHref?.(t.href)
      if (r) tocTitles.set(r.id, t.label)
      if (t.children) walk(t.children)
    }
  }
  walk(toc)

  const chapters: Chapter[] = []
  for (let i = 0; i < spine.length; i++) {
    const loaded = await parser.loadChapter(spine[i].id)
    chapters.push({ id: spine[i].id, title: tocTitles.get(spine[i].id) ?? `第 ${i + 1} 节`, html: loaded?.html ?? '<p>（该章节无法解析）</p>' })
  }
  const md = parser.getMetadata()
  const rawAuthor = md.author as string | string[] | { name?: string } | undefined
  const author = Array.isArray(rawAuthor)
    ? rawAuthor.filter(Boolean).join('、')
    : (typeof rawAuthor === 'object' ? rawAuthor?.name ?? '' : rawAuthor ?? '')
  const cover = parser.getCoverImage()
  parser.destroy()
  return {
    meta: { title: (md.title as string | undefined) || file.name, author, cover: cover.startsWith('data:') ? cover : undefined, format },
    chapters
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
