import { describe, expect, it } from 'vitest'

import { createFakeAgentChatAdapter } from './fakeAdapter'

describe('fake agent chat adapter', () => {
  it('can represent a non-Codex engine through the shared interface', async () => {
    const adapter = createFakeAgentChatAdapter({ engineId: 'claude' })

    await expect(
      adapter.probeCapabilities({ workspaceRoot: '/workspace' })
    ).resolves.toMatchObject({ engineId: 'claude', verdict: 'supported' })
  })
})
