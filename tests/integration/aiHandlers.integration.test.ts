import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { AI_CHANNELS, WORKSPACE_CHANNELS } from '../../src/main/ipc/channels'
import { registerAiHandlers } from '../../src/main/ipc/registerAiHandlers'
import { registerWorkspaceHandlers } from '../../src/main/ipc/registerWorkspaceHandlers'
import { createAiService } from '../../src/main/services/aiService'
import { createWorkspaceService } from '../../src/main/services/workspaceService'

type AiServiceOptions = NonNullable<Parameters<typeof createAiService>[0]>
type LocateCommand = NonNullable<AiServiceOptions['locateCommand']>
type RunPrompt = NonNullable<AiServiceOptions['runPrompt']>

describe('aiHandlers integration', () => {
  const registerHandlers = (workspacePath: string) => {
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
    const locateCommand: LocateCommand = (tool) =>
      Promise.resolve(tool.id === 'codex' ? '/fake/codex' : null)
    const runPrompt: RunPrompt = ({ prompt }) => {
      if (prompt.includes('Translate')) {
        return Promise.resolve('# English\n\nTranslated through IPC.')
      }

      if (prompt.includes('Make it shorter')) {
        return Promise.resolve('## Summary\n\n- Shorter summary through IPC.')
      }

      return Promise.resolve('## Summary\n\n- Summarized through IPC.')
    }

    registerAiHandlers({
      aiService: createAiService({
        locateCommand,
        runPrompt
      }),
      getActiveWorkspaceRoot: workspaceSession.getActiveWorkspaceRoot,
      ipcMain
    })

    return { handlers }
  }

  it('generates translation files through the AI IPC handler', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-ai-ipc-'))

    await writeFile(join(workspacePath, 'README.md'), '# Readme')
    const { handlers } = registerHandlers(workspacePath)
    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }

    const result = (await handlers
      .get(AI_CHANNELS.translateMarkdown)
      ?.({}, 'README.md', '# Readme', 'English', workspace.rootPath)) as {
      contents: string
      path: string
    }

    expect(result).toMatchObject({
      contents: '# English\n\nTranslated through IPC.',
      path: '.mde/translations/README.English.md'
    })
    await expect(readFile(join(workspacePath, result.path), 'utf8')).resolves.toBe(
      '# English\n\nTranslated through IPC.'
    )
  })

  it('forwards summary refinement instructions through the AI IPC handler', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-ai-ipc-'))

    await writeFile(join(workspacePath, 'README.md'), '# Readme')
    const { handlers } = registerHandlers(workspacePath)
    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }

    await handlers
      .get(AI_CHANNELS.summarizeMarkdown)
      ?.({}, 'README.md', '# Readme', workspace.rootPath)
    const refined = (await handlers
      .get(AI_CHANNELS.summarizeMarkdown)
      ?.(
        {},
        'README.md',
        '# Readme',
        workspace.rootPath,
        'Make it shorter'
      )) as {
      contents: string
      path: string
    }

    expect(refined).toMatchObject({
      contents: '## Summary\n\n- Shorter summary through IPC.',
      path: '.mde/translations/README-summary.md'
    })
    await expect(readFile(join(workspacePath, refined.path), 'utf8')).resolves.toBe(
      '## Summary\n\n- Shorter summary through IPC.'
    )
  })

  it('rejects stale AI requests when the active workspace changes', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-ai-ipc-'))
    const { handlers } = registerHandlers(workspacePath)

    await writeFile(join(workspacePath, 'README.md'), '# Readme')
    await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})

    await expect(
      handlers
        .get(AI_CHANNELS.summarizeMarkdown)
        ?.({}, 'README.md', '# Readme', '/stale-workspace')
    ).rejects.toThrow(/workspace changed/i)
  })
})
