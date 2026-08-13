import type { Settings } from '../../shared/book'
import { canNext, nextPage, prevPage } from '../reader/pager'
import { sanitizeHtml } from '../reader/sanitize'

export async function renderReader(container: HTMLElement, bookId: string, onBack: () => void): Promise<void> {
  const data = await window.reader.book.open(bookId)
  if (!data) return
  const { meta, chapters } = data
  let chapterIndex = 0
  let settings = await window.reader.settings.get()

  container.innerHTML = `
    <div class="reader-root">
      <header class="reader-toolbar">
        <button data-act="back">← 书架</button>
        <span class="reader-title"></span>
        <span class="reader-spacer"></span>
        <button data-act="toc">目录</button>
        <button data-act="bookmark">书签</button>
        <button data-act="settings">设置</button>
        <button data-act="upload">扫码上传</button>
      </header>
      <div class="reader-body">
        <aside class="reader-toc hidden"><ul class="toc-list"></ul></aside>
        <main class="reader-main"><div class="reader-page"></div></main>
      </div>
      <footer class="reader-footer">
        <input type="range" min="0" max="100" value="0" class="reader-progress" />
        <span class="reader-pct">0%</span>
      </footer>
      <div class="reader-settings hidden">
        <label>主题 <select data-set="theme"><option value="light">白</option><option value="sepia">米黄</option><option value="dark">夜间</option></select></label>
        <label>字号 <input type="range" data-set="fontSize" min="12" max="32" step="1" /></label>
        <label>行距 <input type="range" data-set="lineHeight" min="1.2" max="2.6" step="0.1" /></label>
        <label>模式 <select data-set="mode"><option value="paged">翻页</option><option value="scroll">滚动</option></select></label>
      </div>
    </div>`

  const root = container.querySelector('.reader-root') as HTMLElement
  const pageEl = root.querySelector('.reader-page') as HTMLElement
  const titleEl = root.querySelector('.reader-title') as HTMLElement
  const tocEl = root.querySelector('.toc-list') as HTMLElement
  const pctEl = root.querySelector('.reader-pct') as HTMLElement
  const progressEl = root.querySelector('.reader-progress') as HTMLInputElement

  function applyTheme(s: Settings): void {
    document.body.dataset.theme = s.theme
    pageEl.style.fontSize = `${s.fontSize}px`
    pageEl.style.lineHeight = String(s.lineHeight)
  }

  function renderChapter(): void {
    const chapter = chapters[chapterIndex]
    titleEl.textContent = `${meta.title} · ${chapter.title}`
    pageEl.innerHTML = sanitizeHtml(chapter.html)
    pageEl.dataset.mode = settings.mode
    pageEl.scrollLeft = 0
    pctEl.textContent = `${Math.round((chapterIndex / chapters.length) * 100)}%`
    progressEl.value = String(Math.round((chapterIndex / chapters.length) * 100))
    void window.reader.book.saveProgress({ bookId, chapterIndex, updatedAt: Date.now() })
    renderToc()
  }

  function renderToc(): void {
    tocEl.innerHTML = ''
    chapters.forEach((c, i) => {
      const li = document.createElement('li')
      li.textContent = c.title
      li.className = i === chapterIndex ? 'active' : ''
      li.addEventListener('click', () => { chapterIndex = i; renderChapter() })
      tocEl.appendChild(li)
    })
  }

  root.querySelector('[data-act="back"]')!.addEventListener('click', onBack)
  root.querySelector('[data-act="toc"]')!.addEventListener('click', () => root.querySelector('.reader-toc')!.classList.toggle('hidden'))
  root.querySelector('[data-act="bookmark"]')!.addEventListener('click', async () => {
    await window.reader.book.addBookmark({ bookId, chapterIndex, paragraphIndex: 0, excerpt: chapters[chapterIndex].title })
  })
  root.querySelector('[data-act="upload"]')!.addEventListener('click', () => container.dispatchEvent(new CustomEvent('open-upload')))
  root.querySelector('[data-act="settings"]')!.addEventListener('click', () => root.querySelector('.reader-settings')!.classList.toggle('hidden'))

  const panel = root.querySelector('.reader-settings') as HTMLElement
  panel.querySelectorAll('[data-set]').forEach((el) => {
    const key = (el as HTMLElement).dataset.set as keyof Settings
    ;(el as HTMLInputElement).value = String(settings[key])
    el.addEventListener('change', async () => {
      const raw = (el as HTMLInputElement).value
      settings = await window.reader.settings.set({
        [key]: key === 'fontSize' || key === 'lineHeight' ? Number(raw) : raw
      } as Partial<Settings>)
      applyTheme(settings)
    })
  })

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') { onBack(); return }
    if (settings.mode === 'paged') {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        if (canNext(pageEl)) nextPage(pageEl)
        else if (chapterIndex < chapters.length - 1) { chapterIndex++; renderChapter() }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        if (pageEl.scrollLeft > 0) prevPage(pageEl)
        else if (chapterIndex > 0) { chapterIndex--; renderChapter() }
      }
    } else if (e.key === 'ArrowRight') {
      pageEl.scrollBy({ top: pageEl.clientHeight * 0.8 })
    }
  }
  document.addEventListener('keydown', onKey)

  progressEl.addEventListener('input', () => {
    chapterIndex = Math.round((Number(progressEl.value) / 100) * (chapters.length - 1))
    renderChapter()
  })

  applyTheme(settings)
  renderChapter()
}
