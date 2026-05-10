import { resolve } from 'node:path'

import { defineConfig, defineProject } from 'vitest/config'

const packageRoot = resolve(__dirname)

const packageAliases = [
  {
    find: /^@mde\/automation-flow$/,
    replacement: resolve(packageRoot, 'src/index.ts')
  },
  {
    find: /^@mde\/automation-flow\/diagnostics$/,
    replacement: resolve(packageRoot, 'src/diagnostics.ts')
  },
  {
    find: /^@mde\/automation-flow\/parser$/,
    replacement: resolve(packageRoot, 'src/parser.ts')
  },
  {
    find: /^@mde\/automation-flow\/schema$/,
    replacement: resolve(packageRoot, 'src/schema.ts')
  },
  {
    find: /^@mde\/automation-flow\/types$/,
    replacement: resolve(packageRoot, 'src/types.ts')
  }
]

export default defineConfig({
  resolve: {
    alias: packageAliases
  },
  test: {
    alias: packageAliases,
    coverage: {
      exclude: ['src/**/*.test.ts'],
      include: ['src/**/*.ts'],
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    },
    projects: [
      defineProject({
        test: {
          environment: 'node',
          exclude: ['src/**/*.integration.test.ts'],
          include: ['src/**/*.test.ts'],
          name: 'unit'
        }
      }),
      defineProject({
        test: {
          environment: 'node',
          include: ['src/**/*.integration.test.ts'],
          name: 'integration'
        }
      })
    ]
  }
})
