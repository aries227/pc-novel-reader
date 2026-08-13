import { describe, expect, it } from 'vitest'
import { applyRemoveRules, createDoc, evalRule, queryRule } from '../src/main/sources/extract'
import { renderTemplate, resolveUrl } from '../src/main/sources/template'

describe('template', () => {
  it('渲染模板变量与 urlencode', () => {
    expect(renderTemplate('/s?q={{keyword}}&p={{keyword|urlencode}}', { keyword: '斗破 苍穹' }))
      .toBe('/s?q=斗破 苍穹&p=%E6%96%97%E7%A0%B4%20%E8%8B%8D%E7%A9%B9')
  })
  it('相对 URL 基于 base 拼接', () => {
    expect(resolveUrl('https://a.com/b/', 'c/d.html')).toBe('https://a.com/b/c/d.html')
  })
})

describe('extract', () => {
  const html = '<ul class="list"><li class="book"><a href="/b/1.html" class="t">书一</a><span class="a">作者甲</span></li><li class="book"><a href="/b/2.html" class="t">书二</a><span class="a">作者乙</span></li></ul><div class="ad">广告</div><div id="content"><p>正文</p><p>完</p></div>'
  it('按 css 取列表与字段', () => {
    const doc = createDoc(html)
    const items = queryRule(doc, 'css:li.book')
    expect(items).toHaveLength(2)
    expect(evalRule(items[0], 'css:.t@text')).toBe('书一')
    expect(evalRule(items[0], 'css:a@href')).toBe('/b/1.html')
  })
  it('regex 提取', () => {
    expect(evalRule(createDoc(html), 'regex:书([一二])')).toBe('一')
  })
  it('移除规则清理广告', () => {
    const doc = createDoc(html)
    applyRemoveRules(doc, ['css:.ad'])
    expect(doc.body.innerHTML).not.toContain('广告')
  })
})
