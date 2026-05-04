import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const markdownBlockEditorPath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx'
)
const markdownBlockEditorTestPath = join(
  process.cwd(),
  'tests/unit/MarkdownBlockEditor.test.tsx'
)
const packageIndexPath = join(
  process.cwd(),
  'packages/editor-react/src/index.ts'
)
const desktopSearchRangesPath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editor/editorSearchRanges.ts'
)

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

describe('editor-react search range adapter package consumption', () => {
  it('exposes DOM search range helpers from editor-react instead of a desktop editor module', async () => {
    const [markdownBlockEditor, markdownBlockEditorTest, packageIndex] =
      await Promise.all([
        readFile(markdownBlockEditorPath, 'utf8'),
        readFile(markdownBlockEditorTestPath, 'utf8'),
        readFile(packageIndexPath, 'utf8')
      ])

    expect(markdownBlockEditor).toContain('from "@mde/editor-react"')
    expect(markdownBlockEditorTest).toContain('from "@mde/editor-react"')
    expect(packageIndex).toContain('createSearchRanges')
    expect(packageIndex).toContain('isEditorSearchMutationRelevant')
    await expect(fileExists(desktopSearchRangesPath)).resolves.toBe(false)
  })
})
