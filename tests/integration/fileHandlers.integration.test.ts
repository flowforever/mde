import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
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
})
