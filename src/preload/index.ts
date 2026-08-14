import { contextBridge, ipcRenderer } from 'electron'
import type { AiChatRequest, ReaderApi } from '../shared/ipc'

const api: ReaderApi = {
  library: {
    list: () => ipcRenderer.invoke('library:list'),
    addFiles: (paths) => ipcRenderer.invoke('library:addFiles', paths),
    addFolder: () => ipcRenderer.invoke('library:addFolder'),
    remove: (id) => ipcRenderer.invoke('library:remove', id),
    rename: (id, title) => ipcRenderer.invoke('library:rename', id, title),
    clear: () => ipcRenderer.invoke('library:clear'),
    import: () => ipcRenderer.invoke('library:import'),
    export: () => ipcRenderer.invoke('library:export')
  },
  book: {
    open: (id) => ipcRenderer.invoke('book:open', id),
    saveProgress: (p) => ipcRenderer.invoke('book:saveProgress', p),
    listBookmarks: (id) => ipcRenderer.invoke('book:listBookmarks', id),
    addBookmark: (b) => ipcRenderer.invoke('book:addBookmark', b),
    removeBookmark: (id) => ipcRenderer.invoke('book:removeBookmark', id),
    listHighlights: (id) => ipcRenderer.invoke('book:listHighlights', id),
    addHighlight: (b) => ipcRenderer.invoke('book:addHighlight', b),
    removeHighlight: (id) => ipcRenderer.invoke('book:removeHighlight', id)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch),
    uploadBackground: () => ipcRenderer.invoke('settings:uploadBackground'),
    clearBackground: () => ipcRenderer.invoke('settings:clearBackground'),
    uploadFont: () => ipcRenderer.invoke('settings:uploadFont'),
    clearFont: () => ipcRenderer.invoke('settings:clearFont')
  },
  translate: { translate: (text) => ipcRenderer.invoke('translate:translate', text) },
  ai: {
    test: (provider) => ipcRenderer.invoke('ai:test', provider),
    fetchModels: (provider) => ipcRenderer.invoke('ai:fetchModels', provider),
    chat: (req: AiChatRequest) => ipcRenderer.invoke('ai:chat', req),
    quiz: (req) => ipcRenderer.invoke('ai:quiz', req)
  },
  dictionary: {
    lookup: (word) => ipcRenderer.invoke('dictionary:lookup', word),
    examples: (word) => ipcRenderer.invoke('dictionary:examples', word),
    import: () => ipcRenderer.invoke('dictionary:import'),
    stats: () => ipcRenderer.invoke('dictionary:stats')
  },
  vocab: {
    list: () => ipcRenderer.invoke('vocab:list'),
    add: (input) => ipcRenderer.invoke('vocab:add', input),
    remove: (id) => ipcRenderer.invoke('vocab:remove', id),
    update: (id, patch) => ipcRenderer.invoke('vocab:update', id, patch)
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
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'),
    onStatus: (cb) => {
      const listener = (_e: unknown, status: { phase: string; version?: string; percent?: number; message?: string }) => cb(status)
      ipcRenderer.on('update:status', listener)
      return () => ipcRenderer.removeListener('update:status', listener)
    }
  },
  dialog: { openFiles: () => ipcRenderer.invoke('dialog:openFiles') },
  app: { quit: () => ipcRenderer.send('app:quit') }
}

contextBridge.exposeInMainWorld('reader', api)
