import type { Highlight } from '../../shared/book'

export function applyHighlights(html: string, highlights: Highlight[]): string {
  if (!highlights.length) return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const item of highlights) {
    const nodes = doc.body.querySelectorAll('p, li, h1, h2, h3, h4, blockquote, div')
    for (const node of nodes) {
      if ((node.textContent ?? '').includes(item.text)) {
        wrapText(node, item.text, item.color)
        break
      }
    }
  }
  return doc.body.innerHTML
}

function wrapText(root: Node, text: string, color: Highlight['color']): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    const value = node.nodeValue ?? ''
    const idx = value.indexOf(text)
    if (idx < 0) continue
    const parent = node.parentNode
    if (!parent) return
    const before = value.slice(0, idx)
    const after = value.slice(idx + text.length)
    const mark = document.createElement('mark')
    mark.className = `hl-${color}`
    mark.dataset.highlight = '1'
    mark.textContent = text
    if (before) parent.insertBefore(document.createTextNode(before), node)
    parent.insertBefore(mark, node)
    if (after) parent.insertBefore(document.createTextNode(after), node)
    parent.removeChild(node)
    return
  }
}
