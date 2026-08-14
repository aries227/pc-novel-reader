import type { LibraryItem } from '../../shared/book'

declare global {
  interface Window { reader: import('../../shared/ipc').ReaderApi }
}

export async function renderLibrary(container: HTMLElement, onOpen: (id: string) => void): Promise<void> {
  container.innerHTML = ''
  const header = document.createElement('div')
  header.className = 'lib-header'
  header.innerHTML = `
    <h1>书架</h1>
    <div class="lib-actions">
      <button data-act="add-files">打开文件</button>
      <button data-act="add-folder">导入文件夹</button>
      <button data-act="web-parse">网页解析</button>
      <button data-act="sources">书源</button>
      <button data-act="upload">扫码上传</button>
      <button data-act="export">导出书架</button>
      <button data-act="import">导入书架</button>
      <button data-act="settings">设置</button>
    </div>`
  container.appendChild(header)

  const grid = document.createElement('div')
  grid.className = 'lib-grid'
  container.appendChild(grid)

  async function refresh(): Promise<void> {
    await renderLibrary(container, onOpen)
  }

  const items = await window.reader.library.list()
  if (items.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'lib-empty'
    empty.textContent = '书架为空：点击“打开文件”或扫码上传书籍'
    grid.appendChild(empty)
  }
  for (const item of items) grid.appendChild(bookCard(item, onOpen, refresh))

  header.querySelector('[data-act="add-files"]')!.addEventListener('click', async () => {
    const paths = await window.reader.dialog.openFiles()
    if (paths.length) {
      await window.reader.library.addFiles(paths)
      await renderLibrary(container, onOpen)
    }
  })
  header.querySelector('[data-act="add-folder"]')!.addEventListener('click', async () => {
    await window.reader.library.addFolder()
    await renderLibrary(container, onOpen)
  })
  header.querySelector('[data-act="export"]')!.addEventListener('click', () => window.reader.library.export())
  header.querySelector('[data-act="import"]')!.addEventListener('click', async () => {
    await window.reader.library.import()
    await renderLibrary(container, onOpen)
  })
  header.querySelector('[data-act="web-parse"]')!.addEventListener('click', async () => {
    const url = prompt('输入网页 URL：')
    if (!url) return
    try {
      const item = await window.reader.web.parse(url)
      onOpen(item.meta.id)
    } catch (err) {
      alert(err instanceof Error ? err.message : '解析失败')
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
    ${cover}
    <div class="book-title">${escapeHtml(item.meta.title)}</div>
    <div class="book-author">${escapeHtml(item.meta.author || '未知作者')}</div>
    <div class="book-progress">${item.progress ? `${Math.round((item.progress.chapterIndex / 1000) * 100)}%` : '未读'}</div>
    <button class="book-rename" title="改名">改名</button>`
  card.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.book-rename')) return
    onOpen(item.meta.id)
  })
  card.querySelector('.book-rename')!.addEventListener('click', async () => {
    const name = prompt('输入新的书名：', item.meta.title)
    if (name === null) return
    try {
      await window.reader.library.rename(item.meta.id, name)
      await onChanged()
    } catch (err) {
      alert(err instanceof Error ? err.message : '改名失败')
    }
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
