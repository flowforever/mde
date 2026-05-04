import { resolve } from 'node:path'

import { defineConfig, defineProject } from 'vitest/config'

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
    find: /^@mde\/editor-react$/,
    replacement: resolve(__dirname, 'packages/editor-react/src/index.ts')
  },
  {
    find: /^@mde\/editor-react\/styles\.css$/,
    replacement: resolve(__dirname, 'packages/editor-react/styles.css')
  },
  {
    find: /^@mde\/editor-react\/testing$/,
    replacement: resolve(__dirname, 'packages/editor-react/src/testing.ts')
  }
]

export default defineConfig({
  resolve: {
    alias: packageAliases
  },
  test: {
    alias: packageAliases,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'packages/editor-core/src/**/*.ts',
        'packages/editor-host/src/**/*.ts',
        'apps/desktop/src/main/autoUpdate.ts',
        'apps/desktop/src/main/ipc/**/*.ts',
        'apps/desktop/src/main/services/**/*.ts',
        'apps/desktop/src/renderer/src/app/appReducer.ts',
        'apps/desktop/src/renderer/src/editor/**/*.ts',
        'apps/desktop/src/renderer/src/editor/**/*.tsx',
        'apps/desktop/src/renderer/src/explorer/**/*.tsx'
      ],
      exclude: ['apps/desktop/src/renderer/src/explorer/explorerTypes.ts'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    },
    projects: [
      defineProject({
        resolve: {
          alias: packageAliases
        },
        test: {
          alias: packageAliases,
          name: 'unit',
          environment: 'jsdom',
          include: ['tests/unit/**/*.test.{ts,tsx}'],
          setupFiles: ['apps/desktop/src/renderer/src/test/setup.ts'],
          testTimeout: 15_000
        }
      }),
      defineProject({
        resolve: {
          alias: packageAliases
        },
        test: {
          alias: packageAliases,
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts']
        }
      })
    ]
  }
})
