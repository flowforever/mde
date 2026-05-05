import { describe, expect, it } from 'vitest'

import {
  createEditorHostBridgeMessage,
  createEditorHostBridgeResponse,
  parseEditorHostBridgeMessage,
  parseEditorHostBridgeResponse
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

  it('validates bridge envelopes and optional typed payloads at runtime', () => {
    const message = parseEditorHostBridgeMessage(
      {
        id: 'request-2',
        payload: { href: 'docs/intro.md' },
        type: 'editor.openLink',
        version: 1
      },
      {
        type: 'editor.openLink',
        validatePayload: (
          payload
        ): payload is { readonly href: string } =>
          typeof payload === 'object' &&
          payload !== null &&
          typeof (payload as { readonly href?: unknown }).href === 'string'
      }
    )

    expect(message.ok).toBe(true)
    expect(message.ok ? message.value.payload.href : null).toBe('docs/intro.md')

    expect(
      parseEditorHostBridgeMessage({
        id: 'request-3',
        payload: { href: 'docs/intro.md' },
        type: 'editor.openLink',
        version: 2
      })
    ).toEqual({
      error: {
        code: 'validation',
        message: 'Invalid editor host bridge message'
      },
      ok: false
    })
    expect(
      parseEditorHostBridgeMessage(
        {
          id: 'request-4',
          payload: { href: 42 },
          type: 'editor.openLink',
          version: 1
        },
        {
          validatePayload: (
            payload
          ): payload is { readonly href: string } =>
            typeof payload === 'object' &&
            payload !== null &&
            typeof (payload as { readonly href?: unknown }).href === 'string'
        }
      )
    ).toEqual({
      error: {
        code: 'validation',
        message: 'Invalid editor host bridge message payload'
      },
      ok: false
    })
  })

  it('validates bridge responses at runtime', () => {
    expect(
      parseEditorHostBridgeResponse({
        id: 'request-5',
        payload: { savedAt: '2026-05-04T00:00:00.000Z' },
        version: 1
      })
    ).toEqual({
      ok: true,
      value: {
        id: 'request-5',
        payload: { savedAt: '2026-05-04T00:00:00.000Z' },
        version: 1
      }
    })

    expect(
      parseEditorHostBridgeResponse({
        id: 'request-6',
        error: { code: 'unsupported' },
        payload: { savedAt: '2026-05-04T00:00:00.000Z' },
        version: 1
      })
    ).toEqual({
      error: {
        code: 'validation',
        message: 'Invalid editor host bridge response'
      },
      ok: false
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
