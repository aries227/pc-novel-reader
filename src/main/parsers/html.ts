import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import type { BookMeta, Chapter } from '../../shared/book'

export async function parseHtmlFile(
  path: string
): Promise<{ meta: Omit<BookMeta, 'id' | 'addedAt' | 'path'>; chapters: Chapter[] }> {
  let raw = await readFile(path, 'utf8')
  raw = raw.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
  const title = raw.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || basename(path)
  raw = raw.replace(/<head[\s\S]*?<\/head>/i, '')
  const parts = raw.split(/(?=<h[1-3][^>]*>)/i)
  const chapters: Chapter[] = []
  for (const part of parts) {
    const m = part.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)
    const visible = part.replace(/<[^>]+>/g, '').trim()
    if (!m && !visible) continue
    const chapterTitle = m ? m[1].replace(/<[^>]+>/g, '').trim() : `第 ${chapters.length + 1} 节`
    chapters.push({ id: `html-${chapters.length}`, title: chapterTitle, html: part })
  }
  return { meta: { title, author: '', format: 'html' }, chapters }
}
