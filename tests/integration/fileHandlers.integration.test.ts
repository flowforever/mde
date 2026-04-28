import { resolve } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { FILE_CHANNELS, WORKSPACE_CHANNELS } from '../../src/main/ipc/channels'
import { registerFileHandlers } from '../../src/main/ipc/registerFileHandlers'
import { registerWorkspaceHandlers } from '../../src/main/ipc/registerWorkspaceHandlers'
import { createMarkdownFileService } from '../../src/main/services/markdownFileService'
import { createWorkspaceService } from '../../src/main/services/workspaceService'
import type { FileContents } from '../../src/shared/workspace'

const fixtureWorkspacePath = resolve('tests/fixtures/workspace')

describe('fileHandlers integration', () => {
  const registerHandlers = (): Map<string, (...args: unknown[]) => unknown> => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      })
    }

    const workspaceSession = registerWorkspaceHandlers({
      dialog: { showOpenDialog: vi.fn() },
      ipcMain,
      testWorkspacePath: fixtureWorkspacePath,
      workspaceService: createWorkspaceService()
    })

    registerFileHandlers({
      getActiveWorkspaceRoot: workspaceSession.getActiveWorkspaceRoot,
      ipcMain,
      markdownFileService: createMarkdownFileService()
    })

    return handlers
  }

  it('reads a Markdown file from the active fixture workspace', async () => {
    const handlers = registerHandlers()

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
    const handlers = registerHandlers()

    await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})

    await expect(
      handlers.get(FILE_CHANNELS.readMarkdownFile)?.({}, 'package.json')
    ).rejects.toThrow(/markdown/i)
  })

  it('rejects path traversal outside the active workspace', async () => {
    const handlers = registerHandlers()

    await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})

    await expect(
      handlers.get(FILE_CHANNELS.readMarkdownFile)?.({}, '../package.json')
    ).rejects.toThrow(/outside workspace/i)
  })
})
