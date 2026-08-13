import { describe, expect, it } from 'vitest'
import { rewriteResourceUrls, toReaderFileUrl } from '../src/main/protocol-utils'

describe('protocol utils', () => {
  it('本地路径转为 reader-file URL', () => {
    expect(toReaderFileUrl('C:\\books\\a.png')).toBe('reader-file:///C:/books/a.png')
  })
  it('重写 img/src 并跳过外链', () => {
    const html = '<img src="C:\\img\\1.png" /><img src="https://x.com/a.png" />'
    const out = rewriteResourceUrls(html, toReaderFileUrl)
    expect(out).toContain('reader-file:///C:/img/1.png')
    expect(out).toContain('https://x.com/a.png')
  })
})
