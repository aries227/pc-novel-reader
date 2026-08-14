import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chatCompletion, fetchModels, normalizeBaseUrl, resolveAiProvider, testProvider } from '../src/main/ai'
import type { AiProvider } from '../src/shared/book'
import { DEFAULT_SETTINGS } from '../src/shared/book'

let server: ReturnType<typeof createServer>
let base = ''

const provider: AiProvider = {
  id: 'p1',
  name: '测试供应商',
  baseUrl: 'http://127.0.0.1:0',
  apiKey: 'test-key',
  models: ['m1', 'm2']
}

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      if (req.headers.authorization !== 'Bearer test-key') {
        res.statusCode = 401
        res.end()
        return
      }
      if (req.method === 'GET' && req.url === '/v1/models') {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ data: [{ id: 'm1' }, { id: 'm2' }] }))
        return
      }
      if (req.method === 'POST' && req.url === '/v1/chat/completions') {
        const j = JSON.parse(body)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ choices: [{ message: { content: `回复:${j.model}:${j.messages[0].content}` } }] }))
        return
      }
      res.statusCode = 404
      res.end()
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const addr = server.address()
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
})
afterAll(() => server.close())

describe('normalizeBaseUrl', () => {
  it('没有 /v1 时自动补上 /v1', () => {
    expect(normalizeBaseUrl('https://api.deepseek.com')).toBe('https://api.deepseek.com/v1')
  })
  it('已带 /v1 时保持不变，并去掉结尾斜杠', () => {
    expect(normalizeBaseUrl('https://api.openai.com/v1/')).toBe('https://api.openai.com/v1')
  })
})

describe('chatCompletion', () => {
  it('携带模型与 Key 调用 OpenAI 兼容接口并返回内容', async () => {
    const out = await chatCompletion({
      baseUrl: base,
      apiKey: 'test-key',
      model: 'm1',
      messages: [{ role: 'user', content: '你好' }]
    })
    expect(out).toBe('回复:m1:你好')
  })
  it('Key 无效时给出中文错误', async () => {
    await expect(chatCompletion({ baseUrl: base, apiKey: 'bad', model: 'm1', messages: [] })).rejects.toThrow('API Key')
  })
  it('未配置 Key 时直接提示', async () => {
    await expect(chatCompletion({ baseUrl: base, apiKey: '', model: 'm1', messages: [] })).rejects.toThrow('API Key')
  })
})

describe('fetchModels', () => {
  it('从 /v1/models 拉取模型列表', async () => {
    await expect(fetchModels({ ...provider, baseUrl: base })).resolves.toEqual(['m1', 'm2'])
  })
  it('Key 错误时抛出中文错误', async () => {
    await expect(fetchModels({ ...provider, baseUrl: base, apiKey: 'bad' })).rejects.toThrow('API Key')
  })
})

describe('testProvider', () => {
  it('连接成功返回 ok 与模型列表', async () => {
    await expect(testProvider({ ...provider, baseUrl: base })).resolves.toEqual({ ok: true, message: '连接成功', models: ['m1', 'm2'] })
  })
  it('连接失败返回 ok=false 与错误信息', async () => {
    const r = await testProvider({ ...provider, baseUrl: base, apiKey: 'bad' })
    expect(r.ok).toBe(false)
    expect(r.message).toContain('API Key')
  })
})

describe('resolveAiProvider', () => {
  it('按默认供应商解析翻译模型', () => {
    const s = {
      ...DEFAULT_SETTINGS,
      aiProviders: [{ id: 'a', name: 'A', baseUrl: 'https://a.example', apiKey: 'k', models: ['a1'] }],
      aiDefaults: { translateProviderId: 'a', translateModel: 'a1', quizProviderId: 'a', quizModel: 'a1', quizCount: 4, quizDifficulty: '通用' }
    }
    const r = resolveAiProvider(s, 'translate')
    expect(r.provider.id).toBe('a')
    expect(r.model).toBe('a1')
  })
  it('默认供应商不存在时回退到第一个供应商', () => {
    const s = {
      ...DEFAULT_SETTINGS,
      aiProviders: [{ id: 'a', name: 'A', baseUrl: 'https://a.example', apiKey: 'k', models: ['a1'] }],
      aiDefaults: { translateProviderId: 'missing', translateModel: '', quizProviderId: 'missing', quizModel: '', quizCount: 4, quizDifficulty: '通用' }
    }
    expect(resolveAiProvider(s, 'translate').provider.id).toBe('a')
  })
  it('没有任何供应商时抛出中文错误', () => {
    const s = { ...DEFAULT_SETTINGS, aiProviders: [], aiDefaults: { translateProviderId: '', translateModel: '', quizProviderId: '', quizModel: '', quizCount: 4, quizDifficulty: '通用' } }
    expect(() => resolveAiProvider(s, 'translate')).toThrow('AI 供应商')
  })
})
