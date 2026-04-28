import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { WORKSPACE_CHANNELS } from '../../src/main/ipc/channels'
import { registerWorkspaceHandlers } from '../../src/main/ipc/registerWorkspaceHandlers'
import { createWorkspaceService } from '../../src/main/services/workspaceService'
import type { TreeNode } from '../../src/shared/fileTree'

const fixtureWorkspacePath = resolve('tests/fixtures/workspace')

const flattenTree = (nodes: readonly TreeNode[]): string[] =>
  nodes.flatMap((node) =>
    node.type === 'directory'
      ? [node.path, ...flattenTree(node.children)]
      : [node.path]
  )

describe('workspaceService integration', () => {
  it('loads the fixture workspace tree', async () => {
    const workspace = await createWorkspaceService().openWorkspace(
      fixtureWorkspacePath
    )

    expect(flattenTree(workspace.tree)).toEqual(
      expect.arrayContaining([
        'README.md',
        'docs/intro.md',
        'docs/nested/deep.md'
      ])
    )
  })

  it('registers workspace handlers without booting Electron IPC', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      })
    }
    const dialog = {
      showOpenDialog: vi.fn()
    }

    registerWorkspaceHandlers({
      dialog,
      ipcMain,
      testWorkspacePath: fixtureWorkspacePath,
      workspaceService: createWorkspaceService()
    })

    expect(ipcMain.handle).toHaveBeenCalledWith(
      WORKSPACE_CHANNELS.openWorkspace,
      expect.any(Function)
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(
      WORKSPACE_CHANNELS.listDirectory,
      expect.any(Function)
    )

    const openWorkspace = handlers.get(WORKSPACE_CHANNELS.openWorkspace)
    const listDirectory = handlers.get(WORKSPACE_CHANNELS.listDirectory)

    expect(openWorkspace).toBeDefined()
    expect(listDirectory).toBeDefined()

    await expect(listDirectory?.({}, 'docs')).rejects.toThrow(
      /open a workspace/i
    )

    const workspace = await openWorkspace?.({})
    const docsNodes = await listDirectory?.({}, 'docs')

    expect(workspace).toMatchObject({ rootPath: fixtureWorkspacePath })
    expect((docsNodes as TreeNode[]).map((node) => node.path)).toEqual([
      'docs/nested',
      'docs/intro.md'
    ])
    expect(dialog.showOpenDialog).not.toHaveBeenCalled()
  })

  it('does not let listDirectory choose a renderer-supplied workspace root', async () => {
    const outsideWorkspacePath = await mkdtemp(join(tmpdir(), 'mdv-outside-'))
    await writeFile(join(outsideWorkspacePath, 'outside.md'), '# Outside')

    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      })
    }
    const dialog = {
      showOpenDialog: vi.fn()
    }

    registerWorkspaceHandlers({
      dialog,
      ipcMain,
      testWorkspacePath: fixtureWorkspacePath,
      workspaceService: createWorkspaceService()
    })

    const openWorkspace = handlers.get(WORKSPACE_CHANNELS.openWorkspace)
    const listDirectory = handlers.get(WORKSPACE_CHANNELS.listDirectory)

    await openWorkspace?.({})

    await expect(listDirectory?.({}, outsideWorkspacePath, '')).rejects.toThrow(
      /outside workspace/i
    )
  })
})
