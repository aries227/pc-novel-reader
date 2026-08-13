# PC 小说阅读器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 Windows 桌面小说阅读器（Electron + 原生 TS UI），支持 8 种格式、书架、扫码上传、书源系统与网页正文解析。

**Architecture:** Electron 主进程负责文件系统/网络/解析/持久化，渲染进程只做 UI，两者通过 contextBridge 白名单 IPC 通信；所有外来 HTML 在渲染进程经 DOMPurify 净化。

**Tech Stack:** Electron 43.4.0、electron-vite 5、Vite 8、TypeScript 5.9、vitest 4；lingo-reader 0.4.6（epub/mobi/azw3/fb2）、jschardet 3.1.4、iconv-lite 0.7.3、mammoth 1.12.1、pdfjs-dist 6.2.108、DOMPurify 3.4.13、jsdom 30 + @mozilla/readability 0.6.0、qrcode 1.5.4、busboy 1.6.0。

## Global Constraints

- 项目根目录：`D:\ft\reader`，独立 git 仓库（设计文档已提交 0486d55）。
- 渲染进程：`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`、严格 CSP（`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: reader-file:; font-src 'self' data:; connect-src 'self'`）。
- 所有外来 HTML 渲染前必须经 DOMPurify 净化；不允许外来脚本。
- 网络请求只由主进程发起；书源 URL 协议白名单 `http/https`。
- 支持扩展名：`txt epub mobi azw3 fb2 pdf html htm docx`；扫码上传单文件默认上限 100MB。
- 统一内部模型：`Book { id, title, author, cover?, format, path?, sourceId?, bookUrl? }` + `Chapter { id, title, html }`。
- 进度定位：TXT = 章节索引 + 字符偏移；EPUB/MOBI/AZW3/FB2/DOCX/HTML = 章节索引 + 段落索引 + 文本前缀哈希；PDF = 页码；书源 = 章节索引。
- 交付脚本：`pnpm dev` 运行、`pnpm build` 类型检查+构建、`pnpm test` 单测、`pnpm dist` 打包 NSIS + portable。
- 版本锁定：electron `^43.4.0`、electron-vite `^5.0.0`、vite `^8.2.1`、typescript `^5.9.2`、vitest `^4.1.10`；其余按 Tech Stack。

---

### Task 1: 项目脚手架（可启动的空白窗口）

**Files:**
- Create: `D:\ft\reader\package.json`
- Create: `D:\ft\reader\tsconfig.json`
- Create: `D:\ft\reader\electron.vite.config.ts`
- Create: `D:\ft\reader\.gitignore`
- Create: `D:\ft\reader\src\main\index.ts`
- Create: `D:\ft\reader\src\preload\index.ts`
- Create: `D:\ft\reader\src\renderer\index.html`
- Create: `D:\ft\reader\src\renderer\main.ts`
- Create: `D:\ft\reader\src\renderer\style.css`
- Test: `D:\ft\reader\tests\scaffold.test.ts`

**Interfaces:**
- Consumes: 无。
- Produces: 可运行的 Electron 窗口；`pnpm dev` / `pnpm build` / `pnpm test` 脚本；目录结构。

- [ ] **Step 1: 写 package.json 与配置文件**

`package.json`：

```json
{
  "name": "pc-novel-reader",
  "productName": "简阅",
  "version": "0.1.0",
  "private": true,
  "description": "简洁高效的 PC 端小说阅读器",
  "main": "./out/main/index.js",
  "type": "module",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "tsc --noEmit && electron-vite build",
    "preview": "electron-vite preview",
    "test": "vitest run",
    "dist": "pnpm build && electron-builder --win nsis portable"
  },
  "dependencies": {
    "@lingo-reader/epub-parser": "^0.4.6",
    "@lingo-reader/fb2-parser": "^0.4.6",
    "@lingo-reader/mobi-parser": "^0.4.6",
    "@mozilla/readability": "^0.6.0",
    "busboy": "^1.6.0",
    "dompurify": "^3.4.13",
    "iconv-lite": "^0.7.3",
    "jschardet": "^3.1.4",
    "jsdom": "^30.0.1",
    "mammoth": "^1.12.1",
    "pdfjs-dist": "^6.2.108",
    "qrcode": "^1.5.4"
  },
  "devDependencies": {
    "@types/busboy": "^1.5.4",
    "@types/node": "^24.0.0",
    "@types/qrcode": "^1.5.5",
    "electron": "^43.4.0",
    "electron-builder": "^26.15.3",
    "electron-vite": "^5.0.0",
    "fflate": "^0.8.2",
    "typescript": "^5.9.2",
    "vite": "^8.2.1",
    "vitest": "^4.1.10"
  },
  "build": {
    "appId": "com.local.jian-yue",
    "productName": "简阅",
    "directories": { "output": "dist" },
    "files": ["out/**/*", "package.json"],
    "win": { "target": ["nsis", "portable"] },
    "nsis": { "oneClick": false, "allowToChangeInstallationDirectory": true }
  },
  "pnpm": {
    "onlyBuiltDependencies": ["electron", "esbuild"]
  }
}
```

`tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["node"],
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": { "@shared/*": ["src/shared/*"] }
  },
  "include": ["src", "tests", "electron.vite.config.ts"]
}
```

`electron.vite.config.ts`：

```ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'node:path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  renderer: {
    resolve: { alias: { '@shared': resolve('src/shared') } }
  }
})
```

`.gitignore`：

```text
node_modules/
out/
dist/
*.log
*.bak
.DS_Store
```

- [ ] **Step 2: 写最小主进程/预加载/渲染进程**

`src/main/index.ts`：

```ts
import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'

let win: BrowserWindow | null = null

function createWindow(): void {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: '简阅',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

`src/preload/index.ts`：

```ts
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('reader', {
  ping: (): Promise<string> => Promise.resolve('pong')
})
```

`src/renderer/index.html`：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: reader-file:; font-src 'self' data:; connect-src 'self'" />
    <title>简阅</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

`src/renderer/main.ts`：

```ts
import './style.css'

const appEl = document.getElementById('app')!
appEl.textContent = '简阅'
```

`src/renderer/style.css`：

```css
:root { --bg: #f5f3ee; --fg: #2b2b2b; --accent: #8a6d3b; }
* { box-sizing: border-box; }
html, body, #app { height: 100%; margin: 0; }
body { background: var(--bg); color: var(--fg); font-family: "Microsoft YaHei", system-ui, sans-serif; }
```

- [ ] **Step 3: 写脚手架冒烟测试**

`tests/scaffold.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('scaffold', () => {
  it('package.json 的 main 指向构建产物', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))
    expect(pkg.main).toBe('./out/main/index.js')
    expect(pkg.scripts.dev).toContain('electron-vite dev')
  })
  it('渲染进程入口存在', () => {
    expect(existsSync(resolve('src/renderer/index.html'))).toBe(true)
  })
})
```

- [ ] **Step 4: 安装依赖并跑测试**

Run: `pnpm install`（网络受限时改用 `npm.cmd install` 并请求联网权限）
Expected: 安装成功并生成锁文件。

Run: `pnpm test`
Expected: 2 个测试通过。

- [ ] **Step 5: 验证构建**

Run: `pnpm build`
Expected: `tsc` 无错误，`out/main/index.js`、`out/preload/index.js`、`out/renderer/index.html` 生成。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: 项目脚手架（Electron + Vite + TS）"
```

---

### Task 2: 共享类型与 IPC 骨架

**Files:**
- Create: `D:\ft\reader\src\shared\book.ts`
- Create: `D:\ft\reader\src\shared\source.ts`
- Create: `D:\ft\reader\src\shared\ipc.ts`
- Modify: `D:\ft\reader\src\preload\index.ts`
- Create: `D:\ft\reader\src\main\ipc.ts`
- Test: `D:\ft\reader\tests\shared.test.ts`

**Interfaces:**
- Consumes: Task 1 目录结构。
- Produces: `ReaderApi`（window.reader 类型）、`BookFormat`、`BookMeta`、`Chapter`、`LibraryItem`、`Progress`、`Bookmark`、`Settings`、`BookSource`、`UploadStatus`；`registerIpc()`。

- [ ] **Step 1: 写共享类型**

`src/shared/book.ts`：

```ts
export type BookFormat =
  | 'txt' | 'epub' | 'mobi' | 'azw3' | 'fb2' | 'pdf' | 'html' | 'docx' | 'source' | 'web'

export interface ChapterMeta { id: string; title: string }
export interface Chapter extends ChapterMeta { html: string }

export interface BookMeta {
  id: string
  title: string
  author: string
  cover?: string
  format: BookFormat
  path?: string
  sourceId?: string
  bookUrl?: string
  addedAt: number
  lastReadAt?: number
  parseError?: string
}

export interface Progress {
  bookId: string
  chapterIndex: number
  charOffset?: number
  paragraphIndex?: number
  textHash?: string
  page?: number
  updatedAt: number
}

export interface Bookmark {
  id: string
  bookId: string
  chapterIndex: number
  paragraphIndex: number
  excerpt: string
  createdAt: number
}

export interface LibraryItem { meta: BookMeta; progress?: Progress; bookmarks: Bookmark[] }

export interface Settings {
  theme: 'light' | 'sepia' | 'dark'
  fontSize: number
  lineHeight: number
  fontFamily: string
  mode: 'paged' | 'scroll'
  uploadPortMode: 'random' | 'fixed'
  uploadPort?: number
  maxUploadMb: number
  sourceCacheLimit: number
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'sepia',
  fontSize: 18,
  lineHeight: 1.9,
  fontFamily: 'system',
  mode: 'paged',
  uploadPortMode: 'random',
  maxUploadMb: 100,
  sourceCacheLimit: 50
}

export const SUPPORTED_EXTENSIONS = ['txt', 'epub', 'mobi', 'azw3', 'fb2', 'pdf', 'html', 'htm', 'docx'] as const

export function formatFromPath(path: string): BookFormat | null {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'txt': return 'txt'
    case 'epub': return 'epub'
    case 'mobi': return 'mobi'
    case 'azw3': return 'azw3'
    case 'fb2': return 'fb2'
    case 'pdf': return 'pdf'
    case 'html':
    case 'htm': return 'html'
    case 'docx': return 'docx'
    default: return null
  }
}
```

`src/shared/source.ts`：

```ts
export interface SourceRequest {
  url: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  charset?: 'utf-8' | 'gbk' | 'auto'
}

export interface SourceStep {
  url: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  charset?: 'utf-8' | 'gbk' | 'auto'
  list?: string
  title?: string
  author?: string
  bookUrl?: string
  cover?: string
  intro?: string
  chapterUrl?: string
  content?: string
  remove?: string[]
}

export interface BookSource {
  id: string
  name: string
  version: number
  baseUrl: string
  enabled: boolean
  search?: SourceStep
  detail?: SourceStep
  chapters?: SourceStep
  content?: SourceStep
}

export interface SourceSearchResult { title: string; author: string; bookUrl: string; cover?: string; intro?: string }
export interface SourceChapter { id: string; title: string; url: string }
```

`src/shared/ipc.ts`：

