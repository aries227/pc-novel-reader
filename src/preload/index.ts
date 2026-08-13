import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('reader', {
  ping: (): Promise<string> => Promise.resolve('pong')
})
