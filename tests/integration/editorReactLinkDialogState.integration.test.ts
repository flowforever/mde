import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const markdownBlockEditorPath = join(
  process.cwd(),
  'packages/editor-react/src/MarkdownBlockEditor.tsx'
)
const desktopLinkDirectoriesPath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editor/editorLinkDirectories.ts'
)
const linkDirectoriesUnitTestPath = join(
  process.cwd(),
  'tests/unit/editorLinkDirectories.test.ts'
)
const linkDialogStateUnitTestPath = join(
  process.cwd(),
  'tests/unit/editorLinkDialogState.test.ts'
)
const linkDirectoriesIntegrationTestPath = join(
  process.cwd(),
  'tests/integration/editorLinkDirectories.integration.test.ts'
)
const packageIndexPath = join(
  process.cwd(),
  'packages/editor-react/src/index.ts'
)
const desktopLinkDialogStatePath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editor/editorLinkDialogState.ts'
)

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

describe('editor-react link dialog state package consumption', () => {
  it('exposes link picker directory and dialog state helpers from editor-react while keeping desktop visible-tree policy local', async () => {
    const [
      markdownBlockEditor,
      desktopLinkDirectories,
      linkDirectoriesUnitTest,
      linkDialogStateUnitTest,
      linkDirectoriesIntegrationTest,
      packageIndex
    ] = await Promise.all([
      readFile(markdownBlockEditorPath, 'utf8'),
      readFile(desktopLinkDirectoriesPath, 'utf8'),
      readFile(linkDirectoriesUnitTestPath, 'utf8'),
      readFile(linkDialogStateUnitTestPath, 'utf8'),
      readFile(linkDirectoriesIntegrationTestPath, 'utf8'),
      readFile(packageIndexPath, 'utf8')
    ])

    expect(markdownBlockEditor).toMatch(/from ['"]\.\/linkDirectories['"]/u)
    expect(markdownBlockEditor).toMatch(/from ['"]\.\/linkDialogState['"]/u)
    expect(desktopLinkDirectories).not.toContain(
      'createInitialLinkDirectoryState'
    )
    expect(desktopLinkDirectories).not.toContain(
      'collectExpandedLinkDirectoryOptions'
    )
    expect(linkDirectoriesUnitTest).toMatch(/from ['"]@mde\/editor-react['"]/u)
    expect(linkDialogStateUnitTest).toMatch(/from ['"]@mde\/editor-react['"]/u)
    expect(linkDirectoriesIntegrationTest).toMatch(
      /from ['"]@mde\/editor-react['"]/u
    )
    expect(packageIndex).toContain('createInitialLinkDialogState')
    expect(packageIndex).toContain('collectExpandedLinkDirectoryOptions')
    await expect(fileExists(desktopLinkDialogStatePath)).resolves.toBe(false)
  })
})
