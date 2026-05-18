import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AgentChatPanel } from '../../src/renderer/src/agentChat/AgentChatPanel'
import { COMPONENT_IDS } from '../../src/renderer/src/componentIds'
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
    releaseWorkspaceSubscriptions: vi.fn<
      AgentChatApi['releaseWorkspaceSubscriptions']
    >(() => Promise.resolve()),
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

const renderPanel = (api: AgentChatApi): ReturnType<typeof render> =>
  render(
    <AgentChatPanel
      api={api}
      contextManifest={contextManifest}
      onClose={vi.fn()}
      text={text}
      workspaceRoot="/workspace"
    />
  )

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
    expect(screen.queryByText('Session')).not.toBeInTheDocument()
    expect(screen.queryByText('Codex sustained chat')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /engine/i })).not.toBeInTheDocument()
  })

  it('matches the shared chat prototype structure with bottom composer context', async () => {
    const { api } = createAgentChatApi()
    const { container } = renderPanel(api)

    await screen.findByRole('button', { name: 'New session' })

    const panel = screen.getByRole('complementary', { name: 'Agent Chat' })
    const body = container.querySelector<HTMLElement>('.agent-chat-body')
    const composer = container.querySelector<HTMLElement>(
      `[data-component-id="${COMPONENT_IDS.agentChat.composer}"]`
    )
    const contextDetails = screen
      .getByText('Context & permission')
      .closest<HTMLDetailsElement>('details')
    const messageList = container.querySelector<HTMLElement>(
      `[data-component-id="${COMPONENT_IDS.agentChat.messageList}"]`
    )
    const messageField = screen.getByLabelText('Message Agent Chat')
    const messageBox = container.querySelector<HTMLElement>('.agent-chat-message-box')
    const attachButton = screen.getByRole('button', { name: 'Attach image' })
    const sendButton = screen.getByRole('button', { name: 'Send' })

    expect(panel).toHaveClass('agent-chat-panel')
    expect(body).toContainElement(messageList)
    expect(composer).toContainElement(contextDetails)
    expect(messageBox).toContainElement(messageField)
    expect(messageBox).toContainElement(attachButton)
    expect(messageBox).toContainElement(sendButton)
    expect(contextDetails).toContainElement(screen.getByText('docs/example.md'))
    expect(contextDetails).toContainElement(screen.getByText('Selected body'))
    expect(contextDetails?.compareDocumentPosition(messageField)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })

  it('releases workspace subscriptions when the panel unmounts', async () => {
    const { api } = createAgentChatApi()
    const { unmount } = renderPanel(api)

    await screen.findByRole('button', { name: 'New session' })
    unmount()

    await waitFor(() => {
      expect(api.releaseWorkspaceSubscriptions).toHaveBeenCalledWith({
        workspaceRoot: '/workspace'
      })
    })
  })

  it('sends current document context through the selected draft session', async () => {
    const { api } = createAgentChatApi()

    renderPanel(api)
    fireEvent.click(await screen.findByRole('button', { name: 'New session' }))
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument()
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
    const { api: baseApi, emit, session } = createAgentChatApi()
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
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop' })).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.agentChat.sendButton
    )
    expect(screen.getByRole('button', { name: 'Stop' })).toBeDisabled()

    act(() => {
      emit({
        session: {
          ...session,
          nativeSessionId: 'thread-1',
          state: 'active'
        },
        type: 'session-started'
      })
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    await waitFor(() => {
      expect(api.stopSession).toHaveBeenCalledWith({
        sessionId: 'mde-chat-1',
        workspaceRoot: '/workspace'
      })
    })

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

  it('uses native session titles in the picker without falling back to ids', async () => {
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
    expect(screen.queryByRole('option', { name: /thread-1/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /mde-native-thread-1/ })).not.toBeInTheDocument()
  })

  it('loads history messages when switching to a native session from the picker', async () => {
    const { api: baseApi, emit, session } = createAgentChatApi()
    const firstSession = {
      ...session,
      nativeSessionId: 'thread-1',
      sessionId: 'mde-native-thread-1',
      state: 'stopped' as const,
      title: 'First chat'
    }
    const secondSession = {
      ...session,
      nativeSessionId: 'thread-2',
      sessionId: 'mde-native-thread-2',
      state: 'stopped' as const,
      title: 'Second chat'
    }
    const api = {
      ...baseApi,
      listSessions: vi.fn<AgentChatApi['listSessions']>(() =>
        Promise.resolve([firstSession, secondSession])
      ),
      resumeSession: vi.fn<AgentChatApi['resumeSession']>((request) => {
        const resumedSession =
          request.sessionId === secondSession.sessionId
            ? secondSession
            : firstSession

        return Promise.resolve({
          ...resumedSession,
          state: 'active'
        })
      })
    } satisfies AgentChatApi

    renderPanel(api)

    await waitFor(() => {
      expect(api.resumeSession).toHaveBeenCalledWith({
        nativeSessionId: 'thread-1',
        sessionId: 'mde-native-thread-1',
        workspaceRoot: '/workspace'
      })
    })
    act(() => {
      emit({
        message: {
          attachments: [],
          content: 'History for First chat',
          createdAt: '2026-05-12T00:00:00.000Z',
          messageId: 'mde-native-thread-1-message',
          role: 'assistant',
          sessionId: firstSession.sessionId
        },
        type: 'assistant-message-completed'
      })
    })
    expect(await screen.findByText('History for First chat')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Session'), {
      target: { value: secondSession.sessionId }
    })

    await waitFor(() => {
      expect(api.resumeSession).toHaveBeenCalledWith({
        nativeSessionId: 'thread-2',
        sessionId: 'mde-native-thread-2',
        workspaceRoot: '/workspace'
      })
    })
    act(() => {
      emit({
        message: {
          attachments: [],
          content: 'History for Second chat',
          createdAt: '2026-05-12T00:00:00.000Z',
          messageId: 'mde-native-thread-2-message',
          role: 'assistant',
          sessionId: secondSession.sessionId
        },
        type: 'assistant-message-completed'
      })
    })
    expect(await screen.findByText('History for Second chat')).toBeInTheDocument()
    expect(screen.queryByText('History for First chat')).not.toBeInTheDocument()
  })

  it('renders assistant markdown as structured message content', async () => {
    const { api, emit, session } = createAgentChatApi()

    renderPanel(api)
    fireEvent.click(await screen.findByRole('button', { name: 'New session' }))

    act(() => {
      emit({
        message: {
          attachments: [],
          content: [
            '# Summary',
            '',
            '- First item',
            '- Second item',
            '',
            '```ts',
            'const ok = true',
            '```'
          ].join('\n'),
          createdAt: '2026-05-12T00:00:00.000Z',
          messageId: 'assistant-markdown-1',
          role: 'assistant',
          sessionId: session.sessionId
        },
        type: 'assistant-message-completed'
      })
    })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Summary' })
    ).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('First item')).toBeInTheDocument()
    expect(screen.getByText('Second item')).toBeInTheDocument()
    expect(screen.getByText('const ok = true')).toBeInTheDocument()
  })

  it('renders live thinking expanded and history thinking collapsed', async () => {
    const { api, emit, session } = createAgentChatApi()

    renderPanel(api)
    fireEvent.click(await screen.findByRole('button', { name: 'New session' }))

    act(() => {
      emit({
        message: {
          attachments: [],
          content: 'Checking context',
          createdAt: '2026-05-12T00:00:00.000Z',
          isStreaming: true,
          messageId: 'thinking-live',
          role: 'thinking',
          sessionId: session.sessionId
        },
        type: 'thinking-updated'
      })
      emit({
        message: {
          attachments: [],
          content: 'Historical reasoning',
          createdAt: '2026-05-12T00:00:00.000Z',
          isStreaming: false,
          messageId: 'thinking-history',
          role: 'thinking',
          sessionId: session.sessionId
        },
        type: 'thinking-updated'
      })
    })

    expect(await screen.findByText('Checking context')).toBeInTheDocument()
    expect(screen.queryByText('Historical reasoning')).not.toBeVisible()
    expect(screen.getByText('Checking context').closest('details')?.open).toBe(
      true
    )
    expect(screen.getByText('Historical reasoning').closest('details')?.open).toBe(
      false
    )
  })

  it('sends only enabled context items', async () => {
    const { api } = createAgentChatApi()

    renderPanel(api)
    fireEvent.click(await screen.findByRole('button', { name: 'New session' }))
    fireEvent.click(screen.getByLabelText('Include document context'))
    fireEvent.click(screen.getByLabelText('Include selection context'))
    fireEvent.change(screen.getByLabelText('Message Agent Chat'), {
      target: { value: 'Use less context' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(api.sendMessage).toHaveBeenCalled()
    })
    const sendRequest = api.sendMessage.mock.calls.at(-1)?.[0]

    expect(sendRequest?.contextManifest.currentDocumentPath).toBeUndefined()
    expect(sendRequest?.contextManifest.currentDocumentSnapshot).toBe('')
    expect(sendRequest?.contextManifest.selectedBlockIds).toEqual([])
    expect(sendRequest?.contextManifest.selectedText).toBe('')
  })

  it('keeps pinned selections available after the live editor selection is gone', async () => {
    const { api } = createAgentChatApi()
    const { rerender } = renderPanel(api)

    fireEvent.click(await screen.findByRole('button', { name: 'New session' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pin selection' }))

    rerender(
      <AgentChatPanel
        api={api}
        contextManifest={{
          ...contextManifest,
          selectedBlockIds: [],
          selectedText: ''
        }}
        onClose={vi.fn()}
        text={text}
        workspaceRoot="/workspace"
      />
    )
    fireEvent.change(screen.getByLabelText('Message Agent Chat'), {
      target: { value: 'Use pinned context' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(api.sendMessage).toHaveBeenCalled()
    })
    expect(api.sendMessage.mock.calls.at(-1)?.[0].contextManifest.selectedText).toBe(
      'Selected body'
    )
  })

  it('restores the submitted draft and attachments when sending fails', async () => {
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
    expect(screen.getByLabelText('Message Agent Chat')).toHaveValue('What changed?')
    expect(screen.getByText('paste.png')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Agent Chat turn failed. Check Codex and try again.'
    )
  })

  it('keeps a runtime turn failure reason when send rejection follows the failed event', async () => {
    let rejectSend: ((error: Error) => void) | undefined
    const { api: baseApi, emit, session } = createAgentChatApi()
    const api = {
      ...baseApi,
      sendMessage: vi.fn<AgentChatApi['sendMessage']>(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectSend = reject
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
    act(() => {
      emit({
        diagnostic: {
          code: 'turn-failed',
          details: 'Raw adapter failure with private details',
          message: 'Codex session expired. Run codex login status.',
          recoverable: true
        },
        session: {
          ...session,
          state: 'failed'
        },
        type: 'session-failed'
      })
    })
    await act(async () => {
      rejectSend?.(new Error('native failure'))
      await Promise.resolve()
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Agent Chat turn failed: Codex session expired. Run codex login status.'
    )
    expect(screen.getByRole('alert')).not.toHaveTextContent('private details')
  })

  it('shows a specific turn failure diagnostic for failed session events', async () => {
    const { api, emit, session } = createAgentChatApi()

    renderPanel(api)
    fireEvent.click(await screen.findByRole('button', { name: 'New session' }))

    act(() => {
      emit({
        diagnostic: {
          code: 'turn-failed',
          details: 'Raw adapter failure with private details',
          message: 'Codex session expired. Run codex login status.',
          recoverable: true
        },
        session: {
          ...session,
          state: 'failed'
        },
        type: 'session-failed'
      })
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Agent Chat turn failed: Codex session expired. Run codex login status.'
    )
    expect(screen.getByRole('alert')).not.toHaveTextContent('private details')
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

  it('shows changed-file summary status without generic diagnostics', async () => {
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
          available: false,
          diagnostic: {
            code: 'changed-files-unavailable',
            message: 'Changed files unavailable',
            recoverable: true
          },
          files: []
        },
        type: 'changed-files-updated'
      })
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(
      screen.getByText('Changed-file summary unavailable for this turn.')
    ).toBeInTheDocument()
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
