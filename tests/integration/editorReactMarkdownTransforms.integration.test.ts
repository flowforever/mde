import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const markdownBlockEditorPath = join(
  process.cwd(),
  'packages/editor-react/src/MarkdownBlockEditor.tsx'
)
const markdownTransformsUnitTestPath = join(
  process.cwd(),
  'tests/unit/markdownTransforms.test.ts'
)
const blankLinesIntegrationTestPath = join(
  process.cwd(),
  'tests/integration/editorBlankLines.integration.test.ts'
)
const markdownTransformsBoundaryTestPath = join(
  process.cwd(),
  'tests/integration/editorMarkdownTransformsBoundary.integration.test.ts'
)
const packageIndexPath = join(
  process.cwd(),
  'packages/editor-react/src/index.ts'
)
const desktopMarkdownTransformsPath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editor/markdownTransforms.ts'
)

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

describe('editor-react markdown transform package consumption', () => {
  it('exposes markdown transform helpers from editor-react instead of a desktop editor module', async () => {
    const [
      markdownBlockEditor,
      markdownTransformsUnitTest,
      blankLinesIntegrationTest,
      markdownTransformsBoundaryTest,
      packageIndex
    ] = await Promise.all([
      readFile(markdownBlockEditorPath, 'utf8'),
      readFile(markdownTransformsUnitTestPath, 'utf8'),
      readFile(blankLinesIntegrationTestPath, 'utf8'),
      readFile(markdownTransformsBoundaryTestPath, 'utf8'),
      readFile(packageIndexPath, 'utf8')
    ])

    expect(markdownBlockEditor).toMatch(/from ['"]\.\/markdownTransforms['"]/u)
    expect(markdownTransformsUnitTest).toMatch(/from ['"]@mde\/editor-react['"]/u)
    expect(blankLinesIntegrationTest).toMatch(/from ['"]@mde\/editor-react['"]/u)
    expect(markdownTransformsBoundaryTest).toContain(
      'packages/editor-react/src/markdownTransforms.ts'
    )
    expect(packageIndex).toContain('prepareMarkdownForEditor')
    expect(packageIndex).toContain('exportBlocksToMarkdown')
    await expect(fileExists(desktopMarkdownTransformsPath)).resolves.toBe(false)
  })
})
