import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { translateText } from '../src/main/translate'

let server: ReturnType<typeof createServer>
let base = ''

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      if (req.method !== 'POST' || req.url !== '/chat/completions') {
        res.statusCode = 404
        res.end()
        return
      }
      if (req.headers.authorization !== 'Bearer test-key') {
        res.statusCode = 401
        res.end()
        return
      }
      const j = JSON.parse(body)
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ choices: [{ message: { content: `译文:${j.messages[1].content}` } }] }))
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const addr = server.address()
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
})
afterAll(() => server.close())

describe('translateText', () => {
  it('调用 DeepSeek 兼容接口并返回译文', async () => {
    const out = await translateText({
      text: '你好世界',
      target: '英文',
      apiKey: 'test-key',
      baseUrl: base,
      model: 'deepseek-chat'
    })
    expect(out).toBe('译文:你好世界')
  })
  it('API Key 无效时给出中文错误', async () => {
    await expect(translateText({ text: 'x', target: '英文', apiKey: 'bad', baseUrl: base })).rejects.toThrow('API Key')
  })
  it('未配置 Key 时直接提示', async () => {
    await expect(translateText({ text: 'x', target: '英文', apiKey: '' })).rejects.toThrow('API Key')
  })
})
