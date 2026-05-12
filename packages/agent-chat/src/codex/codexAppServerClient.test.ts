import { describe, expect, it } from 'vitest'

import {
  createCodexAppServerClient,
  createCodexNotificationMapper
} from './codexAppServerClient'
import type { CodexServerNotification } from './protocolTypes'

const createAsyncLines = (lines: readonly string[]): AsyncIterable<string> => ({
  async *[Symbol.asyncIterator]() {
    await Promise.resolve()

    for (const line of lines) {
      yield `${line}\n`
    }
  }
})

const createMemoryChildProcess = (stdoutLines: readonly string[]) => {
  const writes: string[] = []
  const pendingLines = [...stdoutLines]
  const queuedLines: string[] = []
  const waitingConsumers: ((result: IteratorResult<string>) => void)[] = []

  const resolveNext = (result: IteratorResult<string>): void => {
    const consumer = waitingConsumers.shift()
    if (consumer) {
      consumer(result)
      return
    }
    if (!result.done) {
      queuedLines.push(result.value)
    }
  }

  const pushResponseForRequest = (chunk: string): void => {
    const message = JSON.parse(chunk.trim()) as { readonly id?: unknown }
    if (typeof message.id !== 'string') {
      return
    }
    const line = pendingLines.shift()
    if (line) {
      resolveNext({ done: false, value: `${line}\n` })
    }
  }

  return {
    child: {
      kill: () => undefined,
      stderr: createAsyncLines([]),
      stdin: {
        end: () => undefined,
        write: (chunk: string) => {
          writes.push(chunk)
          pushResponseForRequest(chunk)
        }
      },
      stdout: {
        [Symbol.asyncIterator]: () => ({
          next: () => {
            const line = queuedLines.shift()
            if (line) {
              return Promise.resolve({ done: false, value: line })
            }
            return new Promise<IteratorResult<string>>((resolve) => {
              waitingConsumers.push(resolve)
            })
          }
        })
      }
    },
    writes
  }
}

const initializeResponse = (id: string): string =>
  JSON.stringify({
    id,
    result: {
      codexHome: '/home/user/.codex',
      platformFamily: 'unix',
      platformOs: 'macos',
      userAgent: 'mde-test/0.130.0'
    }
  })

describe('createCodexAppServerClient', () => {
  it('initializes the app-server before serializing thread/start requests', async () => {
    const { child, writes } = createMemoryChildProcess([
      initializeResponse('codex-chat-1'),
      JSON.stringify({
        id: 'codex-chat-2',
        result: { thread: { cwd: '/workspace', id: 'thread-1', name: 'Plan' } }
      })
    ])
    const client = createCodexAppServerClient({ child, idPrefix: 'codex-chat' })

    await client.threadStart({ cwd: '/workspace', experimentalRawEvents: false, persistExtendedHistory: false })

    expect(JSON.parse(writes[0] ?? '{}')).toMatchObject({
      id: 'codex-chat-1',
      method: 'initialize',
      params: {
        capabilities: { experimentalApi: true },
        clientInfo: { name: 'mde', title: 'MDE', version: '1.0.0' }
      }
    })
    expect(JSON.parse(writes[1] ?? '{}')).toEqual({ method: 'initialized' })
    expect(JSON.parse(writes[2] ?? '{}')).toMatchObject({
      id: 'codex-chat-2',
      method: 'thread/start',
      params: { cwd: '/workspace' }
    })
  })

  it('turn/start sends UserInput[] including local image paths', async () => {
    const { child, writes } = createMemoryChildProcess([
      initializeResponse('codex-chat-1'),
      JSON.stringify({ id: 'codex-chat-2', result: { turn: { id: 'turn-1' } } })
    ])
    const client = createCodexAppServerClient({ child, idPrefix: 'codex-chat' })

    await client.turnStart({
      input: [
        { text: 'hello', text_elements: [], type: 'text' },
        { path: '/workspace/.mde/agent-chat/1/attachments/p.png', type: 'localImage' }
      ],
      threadId: 'thread-1'
    })

    expect(JSON.parse(writes[2] ?? '{}')).toMatchObject({
      method: 'turn/start',
      params: {
        input: [
          { text: 'hello', type: 'text' },
          {
            path: '/workspace/.mde/agent-chat/1/attachments/p.png',
            type: 'localImage'
          }
        ],
        threadId: 'thread-1'
      }
    })
  })

  it('maps agent deltas and turn completion to normalized engine events', () => {
    const mapper = createCodexNotificationMapper({
      now: () => '2026-05-12T00:00:00.000Z',
      sessionId: 'mde-chat-1'
    })
    const deltaNotification: CodexServerNotification = {
      method: 'item/agentMessage/delta',
      params: {
        delta: 'hello',
        itemId: 'item-1',
        threadId: 'thread-1',
        turnId: 'turn-1'
      }
    }
    const completedNotification: CodexServerNotification = {
      method: 'turn/completed',
      params: {
        threadId: 'thread-1',
        turn: { id: 'turn-1', status: 'completed' }
      }
    }

    expect(mapper.map(deltaNotification)).toMatchObject({
      delta: 'hello',
      messageId: 'item-1',
      type: 'assistant-message-delta'
    })
    expect(mapper.map(completedNotification)).toMatchObject({
      message: {
        content: 'hello',
        messageId: 'item-1',
        role: 'assistant'
      },
      type: 'assistant-message-completed'
    })
  })
})
