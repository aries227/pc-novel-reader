// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { hideLoading, showLoading, updateLoading } from '../src/renderer/components/loading'

describe('loading overlay', () => {
  it('显示与更新进度，完成后移除', () => {
    showLoading('转换中 0/2', 0)
    expect(document.querySelector('.loading-overlay')?.textContent).toContain('转换中 0/2')
    updateLoading('转换中 1/2', 50)
    expect((document.querySelector('.loading-bar-fill') as HTMLElement).style.width).toBe('50%')
    hideLoading()
    expect(document.querySelector('.loading-overlay')).toBeNull()
  })
  it('无进度时显示不确定加载条', () => {
    showLoading('正在生成练习…')
    expect(document.querySelector('.loading-bar')?.classList.contains('hidden')).toBe(true)
    hideLoading()
  })
})
