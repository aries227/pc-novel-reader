import { app, BrowserWindow, protocol } from 'electron'
import { join } from 'node:path'
import { registerReaderProtocol } from './protocol'
import { LibraryStore } from './library'
import { SettingsStore } from './settings'
import { registerIpc } from './ipc'
import { createUploadServer } from './upload-server'

protocol.registerSchemesAsPrivileged([
  { scheme: 'reader-file', privileges: { secure: true, supportFetchAPI: true, stream: true, bypassCSP: false } }
])

let win: BrowserWindow | null = null
let uploadManager: ReturnType<typeof createUploadServer> | null = null

function createWindow(): void {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: '简阅',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  registerReaderProtocol()
  const userData = app.getPath('userData')
  const settings = new SettingsStore(userData)
  const s = await settings.get()
  uploadManager = createUploadServer(
    { inbox: join(userData, 'upload-inbox'), books: join(userData, 'books') },
    s
  )
  registerIpc(new LibraryStore(userData), settings, uploadManager)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => { uploadManager?.stop() })
