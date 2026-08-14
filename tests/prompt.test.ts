// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { confirmModal, promptModal } from '../src/renderer/components/prompt'

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('promptModal', () => {
  it('点确定返回输入值', async () => {
    const p = promptModal('输入书名', '旧名')
    await tick()
    const input = document.querySelector('.prompt-input') as HTMLInputElement
    input.value = '新名'
    ;(document.querySelector('[data-act="ok"]') as HTMLButtonElement).click()
    await expect(p).resolves.toBe('新名')
    expect(document.querySelector('.prompt-modal')).toBeNull()
  })
  it('点取消返回 null', async () => {
    const p = promptModal('输入书名')
    await tick()
    ;(document.querySelector('[data-act="cancel"]') as HTMLButtonElement).click()
    await expect(p).resolves.toBeNull()
  })
  it('回车确认、Esc 取消', async () => {
    const p1 = promptModal('A')
    await tick()
    const input = document.querySelector('.prompt-input') as HTMLInputElement
    input.value = '回车值'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await expect(p1).resolves.toBe('回车值')

    const p2 = promptModal('B')
    await tick()
    ;(document.querySelector('.prompt-input') as HTMLInputElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await expect(p2).resolves.toBeNull()
  })
})

describe('confirmModal', () => {
  it('点确定返回 true', async () => {
    const p = confirmModal('删除书籍', '确定删除吗？')
    await tick()
    expect(document.querySelector('.confirm-modal')?.textContent).toContain('确定删除吗？')
    ;(document.querySelector('[data-act="ok"]') as HTMLButtonElement).click()
    await expect(p).resolves.toBe(true)
  })
  it('点取消返回 false', async () => {
    const p = confirmModal('删除书籍', '确定删除吗？')
    await tick()
    ;(document.querySelector('[data-act="cancel"]') as HTMLButtonElement).click()
    await expect(p).resolves.toBe(false)
  })
})
