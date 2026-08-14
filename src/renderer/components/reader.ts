import type { Settings } from '../../shared/book'
import type { PdfControls } from '../reader/pdf-view'
import { canNext, nextPage, prevPage } from '../reader/pager'
import { sanitizeHtml } from '../reader/sanitize'
import { applySettingsToBody, resolveFontFamily } from '../theme'
import { openQuizModal, openVocabModal } from './study'

export async function renderReader(container: HTMLElement, bookId: string, onBack: () => void): Promise<void> {
  const data = await window.reader.book.open(bookId)
  if (!data) return
  const { meta, chapters } = data
  let chapterIndex = 0
  let settings = await window.reader.settings.get()
  let pdf: PdfControls | null = null

  container.innerHTML = `
    <div class="reader-root">
      <header class="reader-toolbar">
        <button data-act="back">← 书架</button>
        <span class="reader-title"></span>
        <span class="reader-spacer"></span>
        <button data-act="toc">目录</button>
        <button data-act="bookmark">书签</button>
        <button data-act="vocab">生词本</button>
        <button data-act="quiz">练习</button>
        <button data-act="translate">翻译</button>
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
      <div class="translate-panel hidden">
        <div class="translate-head"><span class="translate-title">译文</span><button data-act="translate-close">×</button></div>
        <div class="translate-content"></div>
      </div>
      <div class="word-popup hidden">
        <button data-act="dict-lookup">查词</button>
        <button data-act="vocab-add">收藏</button>
      </div>
    </div>`

  const root = container.querySelector('.reader-root') as HTMLElement
  const pageEl = root.querySelector('.reader-page') as HTMLElement
  const titleEl = root.querySelector('.reader-title') as HTMLElement
  const tocEl = root.querySelector('.toc-list') as HTMLElement
  const pctEl = root.querySelector('.reader-pct') as HTMLElement
  const progressEl = root.querySelector('.reader-progress') as HTMLInputElement
  const popupEl = root.querySelector('.word-popup') as HTMLElement

  function applyTheme(s: Settings): void {
    applySettingsToBody(s)
    pageEl.style.fontSize = `${s.fontSize}px`
    pageEl.style.lineHeight = String(s.lineHeight)
    pageEl.style.fontFamily = resolveFontFamily(s.fontFamily, s.customFont)
  }

  function renderChapter(): void {
    if (chapters.length === 0) return
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
    if (chapters.length === 0) return
    await window.reader.book.addBookmark({ bookId, chapterIndex, paragraphIndex: 0, excerpt: chapters[chapterIndex].title })
  })
  root.querySelector('[data-act="vocab"]')!.addEventListener('click', () => {
    void openVocabModal(container)
  })
  root.querySelector('[data-act="quiz"]')!.addEventListener('click', () => {
    const chapter = chapters[chapterIndex]
    void openQuizModal(container, {
      bookId,
      chapterTitle: chapter?.title ?? meta.title,
      chapterText: pageEl.innerText
    })
  })
  root.querySelector('[data-act="upload"]')!.addEventListener('click', () => container.dispatchEvent(new CustomEvent('open-upload')))
  root.querySelector('[data-act="settings"]')!.addEventListener('click', () => root.querySelector('.reader-settings')!.classList.toggle('hidden'))
  root.querySelector('[data-act="translate"]')!.addEventListener('click', async () => {
    const panel = root.querySelector('.translate-panel') as HTMLElement
    const contentEl = panel.querySelector('.translate-content') as HTMLElement
    panel.classList.remove('hidden')
    contentEl.textContent = '翻译中…'
    const sel = window.getSelection()
    const anchor = sel?.anchorNode
    const selected = sel?.toString().trim() ?? ''
    const text = selected && anchor && pageEl.contains(anchor) ? selected : pageEl.innerText.slice(0, 8000)
    try {
      contentEl.textContent = await window.reader.translate.translate(text)
    } catch (err) {
      contentEl.textContent = err instanceof Error ? err.message : '翻译失败'
    }
  })
  root.querySelector('[data-act="translate-close"]')!.addEventListener('click', () => {
    root.querySelector('.translate-panel')!.classList.add('hidden')
  })

  function hideWordPopup(): void {
    popupEl.classList.add('hidden')
  }

  function showWordPopup(sel: Selection | null): void {
    hideWordPopup()
    if (!sel || sel.isCollapsed || !pageEl.contains(sel.anchorNode)) return
    const text = sel.toString().trim()
    if (!/^[A-Za-z][A-Za-z' -]{0,39}$/.test(text)) return
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    popupEl.style.left = `${Math.max(0, Math.min(rect.left, window.innerWidth - 180))}px`
    popupEl.style.top = `${rect.bottom + 6}px`
    popupEl.dataset.word = text
    popupEl.classList.remove('hidden')
  }

  function paragraphText(sel: Selection | null): string {
    if (!sel?.anchorNode) return ''
    const el = sel.anchorNode.nodeType === Node.TEXT_NODE ? sel.anchorNode.parentElement : (sel.anchorNode as Element)
    const p = el?.closest?.('p, li, h1, h2, h3, h4, blockquote, div')
    return p?.textContent?.trim() ?? ''
  }

  async function addVocab(word: string, context: string): Promise<void> {
    const entry = await window.reader.dictionary.lookup(word)
    const examples = await window.reader.dictionary.examples(word)
    await window.reader.vocab.add({
      word: entry?.word ?? word,
      translation: entry?.translation,
      phonetic: entry?.phonetic,
      examples: examples.map((x) => `${x.en}（${x.cn}）`),
      contextSentence: context,
      sourceBook: meta.title,
      sourceChapter: chapters[chapterIndex]?.title
    })
  }

  async function showDictPanel(word: string): Promise<void> {
    const panel = root.querySelector('.translate-panel') as HTMLElement
    const title = panel.querySelector('.translate-title') as HTMLElement
    const contentEl = panel.querySelector('.translate-content') as HTMLElement
    title.textContent = '词典'
    contentEl.innerHTML = '查询中…'
    panel.classList.remove('hidden')
    const entry = await window.reader.dictionary.lookup(word)
    const examples = await window.reader.dictionary.examples(word)
    if (!entry) {
      contentEl.innerHTML = `<p>未找到「${esc(word)}」的释义。</p>`
      return
    }
    const ex = examples.map((x) => `<li>${esc(x.en)}<br /><span class="dict-cn">${esc(x.cn)}</span></li>`).join('')
    contentEl.innerHTML = `
      <div class="dict-head"><strong>${esc(entry.word)}</strong>${entry.phonetic ? `<span class="vocab-phonetic">${esc(entry.phonetic)}</span>` : ''}</div>
      <p class="dict-trans">${esc(entry.translation)}</p>
      ${ex ? `<ul class="dict-examples">${ex}</ul>` : ''}
      <button data-act="dict-add" class="dict-add">加入生词本</button>`
    contentEl.querySelector('[data-act="dict-add"]')!.addEventListener('click', async () => {
      await addVocab(entry.word, paragraphText(window.getSelection()))
      const btn = contentEl.querySelector('[data-act="dict-add"]') as HTMLButtonElement
      btn.textContent = '已加入 ✓'
      btn.disabled = true
    })
  }

  pageEl.addEventListener('mouseup', () => showWordPopup(window.getSelection()))
  document.addEventListener('mousedown', (e) => {
    if (!popupEl.contains(e.target as Node)) hideWordPopup()
  })
  popupEl.querySelector('[data-act="dict-lookup"]')!.addEventListener('click', () => {
    const word = popupEl.dataset.word ?? ''
    hideWordPopup()
    void showDictPanel(word)
  })
  popupEl.querySelector('[data-act="vocab-add"]')!.addEventListener('click', async () => {
    const word = popupEl.dataset.word ?? ''
    const context = paragraphText(window.getSelection())
    hideWordPopup()
    const panel = root.querySelector('.translate-panel') as HTMLElement
    const title = panel.querySelector('.translate-title') as HTMLElement
    const contentEl = panel.querySelector('.translate-content') as HTMLElement
    try {
      await addVocab(word, context)
      title.textContent = '生词本'
      contentEl.textContent = `已加入生词本 ✓`
      panel.classList.remove('hidden')
    } catch (err) {
      title.textContent = '生词本'
      contentEl.textContent = err instanceof Error ? err.message : '收藏失败'
      panel.classList.remove('hidden')
    }
  })

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
    if (pdf) {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault(); pdf.next()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault(); pdf.prev()
      }
      return
    }
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
    if (pdf) {
      const total = Number(progressEl.max)
      const page = Math.max(1, Math.round((Number(progressEl.value) / 100) * total))
      pdf.goTo(page)
      return
    }
    chapterIndex = Math.round((Number(progressEl.value) / 100) * (chapters.length - 1))
    renderChapter()
  })

  applyTheme(settings)
  if (data.pdfUrl) {
    titleEl.textContent = meta.title
    const { renderPdf } = await import('../reader/pdf-view')
    void renderPdf(pageEl, data.pdfUrl, (page, total) => {
      pctEl.textContent = `${Math.round((page / total) * 100)}%`
      progressEl.max = String(total)
      progressEl.value = String(Math.round((page / total) * 100))
      void window.reader.book.saveProgress({ bookId, chapterIndex: 0, page, updatedAt: Date.now() })
    }).then((controls) => { pdf = controls })
  } else {
    renderChapter()
  }
}

function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
