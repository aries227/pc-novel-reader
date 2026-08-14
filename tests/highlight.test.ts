// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { Highlight } from '../src/shared/book'
import { applyHighlights } from '../src/renderer/reader/highlight'

function h(partial: Partial<Highlight>): Highlight {
  return { id: 'h1', bookId: 'b1', chapterIndex: 0, text: 'world', color: 'yellow', createdAt: 1, ...partial }
}

describe('applyHighlights', () => {
  it('把高亮文字包裹为 mark', () => {
    const out = applyHighlights('<p>Hello world foo</p>', [h({})])
    expect(out).toContain('hl-yellow')
    expect(out).toContain('>world</mark>')
    expect(out).toContain('Hello')
  })
  it('支持多种颜色与多个高亮', () => {
    const out = applyHighlights('<p>foo bar baz</p>', [
      h({ id: 'a', text: 'foo', color: 'green' }),
      h({ id: 'b', text: 'baz', color: 'pink' })
    ])
    expect(out).toContain('hl-green')
    expect(out).toContain('hl-pink')
  })
  it('找不到文本时不修改原内容', () => {
    const html = '<p>abc</p>'
    expect(applyHighlights(html, [h({ text: 'zzz' })])).toBe(html)
  })
})
