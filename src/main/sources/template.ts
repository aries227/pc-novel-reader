export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*([\w.]+?)(?:\|([\w]+))?\s*\}\}/g, (_, key: string, filter?: string) => {
    const raw = vars[key] ?? ''
    return filter === 'urlencode' ? encodeURIComponent(raw) : raw
  })
}

export function resolveUrl(base: string, value: string): string {
  if (/^https?:\/\//i.test(value)) return value
  return new URL(value, base).toString()
}
