import { expect, test } from '@playwright/test'

import { launchElectronApp } from './support/electronApp'

test('shows the initial open folder action', async () => {
  const { app, window } = await launchElectronApp()

  try {
    await expect(window.getByRole('button', { name: /open folder/i })).toBeVisible()
  } finally {
    await app.close()
  }
})
