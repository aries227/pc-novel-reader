import type { LibraryItem } from '../../shared/book'
import { confirmModal, promptModal, promptTextModal } from './prompt'
import { hideLoading, showLoading, updateLoading } from './loading'

declare global {
  interface Window { reader: import('../../shared/ipc').ReaderApi }
}

export async function renderLibrary(container: HTMLElement, onOpen: (id: string) => void): Promise<void> {
  container.innerHTML = ''
  const header = document.createElement('div')
  header.className = 'lib-header'
  header.innerHTML = `
    <h1>书架</h1>
    <input class="lib-search" placeholder="搜索书名 / 作者" />
    <div class="lib-actions">
      <button data-act="add-files">打开文件</button>
      <button data-act="add-folder">导入文件夹</button>
      <button data-act="webtoepub">网页转EPUB</button>
      <button data-act="web-parse">网页解析</button>
      <button data-act="sources">书源</button>
      <button data-act="upload">扫码上传</button>
      <button data-act="export">导出书架</button>
      <button data-act="import">导入书架</button>
      <button data-act="settings">设置</button>
    </div>`
  container.appendChild(header)
  if ((window as unknown as Record<string, unknown>).__jianyueWeb) {
    header.querySelector('[data-act="upload"]')?.remove()
  }

  const grid = document.createElement('div')
  grid.className = 'lib-grid'
  container.appendChild(grid)

  async function refresh(): Promise<void> {
    await renderLibrary(container, onOpen)
  }

  const items = await window.reader.library.list()
  function renderGrid(list: LibraryItem[]): void {
    grid.innerHTML = ''
    if (list.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'lib-empty'
      empty.textContent = items.length === 0 ? '书架为空：点击“打开文件”或扫码上传书籍' : '没有匹配的书籍'
      grid.appendChild(empty)
    }
    for (const item of list) grid.appendChild(bookCard(item, onOpen, refresh))
  }
  renderGrid(items)
  header.querySelector('.lib-search')!.addEventListener('input', (e) => {
    const q = (e.target as HTMLInputElement).value.trim().toLowerCase()
    const filtered = q
      ? items.filter((i) => i.meta.title.toLowerCase().includes(q) || i.meta.author.toLowerCase().includes(q))
      : items
    renderGrid(filtered)
  })

  header.querySelector('[data-act="add-files"]')!.addEventListener('click', async () => {
    const paths = await window.reader.dialog.openFiles()
    if (paths.length) {
      showLoading('正在导入书籍…')
      try {
        await window.reader.library.addFiles(paths)
        await renderLibrary(container, onOpen)
      } finally {
        hideLoading()
      }
    }
  })
  header.querySelector('[data-act="add-folder"]')!.addEventListener('click', async () => {
    showLoading('正在导入书籍…')
    try {
      await window.reader.library.addFolder()
      await renderLibrary(container, onOpen)
    } finally {
      hideLoading()
    }
  })
  header.querySelector('[data-act="webtoepub"]')!.addEventListener('click', async () => {
    const text = await promptTextModal('批量导入 Web 小说（每行一个目录页 URL）', 'https://example.com/book1\nhttps://example.com/book2')
    if (!text) return
    const urls = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    if (!urls.length) return
    const btn = header.querySelector('[data-act="webtoepub"]') as HTMLButtonElement
    btn.disabled = true
    btn.textContent = '转换中…'
    showLoading('正在批量转换 EPUB…', 0)
    const unsub = window.reader.web.onToEpubProgress((s) => updateLoading(s.message, s.percent))
    try {
      const items = await window.reader.web.toEpubBatch(urls)
      alert(`批量转换完成：新增 ${items.length} 本书`)
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : '转换失败')
    } finally {
      unsub()
      hideLoading()
      btn.disabled = false
      btn.textContent = '网页转EPUB'
    }
  })
  header.querySelector('[data-act="export"]')!.addEventListener('click', () => window.reader.library.export())
  header.querySelector('[data-act="import"]')!.addEventListener('click', async () => {
    await window.reader.library.import()
    await renderLibrary(container, onOpen)
  })
  header.querySelector('[data-act="web-parse"]')!.addEventListener('click', async () => {
    const url = await promptModal('输入网页 URL：')
    if (!url) return
    showLoading('正在解析网页…')
    try {
      const item = await window.reader.web.parse(url)
      onOpen(item.meta.id)
    } catch (err) {
      alert(err instanceof Error ? err.message : '解析失败')
    } finally {
      hideLoading()
    }
  })
  header.querySelector('[data-act="upload"]')!.addEventListener('click', () => container.dispatchEvent(new CustomEvent('open-upload')))
  header.querySelector('[data-act="sources"]')!.addEventListener('click', () => container.dispatchEvent(new CustomEvent('open-sources')))
  header.querySelector('[data-act="settings"]')!.addEventListener('click', () => container.dispatchEvent(new CustomEvent('open-settings')))
}

