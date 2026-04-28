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

    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible()
    await expect(
      window.getByRole('button', { name: /docs folder/i })
    ).toBeVisible()

    await window.getByRole('button', { name: /expand docs/i }).click()

    await expect(
      window.getByRole('button', { name: /intro\.md Markdown file/i })
    ).toBeVisible()
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
    await window.getByRole('button', { name: /README\.md Markdown file/i }).click()

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
    await window.setViewportSize({ width: 1280, height: 720 })
    await window.getByRole('button', { name: /open folder/i }).click()
    const readmeRow = window.getByRole('button', {
      name: /README\.md Markdown file/i
    })

    await readmeRow.click()

    await expect(readmeRow).toHaveAttribute('aria-current', 'page')
    await expect(readmeRow).toHaveClass(/is-active/)
    await expect(window.locator('.app-shell')).toBeVisible()
    await expect(window.getByLabel('Explorer')).toBeVisible()
    await expect(window.getByLabel('Editor')).toBeVisible()
    await expect(window.getByRole('button', { name: /save README\.md/i }))
      .toBeVisible()
    expect(
      await window.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth
      )
    ).toBe(true)

    const editableDocument = window
      .getByTestId('blocknote-view')
      .locator('[contenteditable="true"]')
      .first()

    await expect(editableDocument).toBeVisible()
    await editableDocument.click()
    await window.keyboard.press('End')
    await window.keyboard.press('Enter')
    await window.keyboard.insertText('Saved from button')
    await expect(window.getByText(/unsaved changes/i)).toBeVisible()
    await window.getByRole('button', { name: /save README\.md/i }).click()

    await expect
      .poll(async () => readFile(readmePath, 'utf8'))
      .toContain('Saved from button')
    await expect(window.getByText(/unsaved changes/i)).toBeHidden()

    await editableDocument.click()
    await window.keyboard.press('End')
    await window.keyboard.press('Enter')
    await window.keyboard.insertText('Saved from shortcut')
    await expect(window.getByText(/unsaved changes/i)).toBeVisible()
    await window.keyboard.press(process.platform === 'darwin' ? 'Meta+S' : 'Control+S')

    await expect
      .poll(async () => readFile(readmePath, 'utf8'))
      .toContain('Saved from shortcut')
    await expect(window.getByText(/unsaved changes/i)).toBeHidden()

    await window.getByRole('button', { name: /new markdown file/i }).click()
    await window.getByLabel(/markdown file path/i).fill('notes.md')
    await window.getByRole('button', { name: /^create$/i }).click()

    await expect(
      window.getByRole('button', { name: /notes\.md Markdown file/i })
    ).toBeVisible()
    await expect(readFile(join(workspacePath, 'notes.md'), 'utf8')).resolves.toBe('')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})
