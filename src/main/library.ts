import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { Bookmark, BookMeta, LibraryItem, Progress } from '../shared/book'
import { formatFromPath } from '../shared/book'
import { parseTxt } from './parsers/txt'

function emptyItem(meta: BookMeta): LibraryItem {
  return { meta, bookmarks: [] }
}

export class LibraryStore {
  private items: Record<string, LibraryItem> = {}
  private loaded = false
  private saveTimer: NodeJS.Timeout | null = null

  constructor(private readonly dir: string) {}

  private get file(): string {
    return join(this.dir, 'library.json')
  }

  private async load(): Promise<void> {
    if (this.loaded) return
    this.loaded = true
    try {
      this.items = JSON.parse(await readFile(this.file, 'utf8')) as Record<string, LibraryItem>
    } catch {
      await copyFile(this.file, `${this.file}.bak`).catch(() => undefined)
      this.items = {}
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => void this.flush(), 500)
  }

  private async flush(): Promise<void> {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
    await mkdir(this.dir, { recursive: true })
    await writeFile(this.file, JSON.stringify(this.items, null, 2), 'utf8')
  }

  async list(): Promise<LibraryItem[]> {
    await this.load()
    return Object.values(this.items).sort((a, b) => (b.meta.lastReadAt ?? 0) - (a.meta.lastReadAt ?? 0))
  }

  async get(id: string): Promise<LibraryItem | undefined> {
    await this.load()
    return this.items[id]
  }

  async addSourceBook(args: {
    sourceId: string
    bookUrl: string
    title: string
    author?: string
    cover?: string
  }): Promise<LibraryItem> {
    await this.load()
    const id = randomUUID()
    const meta: BookMeta = {
      id,
      title: args.title,
      author: args.author ?? '',
      cover: args.cover,
      format: 'source',
      sourceId: args.sourceId,
      bookUrl: args.bookUrl,
      addedAt: Date.now()
    }
    this.items[id] = emptyItem(meta)
    await this.flush()
    return this.items[id]
  }

  async addFiles(paths: string[]): Promise<LibraryItem[]> {
    await this.load()
    const added: LibraryItem[] = []
    for (const path of paths) {
      const format = formatFromPath(path)
      if (!format) continue
      const id = randomUUID()
      const meta: BookMeta = {
        id,
        title: basename(path),
        author: '',
        format,
        path,
        addedAt: Date.now()
      }
      if (format === 'txt') {
        try {
          meta.title = (await parseTxt(path)).meta.title
        } catch (err) {
          meta.parseError = err instanceof Error ? err.message : '解析失败'
        }
      }
      this.items[id] = emptyItem(meta)
      added.push(this.items[id])
    }
    await this.flush()
    return added
  }

  async remove(id: string): Promise<void> {
    await this.load()
    delete this.items[id]
    this.scheduleSave()
  }

  async clear(): Promise<void> {
    this.items = {}
    this.scheduleSave()
  }

  async saveProgress(p: Progress): Promise<void> {
    await this.load()
    const item = this.items[p.bookId]
    if (!item) return
    item.progress = p
    item.meta.lastReadAt = p.updatedAt
    this.scheduleSave()
  }

  async addBookmark(b: Omit<Bookmark, 'id' | 'createdAt'>): Promise<Bookmark> {
    await this.load()
    const item = this.items[b.bookId]
    if (!item) throw new Error('书籍不存在')
    const bookmark: Bookmark = { ...b, id: randomUUID(), createdAt: Date.now() }
    item.bookmarks.push(bookmark)
    this.scheduleSave()
    return bookmark
  }

  async removeBookmark(id: string): Promise<void> {
    await this.load()
    for (const item of Object.values(this.items)) {
      item.bookmarks = item.bookmarks.filter((b) => b.id !== id)
    }
    this.scheduleSave()
  }

  async export(filePath: string): Promise<void> {
    await this.load()
    await writeFile(filePath, JSON.stringify(Object.values(this.items), null, 2), 'utf8')
  }

  async import(filePath: string): Promise<void> {
    await this.load()
    const data = JSON.parse(await readFile(filePath, 'utf8')) as LibraryItem[]
    for (const item of data) {
      if (item.meta?.id) this.items[item.meta.id] = item
    }
    this.scheduleSave()
  }
}
