import { resolve } from 'node:path'

import { defineConfig, defineProject } from 'vitest/config'

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
  ),
  '@mde/editor-react': resolve(__dirname, 'packages/editor-react/src/index.ts'),
  '@mde/editor-react/testing': resolve(
    __dirname,
    'packages/editor-react/src/testing.ts'
  )
}

export default defineConfig({
  resolve: {
    alias: packageAliases
  },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'packages/editor-core/src/**/*.ts',
        'packages/editor-host/src/**/*.ts',
        'src/main/autoUpdate.ts',
        'src/main/ipc/**/*.ts',
        'src/main/services/**/*.ts',
        'src/renderer/src/app/appReducer.ts',
        'src/renderer/src/editor/**/*.ts',
        'src/renderer/src/editor/**/*.tsx',
        'src/renderer/src/explorer/**/*.tsx'
      ],
      exclude: ['src/renderer/src/explorer/explorerTypes.ts'],
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
          name: 'unit',
          environment: 'jsdom',
          include: ['tests/unit/**/*.test.{ts,tsx}'],
          setupFiles: ['src/renderer/src/test/setup.ts'],
          testTimeout: 15_000
        }
      }),
      defineProject({
        resolve: {
          alias: packageAliases
        },
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts']
        }
      })
    ]
  }
})
