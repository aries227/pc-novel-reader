// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { applyExamColors } from '../src/renderer/reader/exam-colors'

const TAGS: Record<string, string> = { college: 'cet6', hello: 'gk', abandon: 'cet4' }

describe('applyExamColors', () => {
  it('按考试等级给单词加颜色类', () => {
    const out = applyExamColors('<p>college is hard</p>', TAGS)
    expect(out).toContain('class="lvl-cet6"')
    expect(out).toContain('>college</span>')
    expect(out).not.toContain('lvl-hard')
  })
  it('大小写不敏感', () => {
    expect(applyExamColors('<p>College</p>', TAGS)).toContain('lvl-cet6')
  })
  it('不修改已高亮的文字', () => {
    const out = applyExamColors('<p><mark class="hl-yellow">college</mark></p>', TAGS)
    expect(out).not.toContain('lvl-cet6')
  })
  it('空标签表时原样返回', () => {
    const html = '<p>college</p>'
    expect(applyExamColors(html, {})).toBe(html)
  })
  it('支持自定义颜色', () => {
    const out = applyExamColors('<p>college</p>', TAGS, { cet6: '#ff0000' })
    expect(out).toContain('color-mix')
  })
})
