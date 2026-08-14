import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('scaffold', () => {
  it('package.json 的 main 指向构建产物', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))
    expect(pkg.main).toBe('./out/main/index.js')
    expect(pkg.scripts.dev).toContain('electron-vite dev')
    expect(pkg.version).toBe('0.6.1')
    expect(pkg.build.publish[0].provider).toBe('github')
  })
  it('渲染进程入口存在', () => {
    expect(existsSync(resolve('src/renderer/index.html'))).toBe(true)
  })
})
