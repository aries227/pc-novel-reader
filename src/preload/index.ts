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
