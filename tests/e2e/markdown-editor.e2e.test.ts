import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  stat,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { buildElectronApp, launchElectronApp } from './support/electronApp'
import { createFixtureWorkspace } from './support/fixtureWorkspace'

const E2E_TEST_TIMEOUT_MS = 120_000
const E2E_BUILD_TIMEOUT_MS = 300_000

test.setTimeout(E2E_TEST_TIMEOUT_MS)

test.beforeAll(async ({ browserName }, testInfo) => {
  void browserName
  testInfo.setTimeout(E2E_BUILD_TIMEOUT_MS)
  await buildElectronApp()
})

const ensureWorkspaceDialogOpen = async (window: Page): Promise<void> => {
  const workspaceDialog = window.getByRole('dialog', {
    name: /workspace manager/i
  })
  const workspaceDialogBackdrop = window.locator('.workspace-dialog-backdrop')
  const workspaceTrigger = window
    .getByRole('button', { name: /^open workspace$/i })
    .or(window.getByRole('button', { name: /manage workspaces/i }))
  const waitForWorkspaceDialog = async (): Promise<boolean> => {
    await workspaceDialogBackdrop
      .waitFor({ state: 'visible', timeout: 1500 })
      .catch(() => undefined)

    return workspaceDialogBackdrop.isVisible().catch(() => false)
  }

  if (await waitForWorkspaceDialog()) {
    return
  }

  try {
    await workspaceTrigger.click({ timeout: 1500 })
  } catch (error) {
    if (await waitForWorkspaceDialog()) {
      return
    }

    throw error
  }

  await expect(workspaceDialogBackdrop).toBeVisible()
  await expect(workspaceDialog).toBeVisible()
}

const openNewWorkspace = async (window: Page): Promise<void> => {
  await ensureWorkspaceDialogOpen(window)

  await window.getByRole('button', { name: /open new workspace/i }).click()
}

const openMarkdownFile = async (window: Page): Promise<void> => {
  await ensureWorkspaceDialogOpen(window)

  await window.getByRole('button', { name: /open markdown file/i }).click()
}

const resetThemePreference = async (window: Page): Promise<void> => {
  await window.evaluate(() => {
    globalThis.localStorage.removeItem('mde.themePreference')
    globalThis.location.reload()
  })
}

