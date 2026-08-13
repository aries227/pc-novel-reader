import { protocol } from 'electron'
import { pathToFileURL } from 'node:url'

export function registerReaderProtocol(): void {
  protocol.handle('reader-file', (request) => {
    const url = new URL(request.url)
    const filePath = decodeURIComponent(url.pathname.replace(/^\//, ''))
    return fetch(pathToFileURL(filePath).toString())
  })
}
