import { resolve } from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

const packageAliases = {
  '@mde/editor-core': resolve(__dirname, 'packages/editor-core/src/index.ts'),
  '@mde/editor-core/assets': resolve(
    __dirname,
    'packages/editor-core/src/assets.ts'
  ),
  '@mde/editor-core/flowcharts': resolve(
    __dirname,
    'packages/editor-core/src/flowcharts.ts'
  ),
  '@mde/editor-core/links': resolve(
    __dirname,
    'packages/editor-core/src/links.ts'
  ),
  '@mde/editor-core/types': resolve(
    __dirname,
    'packages/editor-core/src/types.ts'
  )
}

export default defineConfig({
  main: {
    resolve: {
      alias: packageAliases
    },
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/main/index.ts')
      }
    }
  },
  preload: {
    resolve: {
      alias: packageAliases
    },
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/preload/index.ts'),
        output: {
          entryFileNames: 'index.mjs',
          format: 'cjs'
        }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: packageAliases
    },
    plugins: [react()]
  }
})
