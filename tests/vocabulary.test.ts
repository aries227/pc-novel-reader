import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { VocabularyStore } from '../src/main/vocabulary'

let dirs: string[] = []
async function tempDir(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), 'vocab-'))
  dirs.push(d)
  return d
}
afterEach(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })))
  dirs = []
})

describe('VocabularyStore', () => {
  it('添加生词并持久化', async () => {
    const dir = await tempDir()
    const store = new VocabularyStore(dir)
    const entry = await store.add({
      word: 'serendipity',
      translation: '机缘巧合',
      phonetic: '/ˌserənˈdɪpəti/',
      examples: ['Finding this book was serendipity.'],
      contextSentence: 'It was pure serendipity.',
      sourceBook: '测试书',
      sourceChapter: '第一章'
    })
    expect(entry.id).toBeTruthy()
    expect(entry.reviewState).toBe('new')
    const reloaded = new VocabularyStore(dir)
    const list = await reloaded.list()
    expect(list).toHaveLength(1)
    expect(list[0].word).toBe('serendipity')
    expect(list[0].sourceBook).toBe('测试书')
  })
  it('重复添加同一单词不产生重复条目', async () => {
    const dir = await tempDir()
    const store = new VocabularyStore(dir)
    await store.add({ word: 'book', translation: '书' })
    const second = await store.add({ word: 'Book', translation: '书', contextSentence: 'A good book.' })
    expect(second.contextSentence).toBe('A good book.')
    expect(await store.list()).toHaveLength(1)
  })
  it('删除生词', async () => {
    const dir = await tempDir()
    const store = new VocabularyStore(dir)
    const e = await store.add({ word: 'temp', translation: '临时' })
    await store.remove(e.id)
    expect(await store.list()).toHaveLength(0)
  })
  it('更新掌握状态与笔记', async () => {
    const dir = await tempDir()
    const store = new VocabularyStore(dir)
    const e = await store.add({ word: 'hello', translation: '你好' })
    const updated = await store.update(e.id, { reviewState: 'mastered', note: '已熟记' })
    expect(updated.reviewState).toBe('mastered')
    expect(updated.note).toBe('已熟记')
  })
})
