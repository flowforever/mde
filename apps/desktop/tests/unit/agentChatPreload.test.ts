import { describe, expect, it, vi } from 'vitest'

import { createAgentChatApi } from '../../src/preload/agentChatApi'

describe('createAgentChatApi', () => {
  it('exposes only narrow Agent Chat methods', () => {
    const ipcRenderer = {
      invoke: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn()
    } satisfies Parameters<typeof createAgentChatApi>[0]
    const api = createAgentChatApi(ipcRenderer)

    expect(Object.keys(api).sort()).toEqual([
      'createDraftSession',
      'getAvailability',
      'listSessions',
      'onEvent',
      'releaseWorkspaceSubscriptions',
      'resumeSession',
      'saveAttachment',
      'sendMessage',
      'stopSession'
    ])
  })
})
