import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const markdownBlockEditorPath = join(
  process.cwd(),
  'packages/editor-react/src/MarkdownBlockEditor.tsx'
)
const frontmatterPanelUnitTestPath = join(
  process.cwd(),
  'apps/desktop/tests/unit/FrontmatterPanel.test.tsx'
)
const markdownBlockEditorUnitTestPath = join(
  process.cwd(),
  'apps/desktop/tests/unit/MarkdownBlockEditor.test.tsx'
)
const packageIndexPath = join(
  process.cwd(),
  'packages/editor-react/src/index.ts'
)
const desktopFrontmatterPanelPath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editor/FrontmatterPanel.tsx'
)

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

describe('editor-react frontmatter panel package consumption', () => {
  it('exposes the frontmatter panel from editor-react instead of a desktop editor module', async () => {
    const [
      markdownBlockEditor,
      frontmatterPanelUnitTest,
      markdownBlockEditorUnitTest,
      packageIndex
    ] = await Promise.all([
      readFile(markdownBlockEditorPath, 'utf8'),
      readFile(frontmatterPanelUnitTestPath, 'utf8'),
      readFile(markdownBlockEditorUnitTestPath, 'utf8'),
      readFile(packageIndexPath, 'utf8')
    ])

    expect(markdownBlockEditor).toMatch(/from ['"]\.\/FrontmatterPanel['"]/u)
    expect(frontmatterPanelUnitTest).toMatch(/from ['"]@mde\/editor-react['"]/u)
    expect(markdownBlockEditorUnitTest).toMatch(
      /from ['"]@mde\/editor-react['"]/u
    )
    expect(packageIndex).toContain('FrontmatterPanel')
    await expect(fileExists(desktopFrontmatterPanelPath)).resolves.toBe(false)
  })
})