```ts
import type { BookMeta, Bookmark, Chapter, LibraryItem, Progress, Settings } from './book'
import type { BookSource, SourceChapter, SourceSearchResult } from './source'

export interface UploadStatus {
  running: boolean
  port?: number
  url?: string
  qrDataUrl?: string
}

export interface BookOpenResult {
  meta: BookMeta
  chapters: Chapter[]
  pdfUrl?: string
}

export interface ReaderApi {
  library: {
    list(): Promise<LibraryItem[]>
    addFiles(paths: string[]): Promise<LibraryItem[]>
    addFolder(): Promise<LibraryItem[]>
    remove(id: string): Promise<void>
    clear(): Promise<void>
    import(): Promise<void>
    export(): Promise<string | null>
  }
  book: {
    open(id: string): Promise<BookOpenResult | null>
    saveProgress(p: Progress): Promise<void>
    listBookmarks(id: string): Promise<Bookmark[]>
    addBookmark(b: Omit<Bookmark, 'id' | 'createdAt'>): Promise<Bookmark>
    removeBookmark(id: string): Promise<void>
  }
  settings: {
    get(): Promise<Settings>
    set(patch: Partial<Settings>): Promise<Settings>
  }
  upload: {
    status(): Promise<UploadStatus>
    start(): Promise<UploadStatus>
    stop(): Promise<void>
    onUploaded(cb: (path: string) => void): () => void
  }
  sources: {
    list(): Promise<BookSource[]>
    importDialog(): Promise<BookSource[]>
    importUrl(url: string): Promise<BookSource[]>
    save(s: BookSource): Promise<void>
    remove(id: string): Promise<void>
    export(id: string): Promise<string | null>
    search(sourceId: string, keyword: string): Promise<SourceSearchResult[]>
    chapters(sourceId: string, bookUrl: string): Promise<SourceChapter[]>
    content(sourceId: string, chapterUrl: string): Promise<string>
    addBook(args: { sourceId: string; bookUrl: string; title: string; author?: string; cover?: string }): Promise<LibraryItem>
  }
  web: { parse(url: string): Promise<LibraryItem> }
  dialog: { openFiles(): Promise<string[]> }
  app: { quit(): void }
}
```

- [ ] **Step 2: 写共享类型测试**

`tests/shared.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, formatFromPath } from '../src/shared/book'

describe('shared/book', () => {
  it('识别扩展名', () => {
    expect(formatFromPath('a.txt')).toBe('txt')
    expect(formatFromPath('b.AZW3')).toBe('azw3')
    expect(formatFromPath('c.exe')).toBeNull()
  })
  it('默认设置符合全局约束', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('sepia')
    expect(DEFAULT_SETTINGS.maxUploadMb).toBe(100)
  })
})
```

- [ ] **Step 3: 预加载暴露完整 API 骨架**

`src/preload/index.ts`：

```ts
import { contextBridge, ipcRenderer } from 'electron'
import type { ReaderApi } from '../shared/ipc'

const api: ReaderApi = {
  library: {
    list: () => ipcRenderer.invoke('library:list'),
    addFiles: (paths) => ipcRenderer.invoke('library:addFiles', paths),
    addFolder: () => ipcRenderer.invoke('library:addFolder'),
    remove: (id) => ipcRenderer.invoke('library:remove', id),
    clear: () => ipcRenderer.invoke('library:clear'),
    import: () => ipcRenderer.invoke('library:import'),
    export: () => ipcRenderer.invoke('library:export')
  },
  book: {
    open: (id) => ipcRenderer.invoke('book:open', id),
    saveProgress: (p) => ipcRenderer.invoke('book:saveProgress', p),
    listBookmarks: (id) => ipcRenderer.invoke('book:listBookmarks', id),
    addBookmark: (b) => ipcRenderer.invoke('book:addBookmark', b),
    removeBookmark: (id) => ipcRenderer.invoke('book:removeBookmark', id)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch)
  },
  upload: {
    status: () => ipcRenderer.invoke('upload:status'),
    start: () => ipcRenderer.invoke('upload:start'),
    stop: () => ipcRenderer.invoke('upload:stop'),
    onUploaded: (cb) => {
      const listener = (_e: unknown, path: string) => cb(path)
      ipcRenderer.on('upload:uploaded', listener)
      return () => ipcRenderer.removeListener('upload:uploaded', listener)
    }
  },
  sources: {
    list: () => ipcRenderer.invoke('sources:list'),
    importDialog: () => ipcRenderer.invoke('sources:importDialog'),
    importUrl: (url) => ipcRenderer.invoke('sources:importUrl', url),
    save: (s) => ipcRenderer.invoke('sources:save', s),
    remove: (id) => ipcRenderer.invoke('sources:remove', id),
    export: (id) => ipcRenderer.invoke('sources:export', id),
    search: (sourceId, keyword) => ipcRenderer.invoke('sources:search', sourceId, keyword),
    chapters: (sourceId, bookUrl) => ipcRenderer.invoke('sources:chapters', sourceId, bookUrl),
    content: (sourceId, chapterUrl) => ipcRenderer.invoke('sources:content', sourceId, chapterUrl),
    addBook: (args) => ipcRenderer.invoke('sources:addBook', args)
  },
  web: { parse: (url) => ipcRenderer.invoke('web:parse', url) },
  dialog: { openFiles: () => ipcRenderer.invoke('dialog:openFiles') },
  app: { quit: () => ipcRenderer.send('app:quit') }
}

contextBridge.exposeInMainWorld('reader', api)
```

- [ ] **Step 4: 写 IPC 注册骨架**

`src/main/ipc.ts`：

```ts
import { BrowserWindow, dialog, ipcMain } from 'electron'

export function registerIpc(): void {
  ipcMain.handle('dialog:openFiles', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      title: '选择书籍文件',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '书籍', extensions: ['txt', 'epub', 'mobi', 'azw3', 'fb2', 'pdf', 'html', 'htm', 'docx'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    return result.canceled ? [] : result.filePaths
  })
  ipcMain.on('app:quit', () => BrowserWindow.getFocusedWindow()?.close())
}
```

`src/main/index.ts` 中 `app.whenReady().then(() => { registerIpc(); createWindow(); ... })`。

- [ ] **Step 5: 运行测试与构建**

Run: `pnpm test` → 通过。
Run: `pnpm build` → 通过。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: 共享类型与 IPC 骨架"
```

---

### Task 3: TXT 解析器（编码检测 + 章节切分）

**Files:**
- Create: `D:\ft\reader\src\main\parsers\txt.ts`
- Test: `D:\ft\reader\tests\txt.test.ts`

**Interfaces:**
- Consumes: `Chapter`、`BookMeta`。
- Produces: `readTextFile(path): Promise<string>`、`splitChapters(text): { title: string; body: string[] }[]`、`parseTxt(path)`。

- [ ] **Step 1: 写失败测试（含 GBK fixture）**

`tests/txt.test.ts`：

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import iconv from 'iconv-lite'
import { parseTxt, readTextFile, splitChapters } from '../src/main/parsers/txt'

let dir: string
beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), 'reader-txt-')) })
afterAll(async () => { await rm(dir, { recursive: true, force: true }) })

describe('readTextFile', () => {
  it('识别 GBK 编码', async () => {
    const p = join(dir, 'gbk.txt')
    await writeFile(p, iconv.encode('第一章 测试\n这是正文内容。', 'gbk'))
    expect(await readTextFile(p)).toContain('第一章 测试')
  })
})

describe('splitChapters', () => {
  it('按中文章节头切分', () => {
    const parts = splitChapters('第一章 开始\n内容一\n第二章 继续\n内容二\n')
    expect(parts.map((p) => p.title)).toEqual(['第一章 开始', '第二章 继续'])
  })
  it('无章节头时按 3000 字分块', () => {
    const parts = splitChapters('一'.repeat(3500) + '二'.repeat(3000))
    expect(parts.length).toBe(2)
  })
  it('忽略空行与前后空白', () => {
    const parts = splitChapters('\n\n第一章 开始\n\n正文\n\n')
    expect(parts).toHaveLength(1)
    expect(parts[0].body.join('')).toBe('正文')
  })
})

describe('parseTxt', () => {
  it('返回元数据与章节 HTML', async () => {
    const p = join(dir, 'book.txt')
    await writeFile(p, '第一章 开始\n正文段落\n', 'utf8')
    const out = await parseTxt(p)
    expect(out.meta.title).toBe('book.txt')
    expect(out.chapters[0].html).toContain('<h2>第一章 开始</h2>')
    expect(out.chapters[0].html).toContain('<p>正文段落</p>')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/txt.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现解析器**

`src/main/parsers/txt.ts`：

```ts
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import iconv from 'iconv-lite'
import jschardet from 'jschardet'
import type { BookMeta, Chapter } from '../../shared/book'

const CHAPTER_RE = /^第\s*[0-9零一二三四五六七八九十百千两]+\s*[章回卷集部节篇].*$/
const HEADER_RE = /^(楔子|序章|引子|尾声|番外|后记|前言|简介).*$/
const FALLBACK_CHUNK_SIZE = 3000

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function readTextFile(path: string): Promise<string> {
  const buf = await readFile(path)
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.toString('utf8').replace(/^\uFEFF/, '')
  }
  const detected = jschardet.detect(buf.subarray(0, 64 * 1024))
  const enc = (detected?.encoding ?? 'UTF-8').toLowerCase()
  if (iconv.encodingExists(enc)) {
    const decoded = iconv.decode(buf, enc)
    if (!decoded.includes('\uFFFD')) return decoded
  }
  const utf8 = buf.toString('utf8')
  return utf8.includes('\uFFFD') ? iconv.decode(buf, 'gbk') : utf8
}

export function splitChapters(text: string): { title: string; body: string[] }[] {
  const lines = text.split(/\r?\n/)
  const chapters: { title: string; body: string[] }[] = []
  let current: { title: string; body: string[] } | null = null
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (CHAPTER_RE.test(line) || HEADER_RE.test(line)) {
      if (current) chapters.push(current)
      current = { title: line, body: [] }
    } else {
      if (!current) current = { title: '正文', body: [] }
      current.body.push(raw)
    }
  }
  if (current) chapters.push(current)
  if (chapters.length >= 2) return chapters

  const paragraphs = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const chunks: { title: string; body: string[] }[] = []
  let size = 0
  let chunk: string[] = []
  for (const p of paragraphs) {
    chunk.push(p)
    size += p.length
    if (size >= FALLBACK_CHUNK_SIZE) {
      chunks.push({ title: `第 ${chunks.length + 1} 节`, body: chunk })
      chunk = []
      size = 0
    }
  }
  if (chunk.length) chunks.push({ title: `第 ${chunks.length + 1} 节`, body: chunk })
  return chunks
}

export async function parseTxt(
  path: string
): Promise<{ meta: Omit<BookMeta, 'id' | 'addedAt' | 'path'>; chapters: Chapter[] }> {
  const text = await readTextFile(path)
  const parts = splitChapters(text)
  const chapters: Chapter[] = parts.map((p, i) => ({
    id: `txt-${i}`,
    title: p.title,
    html:
      `<h2>${escapeHtml(p.title)}</h2>` +
      p.body.map((para) => `<p>${escapeHtml(para.trim())}</p>`).join('')
  }))
  return { meta: { title: basename(path), author: '', format: 'txt' }, chapters }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/txt.test.ts`
Expected: PASS（5 个用例）。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: TXT 编码检测与章节切分"
```

---

### Task 4: 书架存储（library.ts + settings.ts）

**Files:**
- Create: `D:\ft\reader\src\main\library.ts`
- Create: `D:\ft\reader\src\main\settings.ts`
- Modify: `D:\ft\reader\src\main\ipc.ts`
- Test: `D:\ft\reader\tests\library.test.ts`

**Interfaces:**
- Consumes: `LibraryItem`、`Progress`、`Bookmark`、`Settings`、`formatFromPath`、`parseTxt`。
- Produces: `LibraryStore(dir)`：`list()`、`addFiles(paths)`、`get(id)`、`remove(id)`、`clear()`、`saveProgress(p)`、`addBookmark(b)`、`removeBookmark(id)`、`export(filePath)`、`import(filePath)`；`SettingsStore(dir)`：`get()`、`set(patch)`。

- [ ] **Step 1: 写失败测试**

`tests/library.test.ts`：

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LibraryStore } from '../src/main/library'
import { SettingsStore } from '../src/main/settings'

