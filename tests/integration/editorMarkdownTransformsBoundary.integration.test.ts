import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const markdownTransformsPath = join(
  process.cwd(),
  'apps/desktop/src/renderer/src/editor/markdownTransforms.ts'
)

describe('editor markdown transforms boundary', () => {
  it('keeps markdown transforms host-neutral by requiring injected asset resolution', async () => {
    const contents = await readFile(markdownTransformsPath, 'utf8')

    expect(contents).not.toContain('desktopMarkdownAssetResolver')
    expect(contents).not.toContain('createDesktopMarkdownAssetResolver')
    expect(contents).not.toContain('MarkdownAssetContext')
  })
})
