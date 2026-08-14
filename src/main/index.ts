import { app, BrowserWindow, Menu, protocol } from 'electron'
import { join } from 'node:path'
import { createDictionary } from './dictionary'
import { registerReaderProtocol } from './protocol'
import { LibraryStore } from './library'
import { SettingsStore } from './settings'
import { registerIpc } from './ipc'
import { createUploadServer } from './upload-server'
import { checkForUpdatesOnStart, registerUpdater } from './updater'
import { VocabularyStore } from './vocabulary'
import { QuizStore } from './quiz-store'

protocol.registerSchemesAsPrivileged([
  { scheme: 'reader-file', privileges: { secure: true, supportFetchAPI: true, stream: true, bypassCSP: false } }
])

Menu.setApplicationMenu(null)

let win: BrowserWindow | null = null
let uploadManager: ReturnType<typeof createUploadServer> | null = null

function createWindow(): void {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: '简阅',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
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

app.whenReady().then(async () => {
  registerReaderProtocol()
  const userData = app.getPath('userData')
  const settings = new SettingsStore(userData)
  const s = await settings.get()
  const dictDir = app.isPackaged ? join(process.resourcesPath, 'resources') : join(app.getAppPath(), 'resources')
  const dictionary = await createDictionary(dictDir)
  const vocab = new VocabularyStore(userData)
  const quizStore = new QuizStore(userData)
  registerUpdater()
  uploadManager = createUploadServer(
    { inbox: join(userData, 'upload-inbox'), books: join(userData, 'books') },
    s
  )
  registerIpc(
    new LibraryStore(userData),
    settings,
    uploadManager,
    join(userData, 'books'),
    join(userData, 'sources.json'),
    join(userData, 'cache'),
    join(userData, 'assets'),
    dictionary,
    vocab,
    quizStore
  )
  createWindow()
  void dictionary.warmup()
  checkForUpdatesOnStart()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => { uploadManager?.stop() })
