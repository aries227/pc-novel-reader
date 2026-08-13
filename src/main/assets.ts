import { randomUUID } from 'node:crypto'
import { copyFile, mkdir } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { BrowserWindow, dialog } from 'electron'

const BG_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp']
const FONT_EXTS = ['ttf', 'otf', 'woff', 'woff2']

export async function pickBackgroundImage(assetsDir: string): Promise<string | null> {
  const win = BrowserWindow.getFocusedWindow()
  const r = await dialog.showOpenDialog(win!, {
    title: '选择背景图片',
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: BG_EXTS }]
  })
  if (r.canceled || !r.filePaths[0]) return null
  const ext = extname(r.filePaths[0]).slice(1).toLowerCase() || 'png'
  const dir = join(assetsDir, 'backgrounds')
  await mkdir(dir, { recursive: true })
  const dest = join(dir, `${randomUUID()}.${ext}`)
  await copyFile(r.filePaths[0], dest)
  return dest
}

export async function pickFontFile(assetsDir: string): Promise<string | null> {
  const win = BrowserWindow.getFocusedWindow()
  const r = await dialog.showOpenDialog(win!, {
    title: '选择字体文件',
    properties: ['openFile'],
    filters: [{ name: '字体', extensions: FONT_EXTS }]
  })
  if (r.canceled || !r.filePaths[0]) return null
  const ext = extname(r.filePaths[0]).slice(1).toLowerCase() || 'ttf'
  const dir = join(assetsDir, 'fonts')
  await mkdir(dir, { recursive: true })
  const dest = join(dir, `${randomUUID()}.${ext}`)
  await copyFile(r.filePaths[0], dest)
  return dest
}
