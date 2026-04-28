import { expect, test } from '@playwright/test'

import { buildElectronApp, launchElectronApp } from './support/electronApp'

test.beforeAll(async () => {
  await buildElectronApp()
})

test('shows the initial open folder action', async () => {
  const { app, startupDiagnostics, window } = await launchElectronApp()

  try {
    await expect(window.getByRole('button', { name: /open folder/i })).toBeVisible()
    await expect
      .poll(async () =>
        window.evaluate(() => {
          const shellWindow = globalThis as unknown as Window & {
            markdownEditorShell?: { preloadLoaded?: boolean }
          }

          return shellWindow.markdownEditorShell?.preloadLoaded === true
        })
      )
      .toBe(true)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})
