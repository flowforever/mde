import { describe, expect, it } from 'vitest'

import { shouldShowAgentChatEntry } from '../../src/renderer/src/agentChat/agentChatViewModel'

describe('agentChatViewModel', () => {
  it('shows the editor entry only when Codex sustained Agent Chat is available', () => {
    expect(
      shouldShowAgentChatEntry({
        available: true,
        engineId: 'codex'
      })
    ).toBe(true)
  })

  it('hides the editor entry for unsupported protocol or non-Codex engines', () => {
    expect(
      shouldShowAgentChatEntry({
        available: false,
        engineId: 'codex',
        reason: 'protocol-unsupported'
      })
    ).toBe(false)
    expect(
      shouldShowAgentChatEntry({
        available: true,
        engineId: 'claude'
      })
    ).toBe(false)
    expect(shouldShowAgentChatEntry(null)).toBe(false)
  })
})
