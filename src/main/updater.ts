import { app, BrowserWindow, ipcMain } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

export function registerUpdater(): void {
  if (app.isPackaged) {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.on('checking-for-update', () => broadcast('update:status', { phase: 'checking' }))
    autoUpdater.on('update-available', (info) => broadcast('update:status', { phase: 'available', version: info.version }))
    autoUpdater.on('update-not-available', () => broadcast('update:status', { phase: 'up-to-date' }))
    autoUpdater.on('download-progress', (p) => broadcast('update:status', { phase: 'downloading', percent: p.percent }))
    autoUpdater.on('update-downloaded', () => broadcast('update:status', { phase: 'downloaded' }))
    autoUpdater.on('error', (err) => broadcast('update:status', { phase: 'error', message: String(err) }))
  }
  ipcMain.handle('update:check', async () => {
    if (!app.isPackaged) {
      broadcast('update:status', { phase: 'error', message: '开发模式不检查更新' })
      return
    }
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      broadcast('update:status', { phase: 'error', message: String(err) })
    }
  })
  ipcMain.handle('update:install', () => {
    if (app.isPackaged) autoUpdater.quitAndInstall()
  })
}

export function checkForUpdatesOnStart(): void {
  if (!app.isPackaged) return
  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch((err) => {
      broadcast('update:status', { phase: 'error', message: String(err) })
    })
  }, 5000)
}
