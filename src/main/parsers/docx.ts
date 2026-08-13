import mammoth from 'mammoth'
import { basename } from 'node:path'
import type { BookMeta, Chapter } from '../../shared/book'

export async function parseDocx(
  path: string
): Promise<{ meta: Omit<BookMeta, 'id' | 'addedAt' | 'path'>; chapters: Chapter[] }> {
  const { value } = await mammoth.convertToHtml({ path })
  const parts = value.split(/(?=<h[12][^>]*>)/i)
  const chapters: Chapter[] = []
  for (const part of parts) {
    const m = part.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i)
    const title = m ? m[1].replace(/<[^>]+>/g, '').trim() : `第 ${chapters.length + 1} 节`
    chapters.push({ id: `docx-${chapters.length}`, title, html: part })
  }
  if (chapters.length === 0) {
    chapters.push({ id: 'docx-0', title: basename(path), html: value || '<p>（空文档）</p>' })
  }
  return { meta: { title: basename(path), author: '', format: 'docx' }, chapters }
}