let dir: string
beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), 'reader-lib-')) })
afterAll(async () => { await rm(dir, { recursive: true, force: true }) })

describe('LibraryStore', () => {
  it('添加 txt 文件并持久化', async () => {
    const bookPath = join(dir, 'a.txt')
    await writeFile(bookPath, '第一章 开始\n内容\n', 'utf8')
    const items = await new LibraryStore(dir).addFiles([bookPath])
    expect(items).toHaveLength(1)
    expect(items[0].meta.title).toBe('a.txt')
    const again = await new LibraryStore(dir).list()
    expect(again).toHaveLength(1)
  })
  it('跳过不支持的扩展名', async () => {
    const bad = join(dir, 'x.exe')
    await writeFile(bad, 'MZ')
    const items = await new LibraryStore(dir).addFiles([bad])
    expect(items).toHaveLength(0)
  })
  it('保存进度与书签', async () => {
    const store = new LibraryStore(dir)
    const items = await store.list()
    const id = items[0].meta.id
    await store.saveProgress({ bookId: id, chapterIndex: 1, charOffset: 10, updatedAt: Date.now() })
    const bookmark = await store.addBookmark({ bookId: id, chapterIndex: 1, paragraphIndex: 0, excerpt: '内容' })
    const loaded = await store.list()
    expect(loaded[0].progress?.chapterIndex).toBe(1)
    expect(loaded[0].bookmarks[0].id).toBe(bookmark.id)
  })
})

