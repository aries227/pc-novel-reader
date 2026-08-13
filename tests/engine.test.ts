import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { BookSource } from '../src/shared/source'
import { fetchChapterContent, fetchChapterList, searchSource } from '../src/main/sources/engine'

let server: ReturnType<typeof createServer>
let base = ''
let src: BookSource
beforeAll(async () => {
  server = createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    if (req.url?.startsWith('/search')) {
      res.end('<ul><li><a class="t" href="/b1">书一</a><span class="a">甲</span></li></ul>')
    } else if (req.url === '/b1') {
      res.end('<div class="chapters"><a href="/c1">第一章</a></div>')
    } else if (req.url === '/c1') {
      res.end('<div id="content"><p>第一章内容</p><div class="ad">广告</div></div>')
    } else {
      res.end('')
    }
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const addr = server.address()
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
  src = {
    id: 's1', name: 't', version: 1, baseUrl: base, enabled: true,
    search: { url: `${base}/search?q={{keyword}}`, list: 'css:li', title: 'css:.t@text', author: 'css:.a@text', bookUrl: 'css:.t@href' },
    chapters: { url: '{{bookUrl}}', list: 'css:.chapters a', title: 'css:@text', chapterUrl: 'css:@href' },
    content: { url: '{{chapterUrl}}', content: 'css:#content', remove: ['css:.ad'] }
  }
})
afterAll(() => server.close())

describe('source engine', () => {
  it('搜索返回结果', async () => {
    const results = await searchSource(src, '书')
    expect(results[0].title).toBe('书一')
    expect(results[0].bookUrl).toContain('/b1')
  })
  it('章节列表', async () => {
    const list = await fetchChapterList(src, `${base}/b1`)
    expect(list[0].title).toBe('第一章')
  })
  it('正文抓取并清理', async () => {
    const html = await fetchChapterContent(src, `${base}/c1`)
    expect(html).toContain('第一章内容')
    expect(html).not.toContain('广告')
  })
})
