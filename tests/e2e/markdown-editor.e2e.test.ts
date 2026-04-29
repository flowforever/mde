import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { buildElectronApp, launchElectronApp } from './support/electronApp'
import { createFixtureWorkspace } from './support/fixtureWorkspace'

test.setTimeout(120_000)

test.beforeAll(async ({ browserName }, testInfo) => {
  void browserName
  testInfo.setTimeout(120_000)
  await buildElectronApp()
})

const ensureWorkspaceDialogOpen = async (window: Page): Promise<void> => {
  const workspaceDialog = window.getByRole('dialog', {
    name: /workspace manager/i
  })
  const workspaceDialogBackdrop = window.locator('.workspace-dialog-backdrop')

  await workspaceDialogBackdrop
    .waitFor({ state: 'visible', timeout: 1500 })
    .catch(() => undefined)

  if (await workspaceDialogBackdrop.isVisible().catch(() => false)) {
    return
  }

  await window
    .getByRole('button', { name: /^open workspace$/i })
    .or(window.getByRole('button', { name: /manage workspaces/i }))
    .click()
  await expect(workspaceDialogBackdrop).toBeVisible()
  await expect(workspaceDialog).toBeVisible()
}

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const openNewWorkspace = async (window: Page): Promise<void> => {
  await ensureWorkspaceDialogOpen(window)

  await window.getByRole('button', { name: /open new workspace/i }).click()
}

const openMarkdownFile = async (window: Page): Promise<void> => {
  await ensureWorkspaceDialogOpen(window)

  await window.getByRole('button', { name: /open markdown file/i }).click()
}

test('shows the initial centered workspace popup', async () => {
  const { app, startupDiagnostics, window } = await launchElectronApp()

  try {
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

test('edits and saves markdown by button and keyboard, then creates a new file', async () => {
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

    const docsRow = window.getByRole('button', { name: /docs folder/i })

    await docsRow.click()
    await expect(docsRow).toHaveAttribute('aria-current', 'page')
    await window.getByRole('button', { name: /new markdown file/i }).click()
    await expect(window.getByLabel(/markdown file path/i)).toHaveValue(
      'docs/Untitled.md'
    )
    await window.getByLabel(/markdown file path/i).fill('inside-docs')
    await window.getByRole('button', { name: /^create$/i }).click()

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
    await expect(window.getByLabel(/folder path/i)).toHaveValue('notes')
    await window.getByLabel(/folder path/i).fill('drafts')
    await window.getByRole('button', { name: /^create$/i }).click()

    await expect(
      window.getByRole('button', { name: /drafts folder/i })
    ).toBeVisible()
    await expect(stat(join(workspacePath, 'drafts'))).resolves.toMatchObject({})

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

    const workspaceName = basename(await realpath(workspacePath))

    await window.reload()
    await ensureWorkspaceDialogOpen(window)
    await window
      .getByRole('button', {
        name: new RegExp(`switch to workspace ${escapeRegExp(workspaceName)}`, 'i')
      })
      .click()

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
    await window.getByLabel(/entry name/i).fill('renamed')
    await window.getByRole('button', { name: /^rename$/i }).click()

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
              rootPath: secondWorkspacePath
            },
            {
              name: 'First Workspace',
              rootPath: firstWorkspacePath
            }
          ])
        )
        globalThis.location.reload()
      },
      { firstWorkspacePath, secondWorkspacePath }
    )

    await expect(
      window.getByRole('dialog', { name: /workspace manager/i })
    ).toBeVisible()
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
