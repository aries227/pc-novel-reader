import { describe, expect, it } from 'vitest'
import { canNextVertical, canPrevVertical, nextVerticalPage, prevVerticalPage } from '../src/renderer/reader/pager'

function fakePage(over: Partial<{ scrollTop: number; clientHeight: number; scrollHeight: number }>): HTMLElement {
  const el = {
    scrollTop: 0,
    clientHeight: 100,
    scrollHeight: 100,
    scrollBy: (o: { top?: number; left?: number }) => {
      el.scrollTop += o.top ?? 0
      el.scrollLeft = (el.scrollLeft ?? 0) + (o.left ?? 0)
    },
    scrollLeft: 0,
    ...over
  } as unknown as HTMLElement
  return el
}

describe('垂直翻页', () => {
  it('下一页按一屏高度向下滚动', () => {
    const el = fakePage({ scrollTop: 0, clientHeight: 100, scrollHeight: 500 })
    nextVerticalPage(el)
    expect(el.scrollTop).toBe(100)
  })
  it('上一页向上滚动一屏', () => {
    const el = fakePage({ scrollTop: 300, clientHeight: 100, scrollHeight: 500 })
    prevVerticalPage(el)
    expect(el.scrollTop).toBe(200)
  })
  it('还有内容时可继续下一页', () => {
    const el = fakePage({ scrollTop: 100, clientHeight: 100, scrollHeight: 500 })
    expect(canNextVertical(el)).toBe(true)
  })
  it('到底时不能下一页', () => {
    const el = fakePage({ scrollTop: 400, clientHeight: 100, scrollHeight: 500 })
    expect(canNextVertical(el)).toBe(false)
  })
  it('在顶部时不能上一页', () => {
    const el = fakePage({ scrollTop: 0, clientHeight: 100, scrollHeight: 500 })
    expect(canPrevVertical(el)).toBe(false)
  })
})
