import { mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { WORKSPACE_CHANNELS } from '../../apps/desktop/src/main/ipc/channels'
import { registerWorkspaceHandlers } from '../../apps/desktop/src/main/ipc/registerWorkspaceHandlers'
import { createWorkspaceService } from '../../apps/desktop/src/main/services/workspaceService'
import type { TreeNode } from '@mde/editor-host/file-tree'
import type { WorkspaceLaunchResource } from '../../apps/desktop/src/shared/workspace'

const fixtureWorkspacePath = resolve('tests/fixtures/workspace')

const createIpcEvent = (senderId: number) => ({
  sender: {
    id: senderId
  }
})

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

  it('opens a standalone Markdown file as a file workspace', async () => {
    const fileParentPath = await mkdtemp(join(tmpdir(), 'mde-file-parent-'))
    const filePath = join(fileParentPath, 'single.md')

    await writeFile(filePath, '# Single file')

    const workspace = await createWorkspaceService().openMarkdownFile(filePath)

    expect(workspace).toMatchObject({
      filePath: await realpath(filePath),
      name: 'single.md',
      openedFilePath: 'single.md',
      rootPath: await realpath(fileParentPath),
      type: 'file'
    })
    expect(workspace.tree).toEqual([
      {
        name: basename(filePath),
        path: basename(filePath),
        type: 'file'
      }
    ])
  })

  it('opens a generic launch path as either workspace or file', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-launch-workspace-'))
    const filePath = join(workspacePath, 'launch.md')

    await writeFile(filePath, '# Launch')

    await expect(
      createWorkspaceService().openPath(workspacePath)
    ).resolves.toMatchObject({
      rootPath: await realpath(workspacePath),
      type: 'workspace'
    })
    await expect(createWorkspaceService().openPath(filePath)).resolves.toMatchObject({
      filePath: await realpath(filePath),
      name: 'launch.md',
      type: 'file'
    })
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
      WORKSPACE_CHANNELS.openWorkspaceByPath,
      expect.any(Function)
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(
      WORKSPACE_CHANNELS.openFile,
      expect.any(Function)
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(
      WORKSPACE_CHANNELS.openFileByPath,
      expect.any(Function)
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(
      WORKSPACE_CHANNELS.openPath,
      expect.any(Function)
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(
      WORKSPACE_CHANNELS.inspectPath,
      expect.any(Function)
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(
      WORKSPACE_CHANNELS.openExternalLink,
      expect.any(Function)
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(
      WORKSPACE_CHANNELS.openWorkspaceFileInNewWindow,
      expect.any(Function)
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(
      WORKSPACE_CHANNELS.consumeLaunchPath,
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

  it('opens a renderer supplied launch path through IPC', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-open-path-'))
    const filePath = join(workspacePath, 'single.md')
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      })
    }

    await writeFile(filePath, '# Single')

    registerWorkspaceHandlers({
      dialog: { showOpenDialog: vi.fn() },
      initialLaunchPath: filePath,
      ipcMain,
      workspaceService: createWorkspaceService()
    })

    const consumeLaunchPath = handlers.get(WORKSPACE_CHANNELS.consumeLaunchPath)
    const openPath = handlers.get(WORKSPACE_CHANNELS.openPath)
    const listDirectory = handlers.get(WORKSPACE_CHANNELS.listDirectory)

    await expect(consumeLaunchPath?.({})).resolves.toBe(filePath)
    await expect(consumeLaunchPath?.({})).resolves.toBeNull()
    await expect(openPath?.({}, filePath)).resolves.toMatchObject({
      name: 'single.md',
      type: 'file'
    })
    expect((await listDirectory?.({}, '')) as TreeNode[]).toEqual([
      {
        name: 'single.md',
        path: 'single.md',
        type: 'file'
      }
    ])
  })

  it('registers file open handlers and pins the active root to the file parent', async () => {
    const fileParentPath = await mkdtemp(join(tmpdir(), 'mde-file-open-'))
    const filePath = join(fileParentPath, 'single.md')
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      })
    }
    const dialog = {
      showOpenDialog: vi.fn().mockResolvedValue({
        canceled: false,
        filePaths: [filePath]
      })
    }

    await writeFile(filePath, '# Single file')

    const session = registerWorkspaceHandlers({
      dialog,
      ipcMain,
      workspaceService: createWorkspaceService()
    })

    const openFile = handlers.get(WORKSPACE_CHANNELS.openFile)
    const listDirectory = handlers.get(WORKSPACE_CHANNELS.listDirectory)
    const workspace = await openFile?.({})

    expect(dialog.showOpenDialog).toHaveBeenCalledWith({
      filters: [{ extensions: ['md'], name: 'Markdown' }],
      properties: ['openFile']
    })
    expect(workspace).toMatchObject({
      name: 'single.md',
      rootPath: await realpath(dirname(filePath)),
      type: 'file'
    })
    expect(session.getActiveWorkspaceRoot()).toBe(await realpath(dirname(filePath)))
    expect((await listDirectory?.({}, '')) as TreeNode[]).toEqual([
      {
        name: 'single.md',
        path: 'single.md',
        type: 'file'
      }
    ])
  })

  it('does not let listDirectory choose a renderer-supplied workspace root', async () => {
    const outsideWorkspacePath = await mkdtemp(join(tmpdir(), 'mde-outside-'))
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

  it('switches the active workspace from a remembered workspace path', async () => {
    const firstWorkspacePath = await mkdtemp(join(tmpdir(), 'mde-first-'))
    const secondWorkspacePath = await mkdtemp(join(tmpdir(), 'mde-second-'))

    await writeFile(join(firstWorkspacePath, 'first.md'), '# First')
    await writeFile(join(secondWorkspacePath, 'second.md'), '# Second')

    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      })
    }

    registerWorkspaceHandlers({
      dialog: { showOpenDialog: vi.fn() },
      ipcMain,
      workspaceService: createWorkspaceService()
    })

    const openWorkspaceByPath = handlers.get(WORKSPACE_CHANNELS.openWorkspaceByPath)
    const listDirectory = handlers.get(WORKSPACE_CHANNELS.listDirectory)

    await openWorkspaceByPath?.({}, firstWorkspacePath)
    const secondWorkspace = await openWorkspaceByPath?.({}, secondWorkspacePath)
    const activeNodes = (await listDirectory?.({}, '')) as TreeNode[]

    expect(secondWorkspace).toMatchObject({
      rootPath: await realpath(secondWorkspacePath)
    })
    expect(activeNodes.map((node) => node.path)).toEqual(['second.md'])
  })

  it('keeps active workspaces and launch paths isolated by renderer window', async () => {
    const firstWorkspacePath = await mkdtemp(join(tmpdir(), 'mde-window-one-'))
    const secondWorkspacePath = await mkdtemp(join(tmpdir(), 'mde-window-two-'))
    const launchFilePath = join(secondWorkspacePath, 'launch.md')
    const rememberedResources: string[] = []

    await writeFile(join(firstWorkspacePath, 'first.md'), '# First')
    await writeFile(join(secondWorkspacePath, 'second.md'), '# Second')
    await writeFile(launchFilePath, '# Launch')

    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      })
    }

    const session = registerWorkspaceHandlers({
      dialog: { showOpenDialog: vi.fn() },
      ipcMain,
      rememberRecentResource: (resourcePath) => {
        rememberedResources.push(resourcePath)
      },
      workspaceService: createWorkspaceService()
    })

    const windowOneEvent = createIpcEvent(101)
    const windowTwoEvent = createIpcEvent(202)
    const openWorkspaceByPath = handlers.get(WORKSPACE_CHANNELS.openWorkspaceByPath)
    const consumeLaunchPath = handlers.get(WORKSPACE_CHANNELS.consumeLaunchPath)
    const listDirectory = handlers.get(WORKSPACE_CHANNELS.listDirectory)

    await openWorkspaceByPath?.(windowOneEvent, firstWorkspacePath)
    await openWorkspaceByPath?.(windowTwoEvent, secondWorkspacePath)
    session.setPendingLaunchPath(windowTwoEvent.sender, launchFilePath)

    await expect(consumeLaunchPath?.(windowOneEvent)).resolves.toBeNull()
    await expect(consumeLaunchPath?.(windowTwoEvent)).resolves.toBe(launchFilePath)
    await expect(consumeLaunchPath?.(windowTwoEvent)).resolves.toBeNull()

    expect(
      ((await listDirectory?.(windowOneEvent, '')) as TreeNode[]).map(
        (node) => node.path
      )
    ).toEqual(['first.md'])
    expect(
      ((await listDirectory?.(windowTwoEvent, '')) as TreeNode[]).map(
        (node) => node.path
      )
    ).toEqual(['launch.md', 'second.md'])
    expect(session.getActiveWorkspaceRoot(windowOneEvent)).toBe(
      await realpath(firstWorkspacePath)
    )
    expect(session.getActiveWorkspaceRoot(windowTwoEvent)).toBe(
      await realpath(secondWorkspacePath)
    )
    expect(rememberedResources).toEqual([
      await realpath(firstWorkspacePath),
      await realpath(secondWorkspacePath)
    ])
  })

  it('opens renderer-supplied resources in a separate app window through IPC', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-new-window-'))
    const openedPaths: WorkspaceLaunchResource[] = []
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      })
    }

    await writeFile(join(workspacePath, 'new-window.md'), '# New Window')

    registerWorkspaceHandlers({
      dialog: { showOpenDialog: vi.fn() },
      ipcMain,
      openPathInNewWindow: (resourcePath) => {
        openedPaths.push(resourcePath)
      },
      workspaceService: createWorkspaceService()
    })

    const openWorkspaceByPath = handlers.get(WORKSPACE_CHANNELS.openWorkspaceByPath)
    const openPathInNewWindow = handlers.get(
      WORKSPACE_CHANNELS.openPathInNewWindow
    )
    const listDirectory = handlers.get(WORKSPACE_CHANNELS.listDirectory)

    await openWorkspaceByPath?.(createIpcEvent(303), workspacePath)

    await openPathInNewWindow?.(createIpcEvent(303), workspacePath)

    expect(openedPaths).toEqual([workspacePath])
    expect(((await listDirectory?.(createIpcEvent(303), '')) as TreeNode[])).toEqual([
      {
        name: 'new-window.md',
        path: 'new-window.md',
        type: 'file'
      }
    ])
  })

  it('inspects renderer-supplied paths through IPC without switching workspaces', async () => {
    const activeWorkspacePath = await mkdtemp(join(tmpdir(), 'mde-active-'))
    const droppedWorkspacePath = await mkdtemp(join(tmpdir(), 'mde-dropped-'))
    const droppedMarkdownPath = join(droppedWorkspacePath, 'dropped.md')
    const droppedTextPath = join(droppedWorkspacePath, 'dropped.txt')
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      })
    }

    await writeFile(join(activeWorkspacePath, 'active.md'), '# Active')
    await writeFile(droppedMarkdownPath, '# Dropped')
    await writeFile(droppedTextPath, 'Dropped')

    const session = registerWorkspaceHandlers({
      dialog: { showOpenDialog: vi.fn() },
      ipcMain,
      workspaceService: createWorkspaceService()
    })

    const event = createIpcEvent(707)
    const openWorkspaceByPath = handlers.get(WORKSPACE_CHANNELS.openWorkspaceByPath)
    const inspectPath = handlers.get(WORKSPACE_CHANNELS.inspectPath)

    await openWorkspaceByPath?.(event, activeWorkspacePath)

    await expect(inspectPath?.(event, droppedWorkspacePath)).resolves.toMatchObject({
      kind: 'directory',
      path: await realpath(droppedWorkspacePath)
    })
    await expect(inspectPath?.(event, droppedMarkdownPath)).resolves.toMatchObject({
      kind: 'markdown-file',
      path: await realpath(droppedMarkdownPath)
    })
    await expect(inspectPath?.(event, droppedTextPath)).resolves.toMatchObject({
      kind: 'unsupported-file',
      path: await realpath(droppedTextPath)
    })
    expect(session.getActiveWorkspaceRoot(event)).toBe(
      await realpath(activeWorkspacePath)
    )
  })

  it('opens remembered workspace files in a separate app window through IPC', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-known-workspace-'))
    const openedResources: unknown[] = []
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      })
    }

    registerWorkspaceHandlers({
      dialog: { showOpenDialog: vi.fn() },
      ipcMain,
      openPathInNewWindow: (resourcePath) => {
        openedResources.push(resourcePath)
      },
      workspaceService: createWorkspaceService()
    })

    const openWorkspaceFileInNewWindow = handlers.get(
      WORKSPACE_CHANNELS.openWorkspaceFileInNewWindow
    )

    await openWorkspaceFileInNewWindow?.(
      createIpcEvent(505),
      workspacePath,
      'docs/target.md'
    )

    expect(openedResources).toEqual([
      {
        filePath: 'docs/target.md',
        type: 'workspace-file',
        workspaceRoot: workspacePath
      }
    ])
  })

  it('opens http links externally and rejects unsupported protocols', async () => {
    const openedUrls: string[] = []
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      })
    }

    registerWorkspaceHandlers({
      dialog: { showOpenDialog: vi.fn() },
      ipcMain,
      openExternalLink: (url) => {
        openedUrls.push(url)
      },
      workspaceService: createWorkspaceService()
    })

    const openExternalLink = handlers.get(WORKSPACE_CHANNELS.openExternalLink)

    await expect(
      openExternalLink?.(createIpcEvent(606), 'https://example.com/docs')
    ).resolves.toBeUndefined()
    await expect(
      openExternalLink?.(createIpcEvent(606), 'javascript:alert(1)')
    ).rejects.toThrow(/http/i)

    expect(openedUrls).toEqual(['https://example.com/docs'])
  })

  it('opens a selected workspace in a separate app window through IPC', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-dialog-new-window-'))
    const openedPaths: WorkspaceLaunchResource[] = []
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      })
    }
    const dialog = {
      showOpenDialog: vi.fn().mockResolvedValue({
        canceled: false,
        filePaths: [workspacePath]
      })
    }

    await writeFile(join(workspacePath, 'dialog.md'), '# Dialog')

    registerWorkspaceHandlers({
      dialog,
      ipcMain,
      openPathInNewWindow: (resourcePath) => {
        openedPaths.push(resourcePath)
      },
      workspaceService: createWorkspaceService()
    })

    const openWorkspaceInNewWindow = handlers.get(
      WORKSPACE_CHANNELS.openWorkspaceInNewWindow
    )

    await expect(openWorkspaceInNewWindow?.(createIpcEvent(404))).resolves.toBe(
      true
    )

    expect(dialog.showOpenDialog).toHaveBeenCalledWith({
      properties: ['openDirectory']
    })
    expect(openedPaths).toEqual([workspacePath])
  })

  it('keeps listDirectory pinned to the canonical workspace root after an opened symlink is retargeted', async () => {
    const originalWorkspacePath = await mkdtemp(join(tmpdir(), 'mde-original-'))
    const retargetedWorkspacePath = await mkdtemp(join(tmpdir(), 'mde-retargeted-'))
    const workspaceLinkPath = join(
      await mkdtemp(join(tmpdir(), 'mde-link-parent-')),
      'workspace-link'
    )

    await writeFile(join(originalWorkspacePath, 'original.md'), '# Original')
    await writeFile(join(retargetedWorkspacePath, 'retargeted.md'), '# Retargeted')
    await symlink(originalWorkspacePath, workspaceLinkPath)
    const canonicalOriginalWorkspacePath = await realpath(originalWorkspacePath)

    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      })
    }

    registerWorkspaceHandlers({
      dialog: { showOpenDialog: vi.fn() },
      ipcMain,
      testWorkspacePath: workspaceLinkPath,
      workspaceService: createWorkspaceService()
    })

    const openWorkspace = handlers.get(WORKSPACE_CHANNELS.openWorkspace)
    const listDirectory = handlers.get(WORKSPACE_CHANNELS.listDirectory)

    const workspace = await openWorkspace?.({})

    await rm(workspaceLinkPath)
    await symlink(retargetedWorkspacePath, workspaceLinkPath)

    const nodes = (await listDirectory?.({}, '')) as TreeNode[]

    expect(workspace).toMatchObject({ rootPath: canonicalOriginalWorkspacePath })
    expect(nodes.map((node) => node.path)).toEqual(['original.md'])
  })
})
