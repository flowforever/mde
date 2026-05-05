import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const packageIndexPath = join(process.cwd(), 'packages/editor-react/src/index.ts')
const packageEditorPath = join(
  process.cwd(),
  'packages/editor-react/src/MarkdownBlockEditor.tsx'
)
const desktopEditorShimPath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx'
)
const appPath = join(process.cwd(), 'apps/desktop/src/renderer/src/app/App.tsx')
const aiResultPanelPath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/ai/AiResultPanel.tsx'
)
const markdownBlockEditorUnitTestPath = join(
  process.cwd(),
  'apps/desktop/tests/unit/MarkdownBlockEditor.test.tsx'
)

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

describe('editor-react MarkdownBlockEditor package export', () => {
  it('hosts the main editor component in editor-react and consumes it through the package specifier', async () => {
    await expect(fileExists(packageEditorPath)).resolves.toBe(true)

    const [packageIndex, app, aiResultPanel, markdownBlockEditorUnitTest] =
      await Promise.all([
        readFile(packageIndexPath, 'utf8'),
        readFile(appPath, 'utf8'),
        readFile(aiResultPanelPath, 'utf8'),
        readFile(markdownBlockEditorUnitTestPath, 'utf8')
      ])

    expect(packageIndex).toContain("from './MarkdownBlockEditor'")
    expect(packageIndex).toContain('MarkdownBlockEditor')
    expect(app).toMatch(/from ['"]@mde\/editor-react['"]/u)
    expect(app).not.toMatch(/from ['"]\.\.\/editor\/MarkdownBlockEditor['"]/u)
    expect(aiResultPanel).toMatch(/from ['"]@mde\/editor-react['"]/u)
    expect(aiResultPanel).not.toMatch(
      /from ['"]\.\.\/editor\/MarkdownBlockEditor['"]/u
    )
    expect(markdownBlockEditorUnitTest).toMatch(
      /from ['"]@mde\/editor-react['"]/u
    )

    if (await fileExists(desktopEditorShimPath)) {
      const desktopEditorShim = await readFile(desktopEditorShimPath, 'utf8')

      expect(desktopEditorShim).toMatch(
        /export \{ MarkdownBlockEditor \} from ['"]@mde\/editor-react['"]/u
      )
      expect(desktopEditorShim).not.toMatch(/from ['"]react['"]/u)
      expect(desktopEditorShim).not.toMatch(/from ['"]@blocknote\//u)
    }
  })
})
