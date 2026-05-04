import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const markdownBlockEditorPath = join(
  process.cwd(),
  'packages/editor-react/src/MarkdownBlockEditor.tsx'
)
const codeHighlighterPath = join(
  process.cwd(),
  'packages/editor-react/src/codeHighlighter.ts'
)
const codeBlockLanguageTestPath = join(
  process.cwd(),
  'tests/unit/editorCodeBlockLanguages.test.ts'
)
const packageIndexPath = join(
  process.cwd(),
  'packages/editor-react/src/index.ts'
)
const desktopCodeBlockLanguagesPath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editor/editorCodeBlockLanguages.ts'
)

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

describe('editor-react code block language package consumption', () => {
  it('exposes code block language helpers from editor-react instead of a desktop editor module', async () => {
    const [
      markdownBlockEditor,
      codeHighlighter,
      codeBlockLanguageTest,
      packageIndex
    ] = await Promise.all([
      readFile(markdownBlockEditorPath, 'utf8'),
      readFile(codeHighlighterPath, 'utf8'),
      readFile(codeBlockLanguageTestPath, 'utf8'),
      readFile(packageIndexPath, 'utf8')
    ])

    expect(markdownBlockEditor).toMatch(
      /from ['"]\.\/codeBlockLanguages['"]/u
    )
    expect(codeHighlighter).toMatch(/from ['"]\.\/codeBlockLanguages['"]/u)
    expect(codeBlockLanguageTest).toMatch(/from ['"]@mde\/editor-react['"]/u)
    expect(packageIndex).toContain('normalizeImportedCodeBlockLanguages')
    expect(packageIndex).toContain('SUPPORTED_CODE_LANGUAGES')
    await expect(fileExists(desktopCodeBlockLanguagesPath)).resolves.toBe(false)
  })
})
