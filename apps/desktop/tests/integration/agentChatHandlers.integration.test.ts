import { describe, expect, it, vi } from 'vitest'

import type {
  AgentChatEvent,
  AgentChatRuntime
} from '@mde/agent-chat'

import { AGENT_CHAT_CHANNELS } from '../../src/main/ipc/channels'
import { registerAgentChatHandlers } from '../../src/main/ipc/registerAgentChatHandlers'

interface TestIpcEvent {
  readonly sender: {
    readonly id: number
    readonly send: ReturnType<typeof vi.fn>
  }
}

type TestIpcHandler = (
  event: TestIpcEvent,
  value: unknown
) => Promise<unknown>

describe('agentChatHandlers integration', () => {
  const createFakeRuntime = () => {
    let listener: ((event: AgentChatEvent) => void) | undefined
    const runtime = {
      createDraftSession: vi.fn<AgentChatRuntime['createDraftSession']>((request) =>
        Promise.resolve({
          createdAt: '2026-05-12T00:00:00.000Z',
          engineId: request.engineId,
          host: request.host,
          permissionMode: 'max-permission',
          sessionId: 'mde-chat-1',
          sessionPurpose: request.sessionPurpose,
          state: 'draft',
          updatedAt: '2026-05-12T00:00:00.000Z',
          workspaceRoot: request.workspaceRoot
        })
      ),
      getAvailability: vi.fn<AgentChatRuntime['getAvailability']>(() =>
        Promise.resolve({
          available: true,
          engineId: 'codex'
        })
      ),
      listSessions: vi.fn<AgentChatRuntime['listSessions']>(() =>
        Promise.resolve([])
      ),
      resumeSession: vi.fn<AgentChatRuntime['resumeSession']>((request) =>
        Promise.resolve({
          createdAt: '2026-05-12T00:00:00.000Z',
          engineId: 'codex',
          host: 'editor',
          nativeSessionId: request.nativeSessionId,
          permissionMode: 'max-permission',
          sessionId: request.sessionId ?? 'mde-chat-1',
          sessionPurpose: 'document-chat',
          state: 'active',
          updatedAt: '2026-05-12T00:00:00.000Z',
          workspaceRoot: request.workspaceRoot
        })
      ),
      saveAttachment: vi.fn<AgentChatRuntime['saveAttachment']>((request) =>
        Promise.resolve({
          attachmentId: 'attachment-1',
          fileName: request.fileName,
          mimeType: request.mimeType,
          safePath: `${request.workspaceRoot}/.mde/agent-chat/${request.sessionId}/attachments/${request.fileName}`,
          sizeBytes: request.bytes.byteLength
        })
      ),
      sendMessage: vi.fn<AgentChatRuntime['sendMessage']>(() => Promise.resolve()),
      stopSession: vi.fn<AgentChatRuntime['stopSession']>(() => Promise.resolve()),
      subscribe: vi.fn<AgentChatRuntime['subscribe']>(
        (_sessionId, eventListener) => {
          listener = eventListener
          return vi.fn()
        }
      )
    } satisfies AgentChatRuntime

    return {
      emit: (event: AgentChatEvent) => listener?.(event),
      runtime
    }
  }

  const registerHandlers = (workspaceRoot = '/workspace') => {
    const handlers = new Map<string, TestIpcHandler>()
    const ipcMain = {
      handle: vi.fn((channel: string, handler: TestIpcHandler) => {
        handlers.set(channel, handler)
      })
    }
    const { emit, runtime } = createFakeRuntime()

    registerAgentChatHandlers({
      getActiveWorkspaceRoot: () => workspaceRoot,
      ipcMain: ipcMain as unknown as Parameters<
        typeof registerAgentChatHandlers
      >[0]['ipcMain'],
      runtime
    })

    return { emit, handlers, runtime }
  }

  it('passes the active workspace root to availability checks', async () => {
    const { handlers, runtime } = registerHandlers()

    await handlers.get(AGENT_CHAT_CHANNELS.getAvailability)?.(
      { sender: { id: 1, send: vi.fn() } },
      { selectedEngineId: 'codex', workspaceRoot: '/workspace' }
    )

    expect(runtime.getAvailability).toHaveBeenCalledWith({
      selectedEngineId: 'codex',
      workspaceRoot: '/workspace'
    })
  })

  it('rejects request workspace mismatches', async () => {
    const { handlers } = registerHandlers('/workspace-a')

    await expect(
      handlers.get(AGENT_CHAT_CHANNELS.getAvailability)?.(
        { sender: { id: 1, send: vi.fn() } },
        { selectedEngineId: 'codex', workspaceRoot: '/workspace-b' }
      )
    ).rejects.toThrow('Workspace changed before Agent Chat operation completed')
  })

  it('rejects caller-provided arbitrary attachment paths', async () => {
    const { handlers } = registerHandlers()

    await expect(
      handlers.get(AGENT_CHAT_CHANNELS.saveAttachment)?.(
        { sender: { id: 1, send: vi.fn() } },
        {
          bytes: new Uint8Array([1]),
          fileName: 'paste.png',
          mimeType: 'image/png',
          path: '/tmp/secret.png',
          sessionId: 'mde-chat-1',
          workspaceRoot: '/workspace'
        }
      )
    ).rejects.toThrow('Attachment request must not include local paths')
  })

  it('passes only runtime-cache attachment records through sendMessage', async () => {
    const { handlers, runtime } = registerHandlers()
    const attachment = {
      attachmentId: 'attachment-1',
      fileName: 'paste.png',
      mimeType: 'image/png',
      safePath: '/workspace/.mde/agent-chat/mde-chat-1/attachments/paste.png',
      sizeBytes: 3
    }

    await handlers.get(AGENT_CHAT_CHANNELS.sendMessage)?.(
      { sender: { id: 1, send: vi.fn() } },
      {
        attachments: [attachment],
        content: 'Use this image',
        contextManifest: {
          currentDocumentSnapshot: '# Doc',
          permissionMode: 'max-permission',
          selectedBlockIds: [],
          selectedText: '',
          sessionPurpose: 'document-chat',
          workspaceRoot: '/workspace'
        },
        sessionId: 'mde-chat-1',
        workspaceRoot: '/workspace'
      }
    )

    expect(runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [attachment]
      })
    )
  })

  it('rejects sendMessage attachments outside the MDE session cache', async () => {
    const { handlers } = registerHandlers()

    await expect(
      handlers.get(AGENT_CHAT_CHANNELS.sendMessage)?.(
        { sender: { id: 1, send: vi.fn() } },
        {
          attachments: [
            {
              attachmentId: 'attachment-1',
              fileName: 'secret.png',
              mimeType: 'image/png',
              safePath: '/tmp/secret.png',
              sizeBytes: 3
            }
          ],
          content: 'Use this image',
          contextManifest: {
            currentDocumentSnapshot: '# Doc',
            permissionMode: 'max-permission',
            selectedBlockIds: [],
            selectedText: '',
            sessionPurpose: 'document-chat',
            workspaceRoot: '/workspace'
          },
          sessionId: 'mde-chat-1',
          workspaceRoot: '/workspace'
        }
      )
    ).rejects.toThrow('Attachment path must stay inside the Agent Chat cache')
  })

  it('delegates resume and normalized events through the runtime', async () => {
    const sender = { id: 1, send: vi.fn() }
    const { emit, handlers, runtime } = registerHandlers()
    const session = await handlers.get(AGENT_CHAT_CHANNELS.resumeSession)?.(
      { sender },
      {
        nativeSessionId: 'thread-1',
        sessionId: 'mde-chat-1',
        workspaceRoot: '/workspace'
      }
    )

    const event: AgentChatEvent = {
      diagnostic: {
        code: 'protocol-unsupported',
        message: 'Unsupported',
        recoverable: false
      },
      sessionId: 'mde-chat-1',
      type: 'diagnostic'
    }
    emit(event)

    expect(session).toMatchObject({ nativeSessionId: 'thread-1' })
    expect(runtime.resumeSession).toHaveBeenCalled()
    expect(sender.send).toHaveBeenCalledWith(AGENT_CHAT_CHANNELS.event, event)
  })
})
