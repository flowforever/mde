import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const markdownBlockEditorPath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx'
)
const mermaidFlowchartPanelUnitTestPath = join(
  process.cwd(),
  'tests/unit/MermaidFlowchartPanel.test.ts'
)
const inlineTargetsIntegrationTestPath = join(
  process.cwd(),
  'tests/integration/editorReactFlowchartInlineTargets.integration.test.ts'
)
const packageIndexPath = join(
  process.cwd(),
  'packages/editor-react/src/index.ts'
)
const desktopMermaidFlowchartPanelPath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editor/MermaidFlowchartPanel.tsx'
)

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

describe('editor-react Mermaid flowchart panel package consumption', () => {
  it('exposes the flowchart panel from editor-react instead of a desktop editor module', async () => {
    const [
      markdownBlockEditor,
      mermaidFlowchartPanelUnitTest,
      inlineTargetsIntegrationTest,
      packageIndex
    ] = await Promise.all([
      readFile(markdownBlockEditorPath, 'utf8'),
      readFile(mermaidFlowchartPanelUnitTestPath, 'utf8'),
      readFile(inlineTargetsIntegrationTestPath, 'utf8'),
      readFile(packageIndexPath, 'utf8')
    ])

    expect(markdownBlockEditor).toMatch(/from ['"]@mde\/editor-react['"]/u)
    expect(markdownBlockEditor).not.toMatch(
      /from ['"]\.\/MermaidFlowchartPanel['"]/u
    )
    expect(mermaidFlowchartPanelUnitTest).toMatch(
      /from ['"]@mde\/editor-react['"]/u
    )
    expect(inlineTargetsIntegrationTest).toContain(
      'packages/editor-react/src/MermaidFlowchartPanel.tsx'
    )
    expect(packageIndex).toContain('MermaidFlowchartPanel')
    await expect(fileExists(desktopMermaidFlowchartPanelPath)).resolves.toBe(
      false
    )
  })
})
