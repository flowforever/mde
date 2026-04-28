import { expect, test } from '@playwright/test'

import { buildElectronApp, launchElectronApp } from './support/electronApp'
import { createFixtureWorkspace } from './support/fixtureWorkspace'

test.setTimeout(120_000)

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

test('opens a workspace and expands the docs folder', async () => {
  const workspacePath = await createFixtureWorkspace()
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await window.getByRole('button', { name: /open folder/i }).click()

    await expect(window.getByRole('button', { name: 'README.md' })).toBeVisible()
    await expect(
      window.getByRole('button', { exact: true, name: 'docs' })
    ).toBeVisible()

    await window.getByRole('button', { name: /expand docs/i }).click()

    await expect(window.getByRole('button', { name: 'intro.md' })).toBeVisible()
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})
