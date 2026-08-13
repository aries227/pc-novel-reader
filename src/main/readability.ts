import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import { fetchHtml } from './network'

export async function parseWebPage(url: string): Promise<{ title: string; html: string }> {
  const html = await fetchHtml({ url, charset: 'auto' })
  const dom = new JSDOM(html, { url })
  const article = new Readability(dom.window.document).parse()
  if (!article || !article.textContent?.trim()) {
    throw new Error('页面没有可提取的正文')
  }
  return { title: article.title || url, html: article.content ?? '' }
}
