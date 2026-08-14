import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('updater CJS interop', () => {
  it('不使用 electron-updater 的具名导入（避免打包后 ESM 启动崩溃）', async () => {
    const src = await readFile('src/main/updater.ts', 'utf8')
    expect(src).not.toMatch(/import\s*\{\s*autoUpdater\s*\}\s*from\s*['"]electron-updater['"]/)
    expect(src).toMatch(/import\s+electronUpdater\s+from\s*['"]electron-updater['"]/)
    expect(src).toContain('const { autoUpdater } = electronUpdater')
  })
})
