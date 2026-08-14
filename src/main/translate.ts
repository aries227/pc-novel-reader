import { chatCompletion } from './ai'

export interface TranslateOptions {
  text: string
  target: string
  apiKey: string
  baseUrl?: string
  model?: string
}

export async function translateText(opts: TranslateOptions): Promise<string> {
  if (!opts.apiKey.trim()) throw new Error('请先在设置中填写 API Key')
  return chatCompletion({
    baseUrl: opts.baseUrl ?? 'https://api.deepseek.com',
    apiKey: opts.apiKey,
    model: opts.model ?? 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: `你是一位专业的小说翻译。请把用户提供的内容翻译成${opts.target}。只输出译文，不要解释，不要重复原文。`
      },
      { role: 'user', content: opts.text }
    ],
    temperature: 0.3
  })
}
