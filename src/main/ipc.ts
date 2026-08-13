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