function bookCard(item: LibraryItem, onOpen: (id: string) => void, onChanged: () => Promise<void>): HTMLElement {
  const card = document.createElement('div')
  card.className = 'book-card'
  const cover = item.meta.cover
    ? `<img class="book-cover" src="${item.meta.cover}" alt="" />`
    : `<div class="book-cover book-cover-text" style="background:${coverGradient(item.meta.title)}">${escapeHtml(item.meta.title.slice(0, 4))}</div>`
  card.innerHTML = `
    <div class="book-cover-wrap">
      ${cover}
      <div class="book-card-actions">
        <button class="book-act-rename" title="改名">✎</button>
        <button class="book-act-delete" title="删除">✕</button>
      </div>
    </div>
    <div class="book-title" data-book-title title="点击改名">${escapeHtml(item.meta.title)}</div>
    <div class="book-meta">
      <span class="book-author">${escapeHtml(item.meta.author || '未知作者')}</span>
      <span class="book-progress">${item.progress ? `${Math.round((item.progress.chapterIndex / 1000) * 100)}%` : '未读'}</span>
    </div>
    <div class="book-rename-form hidden">
      <input class="book-rename-input" value="${escapeHtml(item.meta.title)}" />
      <div class="book-rename-btns">
        <button data-act="ok">确定</button>
        <button data-act="cancel">取消</button>
      </div>
    </div>`
  card.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.book-card-actions, .book-rename-form')) return
    onOpen(item.meta.id)
  })

  const titleEl = card.querySelector('[data-book-title]') as HTMLElement
  const renameForm = card.querySelector('.book-rename-form') as HTMLElement
  const input = card.querySelector('.book-rename-input') as HTMLInputElement

  function openRename(): void {
    titleEl.classList.add('hidden')
    renameForm.classList.remove('hidden')
    input.value = item.meta.title
    input.focus()
    input.select()
  }
  function closeRename(): void {
    renameForm.classList.add('hidden')
    titleEl.classList.remove('hidden')
  }
  async function submitRename(): Promise<void> {
    const name = input.value.trim()
    if (!name) return
    try {
      await window.reader.library.rename(item.meta.id, name)
      await onChanged()
    } catch (err) {
      alert(err instanceof Error ? err.message : '改名失败')
      closeRename()
    }
  }

  titleEl.addEventListener('click', (e) => {
    e.stopPropagation()
    openRename()
  })
  card.querySelector('.book-act-rename')!.addEventListener('click', (e) => {
    e.stopPropagation()
    openRename()
  })
  renameForm.querySelector('[data-act="ok"]')!.addEventListener('click', (e) => {
    e.stopPropagation()
    void submitRename()
  })
  renameForm.querySelector('[data-act="cancel"]')!.addEventListener('click', (e) => {
    e.stopPropagation()
    closeRename()
  })
  input.addEventListener('keydown', (e) => {
    e.stopPropagation()
    if (e.key === 'Enter') void submitRename()
    else if (e.key === 'Escape') closeRename()
  })
  card.querySelector('.book-act-delete')!.addEventListener('click', async (e) => {
    e.stopPropagation()
    const ok = await confirmModal('删除书籍', `确定删除《${item.meta.title}》吗？删除后书架不再显示这本书。`)
    if (!ok) return
    await window.reader.library.remove(item.meta.id)
    await onChanged()
  })
  return card
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function coverGradient(title: string): string {
  let h = 0
  for (const ch of title) h = (h * 31 + (ch.codePointAt(0) ?? 0)) % 360
  return `linear-gradient(135deg, hsl(${h}, 55%, 42%), hsl(${(h + 45) % 360}, 60%, 26%))`
}
