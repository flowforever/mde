import {
  link,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { FILE_CHANNELS, WORKSPACE_CHANNELS } from '../../src/main/ipc/channels'
import { registerFileHandlers } from '../../src/main/ipc/registerFileHandlers'
import { registerWorkspaceHandlers } from '../../src/main/ipc/registerWorkspaceHandlers'
import { createMarkdownFileService } from '../../src/main/services/markdownFileService'
import { createWorkspaceService } from '../../src/main/services/workspaceService'
import type { FileContents } from '../../src/shared/workspace'

const fixtureWorkspacePath = resolve('tests/fixtures/workspace')

interface RegisteredHandlers {
  readonly handlers: Map<string, (...args: unknown[]) => unknown>
}

describe('fileHandlers integration', () => {
  const registerHandlers = (
    workspacePath = fixtureWorkspacePath
  ): RegisteredHandlers => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      })
    }

    const workspaceSession = registerWorkspaceHandlers({
      dialog: { showOpenDialog: vi.fn() },
      ipcMain,
      testWorkspacePath: workspacePath,
      workspaceService: createWorkspaceService()
    })

    registerFileHandlers({
      getActiveWorkspaceRoot: workspaceSession.getActiveWorkspaceRoot,
      ipcMain,
      markdownFileService: createMarkdownFileService()
    })

    return { handlers }
  }

  it('reads a Markdown file from the active fixture workspace', async () => {
    const { handlers } = registerHandlers()

    await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})

    const result = (await handlers
      .get(FILE_CHANNELS.readMarkdownFile)
      ?.({}, 'README.md')) as FileContents

    expect(result).toEqual({
      contents: '# Fixture Workspace\n\nRoot markdown file.\n',
      path: 'README.md'
    })
  })

  it('rejects non-Markdown files', async () => {
    const { handlers } = registerHandlers()

    await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})

    await expect(
      handlers.get(FILE_CHANNELS.readMarkdownFile)?.({}, 'package.json')
    ).rejects.toThrow(/markdown/i)
  })

  it('rejects path traversal outside the active workspace', async () => {
    const { handlers } = registerHandlers()

    await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})

    await expect(
      handlers.get(FILE_CHANNELS.readMarkdownFile)?.({}, '../package.json')
    ).rejects.toThrow(/outside workspace/i)
  })

  it('rejects Markdown symlinks that resolve outside the active workspace', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mdv-workspace-'))
    const outsidePath = await mkdtemp(join(tmpdir(), 'mdv-outside-'))
    const outsideFilePath = join(outsidePath, 'outside.md')

    await writeFile(join(workspacePath, 'README.md'), '# Workspace')
    await writeFile(outsideFilePath, '# Outside')
    await symlink(outsideFilePath, join(workspacePath, 'leak.md'))

    const { handlers } = registerHandlers(workspacePath)

    await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})

    await expect(
      handlers.get(FILE_CHANNELS.readMarkdownFile)?.({}, 'leak.md')
    ).rejects.toThrow(/outside workspace/i)
  })

  it('rejects Markdown symlinks that resolve to non-Markdown files inside the active workspace', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mdv-workspace-'))

    await writeFile(join(workspacePath, 'README.md'), '# Workspace')
    await writeFile(join(workspacePath, 'secret.txt'), 'plain text')
    await symlink(join(workspacePath, 'secret.txt'), join(workspacePath, 'leak.md'))

    const { handlers } = registerHandlers(workspacePath)

    await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})

    await expect(
      handlers.get(FILE_CHANNELS.readMarkdownFile)?.({}, 'leak.md')
    ).rejects.toThrow(/markdown/i)
  })

  it('keeps file reads pinned to the canonical workspace root after an opened symlink is retargeted', async () => {
    const originalWorkspacePath = await mkdtemp(join(tmpdir(), 'mdv-original-'))
    const retargetedWorkspacePath = await mkdtemp(join(tmpdir(), 'mdv-retargeted-'))
    const workspaceLinkPath = join(
      await mkdtemp(join(tmpdir(), 'mdv-link-parent-')),
      'workspace-link'
    )

    await writeFile(join(originalWorkspacePath, 'README.md'), '# Original')
    await writeFile(join(retargetedWorkspacePath, 'README.md'), '# Retargeted')
    await symlink(originalWorkspacePath, workspaceLinkPath)

    const { handlers } = registerHandlers(workspaceLinkPath)

    await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})
    await rm(workspaceLinkPath)
    await symlink(retargetedWorkspacePath, workspaceLinkPath)

    const result = (await handlers
      .get(FILE_CHANNELS.readMarkdownFile)
      ?.({}, 'README.md')) as FileContents

    expect(result).toEqual({
      contents: '# Original',
      path: 'README.md'
    })
  })

  it('rejects Markdown hard links before reading through the file IPC handler', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mdv-workspace-'))
    const outsidePath = await mkdtemp(join(tmpdir(), 'mdv-outside-'))
    const outsideFilePath = join(outsidePath, 'outside.md')

    await writeFile(join(workspacePath, 'README.md'), '# Workspace')
    await writeFile(outsideFilePath, '# Outside')
    await link(outsideFilePath, join(workspacePath, 'inside.md'))

    const { handlers } = registerHandlers(workspacePath)

    await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})

    await expect(
      handlers.get(FILE_CHANNELS.readMarkdownFile)?.({}, 'inside.md')
    ).rejects.toThrow(/hard-linked/i)
  })

  it('rejects Markdown hard links before writing through the file IPC handler', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mdv-workspace-'))
    const outsidePath = await mkdtemp(join(tmpdir(), 'mdv-outside-'))
    const outsideFilePath = join(outsidePath, 'outside.md')

    await writeFile(join(workspacePath, 'README.md'), '# Workspace')
    await writeFile(outsideFilePath, '# Outside')
    await link(outsideFilePath, join(workspacePath, 'inside.md'))

    const { handlers } = registerHandlers(workspacePath)

    await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})

    await expect(
      handlers
        .get(FILE_CHANNELS.writeMarkdownFile)
        ?.({}, 'inside.md', '# Changed')
    ).rejects.toThrow(/hard-linked/i)
    await expect(readFile(outsideFilePath, 'utf8')).resolves.toBe('# Outside')
  })

  it('saves edited Markdown through the file IPC handler', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mdv-workspace-'))
    await writeFile(join(workspacePath, 'README.md'), '# Original\n')
    const { handlers } = registerHandlers(workspacePath)

    await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})
    await handlers
      .get(FILE_CHANNELS.writeMarkdownFile)
      ?.({}, 'README.md', '# Edited\n\nSaved from integration.\n')

    await expect(readFile(join(workspacePath, 'README.md'), 'utf8')).resolves.toBe(
      '# Edited\n\nSaved from integration.\n'
    )
  })

  it('creates a Markdown file through the file IPC handler', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mdv-workspace-'))
    await writeFile(join(workspacePath, 'README.md'), '# Workspace')
    const { handlers } = registerHandlers(workspacePath)

    await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})
    const result = (await handlers
      .get(FILE_CHANNELS.createMarkdownFile)
      ?.({}, 'notes/today.md')) as FileContents

    expect(result).toEqual({
      contents: '',
      path: 'notes/today.md'
    })
    await expect(readFile(join(workspacePath, 'notes', 'today.md'), 'utf8')).resolves.toBe(
      ''
    )
  })

  it('creates a folder through the file IPC handler', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mdv-workspace-'))
    await writeFile(join(workspacePath, 'README.md'), '# Workspace')
    const { handlers } = registerHandlers(workspacePath)

    await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})
    await handlers.get(FILE_CHANNELS.createFolder)?.({}, 'notes/daily')

    const createdFolderStats = await stat(join(workspacePath, 'notes', 'daily'))

    expect(createdFolderStats.isDirectory()).toBe(true)
  })

  it('renames an entry through the file IPC handler', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mdv-workspace-'))
    await writeFile(join(workspacePath, 'draft.md'), '# Draft')
    const { handlers } = registerHandlers(workspacePath)

    await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})
    const result = (await handlers
      .get(FILE_CHANNELS.renameEntry)
      ?.({}, 'draft.md', 'final.md')) as { path: string }

    expect(result).toEqual({ path: 'final.md' })
    await expect(readFile(join(workspacePath, 'final.md'), 'utf8')).resolves.toBe(
      '# Draft'
    )
    await expect(stat(join(workspacePath, 'draft.md'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('deletes an entry through the file IPC handler', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mdv-workspace-'))
    await writeFile(join(workspacePath, 'old.md'), '# Old')
    const { handlers } = registerHandlers(workspacePath)

    await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})
    await handlers.get(FILE_CHANNELS.deleteEntry)?.({}, 'old.md')

    await expect(stat(join(workspacePath, 'old.md'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })
})
