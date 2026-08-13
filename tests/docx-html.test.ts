import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { strToU8, zipSync } from 'fflate'
import { parseDocx } from '../src/main/parsers/docx'
import { parseHtmlFile } from '../src/main/parsers/html'

let dir: string
beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), 'reader-docx-')) })
afterAll(async () => { await rm(dir, { recursive: true, force: true }) })

async function makeDocx(p: string): Promise<void> {
  const files = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>第一章</w:t></w:r></w:p><w:p><w:r><w:t>正文内容</w:t></w:r></w:p></w:body></w:document>')
  }
  await writeFile(p, zipSync(files))
}

describe('parseDocx', () => {
  it('解析 docx 并按标题切章', async () => {
    const p = join(dir, 'a.docx')
    await makeDocx(p)
    const out = await parseDocx(p)
    expect(out.chapters[0].title).toContain('第一章')
    expect(out.chapters[0].html).toContain('正文内容')
  })
})

describe('parseHtmlFile', () => {
  it('解析 html 并按 h1-h3 切章', async () => {
    const p = join(dir, 'a.html')
    await writeFile(p, '<html><head><title>网页书</title></head><body><h1>第一章</h1><p>内容A</p><h2>第二节</h2><p>内容B</p></body></html>', 'utf8')
    const out = await parseHtmlFile(p)
    expect(out.meta.title).toBe('网页书')
    expect(out.chapters).toHaveLength(2)
    expect(out.chapters[1].html).toContain('内容B')
  })
})
