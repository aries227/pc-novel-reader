import { describe, expect, it } from 'vitest'
import { unzipSync } from 'fflate'
import { buildEpub, extractChapterList } from '../src/main/webtoepub'

describe('webtoepub', () => {
  it('buildEpub 生成含 mimetype 与章节的 zip', () => {
    const epub = buildEpub({
      title: '测试书',
      chapters: [
        { title: '第一章', html: '<p>内容一</p>' },
        { title: '第二章', html: '<p>内容二</p>' }
      ]
    })
    const files = unzipSync(epub)
    expect(new TextDecoder().decode(files.mimetype)).toBe('application/epub+zip')
    expect(files['OEBPS/content.opf']).toBeTruthy()
    expect(files['OEBPS/chapter1.xhtml']).toBeTruthy()
    expect(files['OEBPS/chapter2.xhtml']).toBeTruthy()
  })
  it('extractChapterList 提取同站章节链接并过滤', () => {
    const html = `<html><body>
      <a href="/c/1.html">第一章 开始</a>
      <a href="/c/2.html">第二章</a>
      <a href="javascript:void(0)">x</a>
      <a href="https://other.com/x">外链</a>
      <a href="/c/1.html">重复</a>
      <a href="/x">a</a>
    </body></html>`
    expect(extractChapterList(html, 'https://example.com/book/')).toEqual([
      { title: '第一章 开始', url: 'https://example.com/c/1.html' },
      { title: '第二章', url: 'https://example.com/c/2.html' }
    ])
  })
})
