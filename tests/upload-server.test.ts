import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createUploadServer } from '../src/main/upload-server'
import { DEFAULT_SETTINGS } from '../src/shared/book'

let dir: string
beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), 'reader-up-')) })
afterAll(async () => { await rm(dir, { recursive: true, force: true }) })

describe('upload server', () => {
  it('上传页面把 token 带到 /upload 请求', async () => {
    const mgr = createUploadServer({ inbox: join(dir, 'inbox2'), books: join(dir, 'books2') }, { ...DEFAULT_SETTINGS })
    const status = await mgr.start()
    const res = await fetch(status.url!)
    const html = await res.text()
    expect(html).toContain("fetch('/upload'+location.search")
    mgr.stop()
  })
  it('启动后可通过 token URL 上传 txt', async () => {
    const mgr = createUploadServer({ inbox: join(dir, 'inbox'), books: join(dir, 'books') }, { ...DEFAULT_SETTINGS })
    const status = await mgr.start()
    expect(status.running).toBe(true)
    expect(status.url).toContain('token=')

    let received = ''
    mgr.onUploaded((p) => { received = p })
    const form = new FormData()
    form.append('files', new Blob(['第一章\n内容'], { type: 'text/plain' }), 'test.txt')
    const base = status.url!.split('?')[0].replace(/\/$/, '')
    const tokenQuery = status.url!.split('?')[1]
    const res = await fetch(`${base}/upload?${tokenQuery}`, { method: 'POST', body: form })
    expect(res.ok).toBe(true)

    for (let i = 0; i < 50 && !received; i++) await new Promise((r) => setTimeout(r, 50))
    expect(received.endsWith('.txt')).toBe(true)
    expect(await readFile(received, 'utf8')).toContain('第一章')
    mgr.stop()
  })
})
