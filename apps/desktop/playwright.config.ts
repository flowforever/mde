import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  // Desktop E2E launches full Electron apps against shared build output.
  // Keep one worker to avoid cross-worker startup and rebuild contention.
  workers: 1,
  use: {
    trace: 'retain-on-failure'
  }
})
