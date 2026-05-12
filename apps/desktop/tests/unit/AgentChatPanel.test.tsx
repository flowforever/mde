import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AgentChatPanel } from '../../src/renderer/src/agentChat/AgentChatPanel'
import {
  BUILT_IN_APP_LANGUAGE_PACKS,
  createAppText
} from '../../src/renderer/src/i18n/appLanguage'
import type {
  AgentChatApi,
  AgentChatEvent,
  AgentChatSession
} from '../../src/shared/agentChat'

const text = createAppText(BUILT_IN_APP_LANGUAGE_PACKS.en)

const contextManifest = {
  currentDocumentPath: 'docs/example.md',
  currentDocumentSnapshot: '# Example\n\nSelected body',
  modelName: 'gpt-5.4',
  permissionMode: 'max-permission',
  selectedBlockIds: ['block-1'],
  selectedText: 'Selected body',
  sessionPurpose: 'document-chat',
  workspaceRoot: '/workspace'
} as const

const createSession = (): AgentChatSession => ({
  createdAt: '2026-05-12T00:00:00.000Z',
  engineId: 'codex',
  host: 'editor',
  permissionMode: 'max-permission',
  sessionId: 'mde-chat-1',
  sessionPurpose: 'document-chat',
  state: 'draft',
  updatedAt: '2026-05-12T00:00:00.000Z',
  workspaceRoot: '/workspace'
})

const createAgentChatApi = () => {
  const session = createSession()
  let listener: ((event: AgentChatEvent) => void) | undefined
  const api = {
    createDraftSession: vi.fn<AgentChatApi['createDraftSession']>(() =>
      Promise.resolve(session)
    ),
    getAvailability: vi.fn<AgentChatApi['getAvailability']>(() =>
      Promise.resolve({
        available: true,
        engineId: 'codex'
      })
    ),
    listSessions: vi.fn<AgentChatApi['listSessions']>(() => Promise.resolve([])),
    onEvent: vi.fn((eventListener: (event: AgentChatEvent) => void) => {
      listener = eventListener

      return vi.fn()
    }),
    resumeSession: vi.fn<AgentChatApi['resumeSession']>(() =>
      Promise.resolve(session)
    ),
    saveAttachment: vi.fn<AgentChatApi['saveAttachment']>((request) =>
      Promise.resolve({
        attachmentId: 'attachment-1',
        fileName: request.fileName,
        mimeType: request.mimeType,
        safePath: `/workspace/.mde/agent-chat/${request.sessionId}/attachments/${request.fileName}`,
        sizeBytes: request.bytes.byteLength
      })
    ),
    sendMessage: vi.fn<AgentChatApi['sendMessage']>(() => Promise.resolve()),
    stopSession: vi.fn<AgentChatApi['stopSession']>(() => Promise.resolve())
  } satisfies AgentChatApi

  return {
    api,
    emit: (event: AgentChatEvent) => listener?.(event),
    session
  }
}

const renderPanel = (api: AgentChatApi): void => {
  render(
    <AgentChatPanel
      api={api}
      contextManifest={contextManifest}
      onClose={vi.fn()}
      text={text}
      workspaceRoot="/workspace"
    />
  )
}

afterEach(() => {
  cleanup()
})

