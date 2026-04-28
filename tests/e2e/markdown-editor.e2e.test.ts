import { expect, test } from '@playwright/test'

import { buildElectronApp, launchElectronApp } from './support/electronApp'

test.beforeAll(async () => {
  await buildElectronApp()
})

test('shows the initial open folder action', async () => {
  const startupErrors: string[] = []
  const { app, window } = await launchElectronApp()

  window.on('console', (message) => {
    if (message.type() === 'error' || /preload|security/i.test(message.text())) {
      startupErrors.push(message.text())
    }
  })
  window.on('pageerror', (error) => {
    startupErrors.push(error.message)
  })

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
    expect(startupErrors).toEqual([])
  } finally {
    await app.close()
  }
})
