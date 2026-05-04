import { resolve } from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

const packageAliases = [
  {
    find: /^@mde\/editor-core$/,
    replacement: resolve(__dirname, 'packages/editor-core/src/index.ts')
  },
  {
    find: /^@mde\/editor-core\/assets$/,
    replacement: resolve(__dirname, 'packages/editor-core/src/assets.ts')
  },
  {
    find: /^@mde\/editor-core\/flowcharts$/,
    replacement: resolve(__dirname, 'packages/editor-core/src/flowcharts.ts')
  },
  {
    find: /^@mde\/editor-core\/frontmatter$/,
    replacement: resolve(__dirname, 'packages/editor-core/src/frontmatter.ts')
  },
  {
    find: /^@mde\/editor-core\/links$/,
    replacement: resolve(__dirname, 'packages/editor-core/src/links.ts')
  },
  {
    find: /^@mde\/editor-core\/markdown$/,
    replacement: resolve(__dirname, 'packages/editor-core/src/markdown.ts')
  },
  {
    find: /^@mde\/editor-core\/search$/,
    replacement: resolve(__dirname, 'packages/editor-core/src/search.ts')
  },
  {
    find: /^@mde\/editor-core\/types$/,
    replacement: resolve(__dirname, 'packages/editor-core/src/types.ts')
  },
  {
    find: /^@mde\/editor-host$/,
    replacement: resolve(__dirname, 'packages/editor-host/src/index.ts')
  },
  {
    find: /^@mde\/editor-host\/bridge$/,
    replacement: resolve(__dirname, 'packages/editor-host/src/bridge.ts')
  },
  {
    find: /^@mde\/editor-host\/fake$/,
    replacement: resolve(__dirname, 'packages/editor-host/src/fake.ts')
  },
  {
    find: /^@mde\/editor-host\/file-tree$/,
    replacement: resolve(__dirname, 'packages/editor-host/src/fileTree.ts')
  },
  {
    find: /^@mde\/editor-host\/types$/,
    replacement: resolve(__dirname, 'packages/editor-host/src/types.ts')
  },
  {
    find: /^@mde\/editor-react\/styles\.css$/,
    replacement: resolve(__dirname, 'packages/editor-react/styles.css')
  }
]

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
