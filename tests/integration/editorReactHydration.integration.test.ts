import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const markdownBlockEditorPath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx'
)
const hydrationTestPath = join(
  process.cwd(),
  'tests/integration/editorHydration.integration.test.ts'
)
const packageIndexPath = join(
  process.cwd(),
  'packages/editor-react/src/index.ts'
)
const desktopHydrationPath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editor/editorHydration.ts'
)

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

describe('editor-react hydration package consumption', () => {
  it('exposes hydration helpers from editor-react instead of a desktop editor module', async () => {
    const [markdownBlockEditor, hydrationTest, packageIndex] =
      await Promise.all([
        readFile(markdownBlockEditorPath, 'utf8'),
        readFile(hydrationTestPath, 'utf8'),
        readFile(packageIndexPath, 'utf8')
      ])

    expect(markdownBlockEditor).toMatch(/from ['"]@mde\/editor-react['"]/u)
    expect(hydrationTest).toMatch(/from ['"]@mde\/editor-react['"]/u)
    expect(packageIndex).toContain('replaceEditorDocumentWithoutUndoHistory')
    expect(packageIndex).toContain('shouldImportMarkdownIntoEditor')
    await expect(fileExists(desktopHydrationPath)).resolves.toBe(false)
  })
})
