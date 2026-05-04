import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const markdownBlockEditorPath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editor/MarkdownBlockEditor.tsx'
)
const appPath = join(process.cwd(), 'apps/desktop/src/renderer/src/app/App.tsx')
const editorLinksPath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editor/editorLinks.ts'
)

describe('editor-core links package consumption', () => {
  it('keeps pure link helpers on editor-core instead of re-exporting them through desktop editorLinks', async () => {
    const markdownBlockEditor = await readFile(markdownBlockEditorPath, 'utf8')
    const app = await readFile(appPath, 'utf8')
    const editorLinks = await readFile(editorLinksPath, 'utf8')

    expect(markdownBlockEditor).toContain("from \"@mde/editor-core/links\"")
    expect(app).toContain("from \"@mde/editor-core/links\"")
    expect(editorLinks).not.toMatch(/export\s+\{[\s\S]*from "@mde\/editor-core\/links"/u)
    expect(editorLinks).not.toMatch(
      /export\s+type\s+\{[\s\S]*from "@mde\/editor-core\/links"/u
    )
  })
})
