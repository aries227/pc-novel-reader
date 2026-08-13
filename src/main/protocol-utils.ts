export function toReaderFileUrl(filePath: string): string {
  return `reader-file:///${encodeURI(filePath).replace(/%2F/gi, '/').replace(/%5C/gi, '/')}`
}

export function rewriteResourceUrls(html: string, convert: (p: string) => string): string {
  return html
    .replace(/(src|href)=["']([^"']+)["']/gi, (_, attr: string, value: string) => {
      if (/^(?:https?:|data:|blob:|reader-file:|#)/i.test(value)) return `${attr}="${value}"`
      return `${attr}="${convert(value)}"`
    })
    .replace(/url\(["']?([^"')]+)["']?\)/gi, (_, value: string) => {
      if (/^(?:https?:|data:|blob:|reader-file:)/i.test(value)) return `url("${value}")`
      return `url("${convert(value)}")`
    })
}
