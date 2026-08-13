export interface TranslateOptions {
  text: string
  target: string
  apiKey: string
  baseUrl?: string
  model?: string
}

export async function translateText(opts: TranslateOptions, attempt = 0): Promise<string> {
  if (!opts.apiKey.trim()) throw new Error('请先在设置中填写 DeepSeek API Key')
  const base = (opts.baseUrl ?? 'https://api.deepseek.com').replace(/\/+$/, '')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60000)
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify({
        model: opts.model ?? 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `你是一位专业的小说翻译。请把用户提供的内容翻译成${opts.target}。只输出译文，不要解释，不要重复原文。`
          },
          { role: 'user', content: opts.text }
        ],
        temperature: 0.3
      }),
      signal: controller.signal
    })
    if (res.status === 401 || res.status === 403) throw new Error('DeepSeek API Key 无效或没有权限')
    if (res.status === 429) throw new Error('DeepSeek 请求过于频繁，请稍后再试')
    if (!res.ok) throw new Error(`DeepSeek 接口错误：HTTP ${res.status}`)
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) throw new Error('DeepSeek 返回内容为空')
    return content
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      if (attempt === 0) return translateText(opts, 1)
      throw new Error('DeepSeek 请求超时，请检查网络后重试')
    }
    if (err instanceof Error && err.message.startsWith('DeepSeek')) throw err
    if (attempt === 0) return translateText(opts, 1)
    throw err
  } finally {
    clearTimeout(timer)
  }
}
