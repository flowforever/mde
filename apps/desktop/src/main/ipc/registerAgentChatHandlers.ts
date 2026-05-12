import type { IpcMain, IpcMainInvokeEvent } from 'electron'

import type {
  AgentChatAttachment,
  AgentChatAvailabilityResponse,
  AgentChatChangedFilesSummary,
  AgentChatAvailabilityRequest,
  AgentChatCreateDraftSessionRequest,
  AgentChatDiagnostic,
  AgentChatEvent,
  AgentChatListSessionsRequest,
  AgentChatReleaseWorkspaceSubscriptionsRequest,
  AgentChatResumeSessionRequest,
  AgentChatRuntime,
  AgentChatSaveAttachmentRequest,
  AgentChatSendMessageRequest,
  AgentChatStopSessionRequest
} from '@mde/agent-chat'
import { isAttachmentInsideSessionCache } from '@mde/agent-chat'

import { AGENT_CHAT_CHANNELS } from './channels'

interface RegisterAgentChatHandlersOptions {
  readonly getActiveWorkspaceRoot: (
    event?: Pick<IpcMainInvokeEvent, 'sender'> | null
  ) => string | null
  readonly ipcMain: Pick<IpcMain, 'handle'>
  readonly runtime: AgentChatRuntime
}

const assertRecord = (value: unknown, name: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`)
  }
  return value as Record<string, unknown>
}

const assertString = (value: unknown, name: string): string => {
  if (typeof value !== 'string') {
    throw new Error(`${name} must be a string`)
  }
  return value
}

const assertOptionalString = (
  value: unknown,
  name: string
): string | undefined => {
  if (value === undefined) {
    return undefined
  }
  return assertString(value, name)
}

const assertStringArray = (value: unknown, name: string): readonly string[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array`)
  }
  return Object.freeze(value.map((item) => assertString(item, name)))
}

const getSenderId = (sender: Pick<IpcMainInvokeEvent['sender'], 'id'>): string => {
  const rawSenderId = sender.id

  return typeof rawSenderId === 'number' || typeof rawSenderId === 'string'
    ? String(rawSenderId)
    : ''
}

const assertBytes = (value: unknown): Uint8Array => {
  if (value instanceof Uint8Array) {
    return value
  }
  throw new Error('Attachment bytes must be a Uint8Array')
}

const getRequiredWorkspaceRoot = (
  event: Pick<IpcMainInvokeEvent, 'sender'>,
  getActiveWorkspaceRoot: RegisterAgentChatHandlersOptions['getActiveWorkspaceRoot'],
  expectedWorkspaceRoot: string
): string => {
  const activeWorkspaceRoot = getActiveWorkspaceRoot(event)

  if (!activeWorkspaceRoot) {
    throw new Error('Open a workspace before using Agent Chat')
  }

  if (activeWorkspaceRoot !== expectedWorkspaceRoot) {
    throw new Error('Workspace changed before Agent Chat operation completed')
  }

  return activeWorkspaceRoot
}

const assertAvailabilityRequest = (
  value: unknown
): AgentChatAvailabilityRequest => {
  const request = assertRecord(value, 'Agent Chat availability request')
  const selectedEngineId = assertString(
    request.selectedEngineId,
    'Selected engine id'
  )

  if (selectedEngineId !== 'codex' && selectedEngineId !== 'claude') {
    throw new Error('Selected engine id must be codex or claude')
  }

  return {
    ...(assertOptionalString(request.modelName, 'Model name')
      ? { modelName: assertOptionalString(request.modelName, 'Model name') }
      : {}),
    selectedEngineId,
    workspaceRoot: assertString(request.workspaceRoot, 'Workspace root')
  }
}

const assertCreateDraftRequest = (
  value: unknown
): AgentChatCreateDraftSessionRequest => {
  const request = assertRecord(value, 'Agent Chat draft request')
  if (request.engineId !== 'codex') {
    throw new Error('Editor Agent Chat V1 only supports Codex')
  }

  return {
    engineId: 'codex',
    host: request.host === 'automation-center' ? 'automation-center' : 'editor',
    sessionPurpose:
      request.sessionPurpose === 'automation-task'
        ? 'automation-task'
        : request.sessionPurpose === 'debug'
          ? 'debug'
          : 'document-chat',
    workspaceRoot: assertString(request.workspaceRoot, 'Workspace root')
  }
}

