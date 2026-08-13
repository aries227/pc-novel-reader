import { JSDOM } from 'jsdom'

export function createDoc(html: string): Document {
  return new JSDOM(html).window.document
}

export function queryRule(el: Element | Document, rule: string): Element[] {
  if (!rule.startsWith('css:')) return []
  return [...el.querySelectorAll(rule.slice(4))]
}

export function evalRule(el: Element | Document, rule: string): string {
  if (!rule) return ''
  const isDoc = (el as Node).nodeType === 9
  if (rule.startsWith('regex:')) {
    const text = isDoc
      ? ((el as Document).documentElement?.textContent ?? '')
      : ((el as Element).textContent ?? '')
    const m = new RegExp(rule.slice(6)).exec(text)
    return m ? (m[1] ?? m[0]) : ''
  }
  if (!rule.startsWith('css:')) return ''
  const [sel, attr = 'text'] = rule.slice(4).split('@')
  const node = sel
    ? (isDoc ? (el as Document).querySelector(sel) : (el as Element).matches(sel) ? (el as Element) : (el as Element).querySelector(sel))
    : isDoc ? null : (el as Element)
  if (!node) return ''
  if (attr === 'text') return node.textContent?.trim() ?? ''
  if (attr === 'html') return node.innerHTML ?? ''
  if (attr) return node.getAttribute(attr)?.trim() ?? ''
  return node.textContent?.trim() ?? ''
}

export function applyRemoveRules(el: Element | Document, rules: string[] = []): void {
  const doc = (el as Node).nodeType === 9 ? (el as Document) : (el as Element).ownerDocument
  if (!doc) return
  const NodeFilter = doc.defaultView?.NodeFilter
  if (!NodeFilter) return
  for (const rule of rules) {
    if (rule.startsWith('css:')) {
      el.querySelectorAll(rule.slice(4)).forEach((n) => n.remove())
    } else if (rule.startsWith('regex:')) {
      const re = new RegExp(rule.slice(6), 'g')
      const root = (el as Node).nodeType === 9 ? (el as Document).body : (el as Element)
      const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      let n: Node | null
      while ((n = walker.nextNode())) {
        const t = n as Text
        if (re.test(t.data)) t.data = t.data.replace(re, '')
        re.lastIndex = 0
      }
    }
  }
}
