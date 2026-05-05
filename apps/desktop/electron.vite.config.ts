import { resolve } from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

const workspaceRoot = resolve(__dirname, '../..')
const internalWorkspacePackages = [
  '@mde/editor-core',
  '@mde/editor-host',
  '@mde/editor-react'
]

const packageAliases = [
  {
    find: /^@mde\/editor-core$/,
    replacement: resolve(workspaceRoot, 'packages/editor-core/src/index.ts')
  },
  {
    find: /^@mde\/editor-core\/assets$/,
    replacement: resolve(workspaceRoot, 'packages/editor-core/src/assets.ts')
  },
  {
    find: /^@mde\/editor-core\/flowcharts$/,
    replacement: resolve(workspaceRoot, 'packages/editor-core/src/flowcharts.ts')
  },
  {
    find: /^@mde\/editor-core\/frontmatter$/,
    replacement: resolve(workspaceRoot, 'packages/editor-core/src/frontmatter.ts')
  },
  {
    find: /^@mde\/editor-core\/links$/,
    replacement: resolve(workspaceRoot, 'packages/editor-core/src/links.ts')
  },
  {
    find: /^@mde\/editor-core\/markdown$/,
    replacement: resolve(workspaceRoot, 'packages/editor-core/src/markdown.ts')
  },
  {
    find: /^@mde\/editor-core\/search$/,
    replacement: resolve(workspaceRoot, 'packages/editor-core/src/search.ts')
  },
  {
    find: /^@mde\/editor-core\/types$/,
    replacement: resolve(workspaceRoot, 'packages/editor-core/src/types.ts')
  },
  {
    find: /^@mde\/editor-host$/,
    replacement: resolve(workspaceRoot, 'packages/editor-host/src/index.ts')
  },
  {
    find: /^@mde\/editor-host\/bridge$/,
    replacement: resolve(workspaceRoot, 'packages/editor-host/src/bridge.ts')
  },
  {
    find: /^@mde\/editor-host\/fake$/,
    replacement: resolve(workspaceRoot, 'packages/editor-host/src/fake.ts')
  },
  {
    find: /^@mde\/editor-host\/file-tree$/,
    replacement: resolve(workspaceRoot, 'packages/editor-host/src/fileTree.ts')
  },
  {
    find: /^@mde\/editor-host\/types$/,
    replacement: resolve(workspaceRoot, 'packages/editor-host/src/types.ts')
  },
  {
    find: /^@mde\/editor-react\/styles\.css$/,
    replacement: resolve(workspaceRoot, 'packages/editor-react/styles.css')
  }
]

export default defineConfig({
  main: {
    resolve: {
      alias: packageAliases
    },
    plugins: [externalizeDepsPlugin({ exclude: internalWorkspacePackages })],
    build: {
      outDir: resolve(__dirname, 'out/main'),
      rollupOptions: {
        input: resolve(__dirname, 'src/main/index.ts')
      }
    }
  },
  preload: {
    resolve: {
      alias: packageAliases
    },
    plugins: [externalizeDepsPlugin({ exclude: internalWorkspacePackages })],
    build: {
      outDir: resolve(__dirname, 'out/preload'),
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
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: packageAliases
    },
    plugins: [react()],
    build: {
      outDir: resolve(__dirname, 'out/renderer'),
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html')
      }
    }
  }
})
