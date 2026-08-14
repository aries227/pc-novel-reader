import type { AiProvider, Settings } from '../shared/book'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  baseUrl: string
  apiKey: string
  model: string
  messages: ChatMessage[]
  temperature?: number
  jsonMode?: boolean
}

export function normalizeBaseUrl(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  return /\/v1$/.test(base) ? base : `${base}/v1`
}

const AUTH_ERROR = 'API Key 无效或没有权限'
const RATE_ERROR = '请求过于频繁，请稍后再试'

export async function chatCompletion(opts: ChatOptions, attempt = 0): Promise<string> {
  if (!opts.apiKey.trim()) throw new Error('请先在设置中填写 API Key')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60000)
  try {
    const res = await fetch(`${normalizeBaseUrl(opts.baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.3,
        ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {})
      }),
      signal: controller.signal
    })
    if (res.status === 401 || res.status === 403) throw new Error(AUTH_ERROR)
    if (res.status === 429) throw new Error(RATE_ERROR)
    if (!res.ok) throw new Error(`AI 接口错误：HTTP ${res.status}`)
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) throw new Error('AI 返回内容为空')
    return content
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      if (attempt === 0) return chatCompletion(opts, 1)
      throw new Error('AI 请求超时，请检查网络后重试')
    }
    if (err instanceof Error && (err.message.startsWith('API Key') || err.message.startsWith('AI ') || err.message.startsWith('请求过于频繁'))) {
      throw err
    }
    if (attempt === 0) return chatCompletion(opts, 1)
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchModels(provider: AiProvider): Promise<string[]> {
  if (!provider.apiKey?.trim()) throw new Error('请先填写 API Key')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  try {
    const res = await fetch(`${normalizeBaseUrl(provider.baseUrl)}/models`, {
      headers: { Authorization: `Bearer ${provider.apiKey}` },
      signal: controller.signal
    })
    if (res.status === 401 || res.status === 403) throw new Error(AUTH_ERROR)
    if (!res.ok) throw new Error(`AI 接口错误：HTTP ${res.status}`)
    const data = (await res.json()) as { data?: { id?: string }[] }
    return (data.data ?? []).map((m) => m.id).filter((x): x is string => Boolean(x))
  } finally {
    clearTimeout(timer)
  }
}

export async function testProvider(provider: AiProvider): Promise<{ ok: boolean; message: string; models: string[] }> {
  try {
    const models = await fetchModels(provider)
    return { ok: true, message: '连接成功', models }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : '连接失败', models: [] }
  }
}

export function resolveAiProvider(s: Settings, purpose: 'translate' | 'quiz'): { provider: AiProvider; model: string } {
  const def = s.aiDefaults
  const providerId = purpose === 'translate' ? def.translateProviderId : def.quizProviderId
  const model = purpose === 'translate' ? def.translateModel : def.quizModel
  const provider = s.aiProviders.find((p) => p.id === providerId) ?? s.aiProviders[0]
  if (!provider) throw new Error('请先在设置中配置 AI 供应商')
  return { provider, model: model || provider.models[0] || '' }
}
