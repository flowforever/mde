import { defineConfig, defineProject } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
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
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['tests/unit/**/*.test.{ts,tsx}'],
          setupFiles: ['src/renderer/src/test/setup.ts'],
          testTimeout: 15_000
        }
      }),
      defineProject({
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts']
        }
      })
    ]
  }
})
