export const EXAM_TAG_LABELS: Record<string, string> = {
  zk: '中考',
  gk: '高考',
  cet4: '四级',
  cet6: '六级',
  ky: '考研',
  toefl: '托福',
  ielts: '雅思',
  gre: 'GRE'
}

export function applyExamColors(html: string, tags: Record<string, string>, colors?: Record<string, string>): string {
  const entries = Object.keys(tags)
  if (!entries.length) return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text)
  for (const node of textNodes) {
    const parent = node.parentElement
    if (parent?.closest('mark, [class*="lvl-"]')) continue
    const value = node.nodeValue ?? ''
    const parts: (string | HTMLElement)[] = []
    let last = 0
    const re = /[A-Za-z][A-Za-z'-]*/g
    let m: RegExpExecArray | null
    while ((m = re.exec(value))) {
      const tag = tags[m[0].toLowerCase()]
      if (!tag) continue
      if (m.index > last) parts.push(value.slice(last, m.index))
      const span = document.createElement('span')
      span.className = `lvl-${tag}`
      const custom = colors?.[tag]
      if (custom) span.style.background = `color-mix(in srgb, ${custom} 45%, transparent)`
      span.title = EXAM_TAG_LABELS[tag] ?? tag
      span.textContent = m[0]
      parts.push(span)
      last = m.index + m[0].length
    }
    if (!parts.length) continue
    if (last < value.length) parts.push(value.slice(last))
    const parentEl = node.parentNode
    if (!parentEl) continue
    for (const part of parts) {
      parentEl.insertBefore(typeof part === 'string' ? document.createTextNode(part) : part, node)
    }
    parentEl.removeChild(node)
  }
  return doc.body.innerHTML
}
