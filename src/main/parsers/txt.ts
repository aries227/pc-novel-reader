import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import iconv from 'iconv-lite'
import jschardet from 'jschardet'
import type { BookMeta, Chapter } from '../../shared/book'

const CHAPTER_RE = /^第\s*[0-9零一二三四五六七八九十百千两]+\s*[章回卷集部节篇].*$/
const HEADER_RE = /^(楔子|序章|引子|尾声|番外|后记|前言|简介).*$/
const FALLBACK_CHUNK_SIZE = 3000

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function readTextFile(path: string): Promise<string> {
  const buf = await readFile(path)
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.toString('utf8').replace(/^\uFEFF/, '')
  }
  const detected = jschardet.detect(buf.subarray(0, 64 * 1024))
  const enc = (detected?.encoding ?? 'UTF-8').toLowerCase()
  if (iconv.encodingExists(enc)) {
    const decoded = iconv.decode(buf, enc)
    if (!decoded.includes('\uFFFD')) return decoded
  }
  const utf8 = buf.toString('utf8')
  return utf8.includes('\uFFFD') ? iconv.decode(buf, 'gbk') : utf8
}

export function splitChapters(text: string): { title: string; body: string[] }[] {
  const lines = text.split(/\r?\n/)
  const chapters: { title: string; body: string[] }[] = []
  let hasHeader = false
  let current: { title: string; body: string[] } | null = null
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (CHAPTER_RE.test(line) || HEADER_RE.test(line)) {
      hasHeader = true
      if (current) chapters.push(current)
      current = { title: line, body: [] }
    } else {
      if (!current) current = { title: '正文', body: [] }
      current.body.push(raw)
    }
  }
  if (current) chapters.push(current)
  if (hasHeader) return chapters

  const paragraphs = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const slices: string[] = []
  for (const p of paragraphs) {
    for (let i = 0; i < p.length; i += FALLBACK_CHUNK_SIZE) {
      slices.push(p.slice(i, i + FALLBACK_CHUNK_SIZE))
    }
  }
  if (slices.length > 1 && slices[slices.length - 1].length < FALLBACK_CHUNK_SIZE / 2) {
    slices[slices.length - 2] += slices.pop()!
  }
  return slices.map((s, i) => ({ title: `第 ${i + 1} 节`, body: [s] }))
}

export async function parseTxt(
  path: string
): Promise<{ meta: Omit<BookMeta, 'id' | 'addedAt' | 'path'>; chapters: Chapter[] }> {
  const text = await readTextFile(path)
  const parts = splitChapters(text)
  const chapters: Chapter[] = parts.map((p, i) => ({
    id: `txt-${i}`,
    title: p.title,
    html:
      `<h2>${escapeHtml(p.title)}</h2>` +
      p.body.map((para) => `<p>${escapeHtml(para.trim())}</p>`).join('')
  }))
  return { meta: { title: basename(path), author: '', format: 'txt' }, chapters }
}
