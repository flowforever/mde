import { defineConfig, defineProject } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      defineProject({
        test: {
          environment: 'node',
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
