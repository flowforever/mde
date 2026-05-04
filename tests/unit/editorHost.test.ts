import { describe, expect, it } from 'vitest'

import {
  createEditorHostBridgeMessage,
  createEditorHostBridgeResponse
} from '@mde/editor-host/bridge'
import { createFakeEditorHost } from '@mde/editor-host/fake'

describe('editor host contract', () => {
  it('creates JSON-serializable bridge envelopes with request correlation ids', () => {
    const message = createEditorHostBridgeMessage({
      id: 'request-1',
      payload: { markdown: '# Title' },
      type: 'editor.save'
    })
    const response = createEditorHostBridgeResponse({
      id: message.id,
      payload: { savedAt: '2026-05-04T00:00:00.000Z' }
    })

    expect(JSON.parse(JSON.stringify(message))).toEqual({
      id: 'request-1',
      payload: { markdown: '# Title' },
      type: 'editor.save',
      version: 1
    })
    expect(response).toEqual({
      id: 'request-1',
      payload: { savedAt: '2026-05-04T00:00:00.000Z' },
      version: 1
    })
  })

  it('provides a minimal fake host with explicit capabilities', async () => {
    const host = createFakeEditorHost({
      documents: {
        'README.md': '# Old'
      }
    })

    expect(host.capabilities).toEqual({
      canCreateLinkedDocument: true,
      canOpenLinks: true,
      canUploadImages: true,
      hasWorkspaceTree: true
    })

    const result = await host.saveDocument({
      document: { path: 'README.md', workspaceRoot: '/workspace' },
      markdown: '# New',
      reason: 'manual'
    })

    expect(result.ok).toBe(true)
    expect(result.ok ? result.value.normalizedMarkdown : null).toBe('# New')
    expect(host.readDocument('README.md')).toBe('# New')
  })
})
