import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const markdownBlockEditorPath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx'
)
const appPath = join(process.cwd(), 'apps/desktop/src/renderer/src/app/App.tsx')
const desktopLinkDirectoriesPath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editor/editorLinkDirectories.ts'
)

describe('editor link tree adapter boundary', () => {
  it('keeps desktop hidden-entry policy injected from the app shell instead of imported by MarkdownBlockEditor', async () => {
    const [markdownBlockEditor, app, desktopLinkDirectories] =
      await Promise.all([
        readFile(markdownBlockEditorPath, 'utf8'),
        readFile(appPath, 'utf8'),
        readFile(desktopLinkDirectoriesPath, 'utf8')
      ])

    expect(markdownBlockEditor).not.toMatch(
      /from ['"]\.\/editorLinkDirectories['"]/u
    )
    expect(markdownBlockEditor).toContain('createVisibleLinkWorkspaceTree')
    expect(app).toMatch(/from ['"].*editorLinkDirectories['"]/u)
    expect(app).toContain('createVisibleLinkWorkspaceTree={')
    expect(desktopLinkDirectories).toContain('createVisibleEditorLinkTree')
  })
})
