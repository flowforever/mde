import { describe, expect, it } from 'vitest'

import {
  createAttachmentCachePath,
  isAttachmentInsideSessionCache
} from './attachments'

describe('agent chat attachments', () => {
  it('stores draft attachments under workspace-local .mde cache', () => {
    expect(
      createAttachmentCachePath({
        fileName: 'pasted.png',
        sessionId: 'mde-chat-1',
        workspaceRoot: '/workspace'
      })
    ).toBe('/workspace/.mde/agent-chat/mde-chat-1/attachments/pasted.png')
  })

  it('rejects arbitrary local paths outside the session cache', () => {
    expect(
      isAttachmentInsideSessionCache({
        candidatePath: '/tmp/secret.png',
        sessionId: 'mde-chat-1',
        workspaceRoot: '/workspace'
      })
    ).toBe(false)
  })
})
