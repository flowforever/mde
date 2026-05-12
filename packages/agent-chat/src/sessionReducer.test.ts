import { describe, expect, it } from 'vitest'

import { createDraftAgentChatSession, reduceAgentChatState } from './sessionReducer'

describe('agent chat session lifecycle', () => {
  it('creates an MDE draft session before native Codex exists', () => {
    const session = createDraftAgentChatSession({
      engineId: 'codex',
      host: 'editor',
      now: () => '2026-05-12T00:00:00.000Z',
      sessionPurpose: 'document-chat',
      workspaceRoot: '/workspace'
    })

    expect(session.sessionId).toMatch(/^mde-chat-/)
    expect(session.nativeSessionId).toBeUndefined()
    expect(session.state).toBe('draft')
  })

  it('binds native session id only after session-started event', () => {
    const draft = createDraftAgentChatSession({
      engineId: 'codex',
      host: 'editor',
      now: () => '2026-05-12T00:00:00.000Z',
      sessionPurpose: 'document-chat',
      workspaceRoot: '/workspace'
    })

    const state = reduceAgentChatState(
      { messages: [], sessions: [draft] },
      {
        session: {
          ...draft,
          nativeSessionId: 'thread-1',
          state: 'active'
        },
        type: 'session-started'
      }
    )

    expect(state.sessions[0]?.nativeSessionId).toBe('thread-1')
    expect(state.sessions[0]?.state).toBe('active')
  })
})
