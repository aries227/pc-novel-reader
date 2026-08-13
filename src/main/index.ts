import { app, BrowserWindow, protocol } from 'electron'
import { join } from 'node:path'
import { registerReaderProtocol } from './protocol'
import { LibraryStore } from './library'
import { SettingsStore } from './settings'
import { registerIpc } from './ipc'

protocol.registerSchemesAsPrivileged([
  { scheme: 'reader-file', privileges: { secure: true, supportFetchAPI: true, stream: true, bypassCSP: false } }
])

let win: BrowserWindow | null = null

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

app.whenReady().then(() => {
  registerReaderProtocol()
  const userData = app.getPath('userData')
  registerIpc(new LibraryStore(userData), new SettingsStore(userData))
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
