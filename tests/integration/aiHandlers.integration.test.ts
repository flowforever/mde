import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises'
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
    const promptRuns: {
      readonly modelName?: string
      readonly toolId: string
    }[] = []
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
    const runPrompt: RunPrompt = ({ modelName, prompt, tool }) => {
      promptRuns.push({
        modelName,
        toolId: tool.id
      })

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

    return { handlers, promptRuns }
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

  it('forwards selected AI CLI options through the AI IPC handler', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-ai-ipc-'))

    await writeFile(join(workspacePath, 'README.md'), '# Readme')
    const { handlers, promptRuns } = registerHandlers(workspacePath)
    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }

    await handlers
      .get(AI_CHANNELS.summarizeMarkdown)
      ?.({}, 'README.md', '# Readme', workspace.rootPath, undefined, {
        modelName: 'gpt-5.4',
        toolId: 'codex'
      })

    expect(promptRuns.at(-1)).toEqual({
      modelName: 'gpt-5.4',
      toolId: 'codex'
    })
  })

  it(
    'runs Codex through IPC without removed approval flags',
    async () => {
      const workspacePath = await mkdtemp(join(tmpdir(), 'mde-ai-ipc-'))
      const binPath = await mkdtemp(join(tmpdir(), 'mde-ai-ipc-codex-'))
      const fakeCodexPath = join(binPath, 'codex')
      const argsPath = join(binPath, 'args.txt')
      const previousArgsPath = process.env.MDE_FAKE_CODEX_ARGS
      const handlers = new Map<string, (...args: unknown[]) => unknown>()
      const ipcMain = {
        handle: vi.fn(
          (channel: string, handler: (...args: unknown[]) => unknown) => {
            handlers.set(channel, handler)
          }
        )
      }
      const workspaceSession = registerWorkspaceHandlers({
        dialog: { showOpenDialog: vi.fn() },
        ipcMain,
        testWorkspacePath: workspacePath,
        workspaceService: createWorkspaceService()
      })

      await writeFile(join(workspacePath, 'README.md'), '# Readme')
      await writeFile(
        fakeCodexPath,
        [
          '#!/bin/sh',
          'printf "%s\\n" "$@" > "$MDE_FAKE_CODEX_ARGS"',
          'printf "%s\\n" "# English" "" "Translated through IPC without removed flags."',
          ''
        ].join('\n'),
        'utf8'
      )
      await chmod(fakeCodexPath, 0o755)
      process.env.MDE_FAKE_CODEX_ARGS = argsPath

      registerAiHandlers({
        aiService: createAiService({
          locateCommand: (tool) =>
            Promise.resolve(tool.id === 'codex' ? fakeCodexPath : null),
          resolveShellPath: () => Promise.resolve(null)
        }),
        getActiveWorkspaceRoot: workspaceSession.getActiveWorkspaceRoot,
        ipcMain
      })

      try {
        const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.(
          {}
        )) as {
          rootPath: string
        }
        const result = (await handlers
          .get(AI_CHANNELS.translateMarkdown)
          ?.({}, 'README.md', '# Readme', 'English', workspace.rootPath)) as {
          contents: string
        }

        expect(result.contents).toBe(
          '# English\n\nTranslated through IPC without removed flags.'
        )
        await expect(readFile(argsPath, 'utf8')).resolves.not.toContain(
          '--ask-for-approval'
        )
      } finally {
        if (previousArgsPath === undefined) {
          delete process.env.MDE_FAKE_CODEX_ARGS
        } else {
          process.env.MDE_FAKE_CODEX_ARGS = previousArgsPath
        }
      }
    },
    30_000
  )

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
