import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fetchHtml } from '../src/main/network'
import { parseWebPage } from '../src/main/readability'

let server: ReturnType<typeof createServer>
let base = ''

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/book') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end('<html><head><title>测试页</title></head><body><article><h1>标题</h1><p>正文内容</p></article></body></html>')
    } else {
      res.statusCode = 500
      res.end('err')
    }
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const addr = server.address()
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
})
afterAll(() => server.close())

describe('fetchHtml', () => {
  it('抓取 HTML 文本', async () => {
    const html = await fetchHtml({ url: `${base}/book` })
    expect(html).toContain('测试页')
  })
  it('非 2xx 抛错', async () => {
    await expect(fetchHtml({ url: `${base}/missing` })).rejects.toThrow()
  })
})

describe('parseWebPage', () => {
  it('提取标题与正文', async () => {
    const out = await parseWebPage(`${base}/book`)
    expect(out.title).toBe('测试页')
    expect(out.html).toContain('正文内容')
  })
})
