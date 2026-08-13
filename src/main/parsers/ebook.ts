import { initEpubFile } from '@lingo-reader/epub-parser'
import { initFb2File } from '@lingo-reader/fb2-parser'
import { initKf8File, initMobiFile } from '@lingo-reader/mobi-parser'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import type { BookMeta, Chapter } from '../../shared/book'

interface ParserLike {
  getMetadata(): { title?: unknown; author?: unknown }
  getSpine(): { id: string }[]
  loadChapter(id: string): Promise<{ html: string; css?: { href: string }[] } | undefined> | { html: string; css?: { href: string }[] } | undefined
  getToc(): { label: string; href: string; children?: { label: string; href: string }[] }[]
  getCoverImage(): string
  resolveHref?(href: string): { id: string } | undefined
  destroy(): void
}

async function coverToDataUrl(p: string): Promise<string | undefined> {
  if (!p) return undefined
  try {
    const buf = await readFile(p)
    if (buf.length > 2 * 1024 * 1024) return undefined
    const ext = p.split('.').pop()?.toLowerCase() ?? 'png'
    return `data:image/${ext};base64,${buf.toString('base64')}`
  } catch {
    return undefined
  }
}

export async function parseEbook(
  path: string,
  format: 'epub' | 'mobi' | 'azw3' | 'fb2'
): Promise<{ meta: Omit<BookMeta, 'id' | 'addedAt' | 'path'>; chapters: Chapter[] }> {
  const dir = await mkdtemp(join(tmpdir(), 'reader-ebook-'))
  try {
    let parser: ParserLike
    if (format === 'epub') parser = (await initEpubFile(path, dir)) as unknown as ParserLike
    else if (format === 'mobi') parser = (await initMobiFile(path, dir)) as unknown as ParserLike
    else if (format === 'azw3') parser = (await initKf8File(path, dir)) as unknown as ParserLike
    else parser = (await initFb2File(path, dir)) as unknown as ParserLike

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
      const item = spine[i]
      const loaded = await parser.loadChapter(item.id)
      chapters.push({
        id: item.id,
        title: tocTitles.get(item.id) ?? `第 ${i + 1} 节`,
        html: loaded?.html ?? '<p>（该章节无法解析）</p>'
      })
    }

    const md = parser.getMetadata()
    const rawAuthor = md.author as string | string[] | { name?: string } | undefined
    const author = Array.isArray(rawAuthor)
      ? rawAuthor.filter(Boolean).join('、')
      : (typeof rawAuthor === 'object' ? rawAuthor?.name ?? '' : rawAuthor ?? '')
    const cover = await coverToDataUrl(parser.getCoverImage())
    parser.destroy()
    return {
      meta: { title: (md.title as string | undefined) || basename(path), author, cover, format },
      chapters
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
