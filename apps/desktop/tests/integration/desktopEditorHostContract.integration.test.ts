import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const appPath = join(process.cwd(), 'apps/desktop/src/renderer/src/app/App.tsx')
const adapterPath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editorHost/desktopEditorHost.ts'
)
const markdownBlockEditorPath = join(
  process.cwd(),
  'packages/editor-react/src/MarkdownBlockEditor.tsx'
)

describe('desktop editor host contract wiring', () => {
  it('routes MarkdownBlockEditor host callbacks through the desktop EditorHost adapter', async () => {
    const [app, adapter, markdownBlockEditor] = await Promise.all([
      readFile(appPath, 'utf8'),
      readFile(adapterPath, 'utf8'),
      readFile(markdownBlockEditorPath, 'utf8')
    ])

    expect(adapter).toContain('@mde/editor-host')
    expect(app).toContain('../editorHost/desktopEditorHost')
    expect(app).toContain('createDesktopEditorHost({')
    expect(app).toContain('saveMarkdownWithEditorHost')
    expect(app).toContain('idle-autosave')
    expect(app).toContain('reason === "idle-autosave"')
    expect(markdownBlockEditor).toContain('blur-autosave')
    expect(markdownBlockEditor).toContain('onSaveRequest(contentsToSave, reason)')
    expect(app).toContain('uploadImageWithEditorHost')
    expect(app).toContain('createLinkedMarkdownWithEditorHost')
    expect(app).toContain('openLinkWithEditorHost')
    expect(app).not.toContain('onSaveRequest={saveCurrentFile}')
    expect(app).not.toContain('onImageUpload={uploadImageAsset}')
    expect(app).not.toContain('onCreateLinkedMarkdown={createMarkdownFileFromEditorLink}')
  })
})
