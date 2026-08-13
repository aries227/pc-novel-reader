import { sanitizeHtml } from '../reader/sanitize'

export async function openSourcesModal(container: HTMLElement): Promise<void> {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal source-modal">
      <h2>书源</h2>
      <div class="source-list"></div>
      <div class="source-actions">
        <button data-act="import">导入书源文件</button>
        <button data-act="import-url">从 URL 导入</button>
        <button data-act="close">关闭</button>
      </div>
      <div class="source-search hidden">
        <input placeholder="搜索书名" data-keyword />
        <button data-act="do-search">搜索</button>
        <div class="source-results"></div>
      </div>
    </div>`
  container.appendChild(overlay)
  const listEl = overlay.querySelector('.source-list') as HTMLElement
  const searchEl = overlay.querySelector('.source-search') as HTMLElement
  const resultsEl = overlay.querySelector('.source-results') as HTMLElement

  async function refresh(): Promise<void> {
    const sources = await window.reader.sources.list()
    listEl.innerHTML = ''
    for (const s of sources) {
      const row = document.createElement('div')
      row.className = 'source-row'
      row.innerHTML = `<span>${escapeHtml(s.name)}</span>
        <button data-del="${s.id}">删除</button>
        <button data-search="${s.id}">搜索</button>`
      listEl.appendChild(row)
    }
    listEl.querySelectorAll('[data-del]').forEach((b) => {
      b.addEventListener('click', async () => {
        await window.reader.sources.remove((b as HTMLElement).dataset.del!)
        await refresh()
      })
    })
    listEl.querySelectorAll('[data-search]').forEach((b) => {
      b.addEventListener('click', () => {
        searchEl.classList.remove('hidden')
        searchEl.dataset.sourceId = (b as HTMLElement).dataset.search!
      })
    })
  }

  overlay.querySelector('[data-act="import"]')!.addEventListener('click', async () => {
    await window.reader.sources.importDialog()
    await refresh()
  })
  overlay.querySelector('[data-act="import-url"]')!.addEventListener('click', async () => {
    const url = prompt('输入书源 JSON 地址：')
    if (!url) return
    await window.reader.sources.importUrl(url)
    await refresh()
  })
  overlay.querySelector('[data-act="close"]')!.addEventListener('click', () => overlay.remove())
  overlay.querySelector('[data-act="do-search"]')!.addEventListener('click', async () => {
    const keyword = (overlay.querySelector('[data-keyword]') as HTMLInputElement).value.trim()
    const sourceId = searchEl.dataset.sourceId
    if (!keyword || !sourceId) return
    const results = await window.reader.sources.search(sourceId, keyword)
    resultsEl.innerHTML = ''
    for (const r of results) {
      const row = document.createElement('div')
      row.className = 'source-result'
      row.innerHTML = `<span>${escapeHtml(r.title)} · ${escapeHtml(r.author)}</span>
        <button data-open="1">阅读</button>
        <button data-add="1">加入书架</button>`
      row.querySelector('[data-open]')!.addEventListener('click', async () => {
        const chapters = await window.reader.sources.chapters(sourceId, r.bookUrl)
        const idx = Number(prompt(`共 ${chapters.length} 章，输入章节号（1-${chapters.length}）`, '1') ?? '1')
        const chapter = chapters[Math.max(0, idx - 1)]
        if (!chapter) return
        const html = await window.reader.sources.content(sourceId, chapter.url)
        const view = document.createElement('div')
        view.className = 'source-content'
        view.innerHTML = `<h2>${escapeHtml(chapter.title)}</h2><div>${sanitizeHtml(html)}</div><button>关闭</button>`
        view.querySelector('button')!.addEventListener('click', () => view.remove())
        overlay.appendChild(view)
      })
      row.querySelector('[data-add]')!.addEventListener('click', async () => {
        await window.reader.sources.addBook({ sourceId, bookUrl: r.bookUrl, title: r.title, author: r.author, cover: r.cover })
        overlay.remove()
        container.dispatchEvent(new CustomEvent('library-changed'))
      })
      resultsEl.appendChild(row)
    }
  })
  await refresh()
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
