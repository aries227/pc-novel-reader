import iconv from 'iconv-lite'
import jschardet from 'jschardet'
import type { SourceRequest } from '../shared/source'

export class NetworkError extends Error {
  constructor(message: string, readonly kind: 'network' | 'http' | 'parse') {
    super(message)
  }
}

export async function fetchHtml(req: SourceRequest, attempt = 0): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(req.url, {
      method: req.method ?? 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ...(req.headers ?? {}) },
      body: req.method === 'POST' ? req.body : undefined,
      signal: controller.signal
    })
    if (!res.ok) throw new NetworkError(`HTTP ${res.status}`, 'http')
    const buf = Buffer.from(await res.arrayBuffer())
    if (req.charset === 'gbk') return iconv.decode(buf, 'gbk')
    if (req.charset === 'utf-8') return buf.toString('utf8')
    const detected = jschardet.detect(buf.subarray(0, 64 * 1024))?.encoding?.toLowerCase() ?? ''
    if (detected && iconv.encodingExists(detected)) {
      const decoded = iconv.decode(buf, detected)
      if (!decoded.includes('\uFFFD')) return decoded
    }
    const utf8 = buf.toString('utf8')
    return utf8.includes('\uFFFD') ? iconv.decode(buf, 'gbk') : utf8
  } catch (err) {
    if (attempt === 0 && !(err instanceof NetworkError)) return fetchHtml(req, 1)
    if (err instanceof NetworkError) throw err
    throw new NetworkError(err instanceof Error ? err.message : '网络请求失败', 'network')
  } finally {
    clearTimeout(timer)
  }
}
