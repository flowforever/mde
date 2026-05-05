import { describe, expect, it } from 'vitest'

import {
  createEditorHostBridgeMessage,
  createEditorHostBridgeResponse,
  parseEditorHostBridgeMessage,
  parseEditorHostBridgeResponse
} from '@mde/editor-host/bridge'

interface SavePayload {
  readonly markdown: string
  readonly path: string
}

const isSavePayload = (payload: unknown): payload is SavePayload =>
  typeof payload === 'object' &&
  payload !== null &&
  typeof (payload as { readonly markdown?: unknown }).markdown === 'string' &&
  typeof (payload as { readonly path?: unknown }).path === 'string'

describe('editor host bridge validation integration', () => {
  it('validates serialized webview messages before host dispatch', () => {
    const serialized = JSON.stringify(
      createEditorHostBridgeMessage({
        id: 'save-1',
        payload: { markdown: '# Updated', path: 'README.md' },
        type: 'editor.save'
      })
    )
    const parsed = parseEditorHostBridgeMessage<SavePayload>(
      JSON.parse(serialized),
      {
        type: 'editor.save',
        validatePayload: isSavePayload
      }
    )

    expect(parsed).toEqual({
      ok: true,
      value: {
        id: 'save-1',
        payload: { markdown: '# Updated', path: 'README.md' },
        type: 'editor.save',
        version: 1
      }
    })
  })

  it('rejects malformed serialized host responses before webview consumption', () => {
    const validResponse = parseEditorHostBridgeResponse<{ readonly savedAt: string }>(
      JSON.parse(
        JSON.stringify(
          createEditorHostBridgeResponse({
            id: 'save-1',
            payload: { savedAt: '2026-05-04T00:00:00.000Z' }
          })
        )
      ),
      {
        validatePayload: (
          payload
        ): payload is { readonly savedAt: string } =>
          typeof payload === 'object' &&
          payload !== null &&
          typeof (payload as { readonly savedAt?: unknown }).savedAt === 'string'
      }
    )

    expect(validResponse).toMatchObject({ ok: true })
    expect(
      parseEditorHostBridgeResponse({
        id: 'save-1',
        payload: { savedAt: 42 },
        version: 1
      },
      {
        validatePayload: (
          payload
        ): payload is { readonly savedAt: string } =>
          typeof payload === 'object' &&
          payload !== null &&
          typeof (payload as { readonly savedAt?: unknown }).savedAt === 'string'
      })
    ).toEqual({
      error: {
        code: 'validation',
        message: 'Invalid editor host bridge response payload'
      },
      ok: false
    })
  })
})
