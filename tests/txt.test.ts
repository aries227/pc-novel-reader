import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import iconv from 'iconv-lite'
import { parseTxt, readTextFile, splitChapters } from '../src/main/parsers/txt'

let dir: string
beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), 'reader-txt-')) })
afterAll(async () => { await rm(dir, { recursive: true, force: true }) })

describe('readTextFile', () => {
  it('识别 GBK 编码', async () => {
    const p = join(dir, 'gbk.txt')
    await writeFile(p, iconv.encode('第一章 测试\n这是正文内容。', 'gbk'))
    expect(await readTextFile(p)).toContain('第一章 测试')
  })
})

describe('splitChapters', () => {
  it('按中文章节头切分', () => {
    const parts = splitChapters('第一章 开始\n内容一\n第二章 继续\n内容二\n')
    expect(parts.map((p) => p.title)).toEqual(['第一章 开始', '第二章 继续'])
  })
  it('无章节头时按 3000 字分块', () => {
    const parts = splitChapters('一'.repeat(3500) + '二'.repeat(3000))
    expect(parts.length).toBe(2)
  })
  it('忽略空行与前后空白', () => {
    const parts = splitChapters('\n\n第一章 开始\n\n正文\n\n')
    expect(parts).toHaveLength(1)
    expect(parts[0].body.join('')).toBe('正文')
  })
})

describe('parseTxt', () => {
  it('返回元数据与章节 HTML', async () => {
    const p = join(dir, 'book.txt')
    await writeFile(p, '第一章 开始\n正文段落\n', 'utf8')
    const out = await parseTxt(p)
    expect(out.meta.title).toBe('book.txt')
    expect(out.chapters[0].html).toContain('<h2>第一章 开始</h2>')
    expect(out.chapters[0].html).toContain('<p>正文段落</p>')
  })
})