const assertContextManifest = (
  value: unknown
): AgentChatSendMessageRequest['contextManifest'] => {
  const manifest = assertRecord(value, 'Agent Chat context manifest')
  return {
    ...(manifest.currentDocumentPath !== undefined
      ? {
          currentDocumentPath: assertString(
            manifest.currentDocumentPath,
            'Current document path'
          )
        }
      : {}),
    currentDocumentSnapshot: assertString(
      manifest.currentDocumentSnapshot,
      'Current document snapshot'
    ),
    ...(manifest.modelName !== undefined
      ? { modelName: assertString(manifest.modelName, 'Model name') }
      : {}),
    permissionMode: 'max-permission',
    selectedBlockIds: assertStringArray(
      manifest.selectedBlockIds,
      'Selected block ids'
    ),
    selectedText: assertString(manifest.selectedText, 'Selected text'),
    sessionPurpose: 'document-chat',
    workspaceRoot: assertString(manifest.workspaceRoot, 'Workspace root')
  }
}

const assertSaveAttachmentRequest = (
  value: unknown
): AgentChatSaveAttachmentRequest => {
  const request = assertRecord(value, 'Agent Chat attachment request')
  if ('path' in request || 'safePath' in request) {
    throw new Error('Attachment request must not include local paths')
  }

  return {
    bytes: assertBytes(request.bytes),
    fileName: assertString(request.fileName, 'Attachment file name'),
    mimeType: assertString(request.mimeType, 'Attachment MIME type'),
    sessionId: assertString(request.sessionId, 'Session id'),
    workspaceRoot: assertString(request.workspaceRoot, 'Workspace root')
  }
}

const assertSendMessageAttachments = (input: {
  readonly sessionId: string
  readonly value: unknown
  readonly workspaceRoot: string
}): readonly AgentChatAttachment[] | undefined => {
  if (input.value === undefined) {
    return undefined
  }

  if (!Array.isArray(input.value)) {
    throw new Error('Message attachments must be an array')
  }

  return Object.freeze(
    input.value.map((value) => {
      const attachment = assertRecord(value, 'Message attachment')
      const safePath = assertString(attachment.safePath, 'Attachment safe path')
      if (
        !isAttachmentInsideSessionCache({
          candidatePath: safePath,
          sessionId: input.sessionId,
          workspaceRoot: input.workspaceRoot
        })
      ) {
        throw new Error('Attachment path must stay inside the Agent Chat cache')
      }
      if (
        typeof attachment.sizeBytes !== 'number' ||
        !Number.isFinite(attachment.sizeBytes) ||
        attachment.sizeBytes < 0
      ) {
        throw new Error('Attachment size must be a non-negative number')
      }

      return Object.freeze({
        attachmentId: assertString(attachment.attachmentId, 'Attachment id'),
        fileName: assertString(attachment.fileName, 'Attachment file name'),
        mimeType: assertString(attachment.mimeType, 'Attachment MIME type'),
        safePath,
        sizeBytes: attachment.sizeBytes
      })
    })
  )
}

const assertListSessionsRequest = (
  value: unknown
): AgentChatListSessionsRequest => {
  const request = assertAvailabilityRequest(value)
  return {
    selectedEngineId: request.selectedEngineId,
    workspaceRoot: request.workspaceRoot
  }
}

const assertReleaseWorkspaceSubscriptionsRequest = (
  value: unknown
): AgentChatReleaseWorkspaceSubscriptionsRequest => {
  const request = assertRecord(value, 'Agent Chat subscription release request')
  return {
    workspaceRoot: assertString(request.workspaceRoot, 'Workspace root')
  }
}

const assertSendMessageRequest = (
  value: unknown
): AgentChatSendMessageRequest => {
  const request = assertRecord(value, 'Agent Chat send request')
  const sessionId = assertString(request.sessionId, 'Session id')
  const workspaceRoot = assertString(request.workspaceRoot, 'Workspace root')
  const attachments = assertSendMessageAttachments({
    sessionId,
    value: request.attachments,
    workspaceRoot
  })
  return {
    ...(attachments ? { attachments } : {}),
    contextManifest: assertContextManifest(request.contextManifest),
    content: assertString(request.content, 'Message content'),
    ...(request.modelName !== undefined
      ? { modelName: assertString(request.modelName, 'Model name') }
      : {}),
    sessionId,
    workspaceRoot
  }
}

const assertContextMatchesWorkspace = (
  contextManifest: AgentChatSendMessageRequest['contextManifest'],
  workspaceRoot: string
): void => {
  if (contextManifest.workspaceRoot !== workspaceRoot) {
    throw new Error('Agent Chat context workspace must match active workspace')
  }
}

const sanitizeDiagnosticForRenderer = (
  diagnostic: AgentChatDiagnostic
): AgentChatDiagnostic =>
  Object.freeze({
    code: diagnostic.code,
    message: diagnostic.message,
    recoverable: diagnostic.recoverable
  })

