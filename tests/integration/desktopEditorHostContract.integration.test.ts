import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const appPath = join(process.cwd(), 'apps/desktop/src/renderer/src/app/App.tsx')
const adapterPath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editorHost/desktopEditorHost.ts'
)

describe('desktop editor host contract wiring', () => {
  it('routes MarkdownBlockEditor host callbacks through the desktop EditorHost adapter', async () => {
    const [app, adapter] = await Promise.all([
      readFile(appPath, 'utf8'),
      readFile(adapterPath, 'utf8')
    ])

    expect(adapter).toContain('@mde/editor-host')
    expect(app).toContain('../editorHost/desktopEditorHost')
    expect(app).toContain('createDesktopEditorHost({')
    expect(app).toContain('saveMarkdownWithEditorHost')
    expect(app).toContain('uploadImageWithEditorHost')
    expect(app).toContain('createLinkedMarkdownWithEditorHost')
    expect(app).toContain('openLinkWithEditorHost')
    expect(app).not.toContain('onSaveRequest={saveCurrentFile}')
    expect(app).not.toContain('onImageUpload={uploadImageAsset}')
    expect(app).not.toContain('onCreateLinkedMarkdown={createMarkdownFileFromEditorLink}')
  })
})
