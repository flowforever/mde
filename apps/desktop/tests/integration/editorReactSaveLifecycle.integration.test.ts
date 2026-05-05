import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const markdownBlockEditorPath = join(
  process.cwd(),
  'packages/editor-react/src/MarkdownBlockEditor.tsx'
)
const saveLifecycleTestPath = join(
  process.cwd(),
  'apps/desktop/tests/unit/editorSaveLifecycle.test.ts'
)
const packageIndexPath = join(
  process.cwd(),
  'packages/editor-react/src/index.ts'
)
const desktopSaveLifecyclePath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editor/editorSaveLifecycle.ts'
)

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

describe('editor-react save lifecycle package consumption', () => {
  it('exposes save lifecycle helpers from editor-react instead of a desktop editor module', async () => {
    const [markdownBlockEditor, saveLifecycleTest, packageIndex] =
      await Promise.all([
        readFile(markdownBlockEditorPath, 'utf8'),
        readFile(saveLifecycleTestPath, 'utf8'),
        readFile(packageIndexPath, 'utf8')
      ])

    expect(markdownBlockEditor).toMatch(/from ['"]\.\/saveLifecycle['"]/u)
    expect(saveLifecycleTest).toMatch(/from ['"]@mde\/editor-react['"]/u)
    expect(packageIndex).toContain('chooseMarkdownContentsToSave')
    expect(packageIndex).toContain('shouldRetryUnchangedSave')
    expect(packageIndex).toContain('shouldClearLocalChangesAfterUnchangedSave')
    await expect(fileExists(desktopSaveLifecyclePath)).resolves.toBe(false)
  })
})
