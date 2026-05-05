import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const appPath = join(process.cwd(), 'apps/desktop/src/renderer/src/app/App.tsx')
const aiResultPanelPath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/ai/AiResultPanel.tsx'
)
const packageEditorPath = join(
  process.cwd(),
  'packages/editor-react/src/MarkdownBlockEditor.tsx'
)
const desktopEditorRoot = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editor'
)
const desktopEditorHostRoot = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editorHost'
)

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

describe('desktop editor host adapter boundaries', () => {
  it('keeps desktop-only editor host policies outside the editor compatibility directory', async () => {
    await expect(
      fileExists(join(desktopEditorHostRoot, 'desktopMarkdownAssetResolver.ts'))
    ).resolves.toBe(true)
    await expect(
      fileExists(join(desktopEditorHostRoot, 'editorLinkDirectories.ts'))
    ).resolves.toBe(true)
    await expect(
      fileExists(join(desktopEditorHostRoot, 'editorLinks.ts'))
    ).resolves.toBe(true)

    await expect(
      fileExists(join(desktopEditorRoot, 'desktopMarkdownAssetResolver.ts'))
    ).resolves.toBe(false)
    await expect(
      fileExists(join(desktopEditorRoot, 'editorLinkDirectories.ts'))
    ).resolves.toBe(false)
    await expect(
      fileExists(join(desktopEditorRoot, 'editorLinks.ts'))
    ).resolves.toBe(false)

    const [app, aiResultPanel, packageEditor] = await Promise.all([
      readFile(appPath, 'utf8'),
      readFile(aiResultPanelPath, 'utf8'),
      readFile(packageEditorPath, 'utf8')
    ])

    expect(app).toContain('../editorHost/desktopMarkdownAssetResolver')
    expect(app).toContain('../editorHost/editorLinkDirectories')
    expect(app).toContain('../editorHost/editorLinks')
    expect(aiResultPanel).toContain(
      '../editorHost/desktopMarkdownAssetResolver'
    )
    expect(packageEditor).not.toContain('apps/desktop')
    expect(packageEditor).not.toContain('editorHost')
  })
})