test('shows the initial centered workspace popup', async () => {
  const { app, startupDiagnostics, window } = await launchElectronApp()

  try {
    await resetThemePreference(window)

    const appShell = window.locator('.app-shell')
    const workspaceButton = window.getByRole('button', {
      name: /^open workspace$/i
    })

    const workspaceDialog = window.getByRole('dialog', {
      name: /workspace manager/i
    })
    const openWorkspaceItem = window.getByRole('button', {
      name: /open new workspace/i
    })

    await expect(workspaceButton).toBeVisible()
    await expect(appShell).toHaveAttribute('data-theme', 'manuscript')
    await expect(appShell).toHaveAttribute('data-theme-family', 'light')
    await expect(appShell).toHaveAttribute('data-panel-family', 'light')
    await expect(window.getByRole('button', { name: /open settings/i }))
      .toBeEnabled()
    await expect(workspaceDialog).toBeVisible()
    await expect(
      window.getByRole('heading', { name: /^Open workspace$/ })
    ).toBeVisible()
    await expect(openWorkspaceItem).toBeVisible()
    await expect(window.getByRole('menu')).toHaveCount(0)

    const buttonBackground = await workspaceButton.evaluate(
      (element) => globalThis.getComputedStyle(element).backgroundColor
    )
    const itemBackground = await openWorkspaceItem.evaluate(
      (element) => globalThis.getComputedStyle(element).backgroundColor
    )
    const dialogCenter = await workspaceDialog.evaluate((element) => {
      const rect = element.getBoundingClientRect()

      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      }
    })
    const viewportCenter = await window.evaluate(() => ({
      x: globalThis.innerWidth / 2,
      y: globalThis.innerHeight / 2
    }))

    expect(buttonBackground).toBe(itemBackground)
    expect(buttonBackground).not.toBe('rgb(46, 111, 143)')
    expect(Math.abs(dialogCenter.x - viewportCenter.x)).toBeLessThan(12)
    expect(Math.abs(dialogCenter.y - viewportCenter.y)).toBeLessThan(12)
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

test('selects and persists a manual theme from settings', async () => {
  const { app, startupDiagnostics, window } = await launchElectronApp()

  try {
    await resetThemePreference(window)

    const appShell = window.locator('.app-shell')

    await expect(appShell).toHaveAttribute('data-theme', 'manuscript')
    await window.getByRole('button', { name: /close workspace popup/i }).click()

    await window.getByRole('button', { name: /open settings/i }).click()
    await expect(window.getByRole('dialog', { name: /settings/i })).toBeVisible()
    await window
      .getByRole('switch', { name: /follow system appearance/i })
      .click()
    await expect(
      window.getByRole('switch', { name: /follow system appearance/i })
    ).not.toBeChecked()

    const themePicker = window.locator('.theme-colorway-grid')
    const blueColorway = window.locator('[data-theme-row="blue"]')

    await expect(themePicker).toHaveAttribute('data-column-count', '3')
    await expect(window.locator('.theme-column-heading')).toHaveCount(0)
    await expect(window.locator('.theme-colorway-row')).toHaveCount(8)
    await expect(blueColorway.locator('[data-theme-id="blue-hour"]')).toBeVisible()
    await expect(blueColorway.locator('[data-theme-id="glacier"]')).toBeVisible()
    await expect(blueColorway.locator('[data-theme-id="paper-blue"]')).toBeVisible()
    await expect(blueColorway.locator('[role="radio"]')).toHaveCount(3)

    await window.getByRole('radio', { name: /blue hour/i }).click()

    await expect(appShell).toHaveAttribute('data-theme', 'blue-hour')
    await expect(appShell).toHaveAttribute('data-theme-family', 'dark')
    expect(
      await window.evaluate(() =>
        globalThis.localStorage.getItem('mde.themePreference')
      )
    ).toContain('"lastDarkThemeId":"blue-hour"')

    await window.evaluate(() => {
      globalThis.location.reload()
    })

    await expect(window.locator('.app-shell')).toHaveAttribute(
      'data-theme',
      'blue-hour'
    )
    await window.getByRole('button', { name: /close workspace popup/i }).click()
    await window.getByRole('button', { name: /open settings/i }).click()
    await expect(
      window.getByRole('switch', { name: /follow system appearance/i })
    ).not.toBeChecked()
    await expect(window.getByRole('button', { name: /open settings/i }))
      .toBeEnabled()
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('selects the current system theme family without leaving follow-system mode', async () => {
  const { app, startupDiagnostics, window } = await launchElectronApp()

  try {
    await window.evaluate(() => {
      globalThis.localStorage.setItem(
        'mde.themePreference',
        JSON.stringify({
          lastDarkThemeId: 'carbon',
          lastLightThemeId: 'manuscript',
          mode: 'system'
        })
      )
      globalThis.location.reload()
    })

    const appShell = window.locator('.app-shell')

    await window.getByRole('button', { name: /close workspace popup/i }).click()
    await window.getByRole('button', { name: /open settings/i }).click()
    await expect(window.getByRole('dialog', { name: /settings/i })).toBeVisible()
    await expect(
      window.getByRole('switch', { name: /follow system appearance/i })
    ).toBeChecked()
    await expect(window.getByRole('radiogroup', { name: /theme colorways/i }))
      .toBeVisible()
    await expect(window.locator('.theme-colorway-grid')).toHaveAttribute(
      'data-column-count',
      '2'
    )
    await expect(window.locator('.theme-column-heading')).toHaveCount(0)
    await expect(window.getByRole('radio', { name: /blue hour/i }))
      .toHaveCount(0)
    await expect(window.getByRole('radio', { name: /glacier/i })).toBeVisible()

    await window.getByRole('radio', { name: /binder/i }).click()

    await expect(appShell).toHaveAttribute('data-theme', 'binder')
    await expect(appShell).toHaveAttribute('data-theme-family', 'light')
    await expect(
      window.getByRole('switch', { name: /follow system appearance/i })
    ).toBeChecked()
    expect(
      await window.evaluate(() =>
        globalThis.localStorage.getItem('mde.themePreference')
      )
    ).toBe(
      JSON.stringify({
        lastDarkThemeId: 'carbon',
        lastLightThemeId: 'binder',
        mode: 'system'
      })
    )
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('follows system appearance using the remembered light and dark themes', async () => {
  const { app, startupDiagnostics, window } = await launchElectronApp()

  try {
    await window.emulateMedia({ colorScheme: 'dark' })
    await window.evaluate(() => {
      globalThis.localStorage.setItem(
        'mde.themePreference',
        JSON.stringify({
          lastDarkThemeId: 'moss',
          lastLightThemeId: 'porcelain',
          mode: 'system'
        })
      )
      globalThis.location.reload()
    })

    const appShell = window.locator('.app-shell')

    await window.waitForFunction(
      () => document.querySelector('.app-shell')?.getAttribute('data-theme') === 'moss'
    )
    await expect(appShell).toHaveAttribute('data-theme', 'moss')

    await window.emulateMedia({ colorScheme: 'light' })
    await expect(appShell).toHaveAttribute('data-theme', 'porcelain')

    await window.emulateMedia({ colorScheme: 'dark' })
    await expect(appShell).toHaveAttribute('data-theme', 'moss')
    expect(
      await window.evaluate(() =>
        globalThis.localStorage.getItem('mde.themePreference')
      )
    ).toBe(
      JSON.stringify({
        lastDarkThemeId: 'moss',
        lastLightThemeId: 'porcelain',
        mode: 'system'
      })
    )
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('exposes update checks through the preload API in development builds', async () => {
  const { app, startupDiagnostics, window } = await launchElectronApp()

  try {
    const updateResult = await window.evaluate(async () => {
      const updateWindow = globalThis as unknown as Window & {
        updateApi?: {
          checkForUpdates: () => Promise<{
            message?: string
            updateAvailable: boolean
          }>
        }
      }

      if (!updateWindow.updateApi) {
        throw new Error('Update API missing')
      }

      return updateWindow.updateApi.checkForUpdates()
    })

    expect(updateResult).toMatchObject({
      message: 'Update checks are disabled.',
      updateAvailable: false
    })
    await expect(
      window.getByRole('dialog', { name: /mde update/i })
    ).toHaveCount(0)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('searches and removes many recent workspace items from the manager popup', async () => {
  const { app, startupDiagnostics, window } = await launchElectronApp()

  try {
    await window.evaluate(() => {
      globalThis.localStorage.setItem(
        'mde.recentWorkspaces',
        JSON.stringify([
          ...Array.from({ length: 18 }, (_, index) => ({
            name: `Workspace ${index + 1}`,
            rootPath: `/workspaces/${index + 1}`,
            type: 'workspace'
          })),
          {
            filePath: '/notes/API.md',
            name: 'API.md',
            openedFilePath: 'API.md',
            rootPath: '/notes',
            type: 'file'
          }
        ])
      )
      globalThis.location.reload()
    })

    const resourceList = window.locator('.workspace-resource-list')

    await expect(resourceList).toBeVisible()
    expect(
      await resourceList.evaluate((element) => ({
        canScroll: element.scrollHeight > element.clientHeight,
        overflowY: globalThis.getComputedStyle(element).overflowY
      }))
    ).toMatchObject({
      canScroll: true,
      overflowY: 'auto'
    })

    await window
      .getByRole('searchbox', { name: /search workspaces and files/i })
      .fill('api')
    await expect(
      window.getByRole('button', { name: /switch to file API\.md/i })
    ).toBeVisible()
    await expect(
      window.getByRole('button', { name: /switch to workspace Workspace 1/i })
    ).toHaveCount(0)

    await window.getByRole('button', { name: /remove recent file API\.md/i }).click()
    await expect(
      window.getByRole('button', { name: /switch to file API\.md/i })
    ).toHaveCount(0)
    expect(
      await window.evaluate(() =>
        globalThis.localStorage.getItem('mde.recentWorkspaces')
      )
    ).not.toContain('API.md')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('opens a workspace and expands the docs folder', async () => {
  const workspacePath = await createFixtureWorkspace()

  await mkdir(join(workspacePath, '.vscode'), { recursive: true })
  await writeFile(join(workspacePath, '.vscode', 'settings.md'), '# Settings')
  await writeFile(join(workspacePath, '.draft.md'), '# Draft')

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await openNewWorkspace(window)

    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible()
    await expect(window).toHaveTitle(await realpath(workspacePath))
    await expect(
      window.getByRole('button', { name: /docs folder/i })
    ).toBeVisible()
    await expect(
      window.getByRole('button', { name: /\.vscode folder/i })
    ).toBeHidden()
    await expect(
      window.getByRole('button', { name: /\.draft\.md Markdown file/i })
    ).toBeHidden()

    await window.getByRole('button', { name: /show hidden entries/i }).click()

    await expect(
      window.getByRole('button', { name: /\.vscode folder/i })
    ).toBeVisible()
    await expect(
      window.getByRole('button', { name: /\.draft\.md Markdown file/i })
    ).toBeVisible()
    await window.getByRole('button', { name: /hide hidden entries/i }).click()

    await window.getByRole('button', { name: /expand docs/i }).click()

    await expect(
      window.getByRole('button', { name: /intro\.md Markdown file/i })
    ).toBeVisible()
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('opens a workspace from a command line path', async () => {
  const workspacePath = await createFixtureWorkspace()
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [workspacePath]
  })

  try {
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible()
    await expect(
      window.getByRole('button', { name: /manage workspaces/i })
    ).toBeVisible()
    await expect(window).toHaveTitle(await realpath(workspacePath))
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('keeps the expanded explorer tree on its own scrollbar', async () => {
  const workspacePath = await createFixtureWorkspace()

  await mkdir(join(workspacePath, 'many'))
  await Promise.all(
    Array.from({ length: 80 }, (_, index) =>
      writeFile(
        join(workspacePath, 'many', `note-${String(index + 1).padStart(2, '0')}.md`),
        `# Note ${index + 1}`
      )
    )
  )

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await window.setViewportSize({ width: 900, height: 600 })
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /expand many/i }).click()

    const explorerTree = window.locator('.explorer-tree-root')

    await expect(
      window.getByRole('button', { name: /note-80\.md Markdown file/i })
    ).toBeAttached()
    expect(
      await explorerTree.evaluate((element) => ({
        canScroll: element.scrollHeight > element.clientHeight,
        overflowY: globalThis.getComputedStyle(element).overflowY
      }))
    ).toMatchObject({
      canScroll: true,
      overflowY: 'auto'
    })

    await explorerTree.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })

    expect(await explorerTree.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    await expect(
      window.getByRole('button', { name: /note-80\.md Markdown file/i })
    ).toBeInViewport()
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('resizes and toggles the explorer sidebar', async () => {
  const workspacePath = await createFixtureWorkspace()
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await window.setViewportSize({ width: 900, height: 600 })
    await openNewWorkspace(window)

    const explorerPane = window.locator('.explorer-pane')
    const resizeHandle = window.getByRole('separator', {
      name: /resize explorer sidebar/i
    })
    const initialWidth = await explorerPane.evaluate(
      (element) => element.getBoundingClientRect().width
    )

    await resizeHandle.hover()
    await window.mouse.down()
    await window.mouse.move(360, 100)
    await window.mouse.up()

    expect(
      await explorerPane.evaluate((element) => element.getBoundingClientRect().width)
    ).toBeGreaterThan(initialWidth + 48)

    await window
      .getByRole('button', { name: /collapse explorer sidebar/i })
      .click()
    await expect(
      window.getByRole('button', { name: /manage workspaces/i })
    ).toHaveCount(0)
    await expect(resizeHandle).toHaveCount(0)
    expect(
      await explorerPane.evaluate((element) => element.getBoundingClientRect().width)
    ).toBeLessThanOrEqual(56)

    await window.getByRole('button', { name: /expand explorer sidebar/i }).click()
    await expect(
      window.getByRole('button', { name: /manage workspaces/i })
    ).toBeVisible()
    await expect(
      window.getByRole('separator', { name: /resize explorer sidebar/i })
    ).toBeVisible()
    expect(
      await explorerPane.evaluate((element) => element.getBoundingClientRect().width)
    ).toBeGreaterThan(initialWidth + 48)
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
    await openNewWorkspace(window)
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

test('toggles the editor between centered and full-width layouts', async () => {
  const workspacePath = await createFixtureWorkspace()
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await window.setViewportSize({ width: 1600, height: 900 })
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /README\.md Markdown file/i }).click()

    const editor = window.getByTestId('markdown-block-editor')
    const actionBar = window.locator('.editor-action-bar')
    const fullWidthButton = window.getByRole('button', {
      name: /use full-width editor view/i
    })

    await expect(editor).toBeVisible()
    await expect(actionBar).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    const actionBarWidth = await actionBar.evaluate(
      (element) => element.getBoundingClientRect().width
    )
    const centeredWidth = await editor.evaluate(
      (element) => element.getBoundingClientRect().width
    )

    expect(actionBarWidth).toBeLessThan(160)
    expect(actionBarWidth).toBeLessThan(centeredWidth)
    await fullWidthButton.click()
    await expect(
      window.getByRole('button', { name: /use centered editor view/i })
    ).toBeVisible()
    const fullWidth = await editor.evaluate(
      (element) => element.getBoundingClientRect().width
    )

    expect(fullWidth).toBeGreaterThan(centeredWidth + 120)

    await window
      .getByRole('button', { name: /use centered editor view/i })
      .click()
    const recenteredWidth = await editor.evaluate(
      (element) => element.getBoundingClientRect().width
    )

    expect(Math.abs(recenteredWidth - centeredWidth)).toBeLessThanOrEqual(1)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('renders Mermaid flowcharts and saves pasted images beside the Markdown file', async () => {
  const workspacePath = await createFixtureWorkspace()
  const diagramPath = join(workspacePath, 'docs', 'diagram.md')

  await writeFile(
    diagramPath,
    [
      '## End-to-End Flow',
      '',
      '```mermaid',
      'flowchart TD',
      '  S[Start] --> D[Done]',
      '```'
    ].join('\n')
  )

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /expand docs/i }).click()
    await window
      .getByRole('button', { name: /diagram\.md Markdown file/i })
      .click()

    const preview = window.getByTestId('mermaid-flowchart-preview-0')

    await expect(preview.locator('svg')).toBeVisible({ timeout: 15_000 })

    await window
      .getByLabel(/mermaid source 1/i)
      .fill('flowchart LR\n  S[Start] --> R[Review]\n  R --> D[Done]')
    await window.keyboard.press(process.platform === 'darwin' ? 'Meta+S' : 'Control+S')
    await expect
      .poll(async () => readFile(diagramPath, 'utf8'), { timeout: 5000 })
      .toContain('R[Review]')

    const editableDocument = window
      .getByTestId('blocknote-view')
      .locator('[contenteditable="true"]')
      .first()
    const pngBytes = [
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0,
      1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68,
      65, 84, 120, 156, 99, 248, 255, 255, 63, 0, 5, 254, 2, 254, 167, 53,
      129, 132, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130
    ]

    await editableDocument.click()
    await editableDocument.evaluate((element, bytes) => {
      const file = new File([new Uint8Array(bytes)], 'clipboard.png', {
        type: 'image/png'
      })
      const dataTransfer = new DataTransfer()

      dataTransfer.items.add(file)
      element.dispatchEvent(
        new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dataTransfer
        })
      )
    }, pngBytes)

    await expect
      .poll(
        async () =>
          readdir(join(workspacePath, 'docs', '.mde', 'assets')).catch(() => []),
        { timeout: 10_000 }
      )
      .toContainEqual(expect.stringMatching(/^image-.+\.png$/))
    await expect
      .poll(async () => readFile(diagramPath, 'utf8'), { timeout: 10_000 })
      .toContain('.mde/assets/image-')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('summarizes and translates the current Markdown file with an installed AI CLI', async () => {
  const workspacePath = await createFixtureWorkspace()
  const fakeBinPath = await mkdtemp(join(tmpdir(), 'mde-fake-ai-bin-'))
  const fakeCodexPath = join(fakeBinPath, 'codex')

  await writeFile(
    fakeCodexPath,
    [
      '#!/bin/sh',
      'input="$(cat)"',
      'case "$input" in',
      '  *"Make it shorter"*) printf "%s\\n" "## Summary" "" "- Shorter summary from fake CLI." ;;',
      '  *Translate*) printf "%s\\n" "# English" "" "Translated from fake CLI." ;;',
      '  *) printf "%s\\n" "## Summary" ""; i=1; while [ "$i" -le 80 ]; do printf "%s\\n" "- Summary from fake CLI line $i."; i=$((i + 1)); done ;;',
      'esac'
    ].join('\n')
  )
  await chmod(fakeCodexPath, 0o755)

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`],
    env: {
      PATH: `${fakeBinPath}:${process.env.PATH ?? ''}`
    }
  })

  try {
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /README\.md Markdown file/i }).click()
    await expect(window.getByTestId('markdown-block-editor')).toBeVisible()

    await window.getByRole('button', { name: /summarize markdown/i }).click()

    const aiResult = window.getByRole('region', { name: /ai result/i })

    await expect(aiResult).toContainText('Summary from fake CLI')
    await expect(aiResult.locator('[contenteditable="false"]').first())
      .toBeVisible()
    await expect(
      window.getByRole('textbox', { name: /refine summary instruction/i })
    ).toBeVisible()
    const refineBar = window.locator('.ai-summary-refine-bar')
    const resultScroll = aiResult.locator('.ai-result-editor-scroll')
    const editorPane = window.locator('.editor-pane')
    const initialRefineBarTop = await refineBar.evaluate((element) =>
      Math.round(element.getBoundingClientRect().top)
    )

    await resultScroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })

    expect(await resultScroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    expect(await editorPane.evaluate((element) => element.scrollTop)).toBe(0)
    expect(
      await refineBar.evaluate((element) =>
        Math.round(element.getBoundingClientRect().top)
      )
    ).toBe(initialRefineBarTop)
    await expect(
      window.getByRole('textbox', { name: /refine summary instruction/i })
    ).toBeInViewport()
    await expect(
      readFile(
        join(workspacePath, '.mde', 'translations', 'README-summary.md'),
        'utf8'
      )
    ).resolves.toContain('Summary from fake CLI')

    await window
      .getByRole('textbox', { name: /refine summary instruction/i })
      .fill('Make it shorter')
    await window.getByRole('button', { name: /regenerate summary/i }).click()

    await expect(aiResult).toContainText('Shorter summary from fake CLI')
    await expect(
      readFile(
        join(workspacePath, '.mde', 'translations', 'README-summary.md'),
        'utf8'
      )
    ).resolves.toContain('Shorter summary from fake CLI')

    await window.getByRole('button', { name: /translate markdown/i }).click()
    await window.getByRole('menuitem', { name: /English/i }).click()

    await expect(aiResult).toContainText('Translated from fake CLI')
    await expect(
      window.getByRole('textbox', { name: /refine summary instruction/i })
    ).toHaveCount(0)
    await expect(
      readFile(
        join(workspacePath, '.mde', 'translations', 'README.English.md'),
        'utf8'
      )
    ).resolves.toContain('Translated from fake CLI')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('opens a standalone markdown file and remembers it in the workspace manager', async () => {
  const workspacePath = await createFixtureWorkspace()
  const standaloneFilePath = join(workspacePath, 'standalone.md')

  await writeFile(standaloneFilePath, '# Standalone File\n\nOpened alone.')

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-file=${standaloneFilePath}`]
  })

  try {
    await openMarkdownFile(window)

    await expect(
      window.getByRole('button', { name: /standalone\.md Markdown file/i })
    ).toBeVisible()
    await expect(window.getByTestId('markdown-block-editor')).toContainText(
      'Standalone File'
    )
    await expect(window).toHaveTitle(`standalone.md - ${await realpath(workspacePath)}`)

    await window.getByRole('button', { name: /manage workspaces/i }).click()
    await expect(
      window.getByRole('button', { name: /switch to file standalone\.md/i })
    ).toBeVisible()
    expect(
      await window.evaluate(() =>
        globalThis.localStorage.getItem('mde.recentWorkspaces')
      )
    ).toContain('"type":"file"')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('opens a standalone markdown file from a command line path', async () => {
  const workspacePath = await createFixtureWorkspace()
  const standaloneFilePath = join(workspacePath, 'cli-file.md')

  await writeFile(standaloneFilePath, '# CLI File\n\nOpened from mde.')

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [standaloneFilePath]
  })

  try {
    await expect(
      window.getByRole('button', { name: /cli-file\.md Markdown file/i })
    ).toBeVisible()
    await expect(window.getByTestId('markdown-block-editor')).toContainText(
      'CLI File'
    )
    await expect(window).toHaveTitle(`cli-file.md - ${await realpath(workspacePath)}`)
    await expect(
      window.getByRole('button', { name: /manage workspaces/i })
    ).toHaveText(/cli-file\.md/i)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('scrolls to the end of a long markdown document', async () => {
  const workspacePath = await createFixtureWorkspace()
  const longDocumentPath = join(workspacePath, 'long.md')
  const finalLine = 'End of long editable document'

  await writeFile(
    longDocumentPath,
    [
      '# Long Document',
      '',
      ...Array.from({ length: 90 }, (_, index) => `Paragraph ${index + 1}`),
      finalLine
    ].join('\n\n')
  )

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await window.setViewportSize({ width: 900, height: 600 })
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /long\.md Markdown file/i }).click()

    const editorPane = window.locator('.editor-pane')
    const finalParagraph = window.getByText(finalLine)

    await expect(finalParagraph).toBeAttached()
    await editorPane.hover()
    await window.mouse.wheel(0, 20_000)

    await expect(finalParagraph).toBeInViewport()
    expect(
      await finalParagraph.evaluate((element) => {
        const rect = element.getBoundingClientRect()

        return globalThis.innerHeight - rect.bottom
      })
    ).toBeGreaterThanOrEqual(96)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('scrolls to the last block after editing a long document', async () => {
  const workspacePath = await createFixtureWorkspace()
  const finalLine = 'Typed paragraph 45'
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await window.setViewportSize({ width: 900, height: 600 })
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /README\.md Markdown file/i }).click()

    const editorPane = window.locator('.editor-pane')
    const editableDocument = window
      .getByTestId('blocknote-view')
      .locator('[contenteditable="true"]')
      .first()

    await editableDocument.click()
    await window.keyboard.press('End')

    for (let index = 1; index <= 45; index += 1) {
      await window.keyboard.press('Enter')
      await window.keyboard.insertText(`Typed paragraph ${index}`)
    }

    const finalParagraph = window.getByText(finalLine)

    await expect(finalParagraph).toBeAttached()
    await editorPane.hover()
    await window.mouse.wheel(0, 20_000)

    await expect(finalParagraph).toBeInViewport()
    expect(
      await finalParagraph.evaluate((element) => {
        const rect = element.getBoundingClientRect()

        return globalThis.innerHeight - rect.bottom
      })
    ).toBeGreaterThanOrEqual(96)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('edits and auto-saves markdown, then creates a new file', async () => {
  const workspacePath = await createFixtureWorkspace()
  const readmePath = join(workspacePath, 'README.md')
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await window.setViewportSize({ width: 1280, height: 720 })
    await openNewWorkspace(window)
    const readmeRow = window.getByRole('button', {
      name: /README\.md Markdown file/i
    })

    await readmeRow.click()

    const toolbarButtons = [
      window.getByRole('button', { name: /new markdown file/i }),
      window.getByRole('button', { name: /new folder/i }),
      window.getByRole('button', { name: /rename selected README\.md/i }),
      window.getByRole('button', { name: /delete selected README\.md/i }),
      window.getByRole('button', { name: /show hidden entries/i })
    ]
    const toolbarButtonTops = await Promise.all(
      toolbarButtons.map((button) =>
        button.evaluate((element) => Math.round(element.getBoundingClientRect().top))
      )
    )

    expect(new Set(toolbarButtonTops).size).toBe(1)
    await expect(readmeRow).toHaveAttribute('aria-current', 'page')
    await expect(readmeRow).toHaveClass(/is-active/)
    await expect(window.locator('.app-shell')).toBeVisible()
    await expect(
      window.getByRole('complementary', { name: /^Explorer$/i })
    ).toBeVisible()
    await expect(window.getByRole('region', { name: /^Editor$/i })).toBeVisible()
    await expect(
      window.getByRole('button', { name: /save README\.md/i })
    ).toHaveCount(0)
    await expect(
      window.getByRole('button', { name: /open recent file README\.md/i })
    ).toBeVisible()
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
    await window.keyboard.insertText('Autosaved after idle')

    await expect
      .poll(async () => readFile(readmePath, 'utf8'), { timeout: 10_000 })
      .toContain('Autosaved after idle')
    await expect(window.getByText(/unsaved changes/i)).toBeHidden()

    await editableDocument.click()
    await window.keyboard.press('End')
    await window.keyboard.press('Enter')
    await window.keyboard.insertText('Autosaved on blur')
    await window.getByRole('button', { name: /manage workspaces/i }).click()

    await expect
      .poll(async () => readFile(readmePath, 'utf8'), { timeout: 3000 })
      .toContain('Autosaved on blur')
    await expect(window.getByText(/unsaved changes/i)).toBeHidden()
    await window.getByRole('button', { name: /close workspace popup/i }).click()

    await window.getByRole('button', { name: /new markdown file/i }).click()
    await window.getByLabel(/new markdown file name/i).fill('notes.md')
    await window.keyboard.press('Enter')

    await expect(
      window.getByRole('button', { name: /notes\.md Markdown file/i })
    ).toBeVisible()
    await expect(readFile(join(workspacePath, 'notes.md'), 'utf8')).resolves.toBe('')

    const docsRow = window.getByRole('button', { name: /docs folder/i })

    await docsRow.click()
    await expect(docsRow).toHaveAttribute('aria-current', 'page')
    await window.getByRole('button', { name: /new markdown file/i }).click()
    await expect(window.getByLabel(/new markdown file name/i)).toHaveValue(
      'Untitled.md'
    )
    await window.getByLabel(/new markdown file name/i).fill('inside-docs')
    await window.keyboard.press('Enter')

    await expect(
      window.getByRole('button', { name: /inside-docs\.md Markdown file/i })
    ).toBeVisible()
    await expect(
      readFile(join(workspacePath, 'docs', 'inside-docs.md'), 'utf8')
    ).resolves.toBe('')

    await docsRow.click()
    await expect(docsRow).toHaveAttribute('aria-current', 'page')
    await docsRow.click()
    await expect(docsRow).not.toHaveAttribute('aria-current', 'page')
    await window.getByRole('button', { name: /new folder/i }).click()
    await expect(window.getByLabel(/new folder name/i)).toHaveValue('notes')
    await window.getByLabel(/new folder name/i).fill('drafts')
    await window.keyboard.press('Enter')

    await expect(
      window.getByRole('button', { name: /drafts folder/i })
    ).toBeVisible()
    await expect(stat(join(workspacePath, 'drafts'))).resolves.toMatchObject({})

    await window.getByRole('button', { name: /drafts folder/i }).click({
      button: 'right'
    })
    await expect(window.getByRole('menu', { name: /drafts actions/i })).toBeVisible()
    await window.locator('.explorer-header').click()
    await expect(window.getByRole('menu', { name: /drafts actions/i })).toHaveCount(0)
    await window.getByRole('button', { name: /drafts folder/i }).click({
      button: 'right'
    })
    await window.getByRole('menuitem', { name: /^hide$/i }).click()
    await expect(
      window.getByRole('button', { name: /drafts folder/i })
    ).toBeHidden()
    await expect(stat(join(workspacePath, 'drafts'))).resolves.toMatchObject({})
    await window.getByRole('button', { name: /show hidden entries/i }).click()
    await expect(
      window.getByRole('button', { name: /drafts folder/i })
    ).toBeVisible()
    await window.getByRole('button', { name: /drafts folder/i }).click({
      button: 'right'
    })
    await window.getByRole('menuitem', { name: /^show$/i }).click()
    await expect(
      window.getByRole('button', { name: /drafts folder/i })
    ).toBeVisible()
    await expect(
      window.getByRole('button', { name: /show hidden entries/i })
    ).toBeDisabled()

    await window.getByRole('button', { name: /drafts folder/i }).click({
      button: 'right'
    })
    await window.getByRole('menuitem', { name: /^hide$/i }).click()
    await expect(
      window.getByRole('button', { name: /drafts folder/i })
    ).toBeHidden()
    await window.getByRole('button', { name: /show hidden entries/i }).click()
    await expect(
      window.getByRole('button', { name: /drafts folder/i })
    ).toBeVisible()
    await window.getByRole('button', { name: /hide hidden entries/i }).click()
    await expect(
      window.getByRole('button', { name: /drafts folder/i })
    ).toBeHidden()

    await window.reload()
    await expect(
      window.getByRole('button', { name: /manage workspaces/i })
    ).toBeVisible()
    await expect(
      window.getByRole('button', { name: /rename selected inside-docs\.md/i })
    ).toBeVisible()

    await expect(
      window.getByRole('button', { name: /drafts folder/i })
    ).toBeHidden()
    await window.getByRole('button', { name: /show hidden entries/i }).click()
    await expect(
      window.getByRole('button', { name: /drafts folder/i })
    ).toBeVisible()
    await window.getByRole('button', { name: /hide hidden entries/i }).click()
    await expect(
      window.getByRole('button', { name: /drafts folder/i })
    ).toBeHidden()

    const notesRow = window.getByRole('button', {
      name: /notes\.md Markdown file/i
    })

    await notesRow.click({ button: 'right' })
    await window.getByRole('menuitem', { name: /^rename$/i }).click()
    await window.getByLabel(/rename notes\.md/i).fill('renamed')
    await window.keyboard.press('Enter')

    await expect(
      window.getByRole('button', { name: /renamed\.md Markdown file/i })
    ).toBeVisible()
    await expect(stat(join(workspacePath, 'renamed.md'))).resolves.toMatchObject({})
    await expect(stat(join(workspacePath, 'notes.md'))).rejects.toMatchObject({
      code: 'ENOENT'
    })

    await window
      .getByRole('button', { name: /renamed\.md Markdown file/i })
      .click({ button: 'right' })
    await window.getByRole('menuitem', { name: /^delete$/i }).click()
    await window.getByRole('button', { name: /confirm delete/i }).click()

    await expect(
      window.getByRole('button', { name: /renamed\.md Markdown file/i })
    ).toBeHidden()
    await expect(stat(join(workspacePath, 'renamed.md'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('remembers and switches recent workspaces from the workspace menu', async () => {
  const firstWorkspacePath = await createFixtureWorkspace()
  const secondWorkspacePath = await createFixtureWorkspace()

  await writeFile(join(secondWorkspacePath, 'SECOND.md'), '# Second workspace')

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${firstWorkspacePath}`]
  })

  try {
    await window.setViewportSize({ width: 900, height: 600 })
    await openNewWorkspace(window)

    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible()

    await window.evaluate(
      ({ firstWorkspacePath, secondWorkspacePath }) => {
        globalThis.localStorage.setItem(
          'mde.recentWorkspaces',
          JSON.stringify([
            {
              name: 'Second Workspace',
              rootPath: secondWorkspacePath,
              type: 'workspace'
            },
            {
              name: 'First Workspace',
              rootPath: firstWorkspacePath,
              type: 'workspace'
            }
          ])
        )
      },
      { firstWorkspacePath, secondWorkspacePath }
    )
    await window.reload({ waitUntil: 'domcontentloaded' })
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible()

    await ensureWorkspaceDialogOpen(window)
    await window
      .getByRole('button', { name: /switch to workspace Second Workspace/i })
      .click()

    await expect(
      window.getByRole('button', { name: /SECOND\.md Markdown file/i })
    ).toBeVisible()
    await expect(window).toHaveTitle(await realpath(secondWorkspacePath))
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})
