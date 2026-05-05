import { describe, expect, it } from 'vitest'

import type {
  MarkdownAssetReference,
  MarkdownAssetResolver
} from '@mde/editor-core'
import {
  createEditorHostBridgeMessage,
  createEditorHostBridgeResponse,
  parseEditorHostBridgeMessage,
  parseEditorHostBridgeResponse
} from '@mde/editor-host/bridge'
import {
  prepareMarkdownForEditor,
  prepareMarkdownForStorage
} from '@mde/editor-react'

interface LinkPayload {
  readonly href: string
}

interface SavePayload {
  readonly markdown: string
  readonly path: string
}

const isLinkPayload = (payload: unknown): payload is LinkPayload =>
  typeof payload === 'object' &&
  payload !== null &&
  typeof (payload as { readonly href?: unknown }).href === 'string'

const isSavePayload = (payload: unknown): payload is SavePayload =>
  typeof payload === 'object' &&
  payload !== null &&
  typeof (payload as { readonly markdown?: unknown }).markdown === 'string' &&
  typeof (payload as { readonly path?: unknown }).path === 'string'

const createUrlAssetResolver = (
  schemeBaseUrl: string
): MarkdownAssetResolver =>
  Object.freeze({
    toEditorUrl: (reference: MarkdownAssetReference) =>
      reference.kind === 'portable-markdown-path'
        ? `${schemeBaseUrl}/${encodeURIComponent(reference.rawTarget)}`
        : null,
    toStoragePath: (reference: MarkdownAssetReference) => {
      if (!reference.rawTarget.startsWith(`${schemeBaseUrl}/`)) {
        return null
      }

      return decodeURIComponent(new URL(reference.rawTarget).pathname.slice(1))
    }
  })

describe('editor host platform adapter spikes', () => {
  it('supports a VS Code webview-style adapter for asset URLs, save errors, and links', () => {
    const resolver = createUrlAssetResolver('vscode-webview://mde')
    const editorMarkdown = prepareMarkdownForEditor(
      '![Diagram](assets/diagram.png)',
      resolver
    )

    expect(editorMarkdown).toBe(
      '![Diagram](vscode-webview://mde/assets%2Fdiagram.png)'
    )
    expect(prepareMarkdownForStorage(editorMarkdown, resolver)).toBe(
      '![Diagram](assets/diagram.png)'
    )

    const saveRequest = parseEditorHostBridgeMessage<SavePayload>(
      createEditorHostBridgeMessage({
        id: 'vscode-save-1',
        payload: { markdown: '# Draft', path: 'README.md' },
        type: 'editor.save'
      }),
      { type: 'editor.save', validatePayload: isSavePayload }
    )

    expect(saveRequest).toMatchObject({ ok: true })
    expect(
      parseEditorHostBridgeResponse(
        createEditorHostBridgeResponse({
          error: {
            code: 'permission-denied',
            message: 'Workspace is not trusted',
            retryable: false
          },
          id: 'vscode-save-1'
        })
      )
    ).toEqual({
      ok: true,
      value: {
        error: {
          code: 'permission-denied',
          message: 'Workspace is not trusted',
          retryable: false
        },
        id: 'vscode-save-1',
        version: 1
      }
    })
    expect(
      parseEditorHostBridgeMessage<LinkPayload>(
        createEditorHostBridgeMessage({
          id: 'vscode-link-1',
          payload: { href: 'https://example.com/docs' },
          type: 'editor.openLink'
        }),
        { type: 'editor.openLink', validatePayload: isLinkPayload }
      )
    ).toMatchObject({ ok: true })
  })

  it('supports a browser extension page-style adapter with explicit storage', () => {
    const resolver = createUrlAssetResolver('chrome-extension://mde-extension')
    const storage = new Map<string, string>()
    const saveRequest = parseEditorHostBridgeMessage<SavePayload>(
      JSON.parse(
        JSON.stringify(
          createEditorHostBridgeMessage({
            id: 'browser-save-1',
            payload: { markdown: '# Browser Draft', path: 'notes/today.md' },
            type: 'editor.save'
          })
        )
      ),
      { type: 'editor.save', validatePayload: isSavePayload }
    )

    if (saveRequest.ok) {
      storage.set(saveRequest.value.payload.path, saveRequest.value.payload.markdown)
    }

    expect(storage.get('notes/today.md')).toBe('# Browser Draft')
    expect(
      prepareMarkdownForStorage(
        prepareMarkdownForEditor('![Icon](assets/icon.png)', resolver),
        resolver
      )
    ).toBe('![Icon](assets/icon.png)')
  })

  it('supports a React Native WebView-style JSON bridge and native link dispatch', () => {
    const resolver = createUrlAssetResolver('mde-rn-asset://document')
    const serializedLinkRequest = JSON.stringify(
      createEditorHostBridgeMessage({
        id: 'rn-link-1',
        payload: { href: 'https://example.com/mobile' },
        type: 'editor.openLink'
      })
    )
    const linkRequest = parseEditorHostBridgeMessage<LinkPayload>(
      JSON.parse(serializedLinkRequest),
      { type: 'editor.openLink', validatePayload: isLinkPayload }
    )

    expect(linkRequest.ok ? linkRequest.value.payload.href : null).toBe(
      'https://example.com/mobile'
    )
    expect(
      prepareMarkdownForEditor('![Photo](assets/photo.png)', resolver)
    ).toBe('![Photo](mde-rn-asset://document/assets%2Fphoto.png)')
    expect(
      prepareMarkdownForStorage(
        '![Photo](mde-rn-asset://document/assets%2Fphoto.png)',
        resolver
      )
    ).toBe('![Photo](assets/photo.png)')
  })
})
