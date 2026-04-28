import { defineConfig, defineProject } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      defineProject({
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['tests/unit/**/*.test.{ts,tsx}'],
          setupFiles: ['src/renderer/src/test/setup.ts']
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
