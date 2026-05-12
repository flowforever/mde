import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import type { AgentChatChildProcess, AgentChatProcessRunner } from '../host'
import type { AgentChatSession } from '../types'
import type { CodexClientRequest } from './protocolTypes'

import { createCodexAgentChatAdapter } from './codexAdapter'

type PushLine = (message: unknown) => void

const waitFor = async (predicate: () => boolean): Promise<void> => {
  for (let index = 0; index < 50; index += 1) {
    if (predicate()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  throw new Error('Timed out waiting for Codex test condition')
}

const createScriptedChild = (
  onRequest: (request: CodexClientRequest, push: PushLine) => void
): {
  readonly child: AgentChatChildProcess
  readonly notifications: readonly string[]
  readonly requests: CodexClientRequest[]
} => {
  const notifications: string[] = []
  const requests: CodexClientRequest[] = []
  const queuedLines: string[] = []
  const waitingConsumers: ((result: IteratorResult<string>) => void)[] = []
  let closed = false

  const resolveNext = (result: IteratorResult<string>): void => {
    const consumer = waitingConsumers.shift()
    if (consumer) {
      consumer(result)
    } else if (!result.done) {
      queuedLines.push(result.value)
    }
  }
  const close = (): void => {
    closed = true
    while (waitingConsumers.length > 0) {
      waitingConsumers.shift()?.({ done: true, value: undefined })
    }
  }
  const push: PushLine = (message) => {
    resolveNext({
      done: false,
      value: `${JSON.stringify(message)}\n`
    })
  }

  return {
    child: {
      kill: vi.fn(close),
      stderr: {
        async *[Symbol.asyncIterator]() {
          await Promise.resolve()
          yield* []
        }
      },
      stdin: {
        end: vi.fn(close),
        write: vi.fn((chunk: string) => {
          for (const line of chunk.trim().split('\n')) {
            if (!line) {
              continue
            }
            const message = JSON.parse(line) as CodexClientRequest | { method?: string }
            if (!('id' in message)) {
              if (typeof message.method === 'string') {
                notifications.push(message.method)
              }
              continue
            }
            const request = message
            requests.push(request)
            if (request.method === 'initialize') {
              push({
                id: request.id,
                result: {
                  codexHome: '/home/user/.codex',
                  platformFamily: 'unix',
                  platformOs: 'macos',
                  userAgent: 'mde-test/0.130.0'
                }
              })
              return
            }
            onRequest(request, push)
          }
        })
      },
      stdout: {
        [Symbol.asyncIterator]: () => ({
          next: () => {
            const line = queuedLines.shift()
            if (line) {
              return Promise.resolve({ done: false, value: line })
            }
            if (closed) {
              return Promise.resolve({ done: true, value: undefined })
            }
            return new Promise<IteratorResult<string>>((resolve) => {
              waitingConsumers.push(resolve)
            })
          }
        })
      }
    },
    notifications,
    requests
  }
}

const createSession = (): AgentChatSession => ({
  createdAt: '2026-05-12T00:00:00.000Z',
  engineId: 'codex',
  host: 'editor',
  permissionMode: 'max-permission',
  sessionId: 'mde-chat-1',
  sessionPurpose: 'document-chat',
  state: 'draft',
  updatedAt: '2026-05-12T00:00:00.000Z',
  workspaceRoot: '/workspace'
})

const contextManifest = {
  currentDocumentPath: 'docs/example.md',
  currentDocumentSnapshot: '# Example',
  permissionMode: 'max-permission',
  selectedBlockIds: ['block-1'],
  selectedText: 'Selected body',
  sessionPurpose: 'document-chat',
  workspaceRoot: '/workspace'
} as const

const requiredCodexProtocolSource = [
  'initialize',
  'initialized',
  'thread/start',
  'thread/resume',
  'thread/list',
  'turn/start',
  'turn/interrupt',
  'localImage',
  'cwd',
  'approvalPolicy',
  'sandbox'
].join('\n')

describe('createCodexAgentChatAdapter', () => {
  it('is unsupported when app-server generation is unavailable', async () => {
    const processRunner = {
      execFile: vi.fn<AgentChatProcessRunner['execFile']>(() =>
        Promise.reject(new Error('missing app-server'))
      ),
      spawn: vi.fn<AgentChatProcessRunner['spawn']>(() => {
        throw new Error('spawn not expected')
      })
    } satisfies AgentChatProcessRunner
    const adapter = createCodexAgentChatAdapter({
      processRunner
    })

    await expect(
      adapter.probeCapabilities({ workspaceRoot: '/workspace' })
    ).resolves.toMatchObject({ verdict: 'unsupported' })
  })

  it('requires localImage support for V1 availability', async () => {
    const processRunner = {
      execFile: vi.fn<AgentChatProcessRunner['execFile']>((_command, args) =>
        Promise.resolve({
          stderr: '',
          stdout: args.includes('--version')
            ? 'codex-cli 0.130.0'
            : 'export type UserInput = { "type": "text", text: string, text_elements: [] };'
        })
      ),
      spawn: vi.fn<AgentChatProcessRunner['spawn']>(() => {
        throw new Error('spawn not expected')
      })
    } satisfies AgentChatProcessRunner
    const adapter = createCodexAgentChatAdapter({
      processRunner
    })

    await expect(
      adapter.probeCapabilities({ workspaceRoot: '/workspace' })
    ).resolves.toMatchObject({ verdict: 'unsupported' })
  })

  it('supports Codex when generate-ts times out after writing required protocol files', async () => {
    const processRunner = {
      execFile: vi.fn<AgentChatProcessRunner['execFile']>(
        async (_command, args) => {
          if (args.includes('--version')) {
            return { stderr: '', stdout: 'codex-cli 0.130.0' }
          }

          if (args.includes('--help')) {
            return { stderr: '', stdout: 'Usage: codex app-server' }
          }

          const outIndex = args.indexOf('--out')
          const outDirectory = outIndex >= 0 ? args[outIndex + 1] : undefined
          if (!outDirectory) {
            throw new Error('missing generated protocol output directory')
          }

          await mkdir(join(outDirectory, 'protocol'), { recursive: true })
          await writeFile(
            join(outDirectory, 'protocol', 'generated.ts'),
            requiredCodexProtocolSource,
            'utf8'
          )
          throw new Error('generate-ts timed out')
        }
      ),
      spawn: vi.fn<AgentChatProcessRunner['spawn']>(() => {
        throw new Error('spawn not expected')
      })
    } satisfies AgentChatProcessRunner
    const adapter = createCodexAgentChatAdapter({
      processRunner
    })

    await expect(
      adapter.probeCapabilities({ workspaceRoot: '/workspace' })
    ).resolves.toMatchObject({
      engineId: 'codex',
      nativeVersion: 'codex-cli 0.130.0',
      verdict: 'supported'
    })
    const generateCall = processRunner.execFile.mock.calls.find((call) =>
      call[1].includes('generate-ts')
    )
    expect(generateCall?.[2]?.timeoutMs).toBeGreaterThanOrEqual(20_000)
  })

  it('initializes the Codex app-server before reading native sessions', async () => {
    const scripted = createScriptedChild((request, push) => {
      if (request.method === 'thread/list') {
        push({
          id: request.id,
          result: {
            data: []
          }
        })
      }
    })
    const processRunner = {
      execFile: vi.fn<AgentChatProcessRunner['execFile']>(),
      spawn: vi.fn<AgentChatProcessRunner['spawn']>(() => scripted.child)
    } satisfies AgentChatProcessRunner
    const adapter = createCodexAgentChatAdapter({
      processRunner
    })

    await expect(
      adapter.listNativeSessions({ workspaceRoot: '/workspace' })
    ).resolves.toEqual([])

    expect(scripted.requests.map((request) => request.method)).toEqual([
      'initialize',
      'thread/list'
    ])
    expect(scripted.notifications).toEqual(['initialized'])
    expect(scripted.requests[0]).toMatchObject({
      method: 'initialize',
      params: {
        capabilities: { experimentalApi: true },
        clientInfo: {
          name: 'mde',
          title: 'MDE',
          version: '1.0.0'
        }
      }
    })
  })

  it('streams turn notifications after turnStart resolves and sends document context', async () => {
    const scripted = createScriptedChild((request, push) => {
      if (request.method === 'thread/start') {
        push({
          id: request.id,
          result: {
            thread: { cwd: '/workspace', id: 'thread-1' }
          }
        })
        return
      }

      if (request.method === 'turn/start') {
        push({
          id: request.id,
          result: {
            turn: { id: 'turn-1' }
          }
        })
        push({
          method: 'item/agentMessage/delta',
          params: {
            delta: 'Hello',
            itemId: 'message-1',
            threadId: 'thread-1',
            turnId: 'turn-1'
          }
        })
        push({
          method: 'turn/completed',
          params: {
            threadId: 'thread-1',
            turn: { id: 'turn-1' }
          }
        })
        push({
          method: 'item/agentMessage/delta',
          params: {
            delta: 'Running',
            itemId: 'message-1',
            threadId: 'thread-1',
            turnId: 'turn-1'
          }
        })
      }
    })
    const processRunner = {
      execFile: vi.fn<AgentChatProcessRunner['execFile']>(),
      spawn: vi.fn<AgentChatProcessRunner['spawn']>(() => scripted.child)
    } satisfies AgentChatProcessRunner
    const adapter = createCodexAgentChatAdapter({
      now: () => '2026-05-12T00:00:00.000Z',
      processRunner
    })

    const events = []
    for await (const event of adapter.startSession({
      attachments: [],
      content: 'Explain',
      contextManifest,
      session: createSession(),
      workspaceRoot: '/workspace'
    })) {
      events.push(event)
    }

    const turnStartRequest = scripted.requests.find(
      (request) => request.method === 'turn/start'
    )

    expect(events.map((event) => event.type)).toEqual([
      'session-started',
      'assistant-message-delta',
      'assistant-message-completed'
    ])
    if (turnStartRequest?.method !== 'turn/start') {
      throw new Error('Expected Codex turn/start request')
    }
    const [inputItem] = turnStartRequest.params.input
    expect(inputItem?.type).toBe('text')
    if (inputItem?.type !== 'text') {
      throw new Error('Expected Codex text input item')
    }
    expect(inputItem.text).toContain('Current Markdown snapshot:\n# Example')
  })

  it('streams Codex reasoning as thinking messages and finalizes them on completion', async () => {
    const scripted = createScriptedChild((request, push) => {
      if (request.method === 'thread/start') {
        push({
          id: request.id,
          result: {
            thread: { cwd: '/workspace', id: 'thread-1' }
          }
        })
        return
      }

      if (request.method === 'turn/start') {
        push({
          id: request.id,
          result: {
            turn: { id: 'turn-1' }
          }
        })
        push({
          method: 'item/reasoning/summaryTextDelta',
          params: {
            delta: 'Checking context',
            itemId: 'reasoning-1',
            summaryIndex: 0,
            threadId: 'thread-1',
            turnId: 'turn-1'
          }
        })
        push({
          method: 'item/reasoning/textDelta',
          params: {
            contentIndex: 0,
            delta: ' and selecting evidence.',
            itemId: 'reasoning-1',
            threadId: 'thread-1',
            turnId: 'turn-1'
          }
        })
        push({
          method: 'item/agentMessage/delta',
          params: {
            delta: 'Done',
            itemId: 'message-1',
            threadId: 'thread-1',
            turnId: 'turn-1'
          }
        })
        push({
          method: 'turn/completed',
          params: {
            threadId: 'thread-1',
            turn: { id: 'turn-1' }
          }
        })
      }
    })
    const processRunner = {
      execFile: vi.fn<AgentChatProcessRunner['execFile']>(),
      spawn: vi.fn<AgentChatProcessRunner['spawn']>(() => scripted.child)
    } satisfies AgentChatProcessRunner
    const adapter = createCodexAgentChatAdapter({
      now: () => '2026-05-12T00:00:00.000Z',
      processRunner
    })

    const events = []
    for await (const event of adapter.startSession({
      attachments: [],
      content: 'Explain',
      contextManifest,
      session: createSession(),
      workspaceRoot: '/workspace'
    })) {
      events.push(event)
    }

    expect(events).toEqual([
      {
        nativeSessionId: 'thread-1',
        sessionId: 'mde-chat-1',
        type: 'session-started'
      },
      {
        message: {
          attachments: [],
          content: 'Checking context',
          createdAt: '2026-05-12T00:00:00.000Z',
          isStreaming: true,
          messageId: 'reasoning-1',
          role: 'thinking',
          sessionId: 'mde-chat-1'
        },
        type: 'thinking-updated'
      },
      {
        message: {
          attachments: [],
          content: 'Checking context and selecting evidence.',
          createdAt: '2026-05-12T00:00:00.000Z',
          isStreaming: true,
          messageId: 'reasoning-1',
          role: 'thinking',
          sessionId: 'mde-chat-1'
        },
        type: 'thinking-updated'
      },
      {
        createdAt: '2026-05-12T00:00:00.000Z',
        delta: 'Done',
        messageId: 'message-1',
        sessionId: 'mde-chat-1',
        type: 'assistant-message-delta'
      },
      {
        message: {
          attachments: [],
          content: 'Checking context and selecting evidence.',
          createdAt: '2026-05-12T00:00:00.000Z',
          isStreaming: false,
          messageId: 'reasoning-1',
          role: 'thinking',
          sessionId: 'mde-chat-1'
        },
        type: 'thinking-updated'
      },
      {
        message: {
          attachments: [],
          content: 'Done',
          createdAt: '2026-05-12T00:00:00.000Z',
          messageId: 'message-1',
          role: 'assistant',
          sessionId: 'mde-chat-1'
        },
        type: 'assistant-message-completed'
      }
    ])
  })

  it('interrupts an active turn using the tracked Codex turn id', async () => {
    let firstPush: PushLine | undefined
    const turnChild = createScriptedChild((request, push) => {
      firstPush = push
      if (request.method === 'thread/start') {
        push({
          id: request.id,
          result: {
            thread: { cwd: '/workspace', id: 'thread-1' }
          }
        })
        return
      }

      if (request.method === 'turn/start') {
        push({
          id: request.id,
          result: {
            turn: { id: 'turn-1' }
          }
        })
        push({
          method: 'turn/started',
          params: {
            threadId: 'thread-1',
            turn: { id: 'turn-1' }
          }
        })
        push({
          method: 'item/agentMessage/delta',
          params: {
            delta: 'Running',
            itemId: 'message-1',
            threadId: 'thread-1',
            turnId: 'turn-1'
          }
        })
      }

      if (request.method === 'turn/interrupt') {
        push({
          id: request.id,
          result: {}
        })
      }
    })
    const processRunner = {
      execFile: vi.fn<AgentChatProcessRunner['execFile']>(),
      spawn: vi.fn<AgentChatProcessRunner['spawn']>(() => turnChild.child)
    } satisfies AgentChatProcessRunner
    const adapter = createCodexAgentChatAdapter({
      processRunner
    })
    const session = {
      ...createSession(),
      nativeSessionId: 'thread-1'
    }

    const iterator = adapter.startSession({
      attachments: [],
      content: 'Run',
      contextManifest,
      session,
      workspaceRoot: '/workspace'
    })[Symbol.asyncIterator]()
    await expect(iterator.next()).resolves.toMatchObject({
      value: {
        nativeSessionId: 'thread-1',
        type: 'session-started'
      }
    })
    const pendingTurn = iterator.next()
    await waitFor(() =>
      turnChild.requests.some((request) => request.method === 'turn/start')
    )
    await expect(pendingTurn).resolves.toMatchObject({
      value: {
        delta: 'Running',
        type: 'assistant-message-delta'
      }
    })

    const stopEvents = []
    for await (const event of adapter.stopSession({
      nativeSessionId: 'thread-1',
      session,
      workspaceRoot: '/workspace'
    })) {
      stopEvents.push(event)
    }

    firstPush?.({
      method: 'turn/completed',
      params: {
        threadId: 'thread-1',
        turn: { id: 'turn-1' }
      }
    })
    await expect(iterator.next()).resolves.toMatchObject({
      value: {
        type: 'assistant-message-completed'
      }
    })
    await expect(iterator.next()).resolves.toMatchObject({
      done: true
    })

    expect(
      turnChild.requests.find((request) => request.method === 'turn/interrupt')
        ?.params
    ).toEqual({
      threadId: 'thread-1',
      turnId: 'turn-1'
    })
    expect(stopEvents).toEqual([
      {
        nativeSessionId: 'thread-1',
        sessionId: 'mde-chat-1',
        type: 'session-stopped'
      }
    ])
  })

  it('queues stop requests that arrive before Codex reports the active turn id', async () => {
    let firstPush: PushLine | undefined
    let turnStartPush: PushLine | undefined
    const turnChild = createScriptedChild((request, push) => {
      firstPush = push
      if (request.method === 'thread/start') {
        push({
          id: request.id,
          result: {
            thread: { cwd: '/workspace', id: 'thread-1' }
          }
        })
        return
      }

      if (request.method === 'turn/start') {
        turnStartPush = push
        return
      }

      if (request.method === 'turn/interrupt') {
        push({
          id: request.id,
          result: {}
        })
      }
    })
    const processRunner = {
      execFile: vi.fn<AgentChatProcessRunner['execFile']>(),
      spawn: vi.fn<AgentChatProcessRunner['spawn']>(() => turnChild.child)
    } satisfies AgentChatProcessRunner
    const adapter = createCodexAgentChatAdapter({
      processRunner
    })
    const session = {
      ...createSession(),
      nativeSessionId: 'thread-1'
    }

    const iterator = adapter.startSession({
      attachments: [],
      content: 'Run',
      contextManifest,
      session,
      workspaceRoot: '/workspace'
    })[Symbol.asyncIterator]()
    await expect(iterator.next()).resolves.toMatchObject({
      value: {
        nativeSessionId: 'thread-1',
        type: 'session-started'
      }
    })
    const pendingTurn = iterator.next()
    await waitFor(() =>
      turnChild.requests.some((request) => request.method === 'turn/start')
    )

    const stopEvents = []
    for await (const event of adapter.stopSession({
      nativeSessionId: 'thread-1',
      session,
      workspaceRoot: '/workspace'
    })) {
      stopEvents.push(event)
    }

    expect(stopEvents).toEqual([
      {
        nativeSessionId: 'thread-1',
        sessionId: 'mde-chat-1',
        type: 'session-stopped'
      }
    ])
    expect(
      turnChild.requests.some((request) => request.method === 'turn/interrupt')
    ).toBe(false)

    turnStartPush?.({
      id: turnChild.requests.find((request) => request.method === 'turn/start')
        ?.id,
      result: {
        turn: { id: 'turn-1' }
      }
    })
    await waitFor(() =>
      turnChild.requests.some((request) => request.method === 'turn/interrupt')
    )
    firstPush?.({
      method: 'turn/completed',
      params: {
        threadId: 'thread-1',
        turn: { id: 'turn-1' }
      }
    })
    await expect(pendingTurn).resolves.toMatchObject({
      done: true
    })

    expect(
      turnChild.requests.find((request) => request.method === 'turn/interrupt')
        ?.params
    ).toEqual({
      threadId: 'thread-1',
      turnId: 'turn-1'
    })
  })

  it('hydrates historical user and assistant messages when resuming a native session', async () => {
    const scripted = createScriptedChild((request, push) => {
      if (request.method === 'thread/resume') {
        push({
          id: request.id,
          result: {
            thread: {
              cwd: '/workspace',
              id: 'thread-1',
              name: 'History title',
              turns: [
                {
                  completedAt: 1778544001,
                  durationMs: 1000,
                  error: null,
                  id: 'turn-1',
                  items: [
                    {
                      content: [
                        {
                          text: 'Current Markdown snapshot:\n# Example\n\nUser message:\nExplain this section',
                          text_elements: [],
                          type: 'text'
                        }
                      ],
                      id: 'user-item-1',
                      type: 'userMessage'
                    },
                    {
                      content: ['Detailed reasoning text'],
                      id: 'reasoning-item-1',
                      summary: ['Read the selected Markdown'],
                      type: 'reasoning'
                    },
                    {
                      id: 'assistant-item-1',
                      memoryCitation: null,
                      phase: null,
                      text: 'This section introduces the feature.',
                      type: 'agentMessage'
                    }
                  ],
                  itemsView: 'full',
                  startedAt: 1778544000,
                  status: 'completed'
                }
              ],
              updatedAt: 1778544001
            }
          }
        })
      }
    })
    const processRunner = {
      execFile: vi.fn<AgentChatProcessRunner['execFile']>(),
      spawn: vi.fn<AgentChatProcessRunner['spawn']>(() => scripted.child)
    } satisfies AgentChatProcessRunner
    const adapter = createCodexAgentChatAdapter({
      now: () => '2026-05-12T00:00:00.000Z',
      processRunner
    })

    const events = []
    for await (const event of adapter.resumeSession({
      nativeSessionId: 'thread-1',
      session: {
        ...createSession(),
        nativeSessionId: 'thread-1',
        state: 'stopped'
      },
      workspaceRoot: '/workspace'
    })) {
      events.push(event)
    }

    expect(scripted.requests.find((request) => request.method === 'thread/resume'))
      .toMatchObject({
        params: {
          excludeTurns: false,
          threadId: 'thread-1'
        }
      })
    expect(events).toEqual([
      {
        nativeSessionId: 'thread-1',
        sessionId: 'mde-chat-1',
        title: 'History title',
        type: 'session-started'
      },
      {
        message: {
          attachments: [],
          content: 'Explain this section',
          createdAt: '2026-05-12T00:00:00.000Z',
          messageId: 'user-item-1',
          role: 'user',
          sessionId: 'mde-chat-1'
        },
        type: 'message-created'
      },
      {
        message: {
          attachments: [],
          content: 'Read the selected Markdown\n\nDetailed reasoning text',
          createdAt: '2026-05-12T00:00:01.000Z',
          isStreaming: false,
          messageId: 'reasoning-item-1',
          role: 'thinking',
          sessionId: 'mde-chat-1'
        },
        type: 'thinking-updated'
      },
      {
        message: {
          attachments: [],
          content: 'This section introduces the feature.',
          createdAt: '2026-05-12T00:00:01.000Z',
          messageId: 'assistant-item-1',
          role: 'assistant',
          sessionId: 'mde-chat-1'
        },
        type: 'assistant-message-completed'
      }
    ])
  })
})
