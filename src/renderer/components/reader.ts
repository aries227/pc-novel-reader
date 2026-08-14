import type { Highlight, Settings } from '../../shared/book'
import type { PdfControls } from '../reader/pdf-view'
import { applyHighlights } from '../reader/highlight'
import { canNext, canNextVertical, canPrevVertical, computeColumnLayout, nextPage, nextVerticalPage, prevPage, prevVerticalPage, scrollHByWheel } from '../reader/pager'
import { sanitizeHtml } from '../reader/sanitize'
import { applyExamColors } from '../reader/exam-colors'
import { applySettingsToBody, resolveFontFamily } from '../theme'
import { createQuizWidget, openVocabModal } from './study'

export async function renderReader(container: HTMLElement, bookId: string, onBack: () => void): Promise<void> {
  const data = await window.reader.book.open(bookId)
  if (!data) return
  const { meta, chapters } = data
  let chapterIndex = 0
  let settings = await window.reader.settings.get()
  let highlights: Highlight[] = await window.reader.book.listHighlights(bookId)
  const examTags = await window.reader.dictionary.examTags()
  let pdf: PdfControls | null = null

  container.innerHTML = `
    <div class="reader-root">
      <header class="reader-toolbar">
        <button data-act="back" class="tool-btn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          书架
        </button>
        <span class="reader-title"></span>
        <nav class="toolbar-actions">
          <button data-act="toc" class="tool-btn" title="章节目录">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
            目录
          </button>
          <button data-act="bookmark" class="tool-btn" title="添加书签">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
            书签
          </button>
          <button data-act="vocab" class="tool-btn" title="生词本">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
            生词
          </button>
          <button data-act="quiz" class="tool-btn" title="本章练习">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
            练习
          </button>
          <button data-act="translate" class="tool-btn" title="翻译">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
            翻译
          </button>
          <button data-act="settings" class="tool-btn" title="阅读设置">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg>
            设置
          </button>
          <button data-act="upload" class="tool-btn" title="扫码上传">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
            上传
          </button>
        </nav>
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
        <label>主题 <select data-set="theme"><option value="light">白</option><option value="sepia">米黄</option><option value="dark">夜间</option><option value="green">护眼绿</option><option value="sunset">日落</option><option value="ocean">海洋</option><option value="forest">森林</option><option value="paper">纸张</option></select></label>
        <label>字号 <input type="range" data-set="fontSize" min="12" max="32" step="1" /></label>
        <label>行距 <input type="range" data-set="lineHeight" min="1.2" max="2.6" step="0.1" /></label>
        <label>模式 <select data-set="mode"><option value="paged">左右翻页</option><option value="vertical">上下翻页</option><option value="hscroll">横向滑动</option><option value="scroll">滚动</option></select></label>
      </div>
      <div class="side-resizer" title="拖动调整宽度"></div>
      <aside class="side-panel hidden">
        <div class="side-tabs">
          <button data-tab="translate">翻译</button>
          <button data-tab="dict">词典</button>
          <button data-tab="quiz">练习</button>
          <button data-act="side-close" title="收起">×</button>
        </div>
        <div class="side-content">
          <div class="side-pane" data-pane="translate"><div class="translate-content"></div></div>
          <div class="side-pane hidden" data-pane="dict"><div class="dict-content"></div></div>
          <div class="side-pane hidden" data-pane="quiz"><div class="quiz-widget"></div></div>
        </div>
      </aside>
      <div class="word-popup hidden">
        <button data-act="dict-lookup">查词</button>
        <button data-act="vocab-add">收藏</button>
        <button data-act="hl-yellow" title="黄色高亮">黄</button>
        <button data-act="hl-green" title="绿色高亮">绿</button>
        <button data-act="hl-pink" title="粉色高亮">粉</button>
        <button data-act="hl-remove" class="hidden">取消高亮</button>
      </div>
      <div class="dict-popup hidden">
        <div class="dict-popup-head"><span>词典</span><button data-act="dict-popup-close">×</button></div>
        <div class="dict-popup-content"></div>
      </div>
    </div>`

  const root = container.querySelector('.reader-root') as HTMLElement
  const pageEl = root.querySelector('.reader-page') as HTMLElement
  const titleEl = root.querySelector('.reader-title') as HTMLElement
  const tocEl = root.querySelector('.toc-list') as HTMLElement
  const pctEl = root.querySelector('.reader-pct') as HTMLElement
  const progressEl = root.querySelector('.reader-progress') as HTMLInputElement
  const popupEl = root.querySelector('.word-popup') as HTMLElement
  const sidePanel = root.querySelector('.side-panel') as HTMLElement
  const translateContent = sidePanel.querySelector('.translate-content') as HTMLElement
  const dictContent = sidePanel.querySelector('.dict-content') as HTMLElement
  const quizPane = sidePanel.querySelector('[data-pane="quiz"] .quiz-widget') as HTMLElement
  const resizerEl = root.querySelector('.side-resizer') as HTMLElement
  const dictPopup = root.querySelector('.dict-popup') as HTMLElement
  const dictPopupContent = dictPopup.querySelector('.dict-popup-content') as HTMLElement

  const savedWidth = Number(localStorage.getItem('jian-yue-side-width'))
  sidePanel.style.width = savedWidth >= 280 && savedWidth <= 640 ? `${savedWidth}px` : '380px'

  function applyPagedLayout(): void {
    if (pdf || (settings.mode !== 'paged' && settings.mode !== 'hscroll')) {
      pageEl.style.columnWidth = ''
      pageEl.style.columnGap = ''
      return
    }
    const { columnWidth, columnGap } = computeColumnLayout(pageEl.clientWidth)
    pageEl.style.columnWidth = `${columnWidth}px`
    pageEl.style.columnGap = `${columnGap}px`
  }

  function reflowPaged(): void {
    const oldStep = (parseFloat(pageEl.style.columnWidth || '0') || 0) + (parseFloat(pageEl.style.columnGap || '0') || 0)
    const page = oldStep > 0 ? Math.max(0, Math.round(pageEl.scrollLeft / oldStep)) : 0
    applyPagedLayout()
    const w = parseFloat(pageEl.style.columnWidth || '0')
    const g = parseFloat(pageEl.style.columnGap || '0')
    const step = w > 0 ? w + g : pageEl.clientWidth
    pageEl.scrollLeft = page * step
  }

  let dragging = false
  let dragStartX = 0
  let dragStartWidth = 380
  resizerEl.addEventListener('mousedown', (e) => {
    dragging = true
    dragStartX = e.clientX
    dragStartWidth = parseFloat(sidePanel.style.width) || 380
    document.body.style.userSelect = 'none'
    e.preventDefault()
  })
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return
    const width = Math.min(640, Math.max(280, dragStartWidth + (dragStartX - e.clientX)))
    sidePanel.style.width = `${width}px`
    reflowPaged()
  })
  window.addEventListener('mouseup', () => {
    if (!dragging) return
    dragging = false
    document.body.style.userSelect = ''
    localStorage.setItem('jian-yue-side-width', String(parseFloat(sidePanel.style.width) || 380))
  })

  function showSideTab(tab: 'translate' | 'dict' | 'quiz'): void {
    sidePanel.classList.remove('hidden')
    sidePanel.querySelectorAll('.side-tabs button[data-tab]').forEach((b) => b.classList.toggle('active', (b as HTMLElement).dataset.tab === tab))
    sidePanel.querySelectorAll('.side-pane').forEach((p) => p.classList.toggle('hidden', (p as HTMLElement).dataset.pane !== tab))
    requestAnimationFrame(() => reflowPaged())
  }

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
    const chapterHighlights = highlights.filter((h) => h.chapterIndex === chapterIndex)
    const sanitized = sanitizeHtml(chapter.html)
    const withHighlights = applyHighlights(sanitized, chapterHighlights)
    pageEl.innerHTML =
      settings.examColors?.enabled === false
        ? withHighlights
        : applyExamColors(withHighlights, examTags, settings.examColors?.colors)
    pageEl.querySelectorAll<HTMLElement>('mark[data-highlight]').forEach((mark) => {
      mark.addEventListener('click', (e) => {
        e.stopPropagation()
        showHighlightMenu(mark)
      })
    })
    pageEl.dataset.mode = settings.mode
    applyPagedLayout()
    pageEl.scrollLeft = 0
    pageEl.scrollTop = 0
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
    showSideTab('quiz')
    if (!quizPane.dataset.ready) {
      quizPane.dataset.ready = '1'
      void createQuizWidget(quizPane, {
        bookId,
        chapterIndex,
        chapterTitle: chapter?.title ?? meta.title,
        chapterText: pageEl.innerText
      })
    }
  })
  root.querySelector('[data-act="upload"]')!.addEventListener('click', () => container.dispatchEvent(new CustomEvent('open-upload')))
  root.querySelector('[data-act="settings"]')!.addEventListener('click', () => root.querySelector('.reader-settings')!.classList.toggle('hidden'))
  root.querySelector('[data-act="translate"]')!.addEventListener('click', async () => {
    showSideTab('translate')
    translateContent.textContent = '翻译中…'
    const sel = window.getSelection()
    const anchor = sel?.anchorNode
    const selected = sel?.toString().trim() ?? ''
    const text = selected && anchor && pageEl.contains(anchor) ? selected : pageEl.innerText.slice(0, 8000)
    try {
      translateContent.textContent = await window.reader.translate.translate(text)
    } catch (err) {
      translateContent.textContent = err instanceof Error ? err.message : '翻译失败'
    }
  })
  root.querySelector('[data-act="side-close"]')!.addEventListener('click', () => {
    sidePanel.classList.add('hidden')
    reflowPaged()
  })
  sidePanel.querySelectorAll('.side-tabs button[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => showSideTab((btn as HTMLElement).dataset.tab as 'translate' | 'dict' | 'quiz'))
  })

  function hideWordPopup(): void {
    popupEl.classList.add('hidden')
  }

  function showWordPopup(sel: Selection | null): void {
    hideWordPopup()
    if (!sel || sel.isCollapsed || !pageEl.contains(sel.anchorNode)) return
    const text = sel.toString().trim()
    if (!text || text.length > 300) return
    const isWord = /^[A-Za-z][A-Za-z' -]{0,39}$/.test(text)
    const dictBtn = popupEl.querySelector('[data-act="dict-lookup"]') as HTMLElement
    const vocabBtn = popupEl.querySelector('[data-act="vocab-add"]') as HTMLElement
    const hlRemove = popupEl.querySelector('[data-act="hl-remove"]') as HTMLElement
    const hlRow = popupEl.querySelectorAll('[data-act^="hl-"]:not([data-act="hl-remove"])')
    dictBtn.classList.toggle('hidden', !isWord)
    vocabBtn.classList.toggle('hidden', !isWord)
    hlRemove.classList.add('hidden')
    hlRow.forEach((b) => b.classList.remove('hidden'))
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    popupEl.style.left = `${Math.max(0, Math.min(rect.left, window.innerWidth - 180))}px`
    popupEl.style.top = `${rect.bottom + 6}px`
    popupEl.dataset.word = text
    popupEl.dataset.rectLeft = String(rect.left)
    popupEl.dataset.rectTop = String(rect.bottom)
    delete popupEl.dataset.highlightId
    popupEl.classList.remove('hidden')
  }

  function showHighlightMenu(mark: HTMLElement): void {
    const dictBtn = popupEl.querySelector('[data-act="dict-lookup"]') as HTMLElement
    const vocabBtn = popupEl.querySelector('[data-act="vocab-add"]') as HTMLElement
    const hlRemove = popupEl.querySelector('[data-act="hl-remove"]') as HTMLElement
    const hlRow = popupEl.querySelectorAll('[data-act^="hl-"]:not([data-act="hl-remove"])')
    dictBtn.classList.add('hidden')
    vocabBtn.classList.add('hidden')
    hlRow.forEach((b) => b.classList.add('hidden'))
    hlRemove.classList.remove('hidden')
    popupEl.dataset.highlightId = mark.dataset.highlightId ?? ''
    const rect = mark.getBoundingClientRect()
    popupEl.style.left = `${Math.max(0, Math.min(rect.left, window.innerWidth - 180))}px`
    popupEl.style.top = `${rect.bottom + 6}px`
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

  async function renderDictContent(host: HTMLElement, word: string): Promise<void> {
    host.innerHTML = '查询中…'
    const entry = await window.reader.dictionary.lookup(word)
    const examples = await window.reader.dictionary.examples(word)
    if (!entry) {
      host.innerHTML = `<p>未找到「${esc(word)}」的释义。</p>`
      return
    }
    const ex = examples.map((x) => `<li>${esc(x.en)}<br /><span class="dict-cn">${esc(x.cn)}</span></li>`).join('')
    const tags = entry.tags ? `<div class="dict-tags">${entry.tags.split(/\s+/).filter(Boolean).map((t) => `<span class="dict-tag">${esc(tagLabel(t))}</span>`).join('')}</div>` : ''
    host.innerHTML = `
      <div class="dict-head"><strong>${esc(entry.word)}</strong>${entry.phonetic ? `<span class="vocab-phonetic">${esc(entry.phonetic)}</span>` : ''}</div>
      <p class="dict-trans">${esc(entry.translation)}</p>
      ${tags}
      ${ex ? `<ul class="dict-examples">${ex}</ul>` : ''}
      <button data-act="dict-add" class="dict-add">加入生词本</button>`
    host.querySelector('[data-act="dict-add"]')!.addEventListener('click', async () => {
      await addVocab(entry.word, paragraphText(window.getSelection()))
      const btn = host.querySelector('[data-act="dict-add"]') as HTMLButtonElement
      btn.textContent = '已加入 ✓'
      btn.disabled = true
    })
  }

  async function showDictPanel(word: string, anchor?: { left: number; top: number }): Promise<void> {
    showSideTab('dict')
    await renderDictContent(dictContent, word)
    if (anchor) {
      await renderDictContent(dictPopupContent, word)
      dictPopup.style.left = `${Math.max(8, Math.min(anchor.left, window.innerWidth - 380))}px`
      dictPopup.style.top = `${anchor.top + 8}px`
      dictPopup.classList.remove('hidden')
    }
  }

  pageEl.addEventListener('mouseup', () => showWordPopup(window.getSelection()))
  document.addEventListener('mousedown', (e) => {
    if (!popupEl.contains(e.target as Node)) hideWordPopup()
    if (!dictPopup.contains(e.target as Node)) dictPopup.classList.add('hidden')
  })
  popupEl.querySelector('[data-act="dict-lookup"]')!.addEventListener('click', () => {
    const word = popupEl.dataset.word ?? ''
    hideWordPopup()
    void showDictPanel(word, { left: Number(popupEl.dataset.rectLeft ?? 0), top: Number(popupEl.dataset.rectTop ?? 0) })
  })
  dictPopup.querySelector('[data-act="dict-popup-close"]')!.addEventListener('click', () => dictPopup.classList.add('hidden'))
  popupEl.querySelector('[data-act="vocab-add"]')!.addEventListener('click', async () => {
    const word = popupEl.dataset.word ?? ''
    const context = paragraphText(window.getSelection())
    hideWordPopup()
    try {
      await addVocab(word, context)
      showSideTab('dict')
      dictContent.textContent = `已加入生词本 ✓`
    } catch (err) {
      showSideTab('dict')
      dictContent.textContent = err instanceof Error ? err.message : '收藏失败'
    }
  })
  popupEl.querySelectorAll('[data-act^="hl-"]:not([data-act="hl-remove"])').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = popupEl.dataset.word ?? ''
      const color = (btn as HTMLElement).dataset.act?.replace('hl-', '') as 'yellow' | 'green' | 'pink'
      hideWordPopup()
      if (!text) return
      await window.reader.book.addHighlight({ bookId, chapterIndex, text, color })
      highlights = await window.reader.book.listHighlights(bookId)
      renderChapter()
    })
  })
  popupEl.querySelector('[data-act="hl-remove"]')!.addEventListener('click', async () => {
    const id = popupEl.dataset.highlightId
    hideWordPopup()
    if (!id) return
    await window.reader.book.removeHighlight(id)
    highlights = await window.reader.book.listHighlights(bookId)
    renderChapter()
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
      applyPagedLayout()
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
    } else if (settings.mode === 'vertical') {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        if (canNextVertical(pageEl)) nextVerticalPage(pageEl)
        else if (chapterIndex < chapters.length - 1) { chapterIndex++; renderChapter() }
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        if (canPrevVertical(pageEl)) prevVerticalPage(pageEl)
        else if (chapterIndex > 0) { chapterIndex--; renderChapter() }
      }
    } else if (settings.mode === 'hscroll') {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        if (canNext(pageEl)) scrollHByWheel(pageEl, pageEl.clientWidth * 0.8)
        else if (chapterIndex < chapters.length - 1) { chapterIndex++; renderChapter() }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        if (pageEl.scrollLeft > 0) scrollHByWheel(pageEl, -pageEl.clientWidth * 0.8)
        else if (chapterIndex > 0) { chapterIndex--; renderChapter() }
      }
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault()
      pageEl.scrollBy({ top: pageEl.clientHeight * 0.8 })
    }
  }
  document.addEventListener('keydown', onKey)
  window.addEventListener('resize', reflowPaged)
  pageEl.addEventListener('wheel', (e) => {
    if (settings.mode !== 'hscroll') return
    e.preventDefault()
    scrollHByWheel(pageEl, e.deltaY)
  }, { passive: false })

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

function tagLabel(tag: string): string {
  const map: Record<string, string> = {
    zk: '中考',
    gk: '高考',
    cet4: '四级',
    cet6: '六级',
    ky: '考研',
    toefl: '托福',
    ielts: '雅思',
    gre: 'GRE',
    sat: 'SAT',
    gmat: 'GMAT',
    bec: 'BEC',
    k12: 'K12'
  }
  return map[tag] ?? tag
}
