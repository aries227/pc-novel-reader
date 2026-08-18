import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'node:path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        output: { format: 'cjs', entryFileNames: 'index.cjs' }
      }
    },
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  renderer: {
    publicDir: 'resources',
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        buffer: 'buffer',
        stream: 'stream-browserify',
        process: 'process/browser'
      }
    }
  }
})
