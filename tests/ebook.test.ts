import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseEbook } from '../src/main/parsers/ebook'
import { makeMinimalEpub, makeMinimalFb2 } from './fixtures/make-fixtures'

let dir: string
beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), 'reader-ebook-')) })
afterAll(async () => { await rm(dir, { recursive: true, force: true }) })

describe('parseEbook', () => {
  it('解析最小 EPUB', async () => {
    const p = await makeMinimalEpub(dir)
    const out = await parseEbook(p, 'epub')
    expect(out.meta.title).toContain('测试书')
    expect(out.chapters[0].title).toContain('第一章')
    expect(out.chapters[0].html).toContain('内容')
  })
  it('解析最小 FB2', async () => {
    const p = await makeMinimalFb2(dir)
    const out = await parseEbook(p, 'fb2')
    expect(out.chapters.length).toBeGreaterThan(0)
  })
})
