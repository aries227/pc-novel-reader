import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { QuizStore } from '../src/main/quiz-store'
import type { Quiz } from '../src/main/quiz'

let dirs: string[] = []
async function tempDir(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), 'quiz-'))
  dirs.push(d)
  return d
}
afterEach(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })))
  dirs = []
})

const quiz: Quiz = {
  title: '第一章练习',
  questions: [{ id: 'q1', type: 'choice', question: 'Q', options: ['A', 'B'], answer: 'A', explanation: 'E' }]
}

describe('QuizStore', () => {
  it('按书/章节/题量/难度保存并读取', async () => {
    const dir = await tempDir()
    const store = new QuizStore(dir)
    await expect(store.get('b1', 0, 4, '通用')).resolves.toBeNull()
    await store.save('b1', 0, 4, '通用', quiz)
    const loaded = await new QuizStore(dir).get('b1', 0, 4, '通用')
    expect(loaded?.title).toBe('第一章练习')
  })
  it('相同题目参数覆盖旧题卷', async () => {
    const dir = await tempDir()
    const store = new QuizStore(dir)
    await store.save('b1', 0, 4, '通用', quiz)
    const next = { ...quiz, title: '重新生成版' }
    await store.save('b1', 0, 4, '通用', next)
    expect((await store.get('b1', 0, 4, '通用'))?.title).toBe('重新生成版')
  })
})
