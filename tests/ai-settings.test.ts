import { describe, expect, it } from 'vitest'
import type { Settings } from '../src/shared/book'
import { DEFAULT_SETTINGS, ensureAiSettings } from '../src/shared/book'

describe('ensureAiSettings', () => {
  it('旧版 translateApiKey 设置自动迁移为默认供应商', () => {
    const s = ensureAiSettings({
      ...DEFAULT_SETTINGS,
      aiProviders: [],
      aiDefaults: { translateProviderId: '', translateModel: '', quizProviderId: '', quizModel: '', quizCount: 4, quizDifficulty: '通用' },
      translateApiKey: 'sk-old',
      translateBaseUrl: 'https://api.deepseek.com',
      translateModel: 'deepseek-chat'
    })
    expect(s.aiProviders).toHaveLength(1)
    expect(s.aiProviders[0].apiKey).toBe('sk-old')
    expect(s.aiProviders[0].baseUrl).toBe('https://api.deepseek.com')
    expect(s.aiDefaults.translateProviderId).toBe(s.aiProviders[0].id)
    expect(s.aiDefaults.translateModel).toBe('deepseek-chat')
  })
  it('已有供应商时保留原配置并补全默认选择', () => {
    const s = ensureAiSettings({
      ...DEFAULT_SETTINGS,
      aiProviders: [{ id: 'a', name: 'A', baseUrl: 'https://a.example', apiKey: '', models: ['a1'] }],
      aiDefaults: { translateProviderId: '', translateModel: '', quizProviderId: '', quizModel: '', quizCount: 4, quizDifficulty: '通用' }
    })
    expect(s.aiProviders).toHaveLength(1)
    expect(s.aiProviders[0].name).toBe('A')
    expect(s.aiDefaults.translateProviderId).toBe('a')
    expect(s.aiDefaults.translateModel).toBe('a1')
  })
  it('旧版 Key 会补进已有的默认供应商', () => {
    const s = ensureAiSettings({ ...DEFAULT_SETTINGS, translateApiKey: 'sk-legacy' })
    expect(s.aiProviders[0].apiKey).toBe('sk-legacy')
  })
  it('默认设置自带 DeepSeek 供应商', () => {
    expect(DEFAULT_SETTINGS.aiProviders[0].name).toBe('DeepSeek')
    expect(DEFAULT_SETTINGS.aiProviders[0].baseUrl).toBe('https://api.deepseek.com')
    expect(DEFAULT_SETTINGS.aiDefaults.translateProviderId).toBe('deepseek')
  })
})
