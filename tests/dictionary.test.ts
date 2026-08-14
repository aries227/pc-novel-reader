import { describe, expect, it } from 'vitest'
import { createDictionary } from '../src/main/dictionary'

const FIXTURE = 'tests/fixtures/dict-fixture'

describe('createDictionary', () => {
  it('查词返回词条与音标', async () => {
    const dict = await createDictionary(FIXTURE)
    const r = await dict.lookup('hello')
    expect(r?.word).toBe('hello')
    expect(r?.translation).toContain('你好')
    expect(r?.phonetic).toBe('həˈloʊ')
  })
  it('大小写不敏感', async () => {
    const dict = await createDictionary(FIXTURE)
    await expect(dict.lookup('Hello')).resolves.toMatchObject({ word: 'hello' })
  })
  it('词形变化映射到原形', async () => {
    const dict = await createDictionary(FIXTURE)
    const r = await dict.lookup('ran')
    expect(r?.word).toBe('run')
    expect(r?.translation).toContain('跑')
  })
  it('未命中时尝试后缀还原', async () => {
    const dict = await createDictionary(FIXTURE)
    const r = await dict.lookup('runnings')
    expect(r?.word).toBe('run')
  })
  it('不存在的词返回 null', async () => {
    const dict = await createDictionary(FIXTURE)
    await expect(dict.lookup('zzzqqq')).resolves.toBeNull()
  })
  it('查询时忽略周围标点', async () => {
    const dict = await createDictionary(FIXTURE)
    await expect(dict.lookup('hello,')).resolves.toMatchObject({ word: 'hello' })
  })
  it('返回中英例句', async () => {
    const dict = await createDictionary(FIXTURE)
    const ex = await dict.examples('run')
    expect(ex).toHaveLength(2)
    expect(ex[0].cn).toContain('跑步')
    await expect(dict.examples('zzz')).resolves.toEqual([])
  })
})
