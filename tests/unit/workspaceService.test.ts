import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createWorkspaceService } from '../../src/main/services/workspaceService'

describe('workspaceService', () => {
  it('sorts directories before Markdown files and ignores unsupported entries', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-workspace-'))

    await mkdir(join(rootPath, 'z-folder'))
    await mkdir(join(rootPath, 'a-folder'))
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
})