describe('AgentChatPanel', () => {
  it('renders a Codex-only session panel with max-permission context', async () => {
    const { api } = createAgentChatApi()

    renderPanel(api)

    expect(await screen.findByRole('button', { name: 'New session' })).toBeInTheDocument()
    expect(screen.getByText('Max permission')).toBeInTheDocument()
    expect(screen.getByText('docs/example.md')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /engine/i })).not.toBeInTheDocument()
  })

  it('sends current document context through the selected draft session', async () => {
    const { api } = createAgentChatApi()

    renderPanel(api)
    fireEvent.click(await screen.findByRole('button', { name: 'New session' }))
    fireEvent.change(screen.getByLabelText('Message Agent Chat'), {
      target: { value: 'What changed?' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(api.sendMessage).toHaveBeenCalledWith({
        attachments: [],
        content: 'What changed?',
        contextManifest,
        modelName: 'gpt-5.4',
        sessionId: 'mde-chat-1',
        workspaceRoot: '/workspace'
      })
    })
  })

  it('clears the composer immediately and shows thinking state while a send is in flight', async () => {
    let resolveSend: (() => void) | undefined
    const { api: baseApi } = createAgentChatApi()
    const api = {
      ...baseApi,
      sendMessage: vi.fn<AgentChatApi['sendMessage']>(
        () =>
          new Promise<void>((resolve) => {
            resolveSend = resolve
          })
      )
    } satisfies AgentChatApi

    renderPanel(api)
    fireEvent.click(await screen.findByRole('button', { name: 'New session' }))
    fireEvent.change(screen.getByLabelText('Message Agent Chat'), {
      target: { value: 'What changed?' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(api.sendMessage).toHaveBeenCalled()
    })
    expect(screen.getByLabelText('Message Agent Chat')).toHaveValue('')
    expect(screen.getByText('Thinking...')).toBeInTheDocument()

    act(() => {
      resolveSend?.()
    })
    await waitFor(() => {
      expect(screen.queryByText('Thinking...')).not.toBeInTheDocument()
    })
  })

  it('resumes a native-backed session when it is selected from the picker', async () => {
    const { api: baseApi, session } = createAgentChatApi()
    const nativeSession = {
      ...session,
      nativeSessionId: 'thread-1',
      sessionId: 'mde-native-thread-1',
      state: 'stopped' as const
    }
    const api = {
      ...baseApi,
      listSessions: vi.fn<AgentChatApi['listSessions']>(() =>
        Promise.resolve([nativeSession])
      ),
      resumeSession: vi.fn<AgentChatApi['resumeSession']>(() =>
        Promise.resolve({
          ...nativeSession,
          state: 'active'
        })
      )
    } satisfies AgentChatApi

    renderPanel(api)

    await waitFor(() => {
      expect(api.resumeSession).toHaveBeenCalledWith({
        nativeSessionId: 'thread-1',
        sessionId: 'mde-native-thread-1',
        workspaceRoot: '/workspace'
      })
    })
  })

  it('uses native session titles in the picker before falling back to ids', async () => {
    const { api: baseApi, session } = createAgentChatApi()
    const nativeSession = {
      ...session,
      nativeSessionId: 'thread-1',
      sessionId: 'mde-native-thread-1',
      state: 'stopped' as const,
      title: 'Summarize README'
    }
    const api = {
      ...baseApi,
      listSessions: vi.fn<AgentChatApi['listSessions']>(() =>
        Promise.resolve([nativeSession])
      )
    } satisfies AgentChatApi

    renderPanel(api)

    expect(
      await screen.findByRole('option', { name: 'Summarize README' })
    ).toBeInTheDocument()
  })

  it('clears the submitted draft and attachments when sending fails', async () => {
    const { api: baseApi } = createAgentChatApi()
    const png = new File([new Uint8Array([1, 2, 3])], 'paste.png', {
      type: 'image/png'
    })
    const api = {
      ...baseApi,
      sendMessage: vi.fn<AgentChatApi['sendMessage']>(() =>
        Promise.reject(new Error('send failed'))
      )
    } satisfies AgentChatApi

    renderPanel(api)
    fireEvent.click(await screen.findByRole('button', { name: 'New session' }))
    fireEvent.paste(screen.getByLabelText('Message Agent Chat'), {
      clipboardData: {
        files: [png]
      }
    })
    await screen.findByText('paste.png')
    fireEvent.change(screen.getByLabelText('Message Agent Chat'), {
      target: { value: 'What changed?' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(api.sendMessage).toHaveBeenCalled()
    })
    expect(screen.getByLabelText('Message Agent Chat')).toHaveValue('')
    expect(screen.queryByText('paste.png')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Agent Chat diagnostic')
  })

  it('renders the image attachment picker as a keyboard-focusable control', async () => {
    const { api } = createAgentChatApi()

    renderPanel(api)

    expect(
      await screen.findByRole('button', { name: 'Attach image' })
    ).toBeInTheDocument()
  })

  it('saves pasted images through the narrow preload attachment API', async () => {
    const { api } = createAgentChatApi()
    const png = new File([new Uint8Array([1, 2, 3])], 'paste.png', {
      type: 'image/png'
    })

    renderPanel(api)
    fireEvent.click(await screen.findByRole('button', { name: 'New session' }))
    fireEvent.paste(screen.getByLabelText('Message Agent Chat'), {
      clipboardData: {
        files: [png]
      }
    })

    await waitFor(() => {
      expect(api.saveAttachment).toHaveBeenCalledWith({
        bytes: new Uint8Array([1, 2, 3]),
        fileName: 'paste.png',
        mimeType: 'image/png',
        sessionId: 'mde-chat-1',
        workspaceRoot: '/workspace'
      })
    })
    expect(await screen.findByText('paste.png')).toBeInTheDocument()
  })

  it('deduplicates pasted images exposed through files and items', async () => {
    const { api } = createAgentChatApi()
    const png = new File([new Uint8Array([1, 2, 3])], 'pasted-round3.png', {
      type: 'image/png'
    })

    renderPanel(api)
    fireEvent.click(await screen.findByRole('button', { name: 'New session' }))
    fireEvent.paste(screen.getByLabelText('Message Agent Chat'), {
      clipboardData: {
        files: [png],
        items: [
          {
            getAsFile: () => png,
            kind: 'file'
          }
        ]
      }
    })

    await waitFor(() => {
      expect(api.saveAttachment).toHaveBeenCalledTimes(1)
    })
    expect(screen.getAllByText('pasted-round3.png')).toHaveLength(1)
  })

  it('saves pasted images when the clipboard exposes only data transfer items', async () => {
    const { api } = createAgentChatApi()
    const png = new File([new Uint8Array([4, 5, 6])], 'items-only.png', {
      type: 'image/png'
    })

    renderPanel(api)
    fireEvent.click(await screen.findByRole('button', { name: 'New session' }))
    fireEvent.paste(screen.getByLabelText('Message Agent Chat'), {
      clipboardData: {
        files: [],
        items: [
          {
            getAsFile: () => png,
            kind: 'file'
          }
        ]
      }
    })

    await waitFor(() => {
      expect(api.saveAttachment).toHaveBeenCalledWith({
        bytes: new Uint8Array([4, 5, 6]),
        fileName: 'items-only.png',
        mimeType: 'image/png',
        sessionId: 'mde-chat-1',
        workspaceRoot: '/workspace'
      })
    })
    expect(await screen.findByText('items-only.png')).toBeInTheDocument()
  })

  it('renders changed-file events without reading native histories in the renderer', async () => {
    const { api, emit, session } = createAgentChatApi()

    renderPanel(api)
    fireEvent.click(await screen.findByRole('button', { name: 'New session' }))
    await waitFor(() => {
      expect(screen.getByLabelText('Session')).toHaveValue('mde-chat-1')
    })

    act(() => {
      emit({
        sessionId: session.sessionId,
        summary: {
          available: true,
          files: [
            {
              changeType: 'modified',
              path: 'docs/example.md'
            }
          ]
        },
        type: 'changed-files-updated'
      })
    })

    const changedFiles = screen.getByText('Changed files').closest('section')

    expect(changedFiles).not.toBeNull()
    expect(within(changedFiles!).getByText('docs/example.md')).toBeInTheDocument()
  })

  it('does not show a generic diagnostic for recoverable changed-file summaries', async () => {
    const { api, emit, session } = createAgentChatApi()

    renderPanel(api)
    fireEvent.click(await screen.findByRole('button', { name: 'New session' }))
    await waitFor(() => {
      expect(screen.getByLabelText('Session')).toHaveValue('mde-chat-1')
    })

    act(() => {
      emit({
        diagnostic: {
          code: 'changed-files-unavailable',
          message: 'Changed files unavailable',
          recoverable: true
        },
        sessionId: session.sessionId,
        type: 'diagnostic'
      })
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('hides stale changed files when an empty summary is emitted', async () => {
    const { api, emit, session } = createAgentChatApi()

    renderPanel(api)
    fireEvent.click(await screen.findByRole('button', { name: 'New session' }))
    await waitFor(() => {
      expect(screen.getByLabelText('Session')).toHaveValue('mde-chat-1')
    })

    act(() => {
      emit({
        sessionId: session.sessionId,
        summary: {
          available: true,
          files: [
            {
              changeType: 'modified',
              path: 'docs/example.md'
            }
          ]
        },
        type: 'changed-files-updated'
      })
    })
    expect(screen.getByText('Changed files')).toBeInTheDocument()

    act(() => {
      emit({
        sessionId: session.sessionId,
        summary: {
          available: true,
          files: []
        },
        type: 'changed-files-updated'
      })
    })

    expect(screen.queryByText('Changed files')).not.toBeInTheDocument()
  })
})
