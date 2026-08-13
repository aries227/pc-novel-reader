import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LibraryStore } from '../src/main/library'

let dir: string
beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), 'reader-src-')) })
afterAll(async () => { await rm(dir, { recursive: true, force: true }) })

describe('LibraryStore.addSourceBook', () => {
  it('写入书源书籍元数据', async () => {
    const item = await new LibraryStore(dir).addSourceBook({ sourceId: 's1', bookUrl: 'https://x.com/b', title: '在线书', author: '某作者' })
    expect(item.meta.format).toBe('source')
    expect(item.meta.sourceId).toBe('s1')
    expect((await new LibraryStore(dir).list())[0].meta.title).toBe('在线书')
  })
})
