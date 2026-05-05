import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    trace: 'retain-on-failure'
  }
})
