import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

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

test('loads README markdown into the block editor surface', async () => {
  const workspacePath = await createFixtureWorkspace()
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await window.getByRole('button', { name: /open folder/i }).click()
    await window.getByRole('button', { name: 'README.md' }).click()

    const editor = window.getByTestId('markdown-block-editor')

    await expect(editor).toBeVisible()
    await expect(editor).toContainText('Fixture Workspace')
    await expect(editor).toContainText('Root markdown file.')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('edits and saves markdown by button and keyboard, then creates a new file', async () => {
  const workspacePath = await createFixtureWorkspace()
  const readmePath = join(workspacePath, 'README.md')
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await window.getByRole('button', { name: /open folder/i }).click()
    await window.getByRole('button', { name: 'README.md' }).click()

    const editableDocument = window
      .getByTestId('blocknote-view')
      .locator('[contenteditable="true"]')
      .first()

    await expect(editableDocument).toBeVisible()
    await editableDocument.click()
    await window.keyboard.press('End')
    await window.keyboard.press('Enter')
    await window.keyboard.insertText('Saved from button')
    await window.getByRole('button', { name: /^save$/i }).click()

    await expect
      .poll(async () => readFile(readmePath, 'utf8'))
      .toContain('Saved from button')

    await editableDocument.click()
    await window.keyboard.press('End')
    await window.keyboard.press('Enter')
    await window.keyboard.insertText('Saved from shortcut')
    await window.keyboard.press(process.platform === 'darwin' ? 'Meta+S' : 'Control+S')

    await expect
      .poll(async () => readFile(readmePath, 'utf8'))
      .toContain('Saved from shortcut')

    await window.getByRole('button', { name: /new markdown file/i }).click()
    await window.getByLabel(/markdown file path/i).fill('notes.md')
    await window.getByRole('button', { name: /^create$/i }).click()

    await expect(window.getByRole('button', { name: 'notes.md' })).toBeVisible()
    await expect(readFile(join(workspacePath, 'notes.md'), 'utf8')).resolves.toBe('')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})
