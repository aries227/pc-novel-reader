import { randomUUID } from 'node:crypto'
import { strToU8, zipSync } from 'fflate'
import { JSDOM } from 'jsdom'
import { parseWebPage } from './readability'

export interface EpubChapter {
  title: string
  html: string
}

export function extractChapterList(html: string, baseUrl: string, limit = 100): { title: string; url: string }[] {
  const dom = new JSDOM(html)
  const base = new URL(baseUrl)
  const seen = new Set<string>()
  const out: { title: string; url: string }[] = []
  for (const a of dom.window.document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const text = (a.textContent ?? '').replace(/\s+/g, ' ').trim()
    const href = a.getAttribute('href') ?? ''
    if (text.length < 2 || text.length > 60) continue
    if (/^(javascript|mailto|#)/i.test(href)) continue
    let url: URL
    try {
      url = new URL(href, base)
    } catch {
      continue
    }
    if (url.origin !== base.origin) continue
    const key = url.href
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ title: text, url: key })
    if (out.length >= limit) break
  }
  return out
}

export function buildEpub(opts: { title: string; author?: string; chapters: EpubChapter[] }): Uint8Array {
  const files: Record<string, Uint8Array> = {
    mimetype: strToU8('application/epub+zip'),
    'META-INF/container.xml': strToU8(containerXml()),
    'OEBPS/content.opf': strToU8(opfXml(opts)),
    'OEBPS/toc.ncx': strToU8(ncxXml(opts))
  }
  opts.chapters.forEach((c, i) => {
    files[`OEBPS/chapter${i + 1}.xhtml`] = strToU8(xhtml(c.title, c.html))
  })
  return zipSync(files, { level: 0 })
}

export async function convertWebToEpub(url: string): Promise<{ title: string; chapters: EpubChapter[] }> {
  const first = await parseWebPage(url)
  const list = extractChapterList(first.html, url)
  let chapters: EpubChapter[]
  if (list.length >= 2) {
    const slice = list.slice(0, 50)
    chapters = await Promise.all(slice.map(async (c) => ({ title: c.title, html: (await parseWebPage(c.url)).html })))
  } else {
    chapters = [{ title: first.title, html: first.html }]
  }
  return { title: first.title, chapters }
}

function containerXml(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
}

function opfXml(opts: { title: string; author?: string; chapters: EpubChapter[] }): string {
  const manifest = opts.chapters
    .map((_, i) => `<item id="chapter${i + 1}" href="chapter${i + 1}.xhtml" media-type="application/xhtml+xml"/>`)
    .join('\n    ')
  const spine = opts.chapters.map((_, i) => `<itemref idref="chapter${i + 1}"/>`).join('\n    ')
  return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:${randomUUID()}</dc:identifier>
    <dc:title>${escapeXml(opts.title)}</dc:title>
    <dc:language>zh-CN</dc:language>
    ${opts.author ? `<dc:creator>${escapeXml(opts.author)}</dc:creator>` : ''}
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    ${manifest}
  </manifest>
  <spine toc="ncx">
    ${spine}
  </spine>
</package>`
}

function ncxXml(opts: { title: string; chapters: EpubChapter[] }): string {
  const points = opts.chapters
    .map(
      (c, i) =>
        `<navPoint id="nav${i + 1}" playOrder="${i + 1}"><navLabel><text>${escapeXml(c.title)}</text></navLabel><content src="chapter${i + 1}.xhtml"/></navPoint>`
    )
    .join('\n    ')
  return `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:uuid:${randomUUID()}"/></head>
  <docTitle><text>${escapeXml(opts.title)}</text></docTitle>
  <navMap>
    ${points}
  </navMap>
</ncx>`
}

function xhtml(title: string, bodyHtml: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head><title>${escapeXml(title)}</title></head>
  <body><h1>${escapeXml(title)}</h1>${bodyHtml}</body>
</html>`
}

function escapeXml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