const sanitizeChangedFilesSummaryForRenderer = (
  summary: AgentChatChangedFilesSummary
): AgentChatChangedFilesSummary =>
  Object.freeze({
    available: summary.available,
    ...(summary.diagnostic
      ? { diagnostic: sanitizeDiagnosticForRenderer(summary.diagnostic) }
      : {}),
    files: summary.files
  })

const sanitizeAvailabilityForRenderer = (
  availability: AgentChatAvailabilityResponse
): AgentChatAvailabilityResponse =>
  Object.freeze({
    available: availability.available,
    ...(availability.diagnostic
      ? { diagnostic: sanitizeDiagnosticForRenderer(availability.diagnostic) }
      : {}),
    ...(availability.engineId ? { engineId: availability.engineId } : {}),
    ...(availability.reason ? { reason: availability.reason } : {})
  })

const sanitizeEventForRenderer = (event: AgentChatEvent): AgentChatEvent => {
  if (event.type === 'session-failed') {
    return Object.freeze({
      diagnostic: sanitizeDiagnosticForRenderer(event.diagnostic),
      session: event.session,
      type: event.type
    })
  }

  if (event.type === 'diagnostic') {
    return Object.freeze({
      diagnostic: sanitizeDiagnosticForRenderer(event.diagnostic),
      ...(event.sessionId ? { sessionId: event.sessionId } : {}),
      type: event.type
    })
  }

  if (event.type === 'changed-files-updated') {
    return Object.freeze({
      sessionId: event.sessionId,
      summary: sanitizeChangedFilesSummaryForRenderer(event.summary),
      type: event.type
    })
  }

  return event
}

const assertResumeSessionRequest = (
  value: unknown
): AgentChatResumeSessionRequest => {
  const request = assertRecord(value, 'Agent Chat resume request')
  return {
    ...(request.contextManifest !== undefined
      ? { contextManifest: assertContextManifest(request.contextManifest) }
      : {}),
    ...(request.content !== undefined
      ? { content: assertString(request.content, 'Message content') }
      : {}),
    ...(request.modelName !== undefined
      ? { modelName: assertString(request.modelName, 'Model name') }
      : {}),
    ...(request.nativeSessionId !== undefined
      ? {
          nativeSessionId: assertString(
            request.nativeSessionId,
            'Native session id'
          )
        }
      : {}),
    ...(request.sessionId !== undefined
      ? { sessionId: assertString(request.sessionId, 'Session id') }
      : {}),
    workspaceRoot: assertString(request.workspaceRoot, 'Workspace root')
  }
}

const assertStopSessionRequest = (
  value: unknown
): AgentChatStopSessionRequest => {
  const request = assertRecord(value, 'Agent Chat stop request')
  return {
    sessionId: assertString(request.sessionId, 'Session id'),
    workspaceRoot: assertString(request.workspaceRoot, 'Workspace root')
  }
}

