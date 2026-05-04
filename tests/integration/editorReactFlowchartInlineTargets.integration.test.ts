import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const mermaidFlowchartPanelPath = join(
  process.cwd(),
  'packages/editor-react/src/MermaidFlowchartPanel.tsx'
)
const mermaidFlowchartPanelTestPath = join(
  process.cwd(),
  'tests/unit/MermaidFlowchartPanel.test.ts'
)
const packageIndexPath = join(
  process.cwd(),
  'packages/editor-react/src/index.ts'
)
const desktopFlowchartInlineTargetsPath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editor/flowchartInlineTargets.ts'
)

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

describe('editor-react flowchart inline target package consumption', () => {
  it('exposes inline flowchart target helpers from editor-react instead of a desktop editor module', async () => {
    const [mermaidFlowchartPanel, mermaidFlowchartPanelTest, packageIndex] =
      await Promise.all([
        readFile(mermaidFlowchartPanelPath, 'utf8'),
        readFile(mermaidFlowchartPanelTestPath, 'utf8'),
        readFile(packageIndexPath, 'utf8')
      ])

    expect(mermaidFlowchartPanel).toMatch(
      /from ['"]\.\/flowchartInlineTargets['"]/u
    )
    expect(mermaidFlowchartPanelTest).toMatch(/from ['"]@mde\/editor-react['"]/u)
    expect(packageIndex).toContain('areSameInlineFlowchartTargets')
    expect(packageIndex).toContain('getNextMissingInlineFlowchartTargets')
    await expect(fileExists(desktopFlowchartInlineTargetsPath)).resolves.toBe(
      false
    )
  })
})
