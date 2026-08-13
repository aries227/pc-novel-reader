import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, formatFromPath } from '../src/shared/book'

describe('shared/book', () => {
  it('识别扩展名', () => {
    expect(formatFromPath('a.txt')).toBe('txt')
    expect(formatFromPath('b.AZW3')).toBe('azw3')
    expect(formatFromPath('c.exe')).toBeNull()
  })
  it('默认设置符合全局约束', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('sepia')
    expect(DEFAULT_SETTINGS.maxUploadMb).toBe(100)
  })
})
