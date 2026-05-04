import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const markdownBlockEditorPath = join(
  process.cwd(),
  'packages/editor-react/src/MarkdownBlockEditor.tsx'
)
const codeHighlighterUnitTestPath = join(
  process.cwd(),
  'tests/unit/editorCodeHighlighter.test.ts'
)
const codeHighlighterIntegrationTestPath = join(
  process.cwd(),
  'tests/integration/editorCodeHighlighter.integration.test.ts'
)
const packageIndexPath = join(
  process.cwd(),
  'packages/editor-react/src/index.ts'
)
const desktopCodeHighlighterPath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editor/editorCodeHighlighter.ts'
)

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

describe('editor-react code highlighter package consumption', () => {
  it('exposes the Shiki code highlighter adapter from editor-react instead of a desktop editor module', async () => {
    const [
      markdownBlockEditor,
      codeHighlighterUnitTest,
      codeHighlighterIntegrationTest,
      packageIndex
    ] = await Promise.all([
      readFile(markdownBlockEditorPath, 'utf8'),
      readFile(codeHighlighterUnitTestPath, 'utf8'),
      readFile(codeHighlighterIntegrationTestPath, 'utf8'),
      readFile(packageIndexPath, 'utf8')
    ])

    expect(markdownBlockEditor).toMatch(/from ['"]\.\/codeHighlighter['"]/u)
    expect(codeHighlighterUnitTest).toMatch(/from ['"]@mde\/editor-react['"]/u)
    expect(codeHighlighterIntegrationTest).toMatch(
      /from ['"]@mde\/editor-react['"]/u
    )
    expect(packageIndex).toContain('createEditorCodeHighlighter')
    expect(packageIndex).toContain('getEditorCodeThemeForThemeFamily')
    await expect(fileExists(desktopCodeHighlighterPath)).resolves.toBe(false)
  })
})
