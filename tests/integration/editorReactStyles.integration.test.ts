import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const readProjectFile = (path: string): Promise<string> =>
  readFile(join(process.cwd(), path), 'utf8')

describe('editor-react stylesheet entrypoint', () => {
  it('is imported by the desktop renderer and owns BlockNote base styles', async () => {
    const [desktopEntry, editorPackageStyles, desktopEditorComponent] =
      await Promise.all([
        readProjectFile('apps/desktop/src/renderer/src/main.tsx'),
        readProjectFile('packages/editor-react/styles.css'),
        readProjectFile(
          'packages/editor-react/src/MarkdownBlockEditor.tsx'
        )
      ])

    expect(desktopEntry).toContain("import '@mde/editor-react/styles.css'")
    expect(editorPackageStyles).toContain(
      "@import '@blocknote/core/fonts/inter.css';"
    )
    expect(editorPackageStyles).toContain(
      "@import '@blocknote/mantine/style.css';"
    )
    expect(desktopEditorComponent).not.toContain('@blocknote/core/fonts/inter.css')
    expect(desktopEditorComponent).not.toContain('@blocknote/mantine/style.css')
  })
})
