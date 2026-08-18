export interface HttpOptions {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
}

export async function httpText(url: string, opts: HttpOptions = {}): Promise<string> {
  const { Capacitor } = await import('@capacitor/core')
  if (Capacitor.isNativePlatform()) {
    const { CapacitorHttp } = await import('@capacitor/core')
    const res = await CapacitorHttp.request({
      url,
      method: opts.method ?? 'GET',
      headers: opts.headers ?? {},
      data: opts.method === 'POST' ? opts.body : undefined
    })
    if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`)
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
  }
  const res = await fetch(url, { method: opts.method ?? 'GET', headers: opts.headers ?? {}, body: opts.method === 'POST' ? opts.body : undefined })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}