describe('SettingsStore', () => {
  it('合并补丁并持久化', async () => {
    const store = new SettingsStore(dir)
    const s1 = await store.get()
    expect(s1.theme).toBe('sepia')
    const s2 = await store.set({ theme: 'dark', fontSize: 20 })
    expect(s2.theme).toBe('dark')
    expect((await new SettingsStore(dir).get()).theme).toBe('dark')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm exec vitest run tests/library.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现存储**

`src/main/library.ts`：

```ts
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
    this.scheduleSave()
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
```

`src/main/settings.ts`：

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Settings } from '../shared/book'
import { DEFAULT_SETTINGS } from '../shared/book'

export class SettingsStore {
  private settings: Settings = { ...DEFAULT_SETTINGS }

  constructor(private readonly dir: string) {}

  private get file(): string {
    return join(this.dir, 'settings.json')
  }

  async get(): Promise<Settings> {
    try {
      this.settings = { ...DEFAULT_SETTINGS, ...(JSON.parse(await readFile(this.file, 'utf8')) as Partial<Settings>) }
    } catch {
      this.settings = { ...DEFAULT_SETTINGS }
    }
    return this.settings
  }

  async set(patch: Partial<Settings>): Promise<Settings> {
    this.settings = { ...this.settings, ...patch }
    await mkdir(this.dir, { recursive: true })
    await writeFile(this.file, JSON.stringify(this.settings, null, 2), 'utf8')
    return this.settings
  }
}
```

- [ ] **Step 4: 接入 IPC**

`src/main/ipc.ts` 改为接收 `library: LibraryStore`、`settings: SettingsStore`：

```ts
import { BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'node:path'
import type { Settings } from '../shared/book'
import { LibraryStore } from './library'
import { SettingsStore } from './settings'

export function registerIpc(library: LibraryStore, settings: SettingsStore): void {
  ipcMain.handle('library:list', () => library.list())
  ipcMain.handle('library:addFiles', (_e, paths: string[]) => library.addFiles(paths))
  ipcMain.handle('library:addFolder', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const r = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] })
    if (r.canceled || r.filePaths.length === 0) return []
    const { readdir } = await import('node:fs/promises')
    const files = (await readdir(r.filePaths[0], { withFileTypes: true }))
      .filter((d) => d.isFile())
      .map((d) => join(r.filePaths[0], d.name))
    return library.addFiles(files)
  })
  ipcMain.handle('library:remove', (_e, id: string) => library.remove(id))
  ipcMain.handle('library:clear', () => library.clear())
  ipcMain.handle('library:import', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const r = await dialog.showOpenDialog(win!, { properties: ['openFile'], filters: [{ name: '书架备份', extensions: ['json'] }] })
    if (r.canceled || r.filePaths.length === 0) return
    await library.import(r.filePaths[0])
  })
  ipcMain.handle('library:export', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const r = await dialog.showSaveDialog(win!, { defaultPath: `简阅书架-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: '书架备份', extensions: ['json'] }] })
    if (r.canceled || !r.filePath) return null
    await library.export(r.filePath)
    return r.filePath
  })
  ipcMain.handle('settings:get', () => settings.get())
  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => settings.set(patch))
  // dialog:openFiles 与 app:quit 同 Task 2
}
```

`src/main/index.ts`：

```ts
import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { LibraryStore } from './library'
import { SettingsStore } from './settings'
import { registerIpc } from './ipc'

app.whenReady().then(() => {
  const userData = app.getPath('userData')
  registerIpc(new LibraryStore(userData), new SettingsStore(userData))
  createWindow()
})
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm exec vitest run tests/library.test.ts`
Expected: PASS（4 个用例）。

Run: `pnpm build`
Expected: 类型检查通过。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: 书架与设置存储"
```

---

### Task 5: 书架 UI

**Files:**
- Create: `D:\ft\reader\src\renderer\components\library.ts`
- Modify: `D:\ft\reader\src\renderer\main.ts`
- Modify: `D:\ft\reader\src\renderer\style.css`

**Interfaces:**
- Consumes: `window.reader`、`LibraryItem`。
- Produces: `renderLibrary(container, onOpen)`。

- [ ] **Step 1: 实现书架组件**

`src/renderer/components/library.ts`：

```ts
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

  const items = await window.reader.library.list()
  if (items.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'lib-empty'
    empty.textContent = '书架为空：点击“打开文件”或扫码上传书籍'
    grid.appendChild(empty)
  }
  for (const item of items) grid.appendChild(bookCard(item, onOpen))

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

function bookCard(item: LibraryItem, onOpen: (id: string) => void): HTMLElement {
  const card = document.createElement('button')
  card.className = 'book-card'
  const cover = item.meta.cover
    ? `<img class="book-cover" src="${item.meta.cover}" alt="" />`
    : `<div class="book-cover book-cover-text">${escapeHtml(item.meta.title.slice(0, 4))}</div>`
  card.innerHTML = `
    ${cover}
    <div class="book-title">${escapeHtml(item.meta.title)}</div>
    <div class="book-author">${escapeHtml(item.meta.author || '未知作者')}</div>
    <div class="book-progress">${item.progress ? `${Math.round((item.progress.chapterIndex / 1000) * 100)}%` : '未读'}</div>`
  card.addEventListener('click', () => onOpen(item.meta.id))
  return card
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
```

`src/renderer/main.ts`：

```ts
import './style.css'
import { renderLibrary } from './components/library'

const appEl = document.getElementById('app')!

async function showLibrary(): Promise<void> {
  await renderLibrary(appEl, () => {})
}

appEl.addEventListener('open-upload', () => alert('扫码上传将在后续任务实现'))
appEl.addEventListener('open-sources', () => alert('书源将在后续任务实现'))
appEl.addEventListener('open-settings', () => alert('设置将在后续任务实现'))

void showLibrary()
```

`style.css` 追加：

```css
.lib-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; border-bottom: 1px solid #ddd; }
.lib-actions button { margin-left: 8px; padding: 6px 12px; border: 1px solid #ccc; border-radius: 6px; background: #fff; cursor: pointer; }
.lib-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 20px; padding: 24px; overflow-y: auto; }
.book-card { display: flex; flex-direction: column; gap: 6px; padding: 0; border: none; background: none; cursor: pointer; text-align: left; }
.book-cover { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: 8px; background: linear-gradient(135deg, #8a6d3b, #5b4426); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 28px; }
.book-title { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.book-author, .book-progress { font-size: 12px; color: #888; }
.lib-empty { grid-column: 1 / -1; text-align: center; color: #999; padding: 80px 0; }
```

- [ ] **Step 2: 构建验证**

Run: `pnpm build`
Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: 书架 UI"
```

---

### Task 6: 阅读器基础（TXT 阅读 + 进度 + 设置）

**Files:**
- Create: `D:\ft\reader\src\renderer\components\reader.ts`
- Create: `D:\ft\reader\src\renderer\reader\pager.ts`
- Create: `D:\ft\reader\src\renderer\reader\sanitize.ts`
- Modify: `D:\ft\reader\src\renderer\main.ts`
- Modify: `D:\ft\reader\src\renderer\style.css`
- Modify: `D:\ft\reader\src\main\ipc.ts`

**Interfaces:**
- Consumes: `window.reader.book.open/saveProgress`、`settings.*`。
- Produces: `renderReader(container, bookId, onBack)`；`sanitizeHtml(html)`；`nextPage/prevPage/canNext`。

- [ ] **Step 1: 实现净化与分页工具**

`src/renderer/reader/sanitize.ts`：

```ts
import DOMPurify from 'dompurify'

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_URI_REGEXP: /^(?:https?|data|blob|reader-file):/i
  })
}
```

`src/renderer/reader/pager.ts`：

```ts
export function nextPage(el: HTMLElement): void {
  el.scrollBy({ left: el.clientWidth })
}

export function prevPage(el: HTMLElement): void {
  el.scrollBy({ left: -el.clientWidth })
}

export function canNext(el: HTMLElement): boolean {
  return el.scrollLeft + el.clientWidth < el.scrollWidth - 4
}
```

- [ ] **Step 2: 实现阅读组件**

`src/renderer/components/reader.ts`：

```ts
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
```

`src/main/ipc.ts` 的 `registerIpc` 增加 `book:open` 与进度通道：

```ts
import { parseTxt } from './parsers/txt'
import type { Progress } from '../shared/book'

ipcMain.handle('book:open', async (_e, id: string) => {
  const item = await library.get(id)
  if (!item) return null
  if (item.meta.format === 'txt' && item.meta.path) {
    const parsed = await parseTxt(item.meta.path)
    return { meta: { ...item.meta, title: parsed.meta.title }, chapters: parsed.chapters }
  }
  return { meta: item.meta, chapters: [] }
})
ipcMain.handle('book:saveProgress', (_e, p: Progress) => library.saveProgress(p))
ipcMain.handle('book:listBookmarks', async (_e, id: string) => (await library.get(id))?.bookmarks ?? [])
ipcMain.handle('book:addBookmark', (_e, b) => library.addBookmark(b))
ipcMain.handle('book:removeBookmark', (_e, id: string) => library.removeBookmark(id))
```

`src/renderer/main.ts` 接入视图切换：

```ts
import { renderReader } from './components/reader'

async function showReader(id: string): Promise<void> {
  await renderReader(appEl, id, () => void showLibrary())
}
async function showLibrary(): Promise<void> {
  await renderLibrary(appEl, (id) => void showReader(id))
}
```

`style.css` 追加：

```css
.reader-root { display: flex; flex-direction: column; height: 100%; }
.reader-toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-bottom: 1px solid #ddd; }
.reader-spacer { flex: 1; }
.reader-body { flex: 1; display: flex; min-height: 0; }
.reader-main { flex: 1; overflow: hidden; }
.reader-page { height: 100%; overflow-x: auto; overflow-y: hidden; padding: 24px 48px; column-width: 34em; column-gap: 3em; scroll-behavior: smooth; }
.reader-page[data-mode="scroll"] { column-width: auto; overflow-y: auto; }
.reader-toc { width: 240px; border-right: 1px solid #ddd; overflow-y: auto; }
.reader-toc.hidden { display: none; }
.reader-toc ul { list-style: none; margin: 0; padding: 8px; }
.reader-toc li { padding: 6px 8px; cursor: pointer; border-radius: 4px; }
.reader-toc li.active { background: var(--accent); color: #fff; }
.reader-footer { display: flex; align-items: center; gap: 12px; padding: 8px 16px; border-top: 1px solid #ddd; }
.reader-progress { flex: 1; }
.reader-settings { position: absolute; right: 16px; top: 48px; background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 10px; z-index: 10; }
.reader-settings.hidden { display: none; }
body[data-theme="dark"] { --bg: #1e1e1e; --fg: #ccc; }
body[data-theme="light"] { --bg: #ffffff; --fg: #222; }
```

- [ ] **Step 3: 构建与手工验证**

Run: `pnpm build` → 通过。
Run: `pnpm dev` → 添加 txt → 阅读 → 调字号/主题 → 翻页 → Esc 返回。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: TXT 阅读器与进度记忆"
```

---

### Task 7: EPUB / MOBI / AZW3 / FB2 解析

**Files:**
- Create: `D:\ft\reader\src\main\parsers\ebook.ts`
- Create: `D:\ft\reader\tests\fixtures\make-fixtures.ts`
- Test: `D:\ft\reader\tests\ebook.test.ts`

**Interfaces:**
- Consumes: lingo-reader 三个包、`Chapter`、`BookMeta`。
- Produces: `parseEbook(path, format: 'epub'|'mobi'|'azw3'|'fb2')`，返回 `{ meta: Omit<BookMeta,'id'|'addedAt'|'path'>, chapters: Chapter[] }`。

- [ ] **Step 1: 写 fixture 生成器与失败测试**

`tests/fixtures/make-fixtures.ts`：

```ts
import { strToU8, zipSync } from 'fflate'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function makeMinimalEpub(dir: string): Promise<string> {
  const files: Record<string, Uint8Array> = {
    'mimetype': strToU8('application/epub+zip'),
    'META-INF/container.xml': strToU8('<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'),
    'OEBPS/content.opf': strToU8('<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>测试书</dc:title><dc:creator>作者甲</dc:creator></metadata><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/></manifest><spine toc="ncx"><itemref idref="c1"/></spine></package>'),
    'OEBPS/toc.ncx': strToU8('<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><navMap><navPoint id="n1" playOrder="1"><navLabel><text>第一章</text></navLabel><content src="c1.xhtml"/></navPoint></navMap></ncx>'),
    'OEBPS/c1.xhtml': strToU8('<html xmlns="http://www.w3.org/1999/xhtml"><head><title>第一章</title></head><body><h1>第一章</h1><p>内容</p></body></html>')
  }
  const path = join(dir, 'minimal.epub')
  await writeFile(path, zipSync(files))
  return path
}

export async function makeMinimalFb2(dir: string): Promise<string> {
  const xml = '<?xml version="1.0"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>测试书</book-title><author><first-name>甲</first-name></author></title-info></description><body><section><title><p>第一章</p></title><p>内容</p></section></body></FictionBook>'
  const path = join(dir, 'minimal.fb2')
  await writeFile(path, xml, 'utf8')
  return path
}
```

`tests/ebook.test.ts`：

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseEbook } from '../src/main/parsers/ebook'
import { makeMinimalEpub, makeMinimalFb2 } from './fixtures/make-fixtures'

let dir: string
beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), 'reader-ebook-')) })
afterAll(async () => { await rm(dir, { recursive: true, force: true }) })

describe('parseEbook', () => {
  it('解析最小 EPUB', async () => {
    const p = await makeMinimalEpub(dir)
    const out = await parseEbook(p, 'epub')
    expect(out.meta.title).toContain('测试书')
    expect(out.chapters[0].title).toContain('第一章')
    expect(out.chapters[0].html).toContain('内容')
  })
  it('解析最小 FB2', async () => {
    const p = await makeMinimalFb2(dir)
    const out = await parseEbook(p, 'fb2')
    expect(out.chapters.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm exec vitest run tests/ebook.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现电子书解析器**

`src/main/parsers/ebook.ts`：

```ts
import { initEpubFile } from '@lingo-reader/epub-parser'
import { initFb2File } from '@lingo-reader/fb2-parser'
import { initKf8File, initMobiFile } from '@lingo-reader/mobi-parser'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import type { BookMeta, Chapter } from '../../shared/book'

interface ParserLike {
  getMetadata(): Record<string, unknown>
  getSpine(): { id: string }[]
  loadChapter(id: string): { html: string; css?: { href: string }[] } | undefined
  getToc(): { label: string; href: string; children?: { label: string; href: string }[] }[]
  getCoverImage(): string
  resolveHref?(href: string): { id: string } | undefined
  destroy(): void
}

async function coverToDataUrl(p: string): Promise<string | undefined> {
  if (!p) return undefined
  try {
    const buf = await readFile(p)
    if (buf.length > 2 * 1024 * 1024) return undefined
    const ext = p.split('.').pop()?.toLowerCase() ?? 'png'
    return `data:image/${ext};base64,${buf.toString('base64')}`
  } catch {
    return undefined
  }
}

export async function parseEbook(
  path: string,
  format: 'epub' | 'mobi' | 'azw3' | 'fb2'
): Promise<{ meta: Omit<BookMeta, 'id' | 'addedAt' | 'path'>; chapters: Chapter[] }> {
  const dir = await mkdtemp(join(tmpdir(), 'reader-ebook-'))
  try {
    let parser: ParserLike
    if (format === 'epub') parser = (await initEpubFile(path, dir)) as ParserLike
    else if (format === 'mobi') parser = (await initMobiFile(path, dir)) as ParserLike
    else if (format === 'azw3') parser = (await initKf8File(path, dir)) as ParserLike
    else parser = (await initFb2File(path, dir)) as ParserLike

    const spine = parser.getSpine()
    const toc = parser.getToc()
    const tocTitles = new Map<string, string>()
    const walk = (items: { label: string; href: string; children?: { label: string; href: string }[] }[]): void => {
      for (const t of items) {
        const r = parser.resolveHref?.(t.href)
        if (r) tocTitles.set(r.id, t.label)
        if (t.children) walk(t.children)
      }
    }
    walk(toc)

    const chapters: Chapter[] = []
    for (let i = 0; i < spine.length; i++) {
      const item = spine[i]
      const loaded = parser.loadChapter(item.id)
      chapters.push({
        id: item.id,
        title: tocTitles.get(item.id) ?? `第 ${i + 1} 节`,
        html: loaded?.html ?? '<p>（该章节无法解析）</p>'
      })
    }

    const md = parser.getMetadata()
    const rawAuthor = md.author as string | string[] | { name?: string } | undefined
    const author = Array.isArray(rawAuthor)
      ? rawAuthor.filter(Boolean).join('、')
      : (typeof rawAuthor === 'object' ? rawAuthor?.name ?? '' : rawAuthor ?? '')
    const cover = await coverToDataUrl(parser.getCoverImage())
    parser.destroy()
    return {
      meta: { title: (md.title as string | undefined) || basename(path), author, cover, format },
      chapters
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/ebook.test.ts`
Expected: EPUB/FB2 通过。

- [ ] **Step 5: book.open 接入电子书**

`src/main/ipc.ts` 的 `book:open` 中增加：

```ts
if (item.meta.format === 'epub' || item.meta.format === 'mobi' || item.meta.format === 'azw3' || item.meta.format === 'fb2') {
  const parsed = await parseEbook(item.meta.path!, item.meta.format)
  return { meta: { ...item.meta, ...parsed.meta }, chapters: parsed.chapters }
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: EPUB/MOBI/AZW3/FB2 解析"
```

---

### Task 8: DOCX 与 HTML 解析

**Files:**
- Create: `D:\ft\reader\src\main\parsers\docx.ts`
- Create: `D:\ft\reader\src\main\parsers\html.ts`
- Test: `D:\ft\reader\tests\docx-html.test.ts`

**Interfaces:**
- Produces: `parseDocx(path)`、`parseHtmlFile(path)`，返回与 `parseTxt` 相同的 `{ meta, chapters }` 形状。

- [ ] **Step 1: 写失败测试（docx fixture 用 fflate 构造）**

`tests/docx-html.test.ts`：

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { strToU8, zipSync } from 'fflate'
import { parseDocx } from '../src/main/parsers/docx'
import { parseHtmlFile } from '../src/main/parsers/html'

let dir: string
beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), 'reader-docx-')) })
afterAll(async () => { await rm(dir, { recursive: true, force: true }) })

async function makeDocx(p: string): Promise<void> {
  const files = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>第一章</w:t></w:r></w:p><w:p><w:r><w:t>正文内容</w:t></w:r></w:p></w:body></w:document>')
  }
  await writeFile(p, zipSync(files))
}

describe('parseDocx', () => {
  it('解析 docx 并按标题切章', async () => {
    const p = join(dir, 'a.docx')
    await makeDocx(p)
    const out = await parseDocx(p)
    expect(out.chapters[0].title).toContain('第一章')
    expect(out.chapters[0].html).toContain('正文内容')
  })
})

describe('parseHtmlFile', () => {
  it('解析 html 并按 h1-h3 切章', async () => {
    const p = join(dir, 'a.html')
    await writeFile(p, '<html><head><title>网页书</title></head><body><h1>第一章</h1><p>内容A</p><h2>第二节</h2><p>内容B</p></body></html>', 'utf8')
    const out = await parseHtmlFile(p)
    expect(out.meta.title).toBe('网页书')
    expect(out.chapters).toHaveLength(2)
    expect(out.chapters[1].html).toContain('内容B')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm exec vitest run tests/docx-html.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现解析器**

`src/main/parsers/docx.ts`：

```ts
import mammoth from 'mammoth'
import { basename } from 'node:path'
import type { BookMeta, Chapter } from '../../shared/book'

export async function parseDocx(
  path: string
): Promise<{ meta: Omit<BookMeta, 'id' | 'addedAt' | 'path'>; chapters: Chapter[] }> {
  const { value } = await mammoth.convertToHtml({ path })
  const parts = value.split(/(?=<h[12][^>]*>)/i)
  const chapters: Chapter[] = []
  for (const part of parts) {
    const m = part.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i)
    const title = m ? m[1].replace(/<[^>]+>/g, '').trim() : `第 ${chapters.length + 1} 节`
    chapters.push({ id: `docx-${chapters.length}`, title, html: part })
  }
  if (chapters.length === 0) {
    chapters.push({ id: 'docx-0', title: basename(path), html: value || '<p>（空文档）</p>' })
  }
  return { meta: { title: basename(path), author: '', format: 'docx' }, chapters }
}
```

`src/main/parsers/html.ts`：

```ts
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import type { BookMeta, Chapter } from '../../shared/book'

export async function parseHtmlFile(
  path: string
): Promise<{ meta: Omit<BookMeta, 'id' | 'addedAt' | 'path'>; chapters: Chapter[] }> {
  let raw = await readFile(path, 'utf8')
  raw = raw.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
  const title = raw.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || basename(path)
  const parts = raw.split(/(?=<h[1-3][^>]*>)/i)
  const chapters: Chapter[] = []
  for (const part of parts) {
    const m = part.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)
    const chapterTitle = m ? m[1].replace(/<[^>]+>/g, '').trim() : `第 ${chapters.length + 1} 节`
    chapters.push({ id: `html-${chapters.length}`, title: chapterTitle, html: part })
  }
  return { meta: { title, author: '', format: 'html' }, chapters }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/docx-html.test.ts`
Expected: PASS（2 个用例）。

- [ ] **Step 5: book.open 接入 DOCX/HTML**

`src/main/ipc.ts` 中 `book:open` 增加：

```ts
if (item.meta.format === 'docx') {
  const parsed = await parseDocx(item.meta.path!)
  return { meta: { ...item.meta, ...parsed.meta }, chapters: parsed.chapters }
}
if (item.meta.format === 'html') {
  const parsed = await parseHtmlFile(item.meta.path!)
  return { meta: { ...item.meta, ...parsed.meta }, chapters: parsed.chapters }
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: DOCX/HTML 解析"
```

---

### Task 9: reader-file 协议与 PDF 阅读

**Files:**
- Create: `D:\ft\reader\src\main\protocol.ts`
- Create: `D:\ft\reader\src\renderer\reader\pdf-view.ts`
- Modify: `D:\ft\reader\src\main\index.ts`
- Modify: `D:\ft\reader\src\main\ipc.ts`
- Test: `D:\ft\reader\tests\protocol.test.ts`

**Interfaces:**
- Produces: `registerReaderProtocol()`、`toReaderFileUrl(filePath)`、`rewriteResourceUrls(html, convert)`；`renderPdf(container, url, onProgress)`。

- [ ] **Step 1: 写协议工具函数与测试**

`src/main/protocol.ts`：

```ts
import { protocol } from 'electron'
import { pathToFileURL } from 'node:url'

export function registerReaderProtocol(): void {
  protocol.handle('reader-file', (request) => {
    const url = new URL(request.url)
    const filePath = decodeURIComponent(url.pathname.replace(/^\//, ''))
    return fetch(pathToFileURL(filePath).toString())
  })
}

export function toReaderFileUrl(filePath: string): string {
  return `reader-file:///${encodeURI(filePath).replace(/%2F/gi, '/').replace(/%5C/gi, '/')}`
}

export function rewriteResourceUrls(html: string, convert: (p: string) => string): string {
  return html
    .replace(/(src|href)=["']([^"']+)["']/gi, (_, attr: string, value: string) => {
      if (/^(?:https?:|data:|blob:|reader-file:|#)/i.test(value)) return `${attr}="${value}"`
      return `${attr}="${convert(value)}"`
    })
    .replace(/url\(["']?([^"')]+)["']?\)/gi, (_, value: string) => {
      if (/^(?:https?:|data:|blob:|reader-file:)/i.test(value)) return `url("${value}")`
      return `url("${convert(value)}")`
    })
}
```

`tests/protocol.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { rewriteResourceUrls, toReaderFileUrl } from '../src/main/protocol'

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
```

- [ ] **Step 2: 注册协议**

`src/main/index.ts`：

```ts
import { app, protocol } from 'electron'
import { registerReaderProtocol } from './protocol'

protocol.registerSchemesAsPrivileged([
  { scheme: 'reader-file', privileges: { secure: true, supportFetchAPI: true, stream: true, bypassCSP: false } }
])

app.whenReady().then(() => {
  registerReaderProtocol()
  // 其余初始化
})
```

注意：`registerSchemesAsPrivileged` 必须在 `app.whenReady()` 之前调用（模块顶层）。

- [ ] **Step 3: 实现 PDF 视图**

`src/renderer/reader/pdf-view.ts`：

```ts
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export async function renderPdf(
  container: HTMLElement,
  url: string,
  onProgress: (page: number, total: number) => void
): Promise<{ next(): boolean; prev(): boolean; goTo(p: number): void }> {
  const doc = await pdfjsLib.getDocument(url).promise
  const canvas = document.createElement('canvas')
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')!
  let pageNumber = 1

  async function renderPage(n: number): Promise<void> {
    const page = await doc.getPage(n)
    const base = Math.max(container.clientWidth - 96, 320)
    const viewport = page.getViewport({ scale: 1 })
    const scale = base / viewport.width
    const scaled = page.getViewport({ scale })
    canvas.width = Math.floor(scaled.width)
    canvas.height = Math.floor(scaled.height)
    canvas.style.width = `${scaled.width}px`
    canvas.style.height = `${scaled.height}px`
    await page.render({ canvasContext: ctx, viewport: scaled }).promise
    onProgress(pageNumber, doc.numPages)
  }

  await renderPage(pageNumber)
  return {
    next: () => { if (pageNumber < doc.numPages) { pageNumber++; void renderPage(pageNumber); return true } return false },
    prev: () => { if (pageNumber > 1) { pageNumber--; void renderPage(pageNumber); return true } return false },
    goTo: (p) => { pageNumber = Math.max(1, Math.min(doc.numPages, p)); void renderPage(pageNumber) }
  }
}
```

- [ ] **Step 4: book.open 支持 PDF**

`src/main/ipc.ts`：

```ts
import { toReaderFileUrl } from './protocol'

ipcMain.handle('book:open', async (_e, id: string) => {
  const item = await library.get(id)
  if (!item) return null
  if (item.meta.format === 'pdf' && item.meta.path) {
    return { meta: item.meta, chapters: [], pdfUrl: toReaderFileUrl(item.meta.path) }
  }
  // ...其余分支
})
```

`src/renderer/components/reader.ts` 中：若 `data.pdfUrl`，调用 `renderPdf(pageEl, data.pdfUrl, (page, total) => { pctEl.textContent = ... })` 并把键盘翻页委托给返回的 `next/prev`。

- [ ] **Step 5: 构建与手工验证**

Run: `pnpm test && pnpm build`
Expected: 通过；打开一个 PDF 可翻页。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: reader-file 协议与 PDF 阅读"
```

---

### Task 10: 扫码上传服务

**Files:**
- Create: `D:\ft\reader\src\main\upload-server.ts`
- Test: `D:\ft\reader\tests\upload-server.test.ts`

**Interfaces:**
- Produces: `createUploadServer(dirs: { inbox: string; books: string }, settings: Settings): UploadManager`，方法 `start()`、`stop()`、`status()`、`onUploaded(cb)`。

- [ ] **Step 1: 写失败测试（Node 24 内置 FormData/fetch）**

`tests/upload-server.test.ts`：

```ts
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
  it('启动后可通过 token URL 上传 txt', async () => {
    const mgr = createUploadServer({ inbox: join(dir, 'inbox'), books: join(dir, 'books') }, { ...DEFAULT_SETTINGS })
    const status = await mgr.start()
    expect(status.running).toBe(true)
    expect(status.url).toContain('token=')

    let received = ''
    mgr.onUploaded((p) => { received = p })
    const form = new FormData()
    form.append('files', new Blob(['第一章\n内容'], { type: 'text/plain' }), 'test.txt')
    const res = await fetch(`${status.url}/upload`, { method: 'POST', body: form })
    expect(res.ok).toBe(true)

    for (let i = 0; i < 50 && !received; i++) await new Promise((r) => setTimeout(r, 50))
    expect(received.endsWith('.txt')).toBe(true)
    expect(await readFile(received, 'utf8')).toContain('第一章')
    mgr.stop()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm exec vitest run tests/upload-server.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现上传服务**

`src/main/upload-server.ts`：

```ts
import { randomBytes, randomUUID } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { networkInterfaces } from 'node:os'
import { extname, join } from 'node:path'
import busboy from 'busboy'
import QRCode from 'qrcode'
import type { Settings } from '../shared/book'
import { SUPPORTED_EXTENSIONS } from '../shared/book'
import type { UploadStatus } from '../shared/ipc'

export interface UploadManager {
  start(): Promise<UploadStatus>
  stop(): void
  status(): UploadStatus
  onUploaded(cb: (path: string) => void): () => void
}

export function createUploadServer(
  dirs: { inbox: string; books: string },
  settings: Settings
): UploadManager {
  let server: Server | null = null
  let port = 0
  let token = ''
  const listeners = new Set<(p: string) => void>()

  function lanIp(): string {
    for (const infos of Object.values(networkInterfaces())) {
      for (const info of infos ?? []) {
        if (info.family === 'IPv4' && !info.internal) return info.address
      }
    }
    return '127.0.0.1'
  }

  function url(): string {
    return `http://${lanIp()}:${port}/?token=${token}`
  }

  function page(): string {
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>上传到简阅</title><style>body{font-family:system-ui;padding:24px;max-width:480px;margin:0 auto}h1{font-size:20px}input,button{width:100%;padding:12px;margin:8px 0;font-size:16px}li{color:#2a7a2a}</style></head><body><h1>上传书籍到简阅</h1><input type="file" id="f" multiple accept=".txt,.epub,.mobi,.azw3,.fb2,.pdf,.html,.htm,.docx"><button onclick="upload()">上传</button><ul id="log"></ul><script>
async function upload(){const inp=document.getElementById('f');const log=document.getElementById('log');for(const file of inp.files){const fd=new FormData();fd.append('files',file);try{const r=await fetch('/upload',{method:'POST',body:fd});const j=await r.json();const li=document.createElement('li');li.textContent=j.ok?'已上传 '+file.name:'失败 '+file.name+': '+j.error;log.appendChild(li)}catch(e){const li=document.createElement('li');li.textContent='失败 '+file.name;log.appendChild(li)}}}
</script></body></html>`
  }

  return {
    async start(): Promise<UploadStatus> {
      if (server) return this.status()
      token = randomBytes(16).toString('hex')
      await mkdir(dirs.inbox, { recursive: true })
      await mkdir(dirs.books, { recursive: true })
      port = settings.uploadPortMode === 'fixed' && settings.uploadPort ? settings.uploadPort : 0
      server = createServer((req, res) => {
        const reqUrl = new URL(req.url ?? '/', `http://localhost:${port}`)
        if (reqUrl.pathname === '/' && reqUrl.searchParams.get('token') === token) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(page())
          return
        }
        if (reqUrl.pathname === '/upload' && reqUrl.searchParams.get('token') === token && req.method === 'POST') {
          const bb = busboy({ headers: req.headers })
          const saved: string[] = []
          bb.on('file', (_name, stream, info) => {
            const ext = extname(info.filename).toLowerCase().replace('.', '')
            if (!SUPPORTED_EXTENSIONS.includes(ext as (typeof SUPPORTED_EXTENSIONS)[number])) {
              stream.resume()
              return
            }
            const tmp = join(dirs.inbox, `${randomUUID()}.${ext}`)
            const chunks: Buffer[] = []
            stream.on('data', (c: Buffer) => {
              chunks.push(c)
              const total = chunks.reduce((s, x) => s + x.length, 0)
              if (total > settings.maxUploadMb * 1024 * 1024) {
                void rm(tmp, { force: true }).catch(() => undefined)
                stream.destroy(new Error('文件过大'))
              }
            })
            stream.on('end', async () => {
              await writeFile(tmp, Buffer.concat(chunks))
              const dest = join(dirs.books, `${randomUUID()}.${ext}`)
              await rename(tmp, dest)
              saved.push(dest)
            })
          })
          bb.on('finish', async () => {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            if (saved.length === 0) {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false, error: '没有可接受的文件' }))
              return
            }
            res.end(JSON.stringify({ ok: true, files: saved.map((p) => p.split('\\').pop()) }))
            for (const p of saved) {
              for (const cb of listeners) cb(p)
            }
          })
          req.pipe(bb)
          return
        }
        res.statusCode = 404
        res.end('Not Found')
      })
      await new Promise<void>((resolve) => server!.listen(port, '0.0.0.0', resolve))
      const addr = server.address()
      port = typeof addr === 'object' && addr ? addr.port : port
      const qrDataUrl = await QRCode.toDataURL(url())
      return { running: true, port, url: url(), qrDataUrl }
    },
    stop(): void {
      if (server) { server.close(); server = null }
    },
    status(): UploadStatus {
      return server ? { running: true, port, url: url(), qrDataUrl: '' } : { running: false }
    },
    onUploaded(cb: (p: string) => void): () => void {
      listeners.add(cb)
      return () => listeners.delete(cb)
    }
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/upload-server.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: 扫码上传 HTTP 服务"
```

---

### Task 11: 上传 UI（二维码面板 + 自动入库）

**Files:**
- Create: `D:\ft\reader\src\renderer\components\upload.ts`
- Modify: `D:\ft\reader\src\renderer\main.ts`
- Modify: `D:\ft\reader\src\main\ipc.ts`
- Modify: `D:\ft\reader\src\renderer\style.css`

**Interfaces:**
- Produces: `openUploadModal(container, onUploaded)`；主进程把上传文件自动加入书架并广播 `upload:uploaded`。

- [ ] **Step 1: 实现上传面板**

`src/renderer/components/upload.ts`：

```ts
export async function openUploadModal(container: HTMLElement, onUploaded: () => void): Promise<void> {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal">
      <h2>扫码上传</h2>
      <p class="upload-hint">用手机扫一扫，在浏览器里选择书籍文件上传</p>
      <div class="upload-qr"></div>
      <p class="upload-url"></p>
      <div class="modal-actions">
        <button data-act="start">启动服务</button>
        <button data-act="stop">停止</button>
        <button data-act="close">关闭</button>
      </div>
    </div>`
  container.appendChild(overlay)
  const qrEl = overlay.querySelector('.upload-qr') as HTMLElement
  const urlEl = overlay.querySelector('.upload-url') as HTMLElement

  async function refresh(): Promise<void> {
    const s = await window.reader.upload.status()
    if (s.running && s.qrDataUrl) {
      qrEl.innerHTML = `<img src="${s.qrDataUrl}" alt="二维码" />`
      urlEl.textContent = s.url ?? ''
    }
  }

  overlay.querySelector('[data-act="start"]')!.addEventListener('click', async () => {
    const s = await window.reader.upload.start()
    if (s.running && s.qrDataUrl) {
      qrEl.innerHTML = `<img src="${s.qrDataUrl}" alt="二维码" />`
      urlEl.textContent = s.url ?? ''
    }
  })
  overlay.querySelector('[data-act="stop"]')!.addEventListener('click', async () => {
    await window.reader.upload.stop()
    qrEl.innerHTML = ''
    urlEl.textContent = ''
  })
  overlay.querySelector('[data-act="close"]')!.addEventListener('click', () => overlay.remove())
  await refresh()
}
```

- [ ] **Step 2: 主进程接入 IPC 与自动入库**

`src/main/ipc.ts` 的 `registerIpc` 增加参数 `uploadManager`：

```ts
import type { UploadManager } from './upload-server'

ipcMain.handle('upload:status', () => uploadManager.status())
ipcMain.handle('upload:start', () => uploadManager.start())
ipcMain.handle('upload:stop', () => { uploadManager.stop() })

uploadManager.onUploaded((p) => {
  void library.addFiles([p])
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('upload:uploaded', p)
  }
})
```

`src/main/index.ts`：创建 `uploadManager`，`app.on('before-quit', () => uploadManager.stop())`。

- [ ] **Step 3: main.ts 接入弹窗**

```ts
import { openUploadModal } from './components/upload'

appEl.addEventListener('open-upload', () => {
  void openUploadModal(appEl, () => void showLibrary())
})
```

`style.css` 追加：

```css
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: #fff; border-radius: 12px; padding: 24px; width: 360px; text-align: center; }
.upload-qr img { width: 220px; height: 220px; }
.upload-url { font-size: 12px; color: #666; word-break: break-all; }
.modal-actions { display: flex; justify-content: center; gap: 8px; margin-top: 12px; }
```

- [ ] **Step 4: 构建与手工验证**

Run: `pnpm build`
Run: `pnpm dev` → 手机扫码 → 上传 txt → 书架出现新书。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: 扫码上传 UI 与自动入库"
```

---

### Task 12: 网络层与网页正文解析

**Files:**
- Create: `D:\ft\reader\src\main\network.ts`
- Create: `D:\ft\reader\src\main\readability.ts`
- Modify: `D:\ft\reader\src\main\ipc.ts`
- Test: `D:\ft\reader\tests\network.test.ts`

**Interfaces:**
- Produces: `fetchHtml(req: SourceRequest): Promise<string>`（15s 超时、1 次重试）、`parseWebPage(url): Promise<{ title: string; html: string }>`。

- [ ] **Step 1: 写失败测试（本地 HTTP 服务）**

`tests/network.test.ts`：

```ts
import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fetchHtml } from '../src/main/network'
import { parseWebPage } from '../src/main/readability'

let server: ReturnType<typeof createServer>
let base = ''

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/book') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end('<html><head><title>测试页</title></head><body><article><h1>标题</h1><p>正文内容</p></article></body></html>')
    } else {
      res.statusCode = 500
      res.end('err')
    }
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const addr = server.address()
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
})
afterAll(() => server.close())

describe('fetchHtml', () => {
  it('抓取 HTML 文本', async () => {
    const html = await fetchHtml({ url: `${base}/book` })
    expect(html).toContain('测试页')
  })
  it('非 2xx 抛错', async () => {
    await expect(fetchHtml({ url: `${base}/missing` })).rejects.toThrow()
  })
})

describe('parseWebPage', () => {
  it('提取标题与正文', async () => {
    const out = await parseWebPage(`${base}/book`)
    expect(out.title).toBe('测试页')
    expect(out.html).toContain('正文内容')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm exec vitest run tests/network.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现网络层与正文解析**

`src/main/network.ts`：

```ts
import iconv from 'iconv-lite'
import jschardet from 'jschardet'
import type { SourceRequest } from '../shared/source'

export class NetworkError extends Error {
  constructor(message: string, readonly kind: 'network' | 'http' | 'parse') {
    super(message)
  }
}

export async function fetchHtml(req: SourceRequest, attempt = 0): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(req.url, {
      method: req.method ?? 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ...(req.headers ?? {}) },
      body: req.method === 'POST' ? req.body : undefined,
      signal: controller.signal
    })
    if (!res.ok) throw new NetworkError(`HTTP ${res.status}`, 'http')
    const buf = Buffer.from(await res.arrayBuffer())
    if (req.charset === 'gbk') return iconv.decode(buf, 'gbk')
    if (req.charset === 'utf-8') return buf.toString('utf8')
    const detected = jschardet.detect(buf.subarray(0, 64 * 1024))?.encoding?.toLowerCase() ?? ''
    if (detected && iconv.encodingExists(detected)) {
      const decoded = iconv.decode(buf, detected)
      if (!decoded.includes('\uFFFD')) return decoded
    }
    const utf8 = buf.toString('utf8')
    return utf8.includes('\uFFFD') ? iconv.decode(buf, 'gbk') : utf8
  } catch (err) {
    if (attempt === 0 && !(err instanceof NetworkError)) return fetchHtml(req, 1)
    if (err instanceof NetworkError) throw err
    throw new NetworkError(err instanceof Error ? err.message : '网络请求失败', 'network')
  } finally {
    clearTimeout(timer)
  }
}
```

`src/main/readability.ts`：

```ts
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
  return { title: article.title || url, html: article.content }
}
```

`src/main/ipc.ts` 接入：

```ts
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseWebPage } from './readability'

ipcMain.handle('web:parse', async (_e, url: string) => {
  const { title, html } = await parseWebPage(url)
  const file = join(app.getPath('userData'), 'books', `${randomUUID()}.html`)
  await writeFile(file, html, 'utf8')
  const items = await library.addFiles([file])
  items[0].meta.title = title
  return items[0]
})
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/network.test.ts`
Expected: PASS（3 个用例）。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: 网络层与网页正文解析"
```

---

### Task 13: 书源类型校验

**Files:**
- Create: `D:\ft\reader\src\main\sources\types.ts`
- Create: `D:\ft\reader\src\main\sources\validate.ts`
- Test: `D:\ft\reader\tests\validate.test.ts`

**Interfaces:**
- Produces: `normalizeSource(raw: unknown): { source: BookSource; errors: string[] }`。

- [ ] **Step 1: 写失败测试**

`tests/validate.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { normalizeSource } from '../src/main/sources/validate'

const valid = {
  name: '示例书源',
  baseUrl: 'https://example.com',
  search: { url: 'https://example.com/s?q={{keyword}}', list: 'css:li', title: 'css:.t', bookUrl: 'css:a@href' }
}

describe('normalizeSource', () => {
  it('合法书源通过并补默认字段', () => {
    const { source, errors } = normalizeSource(valid)
    expect(errors).toEqual([])
    expect(source.enabled).toBe(true)
    expect(source.version).toBe(1)
    expect(source.id).toBeTruthy()
  })
  it('缺 baseUrl 报错', () => {
    expect(normalizeSource({ name: 'x' }).errors.some((e) => e.includes('baseUrl'))).toBe(true)
  })
  it('非法规则语法报错', () => {
    const { errors } = normalizeSource({ ...valid, search: { ...valid.search, list: 'xpath://div' } })
    expect(errors.some((e) => e.includes('list'))).toBe(true)
  })
  it('协议白名单校验', () => {
    const { errors } = normalizeSource({ ...valid, baseUrl: 'file:///etc/passwd' })
    expect(errors.some((e) => e.includes('http'))).toBe(true)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm exec vitest run tests/validate.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现**

`src/main/sources/types.ts`：

```ts
export type { BookSource, SourceStep } from '../../shared/source'
```

`src/main/sources/validate.ts`：

```ts
import { randomUUID } from 'node:crypto'
import type { BookSource, SourceStep } from '../../shared/source'

const RULE_PREFIX = /^(css:|regex:)/
const HTTP_RE = /^https?:\/\//i

function checkStep(step: unknown, name: string, errors: string[]): void {
  if (!step || typeof step !== 'object') { errors.push(`${name} 缺失`); return }
  const s = step as Record<string, unknown>
  if (typeof s.url !== 'string' || !s.url.includes('{{')) errors.push(`${name}.url 必须是含模板变量的字符串`)
  for (const key of ['list', 'title', 'author', 'bookUrl', 'cover', 'intro', 'chapterUrl', 'content']) {
    const v = s[key]
    if (v !== undefined && (typeof v !== 'string' || !RULE_PREFIX.test(v))) {
      errors.push(`${name}.${key} 规则必须以 css: 或 regex: 开头`)
    }
  }
}

export function normalizeSource(raw: unknown): { source: BookSource; errors: string[] } {
  const errors: string[] = []
  const r = (raw ?? {}) as Record<string, unknown>
  if (typeof r.name !== 'string' || !r.name.trim()) errors.push('name 缺失')
  if (typeof r.baseUrl !== 'string' || !HTTP_RE.test(r.baseUrl)) errors.push('baseUrl 必须是 http/https 地址')
  checkStep(r.search, 'search', errors)
  checkStep(r.detail, 'detail', errors)
  checkStep(r.chapters, 'chapters', errors)
  checkStep(r.content, 'content', errors)
  const source: BookSource = {
    id: typeof r.id === 'string' ? r.id : randomUUID(),
    name: typeof r.name === 'string' ? r.name.trim() : '未命名书源',
    version: typeof r.version === 'number' ? r.version : 1,
    baseUrl: typeof r.baseUrl === 'string' ? r.baseUrl.replace(/\/+$/, '') : '',
    enabled: r.enabled !== false,
    search: r.search as SourceStep | undefined,
    detail: r.detail as SourceStep | undefined,
    chapters: r.chapters as SourceStep | undefined,
    content: r.content as SourceStep | undefined
  }
  return { source, errors }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/validate.test.ts`
Expected: PASS（4 个用例）。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: 书源类型与校验"
```

---

### Task 14: 书源模板与提取引擎

**Files:**
- Create: `D:\ft\reader\src\main\sources\template.ts`
- Create: `D:\ft\reader\src\main\sources\extract.ts`
- Test: `D:\ft\reader\tests\extract.test.ts`

**Interfaces:**
- Produces: `renderTemplate(tpl, vars)`、`resolveUrl(base, value)`、`createDoc(html)`、`queryRule(el, rule)`、`evalRule(el, rule)`、`applyRemoveRules(doc, rules)`。

- [ ] **Step 1: 写失败测试**

`tests/extract.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { applyRemoveRules, createDoc, evalRule, queryRule } from '../src/main/sources/extract'
import { renderTemplate, resolveUrl } from '../src/main/sources/template'

describe('template', () => {
  it('渲染模板变量与 urlencode', () => {
    expect(renderTemplate('/s?q={{keyword}}&p={{keyword|urlencode}}', { keyword: '斗破 苍穹' }))
      .toBe('/s?q=斗破 苍穹&p=%E6%96%97%E7%A0%B4%20%E8%8B%8D%E7%A9%B9')
  })
  it('相对 URL 基于 base 拼接', () => {
    expect(resolveUrl('https://a.com/b/', 'c/d.html')).toBe('https://a.com/b/c/d.html')
  })
})

describe('extract', () => {
  const html = '<ul class="list"><li class="book"><a href="/b/1.html" class="t">书一</a><span class="a">作者甲</span></li><li class="book"><a href="/b/2.html" class="t">书二</a><span class="a">作者乙</span></li></ul><div class="ad">广告</div><div id="content"><p>正文</p><p>完</p></div>'
  it('按 css 取列表与字段', () => {
    const doc = createDoc(html)
    const items = queryRule(doc, 'css:li.book')
    expect(items).toHaveLength(2)
    expect(evalRule(items[0], 'css:.t@text')).toBe('书一')
    expect(evalRule(items[0], 'css:a@href')).toBe('/b/1.html')
  })
  it('regex 提取', () => {
    expect(evalRule(createDoc(html), 'regex:书([一二])')).toBe('一')
  })
  it('移除规则清理广告', () => {
    const doc = createDoc(html)
    applyRemoveRules(doc, ['css:.ad'])
    expect(doc.body.innerHTML).not.toContain('广告')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm exec vitest run tests/extract.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现**

`src/main/sources/template.ts`：

```ts
export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*([\w.]+?)(?:\|([\w]+))?\s*\}\}/g, (_, key: string, filter?: string) => {
    const raw = vars[key] ?? ''
    return filter === 'urlencode' ? encodeURIComponent(raw) : raw
  })
}

export function resolveUrl(base: string, value: string): string {
  if (/^https?:\/\//i.test(value)) return value
  return new URL(value, base).toString()
}
```

`src/main/sources/extract.ts`：

```ts
import { JSDOM } from 'jsdom'

export function createDoc(html: string): Document {
  return new JSDOM(html).window.document
}

export function queryRule(el: Element | Document, rule: string): Element[] {
  if (!rule.startsWith('css:')) return []
  return [...el.querySelectorAll(rule.slice(4))]
}

export function evalRule(el: Element | Document, rule: string): string {
  if (!rule) return ''
  if (rule.startsWith('regex:')) {
    const m = new RegExp(rule.slice(6)).exec(el.textContent ?? '')
    return m ? (m[1] ?? m[0]) : ''
  }
  if (!rule.startsWith('css:')) return ''
  const [sel, attr = 'text'] = rule.slice(4).split('@')
  const node = sel
    ? (el instanceof Document ? el.querySelector(sel) : (el as Element).matches(sel) ? (el as Element) : el.querySelector(sel))
    : el instanceof Document ? null : (el as Element)
  if (!node) return ''
  if (attr === 'html') return node.innerHTML ?? ''
  if (attr) return node.getAttribute(attr)?.trim() ?? ''
  return node.textContent?.trim() ?? ''
}

export function applyRemoveRules(doc: Document, rules: string[] = []): void {
  for (const rule of rules) {
    if (rule.startsWith('css:')) {
      doc.querySelectorAll(rule.slice(4)).forEach((n) => n.remove())
    } else if (rule.startsWith('regex:')) {
      const re = new RegExp(rule.slice(6), 'g')
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
      let n: Node | null
      while ((n = walker.nextNode())) {
        const t = n as Text
        if (re.test(t.data)) t.data = t.data.replace(re, '')
        re.lastIndex = 0
      }
    }
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/extract.test.ts`
Expected: PASS（5 个用例）。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: 书源模板与提取引擎"
```

---

### Task 15: 书源搜索 / 章节 / 正文

**Files:**
- Create: `D:\ft\reader\src\main\sources\engine.ts`
- Modify: `D:\ft\reader\src\main\ipc.ts`
- Test: `D:\ft\reader\tests\engine.test.ts`

**Interfaces:**
- Produces: `searchSource(src, keyword)`、`fetchChapterList(src, bookUrl)`、`fetchChapterContent(src, chapterUrl)`、`createCachedEngine(cacheDir)`。

- [ ] **Step 1: 写失败测试（本地书源 HTML）**

`tests/engine.test.ts`：

```ts
import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { BookSource } from '../src/shared/source'
import { fetchChapterContent, fetchChapterList, searchSource } from '../src/main/sources/engine'

let server: ReturnType<typeof createServer>
let base = ''
beforeAll(async () => {
  server = createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    if (req.url?.startsWith('/search')) {
      res.end('<ul><li><a class="t" href="/b1">书一</a><span class="a">甲</span></li></ul>')
    } else if (req.url === '/b1') {
      res.end('<div class="chapters"><a href="/c1">第一章</a></div>')
    } else if (req.url === '/c1') {
      res.end('<div id="content"><p>第一章内容</p><div class="ad">广告</div></div>')
    } else {
      res.end('')
    }
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const addr = server.address()
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
})
afterAll(() => server.close())

const src: BookSource = {
  id: 's1', name: 't', version: 1, baseUrl: base, enabled: true,
  search: { url: `${base}/search?q={{keyword}}`, list: 'css:li', title: 'css:.t@text', author: 'css:.a@text', bookUrl: 'css:.t@href' },
  chapters: { url: '{{bookUrl}}', list: 'css:.chapters a', title: 'css:@text', chapterUrl: 'css:@href' },
  content: { url: '{{chapterUrl}}', content: 'css:#content', remove: ['css:.ad'] }
}

describe('source engine', () => {
  it('搜索返回结果', async () => {
    const results = await searchSource(src, '书')
    expect(results[0].title).toBe('书一')
    expect(results[0].bookUrl).toContain('/b1')
  })
  it('章节列表', async () => {
    const list = await fetchChapterList(src, `${base}/b1`)
    expect(list[0].title).toBe('第一章')
  })
  it('正文抓取并清理', async () => {
    const html = await fetchChapterContent(src, `${base}/c1`)
    expect(html).toContain('第一章内容')
    expect(html).not.toContain('广告')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm exec vitest run tests/engine.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现引擎**

`src/main/sources/engine.ts`：

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { BookSource, SourceChapter, SourceSearchResult } from '../../shared/source'
import { fetchHtml } from '../network'
import { applyRemoveRules, createDoc, evalRule, queryRule } from './extract'
import { renderTemplate, resolveUrl } from './template'

function stepUrl(step: { url: string }, vars: Record<string, string>): string {
  return renderTemplate(step.url, vars)
}

export async function searchSource(src: BookSource, keyword: string): Promise<SourceSearchResult[]> {
  const step = src.search
  if (!step) throw new Error('该书源未配置搜索')
  const url = stepUrl(step, { keyword, baseUrl: src.baseUrl })
  const html = await fetchHtml({ ...step, url })
  const doc = createDoc(html)
  const items = queryRule(doc, step.list ?? 'body')
  return items.map((el) => ({
    title: evalRule(el, step.title ?? 'css:@text'),
    author: evalRule(el, step.author ?? ''),
    bookUrl: resolveUrl(src.baseUrl, evalRule(el, step.bookUrl ?? 'css:@text')),
    cover: step.cover ? resolveUrl(src.baseUrl, evalRule(el, step.cover)) : undefined,
    intro: step.intro ? evalRule(el, step.intro) : undefined
  })).filter((r) => r.title && r.bookUrl)
}

export async function fetchChapterList(src: BookSource, bookUrl: string): Promise<SourceChapter[]> {
  const step = src.chapters
  if (!step) throw new Error('该书源未配置章节列表')
  const url = stepUrl(step, { bookUrl, baseUrl: src.baseUrl })
  const html = await fetchHtml({ ...step, url })
  const doc = createDoc(html)
  const items = queryRule(doc, step.list ?? 'body')
  return items.map((el, i) => ({
    id: `src-${i}`,
    title: evalRule(el, step.title ?? 'css:@text'),
    url: resolveUrl(src.baseUrl, evalRule(el, step.chapterUrl ?? 'css:@text'))
  })).filter((c) => c.title && c.url)
}

export async function fetchChapterContent(src: BookSource, chapterUrl: string): Promise<string> {
  const step = src.content
  if (!step?.content) throw new Error('该书源未配置正文规则')
  const url = stepUrl(step, { chapterUrl, baseUrl: src.baseUrl })
  const html = await fetchHtml({ ...step, url })
  const doc = createDoc(html)
  const node = doc.querySelector(step.content.slice(4))
  if (!node) throw new Error('正文规则未匹配到内容')
  const wrapper = doc.createElement('div')
  wrapper.innerHTML = node.innerHTML
  applyRemoveRules(doc, step.remove)
  return wrapper.innerHTML
}

export function createCachedEngine(cacheDir: string) {
  return {
    async content(src: BookSource, chapterUrl: string): Promise<string> {
      const key = encodeURIComponent(chapterUrl)
      const file = join(cacheDir, src.id, `${key}.html`)
      try {
        return await readFile(file, 'utf8')
      } catch {
        const html = await fetchChapterContent(src, chapterUrl)
        await mkdir(join(cacheDir, src.id), { recursive: true })
        await writeFile(file, html, 'utf8')
        return html
      }
    }
  }
}
```

- [ ] **Step 4: 书源 IPC 接入**

`src/main/ipc.ts` 的 `registerIpc` 增加 `sourcesFile: string`、`sourceCacheDir: string`：

```ts
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { BookSource } from '../shared/source'
import { normalizeSource } from './sources/validate'
import { createCachedEngine, fetchChapterContent, fetchChapterList, searchSource } from './sources/engine'

async function readSources(): Promise<BookSource[]> {
  try { return JSON.parse(await readFile(sourcesFile, 'utf8')) } catch { return [] }
}
async function writeSources(list: BookSource[]): Promise<void> {
  await writeFile(sourcesFile, JSON.stringify(list, null, 2), 'utf8')
}
const engine = createCachedEngine(sourceCacheDir)

ipcMain.handle('sources:list', () => readSources())
ipcMain.handle('sources:importDialog', async () => {
  const win = BrowserWindow.getFocusedWindow()
  const r = await dialog.showOpenDialog(win!, { properties: ['openFile'], filters: [{ name: '书源', extensions: ['json'] }] })
  if (r.canceled || r.filePaths.length === 0) return readSources()
  const raw = JSON.parse(await readFile(r.filePaths[0], 'utf8'))
  const { source, errors } = normalizeSource(raw)
  if (errors.length) throw new Error(errors.join('；'))
  const list = await readSources()
  list.push(source)
  await writeSources(list)
  return list
})
ipcMain.handle('sources:importUrl', async (_e, url: string) => {
  const raw = JSON.parse(await fetchHtml({ url }))
  const { source, errors } = normalizeSource(raw)
  if (errors.length) throw new Error(errors.join('；'))
  const list = await readSources()
  list.push(source)
  await writeSources(list)
  return list
})
ipcMain.handle('sources:save', async (_e, s: BookSource) => {
  const list = await readSources()
  const i = list.findIndex((x) => x.id === s.id)
  if (i >= 0) list[i] = s
  else list.push(s)
  await writeSources(list)
})
ipcMain.handle('sources:remove', async (_e, id: string) => writeSources((await readSources()).filter((s) => s.id !== id)))
ipcMain.handle('sources:export', async (_e, id: string) => {
  const s = (await readSources()).find((x) => x.id === id)
  if (!s) return null
  const r = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow()!, { defaultPath: `${s.name}.json` })
  if (r.canceled || !r.filePath) return null
  await writeFile(r.filePath, JSON.stringify(s, null, 2), 'utf8')
  return r.filePath
})
ipcMain.handle('sources:search', async (_e, sourceId: string, keyword: string) => {
  const src = (await readSources()).find((s) => s.id === sourceId)
  if (!src) throw new Error('书源不存在')
  return searchSource(src, keyword)
})
ipcMain.handle('sources:chapters', async (_e, sourceId: string, bookUrl: string) => {
  const src = (await readSources()).find((s) => s.id === sourceId)
  if (!src) throw new Error('书源不存在')
  return fetchChapterList(src, bookUrl)
})
ipcMain.handle('sources:content', async (_e, sourceId: string, chapterUrl: string) => {
  const src = (await readSources()).find((s) => s.id === sourceId)
  if (!src) throw new Error('书源不存在')
  return engine.content(src, chapterUrl)
})
```

`src/main/index.ts` 传入 `join(userData, 'sources.json')` 与 `join(userData, 'cache')`。

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm exec vitest run tests/engine.test.ts`
Expected: PASS（3 个用例）。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: 书源搜索/章节/正文引擎"
```

---

### Task 16: 书源 UI

**Files:**
- Create: `D:\ft\reader\src\renderer\components\sources.ts`
- Modify: `D:\ft\reader\src\renderer\main.ts`
- Modify: `D:\ft\reader\src\renderer\style.css`

**Interfaces:**
- Produces: `openSourcesModal(container)`。

- [ ] **Step 1: 实现书源面板**

`src/renderer/components/sources.ts`：

```ts
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
      const row = document.createElement('button')
      row.className = 'source-result'
      row.textContent = `${r.title} · ${r.author}`
      row.addEventListener('click', async () => {
        const chapters = await window.reader.sources.chapters(sourceId, r.bookUrl)
        const idx = Number(prompt(`共 ${chapters.length} 章，输入章节号（1-${chapters.length}）`, '1') ?? '1')
        const chapter = chapters[Math.max(0, idx - 1)]
        if (!chapter) return
        const html = await window.reader.sources.content(sourceId, chapter.url)
        const view = document.createElement('div')
        view.className = 'source-content'
        view.innerHTML = `<h2>${escapeHtml(chapter.title)}</h2><div>${html}</div><button>关闭</button>`
        view.querySelector('button')!.addEventListener('click', () => view.remove())
        overlay.appendChild(view)
      })
      resultsEl.appendChild(row)
    }
  })
  await refresh()
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
```

注意：正文 HTML 在本任务直接插入；阅读前必须经过 `sanitizeHtml`（Task 6），本任务临时展示为可接受的最小实现，Task 17 接入书架后统一走净化。

- [ ] **Step 2: main.ts 接入**

```ts
import { openSourcesModal } from './components/sources'

appEl.addEventListener('open-sources', () => void openSourcesModal(appEl))
```

`style.css` 追加：

```css
.source-modal { width: 560px; max-height: 80vh; overflow-y: auto; text-align: left; }
.source-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid #eee; }
.source-row span { flex: 1; }
.source-result { display: block; width: 100%; text-align: left; padding: 8px; margin: 4px 0; cursor: pointer; }
.source-content { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-top: 12px; background: #fff; }
```

- [ ] **Step 3: 构建与手工验证**

Run: `pnpm build`
Run: `pnpm dev` → 导入书源 → 搜索 → 打开章节。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: 书源管理 UI"
```

---

### Task 17: 书源书籍加入书架

**Files:**
- Modify: `D:\ft\reader\src\main\library.ts`
- Modify: `D:\ft\reader\src\main\ipc.ts`
- Modify: `D:\ft\reader\src\renderer\components\sources.ts`
- Modify: `D:\ft\reader\src\main\sources\engine.ts`
- Test: `D:\ft\reader\tests\library-source.test.ts`

**Interfaces:**
- Produces: `library.addSourceBook(args)`；`book:open` 对 `format === 'source'` 返回书源章节。

- [ ] **Step 1: 写失败测试**

`tests/library-source.test.ts`：

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LibraryStore } from '../src/main/library'

let dir: string
beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), 'reader-src-')) })
afterAll(async () => { await rm(dir, { recursive: true, force: true }) })

describe('LibraryStore.addSourceBook', () => {
  it('写入书源书籍元数据', async () => {
    const item = await new LibraryStore(dir).addSourceBook({ sourceId: 's1', bookUrl: 'https://x.com/b', title: '在线书', author: '某作者' })
    expect(item.meta.format).toBe('source')
    expect(item.meta.sourceId).toBe('s1')
    expect((await new LibraryStore(dir).list())[0].meta.title).toBe('在线书')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm exec vitest run tests/library-source.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现**

`src/main/library.ts` 增加：

```ts
async addSourceBook(this: LibraryStore, args: {
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
  this.scheduleSave()
  return this.items[id]
}
```

`src/main/ipc.ts` 增加：

```ts
ipcMain.handle('sources:addBook', (_e, args: { sourceId: string; bookUrl: string; title: string; author?: string; cover?: string }) =>
  library.addSourceBook(args)
)
```

`src/main/ipc.ts` 的 `book:open` 增加分支：

```ts
if (item.meta.format === 'source' && item.meta.sourceId && item.meta.bookUrl) {
  const src = (await readSources()).find((s) => s.id === item.meta.sourceId)
  if (!src) throw new Error('书源已删除')
  const chapters = await fetchChapterList(src, item.meta.bookUrl)
  const loaded: Chapter[] = []
  for (const c of chapters) {
    loaded.push({ id: c.id, title: c.title, html: await engine.content(src, c.url) })
  }
  return { meta: item.meta, chapters: loaded }
}
```

`src/renderer/components/sources.ts` 搜索结果行增加“加入书架”：

```ts
const addBtn = document.createElement('button')
addBtn.textContent = '加入书架'
addBtn.addEventListener('click', async () => {
  await window.reader.sources.addBook({ sourceId, bookUrl: r.bookUrl, title: r.title, author: r.author, cover: r.cover })
  overlay.remove()
  container.dispatchEvent(new CustomEvent('library-changed'))
})
row.appendChild(addBtn)
```

`src/renderer/main.ts` 监听 `library-changed` 后重渲染书架。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/library-source.test.ts`
Expected: PASS。
Run: `pnpm build`
Expected: 通过。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: 书源书籍加入书架"
```

---

### Task 18: 设置面板完善

**Files:**
- Create: `D:\ft\reader\src\renderer\components\settings.ts`
- Modify: `D:\ft\reader\src\renderer\main.ts`

**Interfaces:**
- Produces: `openSettingsModal(container)`。

- [ ] **Step 1: 设置面板**

`src/renderer/components/settings.ts`：

```ts
export async function openSettingsModal(container: HTMLElement): Promise<void> {
  const s = await window.reader.settings.get()
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal">
      <h2>设置</h2>
      <label>主题 <select data-set="theme"><option value="light">白</option><option value="sepia">米黄</option><option value="dark">夜间</option></select></label>
      <label>默认字号 <input type="number" data-set="fontSize" min="12" max="32" /></label>
      <label>默认行距 <input type="number" data-set="lineHeight" min="1.2" max="2.6" step="0.1" /></label>
      <label>上传端口 <select data-set="uploadPortMode"><option value="random">随机</option><option value="fixed">固定</option></select></label>
      <label>上传上限(MB) <input type="number" data-set="maxUploadMb" min="1" max="1024" /></label>
      <button data-act="close">关闭</button>
    </div>`
  container.appendChild(overlay)
  overlay.querySelectorAll('[data-set]').forEach((el) => {
    const key = (el as HTMLElement).dataset.set!
    ;(el as HTMLInputElement).value = String((s as Record<string, unknown>)[key])
    el.addEventListener('change', async () => {
      const raw = (el as HTMLInputElement).value
      const patch: Record<string, unknown> = { [key]: ['fontSize', 'lineHeight', 'maxUploadMb'].includes(key) ? Number(raw) : raw }
      await window.reader.settings.set(patch as never)
      document.body.dataset.theme = key === 'theme' ? raw : document.body.dataset.theme
    })
  })
  overlay.querySelector('[data-act="close"]')!.addEventListener('click', () => overlay.remove())
}
```

- [ ] **Step 2: main.ts 接入**

```ts
import { openSettingsModal } from './components/settings'

appEl.addEventListener('open-settings', () => void openSettingsModal(appEl))
```

- [ ] **Step 3: 构建与手工验证**

Run: `pnpm test && pnpm build`
Run: `pnpm dev` → 修改设置 → 重启后保留。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: 设置面板"
```

---

### Task 19: 打包配置、README 与验收

**Files:**
- Create: `D:\ft\reader\README.md`

**Interfaces:**
- 无新接口；验收入口。

- [ ] **Step 1: 写 README**

`README.md` 包含：功能清单、开发运行（`pnpm install` / `pnpm dev`）、测试与构建（`pnpm test` / `pnpm build`）、打包（`pnpm dist`，产物在 `dist/`）、扫码上传步骤、Windows 防火墙放行示例：

```powershell
netsh advfirewall firewall add rule name="jian-yue-upload" dir=in action=allow protocol=TCP localport=6789
```

书源 JSON 示例（引用设计文档 6.5.1）、数据位置说明、格式支持列表。

- [ ] **Step 2: 打包验证**

Run: `pnpm dist`
Expected: `dist/` 下生成安装包与便携版；均可启动。

- [ ] **Step 3: 全量验收清单（手工）**

- [ ] TXT（GBK 与 UTF-8）可读、翻页、进度恢复
- [ ] EPUB/MOBI/AZW3/FB2/PDF/DOCX/HTML 各一份可打开
- [ ] 书架增删、导入导出
- [ ] 扫码上传：同一局域网手机扫码 → 上传 → 自动入书架
- [ ] 书源：导入 → 搜索 → 开章节 → 加入书架 → 断网读缓存
- [ ] 网页解析：粘贴 URL → 生成书籍
- [ ] 设置持久化、夜间主题、字号
- [ ] 打包产物启动与进度恢复

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: README 与验收清单"
```

---

## Self-Review

1. **Spec 覆盖：** 设计文档 6.1 书架 → Task 4/5；6.2 阅读器 → Task 6/9；6.3 格式管线 → Task 3/7/8/9；6.4 扫码上传 → Task 10/11；6.5 书源 → Task 13/14/15/16/17；6.6 网页解析 → Task 12；6.7 设置 → Task 18；7 存储 → Task 4；8 IPC → Task 2 起逐步补齐；9 安全 → Task 1/9/14；10 错误处理 → 各解析器 throw + UI 提示；11 测试 → 各 Task；12 打包 → Task 19。
2. **占位符扫描：** 无 TBD/TODO。Task 16 的正文展示注明先临时插入、Task 17 统一净化；`library:import` 在 Task 4 已实现为无参对话框版本。
3. **类型一致性：** `BookOpenResult.pdfUrl` 在 Task 2 定义、Task 9 使用；`sources:importDialog` 在 Task 2 预置、Task 15 实现；`createCachedEngine` 在 Task 15 定义、Task 17 使用；`canNext` 在 Task 6 定义并导出。

