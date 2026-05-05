import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const appPath = join(process.cwd(), 'apps/desktop/src/renderer/src/app/App.tsx')
const markdownBlockEditorPath = join(
  process.cwd(),
  'packages/editor-react/src/MarkdownBlockEditor.tsx'
)
const layoutPreferenceIntegrationTestPath = join(
  process.cwd(),
  'apps/desktop/tests/integration/editorLayoutPreferences.integration.test.ts'
)
const lineSpacingUnitTestPath = join(
  process.cwd(),
  'apps/desktop/tests/unit/editorLineSpacing.test.ts'
)
const viewModeUnitTestPath = join(
  process.cwd(),
  'apps/desktop/tests/unit/editorViewMode.test.ts'
)
const packageIndexPath = join(
  process.cwd(),
  'packages/editor-react/src/index.ts'
)
const desktopLineSpacingPath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editor/editorLineSpacing.ts'
)
const desktopViewModePath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editor/editorViewMode.ts'
)

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

describe('editor-react layout preference package consumption', () => {
  it('exposes editor layout preference helpers from editor-react instead of desktop editor modules', async () => {
    const [
      app,
      markdownBlockEditor,
      layoutPreferenceIntegrationTest,
      lineSpacingUnitTest,
      viewModeUnitTest,
      packageIndex
    ] = await Promise.all([
      readFile(appPath, 'utf8'),
      readFile(markdownBlockEditorPath, 'utf8'),
      readFile(layoutPreferenceIntegrationTestPath, 'utf8'),
      readFile(lineSpacingUnitTestPath, 'utf8'),
      readFile(viewModeUnitTestPath, 'utf8'),
      readFile(packageIndexPath, 'utf8')
    ])

    expect(app).toMatch(/from ['"]@mde\/editor-react['"]/u)
    expect(markdownBlockEditor).toMatch(
      /from ['"]\.\/layoutPreferences['"]/u
    )
    expect(layoutPreferenceIntegrationTest).toMatch(
      /from ['"]@mde\/editor-react['"]/u
    )
    expect(lineSpacingUnitTest).toMatch(/from ['"]@mde\/editor-react['"]/u)
    expect(viewModeUnitTest).toMatch(/from ['"]@mde\/editor-react['"]/u)
    expect(packageIndex).toContain('readEditorLineSpacing')
    expect(packageIndex).toContain('readEditorViewMode')
    await expect(fileExists(desktopLineSpacingPath)).resolves.toBe(false)
    await expect(fileExists(desktopViewModePath)).resolves.toBe(false)
  })
})