export const registerAgentChatHandlers = ({
  getActiveWorkspaceRoot,
  ipcMain,
  runtime
}: RegisterAgentChatHandlersOptions): void => {
  const subscriptions = new Map<string, () => void>()

  const cleanupSubscription = (key: string): void => {
    const unsubscribe = subscriptions.get(key)
    if (!unsubscribe) {
      return
    }
    unsubscribe()
    subscriptions.delete(key)
  }

  const cleanupWorkspaceSubscriptions = (
    sender: Pick<IpcMainInvokeEvent['sender'], 'id'>,
    workspaceRoot: string
  ): void => {
    const senderId = getSenderId(sender)
    if (!senderId) {
      return
    }

    const workspacePrefix = `${workspaceRoot}:`
    const senderSuffix = `:${senderId}`
    for (const key of subscriptions.keys()) {
      if (key.startsWith(workspacePrefix) && key.endsWith(senderSuffix)) {
        cleanupSubscription(key)
      }
    }
  }

  const ensureSubscribed = (
    event: Pick<IpcMainInvokeEvent, 'sender'>,
    sessionId: string,
    workspaceRoot: string
  ): void => {
    const sender = event.sender as IpcMainInvokeEvent['sender'] & {
      readonly isDestroyed?: () => boolean
      readonly off?: (eventName: 'destroyed', listener: () => void) => unknown
      readonly once?: (eventName: 'destroyed', listener: () => void) => unknown
      readonly removeListener?: (
        eventName: 'destroyed',
        listener: () => void
      ) => unknown
    }
    const isSenderDestroyed = (): boolean =>
      typeof sender.isDestroyed === 'function' ? sender.isDestroyed() : false

    if (isSenderDestroyed()) {
      return
    }

    const senderId = getSenderId(sender)
    if (!senderId) {
      return
    }

    const key = `${workspaceRoot}:${sessionId}:${senderId}`
    if (subscriptions.has(key)) {
      return
    }
    const destroyedListener = (): void => {
      cleanupSubscription(key)
    }
    const removeDestroyedListener = (): void => {
      if (typeof sender.off === 'function') {
        sender.off('destroyed', destroyedListener)
        return
      }

      sender.removeListener?.('destroyed', destroyedListener)
    }
    const unsubscribe = runtime.subscribe(sessionId, (payload: AgentChatEvent) => {
      if (
        isSenderDestroyed() ||
        getActiveWorkspaceRoot({ sender }) !== workspaceRoot
      ) {
        cleanupSubscription(key)
        return
      }
      sender.send(AGENT_CHAT_CHANNELS.event, sanitizeEventForRenderer(payload))
    })
    subscriptions.set(key, () => {
      unsubscribe()
      removeDestroyedListener()
    })
    sender.once?.('destroyed', destroyedListener)
  }

  ipcMain.handle(AGENT_CHAT_CHANNELS.getAvailability, async (event, value) => {
    const request = assertAvailabilityRequest(value)
    const workspaceRoot = getRequiredWorkspaceRoot(
      event,
      getActiveWorkspaceRoot,
      request.workspaceRoot
    )
    if (request.selectedEngineId !== 'codex') {
      return {
        available: false,
        reason: 'engine-not-selected'
      }
    }
    return sanitizeAvailabilityForRenderer(
      await runtime.getAvailability({ ...request, workspaceRoot })
    )
  })

  ipcMain.handle(AGENT_CHAT_CHANNELS.createDraftSession, async (event, value) => {
    const request = assertCreateDraftRequest(value)
    const workspaceRoot = getRequiredWorkspaceRoot(
      event,
      getActiveWorkspaceRoot,
      request.workspaceRoot
    )
    const session = await runtime.createDraftSession({ ...request, workspaceRoot })
    ensureSubscribed(event, session.sessionId, workspaceRoot)
    return session
  })

  ipcMain.handle(AGENT_CHAT_CHANNELS.listSessions, async (event, value) => {
    const request = assertListSessionsRequest(value)
    const workspaceRoot = getRequiredWorkspaceRoot(
      event,
      getActiveWorkspaceRoot,
      request.workspaceRoot
    )
    return runtime.listSessions({ ...request, workspaceRoot })
  })

  ipcMain.handle(
    AGENT_CHAT_CHANNELS.releaseWorkspaceSubscriptions,
    (event, value) => {
      const request = assertReleaseWorkspaceSubscriptionsRequest(value)
      cleanupWorkspaceSubscriptions(event.sender, request.workspaceRoot)
    }
  )

  ipcMain.handle(AGENT_CHAT_CHANNELS.saveAttachment, async (event, value) => {
    const request = assertSaveAttachmentRequest(value)
    const workspaceRoot = getRequiredWorkspaceRoot(
      event,
      getActiveWorkspaceRoot,
      request.workspaceRoot
    )
    ensureSubscribed(event, request.sessionId, workspaceRoot)
    return runtime.saveAttachment({ ...request, workspaceRoot })
  })

  ipcMain.handle(AGENT_CHAT_CHANNELS.sendMessage, async (event, value) => {
    const request = assertSendMessageRequest(value)
    const workspaceRoot = getRequiredWorkspaceRoot(
      event,
      getActiveWorkspaceRoot,
      request.workspaceRoot
    )
    assertContextMatchesWorkspace(request.contextManifest, workspaceRoot)
    ensureSubscribed(event, request.sessionId, workspaceRoot)
    await runtime.sendMessage({ ...request, workspaceRoot })
  })

  ipcMain.handle(AGENT_CHAT_CHANNELS.resumeSession, async (event, value) => {
    const request = assertResumeSessionRequest(value)
    const workspaceRoot = getRequiredWorkspaceRoot(
      event,
      getActiveWorkspaceRoot,
      request.workspaceRoot
    )
    if (request.contextManifest) {
      assertContextMatchesWorkspace(request.contextManifest, workspaceRoot)
    }
    if (request.sessionId) {
      ensureSubscribed(event, request.sessionId, workspaceRoot)
    }
    const session = await runtime.resumeSession({ ...request, workspaceRoot })
    ensureSubscribed(event, session.sessionId, workspaceRoot)
    return session
  })

  ipcMain.handle(AGENT_CHAT_CHANNELS.stopSession, async (event, value) => {
    const request = assertStopSessionRequest(value)
    const workspaceRoot = getRequiredWorkspaceRoot(
      event,
      getActiveWorkspaceRoot,
      request.workspaceRoot
    )
    ensureSubscribed(event, request.sessionId, workspaceRoot)
    await runtime.stopSession({ ...request, workspaceRoot })
  })
}
