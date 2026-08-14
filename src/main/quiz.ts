import { chatCompletion } from './ai'

export type QuizQuestionType = 'reading' | 'choice' | 'translation' | 'grammar'

export interface QuizQuestion {
  id: string
  type: QuizQuestionType
  question: string
  options?: string[]
  answer: string
  explanation: string
}

export interface Quiz {
  title: string
  questions: QuizQuestion[]
}

export interface QuizOptions {
  apiKey: string
  baseUrl: string
  model: string
  chapterTitle: string
  chapterText: string
  count?: number
  difficulty?: string
  customPrompt?: string
}

export async function generateQuiz(opts: QuizOptions): Promise<Quiz> {
  const count = Math.min(12, Math.max(1, Math.round(opts.count ?? 4)))
  const difficulty = opts.difficulty?.trim() || '通用'
  const customPrompt = opts.customPrompt?.trim()
  const system = customPrompt
    ? `${customPrompt}\n\n必须只输出 JSON，格式：{"title":"题目标题","questions":[{"type":"reading|choice|translation|grammar","question":"题干","options":["选项A","选项B"],"answer":"正确答案","explanation":"中文解析"}]}。reading 和 choice 必须有至少 2 个选项，translation 的 answer 为参考译文。`
    : `你是一位英语学习出题老师。请根据用户提供的章节内容生成共 ${count} 道题，其中 1 道阅读理解题和 ${count - 1} 道练习题（选择题/翻译题/语法题混合），难度级别：${difficulty}，全部基于本章内容，不要凭空编造。只输出 JSON，不要输出其他文字。JSON 格式：{"title":"题目标题","questions":[{"type":"reading|choice|translation|grammar","question":"题干","options":["选项A","选项B"],"answer":"正确答案","explanation":"中文解析"}]}。reading 和 choice 必须有至少 2 个选项，translation 的 answer 为参考译文，grammar 的 answer 为答案。`
  const content = await chatCompletion({
    baseUrl: opts.baseUrl,
    apiKey: opts.apiKey,
    model: opts.model,
    temperature: 0.6,
    jsonMode: true,
    messages: [
      {
        role: 'system',
        content: system
      },
      {
        role: 'user',
        content: `章节标题：${opts.chapterTitle}\n章节内容：\n${opts.chapterText.slice(0, 6000)}`
      }
    ]
  })
  return parseQuiz(content)
}

function parseQuiz(content: string): Quiz {
  const cleaned = content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
  let raw: unknown
  try {
    raw = JSON.parse(cleaned)
  } catch {
    throw new Error('AI 返回的题目格式不正确')
  }
  const obj = raw as { title?: unknown; questions?: unknown }
  if (typeof obj.title !== 'string' || !Array.isArray(obj.questions) || obj.questions.length < 1) {
    throw new Error('AI 返回的题目格式不正确')
  }
  const questions = obj.questions.map((q, i): QuizQuestion => {
    const item = q as Record<string, unknown>
    if (typeof item.question !== 'string' || typeof item.answer !== 'string' || typeof item.explanation !== 'string') {
      throw new Error('AI 返回的题目格式不正确')
    }
    const type: QuizQuestionType =
      item.type === 'choice' || item.type === 'reading' || item.type === 'translation' || item.type === 'grammar'
        ? item.type
        : 'choice'
    if ((type === 'choice' || type === 'reading') && (!Array.isArray(item.options) || item.options.length < 2)) {
      throw new Error('AI 返回的题目格式不正确')
    }
    return {
      id: `q${i + 1}`,
      type,
      question: item.question,
      options: Array.isArray(item.options) ? item.options.map(String) : undefined,
      answer: item.answer,
      explanation: item.explanation
    }
  })
  return { title: obj.title, questions }
}
