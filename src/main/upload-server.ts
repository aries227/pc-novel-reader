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

interface PendingFile {
  ext: string
  chunks: Buffer[]
  tooLarge: boolean
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
async function upload(){const inp=document.getElementById('f');const log=document.getElementById('log');for(const file of inp.files){const fd=new FormData();fd.append('files',file);try{const r=await fetch('/upload'+location.search,{method:'POST',body:fd});const j=await r.json();const li=document.createElement('li');li.textContent=j.ok?'已上传 '+file.name:'失败 '+file.name+': '+j.error;log.appendChild(li)}catch(e){const li=document.createElement('li');li.textContent='失败 '+file.name;log.appendChild(li)}}}
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
          const pending: PendingFile[] = []
          bb.on('file', (_name, stream, info) => {
            const ext = extname(info.filename).toLowerCase().replace('.', '')
            if (!SUPPORTED_EXTENSIONS.includes(ext as (typeof SUPPORTED_EXTENSIONS)[number])) {
              stream.resume()
              return
            }
            const rec: PendingFile = { ext, chunks: [], tooLarge: false }
            pending.push(rec)
            stream.on('data', (c: Buffer) => {
              rec.chunks.push(c)
              const total = rec.chunks.reduce((s, x) => s + x.length, 0)
              if (total > settings.maxUploadMb * 1024 * 1024) rec.tooLarge = true
            })
          })
          bb.on('finish', async () => {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            const saved: string[] = []
            for (const rec of pending) {
              if (rec.tooLarge) continue
              const tmp = join(dirs.inbox, `${randomUUID()}.${rec.ext}`)
              const dest = join(dirs.books, `${randomUUID()}.${rec.ext}`)
              await writeFile(tmp, Buffer.concat(rec.chunks))
              await rename(tmp, dest)
              saved.push(dest)
            }
            if (saved.length === 0) {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false, error: '没有可接受的文件或文件过大' }))
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
