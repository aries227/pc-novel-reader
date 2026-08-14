import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { generateQuiz } from '../src/main/quiz'

let server: ReturnType<typeof createServer>
let base = ''
let lastBody: { response_format?: unknown; messages?: { content?: string }[] } = {}

const VALID_JSON = JSON.stringify({
  title: '第一章 阅读理解',
  questions: [
    { type: 'reading', question: '主人公去了哪里？', options: ['公园', '学校'], answer: '公园', explanation: '第一段提到。' },
    { type: 'choice', question: '“run” 的意思是？', options: ['跑', '吃'], answer: '跑', explanation: 'run 意为跑。' },
    { type: 'translation', question: '翻译：I love reading.', answer: '我喜欢阅读。', explanation: 'love 表示喜欢。' },
    { type: 'grammar', question: 'He ___ a student.', options: ['is', 'are'], answer: 'is', explanation: '主语是第三人称单数。' }
  ]
})

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      lastBody = JSON.parse(body)
      if (req.headers.authorization !== 'Bearer test-key') {
        res.statusCode = 401
        res.end()
        return
      }
      const url = req.url ?? ''
      if (url.includes('/fenced')) {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ choices: [{ message: { content: '```json\n' + VALID_JSON + '\n```' } }] }))
        return
      }
      if (url.includes('/invalid')) {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ choices: [{ message: { content: '这不是JSON' } }] }))
        return
      }
      if (url.includes('/nooptions')) {
        const bad = JSON.parse(VALID_JSON)
        bad.questions[1].options = undefined
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(bad) } }] }))
        return
      }
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ choices: [{ message: { content: VALID_JSON } }] }))
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const addr = server.address()
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
})
afterAll(() => server.close())

describe('generateQuiz', () => {
  it('生成并解析 4 道练习题', async () => {
    const quiz = await generateQuiz({
      apiKey: 'test-key',
      baseUrl: base,
      model: 'deepseek-chat',
      chapterTitle: '第一章',
      chapterText: '内容'
    })
    expect(quiz.title).toContain('第一章')
    expect(quiz.questions).toHaveLength(4)
    expect(quiz.questions[0].type).toBe('reading')
    expect(quiz.questions[3].options).toEqual(['is', 'are'])
    expect(lastBody.response_format).toEqual({ type: 'json_object' })
  })
  it('兼容 markdown 代码块包裹的 JSON', async () => {
    const quiz = await generateQuiz({
      apiKey: 'test-key',
      baseUrl: base + '/fenced',
      model: 'deepseek-chat',
      chapterTitle: '第一章',
      chapterText: '内容'
    })
    expect(quiz.questions).toHaveLength(4)
  })
  it('非法 JSON 给出中文错误', async () => {
    await expect(
      generateQuiz({ apiKey: 'test-key', baseUrl: base + '/invalid', model: 'm', chapterTitle: 't', chapterText: 'c' })
    ).rejects.toThrow('题目格式不正确')
  })
  it('选择题缺少选项时报错', async () => {
    await expect(
      generateQuiz({ apiKey: 'test-key', baseUrl: base + '/nooptions', model: 'm', chapterTitle: 't', chapterText: 'c' })
    ).rejects.toThrow('题目格式不正确')
  })
  it('把题量与难度写入提示词', async () => {
    await generateQuiz({
      apiKey: 'test-key',
      baseUrl: base,
      model: 'deepseek-chat',
      chapterTitle: '第一章',
      chapterText: '内容',
      count: 6,
      difficulty: '雅思'
    })
    const sys = lastBody.messages?.[0]?.content as string
    expect(sys).toContain('6 道')
    expect(sys).toContain('雅思')
  })
  it('自定义提示词生效', async () => {
    await generateQuiz({
      apiKey: 'test-key',
      baseUrl: base,
      model: 'deepseek-chat',
      chapterTitle: '第一章',
      chapterText: '内容',
      customPrompt: '只出翻译题，不要选择题'
    })
    const sys = lastBody.messages?.[0]?.content as string
    expect(sys).toContain('只出翻译题')
  })
  it('考研难度写入难度要求', async () => {
    await generateQuiz({
      apiKey: 'test-key',
      baseUrl: base,
      model: 'deepseek-chat',
      chapterTitle: '第一章',
      chapterText: '内容',
      difficulty: '考研'
    })
    const sys = lastBody.messages?.[0]?.content as string
    expect(sys).toContain('考研英语')
    expect(sys).toContain('严格匹配该难度')
  })
})
