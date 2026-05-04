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
  '@mde/editor-core/frontmatter': resolve(
    __dirname,
    'packages/editor-core/src/frontmatter.ts'
  ),
  '@mde/editor-core/links': resolve(
    __dirname,
    'packages/editor-core/src/links.ts'
  ),
  '@mde/editor-core/markdown': resolve(
    __dirname,
    'packages/editor-core/src/markdown.ts'
  ),
  '@mde/editor-core/search': resolve(
    __dirname,
    'packages/editor-core/src/search.ts'
  ),
  '@mde/editor-core/types': resolve(
    __dirname,
    'packages/editor-core/src/types.ts'
  ),
  '@mde/editor-host': resolve(__dirname, 'packages/editor-host/src/index.ts'),
  '@mde/editor-host/bridge': resolve(
    __dirname,
    'packages/editor-host/src/bridge.ts'
  ),
  '@mde/editor-host/fake': resolve(
    __dirname,
    'packages/editor-host/src/fake.ts'
  ),
  '@mde/editor-host/file-tree': resolve(
    __dirname,
    'packages/editor-host/src/fileTree.ts'
  ),
  '@mde/editor-host/types': resolve(
    __dirname,
    'packages/editor-host/src/types.ts'
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
        input: resolve(__dirname, 'apps/desktop/src/main/index.ts')
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
        input: resolve(__dirname, 'apps/desktop/src/preload/index.ts'),
        output: {
          entryFileNames: 'index.mjs',
          format: 'cjs'
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'apps/desktop/src/renderer'),
    resolve: {
      alias: packageAliases
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'apps/desktop/src/renderer/index.html')
      }
    }
  }
})
