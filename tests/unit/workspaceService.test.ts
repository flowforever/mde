import { mkdtemp, mkdir, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createWorkspaceService } from '../../apps/desktop/src/main/services/workspaceService'
import { createMarkdownFileService } from '../../apps/desktop/src/main/services/markdownFileService'

describe('workspaceService', () => {
  it('sorts directories before Markdown files and ignores unsupported entries', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-workspace-'))

    await mkdir(join(rootPath, 'z-folder'))
    await mkdir(join(rootPath, 'a-folder'))
    await mkdir(join(rootPath, '.mde'))
    await mkdir(join(rootPath, 'node_modules'))
    await writeFile(join(rootPath, 'README.md'), '# Readme')
    await writeFile(join(rootPath, 'alpha.md'), '# Alpha')
    await writeFile(join(rootPath, '.DS_Store'), '')
    await writeFile(join(rootPath, 'notes.txt'), 'ignore me')

    const workspace = await createWorkspaceService().openWorkspace(rootPath)

    expect(workspace.tree.map((node) => [node.type, node.name])).toEqual([
      ['directory', 'a-folder'],
      ['directory', 'z-folder'],
      ['file', 'alpha.md'],
      ['file', 'README.md']
    ])
    expect(Object.isFrozen(workspace.tree)).toBe(true)
  })

  it('inspects dropped launch paths without opening them', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-inspect-workspace-'))
    const markdownPath = join(rootPath, 'note.md')
    const textPath = join(rootPath, 'note.txt')
    const service = createWorkspaceService()

    await mkdir(join(rootPath, 'docs'))
    await writeFile(markdownPath, '# Note')
    await writeFile(textPath, 'Plain text')

    const canonicalRootPath = await realpath(rootPath)
    const canonicalMarkdownPath = await realpath(markdownPath)
    const canonicalTextPath = await realpath(textPath)

    await expect(service.inspectPath(rootPath)).resolves.toMatchObject({
      kind: 'directory',
      path: canonicalRootPath
    })
    await expect(service.inspectPath(markdownPath)).resolves.toMatchObject({
      kind: 'markdown-file',
      path: canonicalMarkdownPath
    })
    await expect(service.inspectPath(textPath)).resolves.toMatchObject({
      kind: 'unsupported-file',
      path: canonicalTextPath
    })
  })

  it('searches Markdown content across the workspace with bounded previews', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-workspace-search-'))

    await mkdir(join(rootPath, 'docs'))
    await mkdir(join(rootPath, 'node_modules'))
    await writeFile(join(rootPath, 'README.md'), '# Alpha\n\nRoot alpha note')
    await writeFile(join(rootPath, 'docs', 'guide.md'), 'Beta\nalpha guide')
    await writeFile(join(rootPath, 'notes.txt'), 'alpha plain text')
    await writeFile(join(rootPath, 'node_modules', 'ignored.md'), 'alpha ignored')

    const result = await createMarkdownFileService().searchMarkdownFiles(
      rootPath,
      'alpha'
    )

    expect(result).toEqual({
      limited: false,
      query: 'alpha',
      results: [
        {
          matches: [
            {
              columnNumber: 3,
              kind: 'body',
              lineNumber: 1,
              preview: '# Alpha'
            },
            {
              columnNumber: 6,
              kind: 'body',
              lineNumber: 3,
              preview: 'Root alpha note'
            }
          ],
          path: 'README.md'
        },
        {
          matches: [
            {
              columnNumber: 1,
              kind: 'body',
              lineNumber: 2,
              preview: 'alpha guide'
            }
          ],
          path: 'docs/guide.md'
        }
      ]
    })
  })
})
