import { describe, expect, it, vi } from 'vitest'

import { createFakeAgentChatAdapter } from './fakeAdapter'
import { createAgentChatRuntime } from './runtime'

const createTestFileStore = () => ({
  mkdir: vi.fn(() => Promise.resolve()),
  realpath: vi.fn((path: string) => Promise.resolve(path)),
  writeFile: vi.fn(() => Promise.resolve())
})

describe('Agent Chat runtime integration', () => {
  it('runs the shared event model with a non-Codex fake adapter', async () => {
    const runtime = createAgentChatRuntime({
      adapters: [createFakeAgentChatAdapter({ engineId: 'claude' })],
      fileStore: createTestFileStore(),
      now: () => '2026-05-12T00:00:00.000Z'
    })
    const session = await runtime.createDraftSession({
      engineId: 'claude',
      host: 'editor',
      sessionPurpose: 'document-chat',
      workspaceRoot: '/workspace'
    })
    const events: string[] = []
    runtime.subscribe(session.sessionId, (event) => {
      events.push(event.type)
    })

    await runtime.sendMessage({
      contextManifest: {
        currentDocumentSnapshot: '# Example',
        permissionMode: 'max-permission',
        selectedBlockIds: [],
        selectedText: '',
        sessionPurpose: 'document-chat',
        workspaceRoot: '/workspace'
      },
      content: 'Hello',
      sessionId: session.sessionId,
      workspaceRoot: '/workspace'
    })

    expect(events).toEqual([
      'message-created',
      'session-updated',
      'session-started',
      'assistant-message-delta',
      'assistant-message-completed'
    ])
  })
})
