import { describe, expect, it } from 'vitest'
import { normalizeSource } from '../src/main/sources/validate'

const valid = {
  name: '示例书源',
  baseUrl: 'https://example.com',
  search: { url: 'https://example.com/s?q={{keyword}}', list: 'css:li', title: 'css:.t', bookUrl: 'css:a@href' }
}

describe('normalizeSource', () => {
  it('合法书源通过并补默认字段', () => {
    const { source, errors } = normalizeSource(valid)
    expect(errors).toEqual([])
    expect(source.enabled).toBe(true)
    expect(source.version).toBe(1)
    expect(source.id).toBeTruthy()
  })
  it('缺 baseUrl 报错', () => {
    expect(normalizeSource({ name: 'x' }).errors.some((e) => e.includes('baseUrl'))).toBe(true)
  })
  it('非法规则语法报错', () => {
    const { errors } = normalizeSource({ ...valid, search: { ...valid.search, list: 'xpath://div' } })
    expect(errors.some((e) => e.includes('list'))).toBe(true)
  })
  it('协议白名单校验', () => {
    const { errors } = normalizeSource({ ...valid, baseUrl: 'file:///etc/passwd' })
    expect(errors.some((e) => e.includes('http'))).toBe(true)
  })
})
