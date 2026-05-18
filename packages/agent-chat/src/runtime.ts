import { dirname } from 'node:path'

import { createAttachmentCachePath, sanitizeAttachmentFileName } from './attachments'
import { captureChangedFilesAroundTurn } from './changedFiles'
import {
  createAgentChatDiagnostic,
  createAgentChatTurnFailedMessage,
  getAgentChatErrorDetails,
  isAgentChatExecutableMissingError
} from './diagnostics'
import type { AgentChatFileStore, AgentChatWorkspaceSnapshotProvider } from './host'
import { filterNativeSessionsForWorkspace } from './nativeHistory'
import { createDraftAgentChatSession, reduceAgentChatState } from './sessionReducer'
import {
  createMemoryAgentChatMetadataStorage,
  type AgentChatMetadataStorage
} from './storage'
import type {
  AgentChatAttachment,
  AgentChatAvailabilityRequest,
  AgentChatAvailabilityResponse,
  AgentChatCapabilityProbeInput,
  AgentChatCapabilityReport,
  AgentChatChangedFilesSummary,
  AgentChatCreateDraftSessionRequest,
  AgentChatEngineAdapter,
  AgentChatEngineEvent,
  AgentChatEvent,
  AgentChatListSessionsRequest,
  AgentChatResumeSessionRequest,
  AgentChatSaveAttachmentRequest,
  AgentChatSendMessageRequest,
  AgentChatSession,
  AgentChatState,
  AgentChatStopSessionRequest
} from './types'

export type AgentChatRuntimeEventListener = (event: AgentChatEvent) => void

export interface AgentChatRuntime {
  readonly createDraftSession: (
    request: AgentChatCreateDraftSessionRequest
  ) => Promise<AgentChatSession>
  readonly getAvailability: (
    request: AgentChatAvailabilityRequest
  ) => Promise<AgentChatAvailabilityResponse>
  readonly listSessions: (
    request: AgentChatListSessionsRequest
  ) => Promise<readonly AgentChatSession[]>
  readonly resumeSession: (
    request: AgentChatResumeSessionRequest
  ) => Promise<AgentChatSession>
  readonly saveAttachment: (
    request: AgentChatSaveAttachmentRequest
  ) => Promise<AgentChatAttachment>
  readonly sendMessage: (request: AgentChatSendMessageRequest) => Promise<void>
  readonly stopSession: (request: AgentChatStopSessionRequest) => Promise<void>
  readonly subscribe: (
    sessionId: string,
    listener: AgentChatRuntimeEventListener
  ) => () => void
}

export interface AgentChatRuntimeOptions {
  readonly adapters: readonly AgentChatEngineAdapter[]
  readonly fileStore: AgentChatFileStore
  readonly metadataStorage?: AgentChatMetadataStorage
  readonly now: () => string
  readonly snapshotProvider?: AgentChatWorkspaceSnapshotProvider
}

const normalizeOptionalText = (value?: string): string | undefined => {
  const normalized = value?.trim()
  if (!normalized) {
    return undefined
  }
  return normalized
}

const createSessionTitleFromMessage = (content: string): string | undefined => {
  const normalized = content.trim().replace(/\s+/g, ' ')

  if (!normalized) {
    return undefined
  }

  return normalized.length > 64 ? `${normalized.slice(0, 61)}...` : normalized
}

const getSession = (
  state: AgentChatState,
  sessionId: string,
  workspaceRoot: string
): AgentChatSession | undefined =>
  state.sessions.find(
    (session) =>
      session.sessionId === sessionId && session.workspaceRoot === workspaceRoot
  )

const createAttachmentId = (sessionId: string, fileName: string): string =>
  `${sessionId}-${fileName.replace(/[^0-9a-z.-]/gi, '-').toLowerCase()}`

const createAvailabilityCacheKey = (input: {
  readonly capabilityIdentity?: string
  readonly modelName?: string
  readonly selectedEngineId: string
}): string =>
  [
    input.selectedEngineId,
    normalizeOptionalText(input.modelName) ?? '',
    input.capabilityIdentity ?? ''
  ].join(':')

const mapCapabilityReportToAvailability = (
  report: AgentChatCapabilityReport
): AgentChatAvailabilityResponse =>
  report.verdict === 'supported' && report.authenticated !== false
    ? {
        available: true,
        engineId: report.engineId
      }
    : {
        available: false,
        diagnostic: report.diagnostic,
        engineId: report.engineId,
        reason:
          report.authenticated === false
            ? 'authentication-required'
            : 'protocol-unsupported'
      }

const mapCapabilityIdentityErrorToAvailability = (
  adapter: AgentChatEngineAdapter,
  error: unknown
): AgentChatAvailabilityResponse | undefined => {
  if (!isAgentChatExecutableMissingError(error)) {
    return undefined
  }

  return mapCapabilityReportToAvailability({
    diagnostic: createAgentChatDiagnostic({
      code: 'engine-missing',
      details: getAgentChatErrorDetails(error),
      recoverable: true
    }),
    engineId: adapter.engineId,
    verdict: 'unsupported'
  })
}

export const createAgentChatRuntime = (
  options: AgentChatRuntimeOptions
): AgentChatRuntime => {
  const adapters = new Map(
    options.adapters.map((adapter) => [adapter.engineId, adapter] as const)
  )
  const metadataStorage =
    options.metadataStorage ?? createMemoryAgentChatMetadataStorage()
  const listenersBySession = new Map<
    string,
    Set<AgentChatRuntimeEventListener>
  >()
  const capabilityReportsByKey = new Map<string, AgentChatCapabilityReport>()
  const inFlightCapabilityReportsByKey = new Map<
    string,
    Promise<AgentChatCapabilityReport>
  >()
  let state: AgentChatState = Object.freeze({
    messages: Object.freeze([]),
    sessions: Object.freeze([])
  })

  const emit = (event: AgentChatEvent): void => {
    state = reduceAgentChatState(state, event)

    if ('sessionId' in event && event.sessionId) {
      listenersBySession.get(event.sessionId)?.forEach((listener) => listener(event))
      return
    }

    if ('session' in event) {
      listenersBySession
        .get(event.session.sessionId)
        ?.forEach((listener) => listener(event))
      return
    }

    if ('message' in event) {
      listenersBySession
        .get(event.message.sessionId)
        ?.forEach((listener) => listener(event))
    }
  }

  const updateSession = (session: AgentChatSession): AgentChatSession => {
    const event: AgentChatEvent = {
      session,
      type: 'session-updated'
    }
    emit(event)
    return session
  }

  const handleEngineEvent = async (
    session: AgentChatSession,
    event: AgentChatEngineEvent
  ): Promise<AgentChatSession> => {
    if (event.type === 'session-started') {
      const activeSession = {
        ...session,
        nativeSessionId: event.nativeSessionId,
        state: 'active',
        ...(event.title ? { title: event.title } : {}),
        updatedAt: options.now()
      } satisfies AgentChatSession

      await metadataStorage.bindNativeSession({
        nativeSessionId: event.nativeSessionId,
        sessionId: activeSession.sessionId,
        updatedAt: activeSession.updatedAt,
        workspaceRoot: activeSession.workspaceRoot
      })

      emit({
        session: activeSession,
        type: 'session-started'
      })

      return activeSession
    }

    if (event.type === 'assistant-message-delta') {
      emit(event)
      return session
    }

    if (event.type === 'message-created') {
      emit(event)
      return session
    }

    if (event.type === 'assistant-message-completed') {
      emit(event)
      return session
    }

    if (event.type === 'thinking-updated') {
      emit(event)
      return session
    }

    if (event.type === 'changed-files-updated') {
      emit(event)
      return session
    }

    if (event.type === 'diagnostic') {
      emit(event)
      if (session.state === 'native-starting' || session.state === 'stopping') {
        const failedSession = {
          ...session,
          state: 'failed',
          updatedAt: options.now()
        } satisfies AgentChatSession
        emit({
          diagnostic: event.diagnostic,
          session: failedSession,
          type: 'session-failed'
        })
        return failedSession
      }
      return session
    }

    if (event.type === 'session-stopped') {
      const stoppedSession = {
        ...session,
        state: 'stopped',
        updatedAt: options.now()
      } satisfies AgentChatSession
      emit({
        session: stoppedSession,
        type: 'session-stopped'
      })
      return stoppedSession
    }

    return session
  }

  const runEngineEvents = async (
    session: AgentChatSession,
    events: AsyncIterable<AgentChatEngineEvent>
  ): Promise<AgentChatSession> => {
    let currentSession = session
    for await (const event of events) {
      currentSession = await handleEngineEvent(currentSession, event)
    }
    return currentSession
  }

  const emitChangedFiles = (
    sessionId: string,
    summary: AgentChatChangedFilesSummary
  ): void => {
    emit({
      sessionId,
      summary,
      type: 'changed-files-updated'
    })
  }

  const runWithChangedFileSummary = async <T>(
    sessionId: string,
    workspaceRoot: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    if (!options.snapshotProvider) {
      return operation()
    }

    const { result, summary } = await captureChangedFilesAroundTurn({
      operation,
      snapshotProvider: options.snapshotProvider,
      workspaceRoot
    })
    emitChangedFiles(sessionId, summary)
    return result
  }

  const getCachedCapabilityReport = async (input: {
    readonly adapter: AgentChatEngineAdapter
    readonly cacheKey: string
    readonly probeInput: AgentChatCapabilityProbeInput
    readonly workspaceRoot: string
  }): Promise<AgentChatCapabilityReport> => {
    const cachedReport = capabilityReportsByKey.get(input.cacheKey)
    if (cachedReport) {
      return cachedReport
    }

    const persistedReport = await metadataStorage.readCapabilityReport?.({
      cacheKey: input.cacheKey,
      workspaceRoot: input.workspaceRoot
    })
    if (persistedReport) {
      capabilityReportsByKey.set(input.cacheKey, persistedReport)
      return persistedReport
    }

    const inFlightReport = inFlightCapabilityReportsByKey.get(input.cacheKey)
    if (inFlightReport) {
      return inFlightReport
    }

    const reportPromise = input.adapter
      .probeCapabilities(input.probeInput)
      .then(async (report) => {
        capabilityReportsByKey.set(input.cacheKey, report)
        await metadataStorage.writeCapabilityReport?.({
          cacheKey: input.cacheKey,
          report,
          updatedAt: options.now(),
          workspaceRoot: input.workspaceRoot
        })
        return report
      })
      .finally(() => {
        inFlightCapabilityReportsByKey.delete(input.cacheKey)
      })
    inFlightCapabilityReportsByKey.set(input.cacheKey, reportPromise)
    return reportPromise
  }

  return {
    createDraftSession: (request) => {
      const session = createDraftAgentChatSession({
        ...request,
        now: options.now
      })
      state = Object.freeze({
        messages: state.messages,
        sessions: Object.freeze([...state.sessions, session])
      })
      return Promise.resolve(session)
    },
    getAvailability: async (request) => {
      if (!request.workspaceRoot.trim()) {
        return {
          available: false,
          diagnostic: createAgentChatDiagnostic({ code: 'workspace-missing' }),
          reason: 'workspace-missing'
        }
      }

      const adapter = adapters.get(request.selectedEngineId)
      if (!adapter) {
        return {
          available: false,
          diagnostic: createAgentChatDiagnostic({
            code: 'engine-not-registered',
            recoverable: false
          }),
          reason: 'engine-not-registered'
        }
      }

      const modelName = normalizeOptionalText(request.modelName)
      let capabilityIdentity: string | undefined
      try {
        capabilityIdentity = await adapter.createCapabilityCacheKey?.({
          modelName,
          workspaceRoot: request.workspaceRoot
        })
      } catch (error) {
        const availability = mapCapabilityIdentityErrorToAvailability(adapter, error)
        if (availability) {
          return availability
        }
        throw error
      }
      const report = await getCachedCapabilityReport({
        adapter,
        cacheKey: createAvailabilityCacheKey({
          capabilityIdentity,
          modelName,
          selectedEngineId: request.selectedEngineId
        }),
        probeInput: {
          modelName,
          workspaceRoot: request.workspaceRoot
        },
        workspaceRoot: request.workspaceRoot
      })

      return mapCapabilityReportToAvailability(report)
    },
    listSessions: async (request) => {
      const adapter = adapters.get(request.selectedEngineId)
      const localSessions = state.sessions.filter(
        (session) =>
          session.workspaceRoot === request.workspaceRoot &&
          session.engineId === request.selectedEngineId
      )
      const bindings = await metadataStorage.listBindings(request.workspaceRoot)
      const bindingByNativeSessionId = new Map(
        bindings.map((binding) => [binding.nativeSessionId, binding] as const)
      )
      const allNativeSessions = adapter
        ? await adapter
            .listNativeSessions({
              workspaceRoot: request.workspaceRoot
            })
            .catch(() => [])
        : []
      const cwdMatchedNativeSessionIds = new Set(
        filterNativeSessionsForWorkspace({
          sessions: allNativeSessions,
          workspaceRoot: request.workspaceRoot
        }).map((session) => session.nativeSessionId)
      )
      const nativeSessions = [
        ...allNativeSessions.filter(
          (session) =>
            cwdMatchedNativeSessionIds.has(session.nativeSessionId) ||
            bindingByNativeSessionId.has(session.nativeSessionId)
        ),
        ...bindings
          .filter(
            (binding) =>
              !allNativeSessions.some(
                (session) => session.nativeSessionId === binding.nativeSessionId
              )
          )
          .map((binding) => ({
            nativeSessionId: binding.nativeSessionId,
            title: undefined,
            updatedAt: binding.updatedAt
          }))
      ]
      const existingSessionIds = new Set(localSessions.map((session) => session.sessionId))
      const nativeBackedSessions = nativeSessions.flatMap((nativeSession) => {
        const binding = bindingByNativeSessionId.get(nativeSession.nativeSessionId)
        const sessionId =
          binding?.sessionId ?? `mde-native-${nativeSession.nativeSessionId}`
        if (existingSessionIds.has(sessionId)) {
          return []
        }
        return [
          Object.freeze({
            createdAt: nativeSession.updatedAt ?? options.now(),
            engineId: request.selectedEngineId,
            host: 'editor' as const,
            nativeSessionId: nativeSession.nativeSessionId,
            permissionMode: 'max-permission' as const,
            sessionId,
            sessionPurpose: 'document-chat' as const,
            state: 'stopped' as const,
            ...(nativeSession.title ? { title: nativeSession.title } : {}),
            updatedAt: nativeSession.updatedAt ?? options.now(),
            workspaceRoot: request.workspaceRoot
          })
        ]
      })
      state = Object.freeze({
        messages: state.messages,
        sessions: Object.freeze([...state.sessions, ...nativeBackedSessions])
      })
      return Object.freeze([...localSessions, ...nativeBackedSessions])
    },
    resumeSession: async (request) => {
      const session = request.sessionId
        ? getSession(state, request.sessionId, request.workspaceRoot)
        : undefined
      const nativeSessionId = request.nativeSessionId ?? session?.nativeSessionId

      if (!session || !nativeSessionId) {
        throw new Error('Agent Chat session is not resumable')
      }

      const adapter = adapters.get(session.engineId)
      if (!adapter) {
        throw new Error('Agent Chat engine is not registered')
      }

      const startingSession = updateSession({
        ...session,
        state: 'native-starting',
        updatedAt: options.now()
      })

      return runWithChangedFileSummary(
        startingSession.sessionId,
        request.workspaceRoot,
        () =>
          runEngineEvents(
            startingSession,
            adapter.resumeSession({
              content: request.content,
              contextManifest: request.contextManifest,
              modelName: normalizeOptionalText(
                request.modelName ?? request.contextManifest?.modelName
              ),
              nativeSessionId,
              session: startingSession,
              workspaceRoot: request.workspaceRoot
            })
          )
      )
    },
    saveAttachment: async (request) => {
      const session = getSession(state, request.sessionId, request.workspaceRoot)
      if (!session) {
        throw new Error('Agent Chat session not found')
      }

      const fileName = sanitizeAttachmentFileName(request.fileName)
      const safePath = createAttachmentCachePath({
        fileName,
        sessionId: session.sessionId,
        workspaceRoot: request.workspaceRoot
      })
      const directoryPath = dirname(safePath)
      await options.fileStore.mkdir(directoryPath)
      await options.fileStore.writeFile(safePath, request.bytes)

      return Object.freeze({
        attachmentId: createAttachmentId(session.sessionId, fileName),
        fileName,
        mimeType: request.mimeType,
        safePath,
        sizeBytes: request.bytes.byteLength
      })
    },
    sendMessage: async (request) => {
      const session = getSession(state, request.sessionId, request.workspaceRoot)
      if (!session) {
        throw new Error('Agent Chat session not found')
      }

      const adapter = adapters.get(session.engineId)
      if (!adapter) {
        throw new Error('Agent Chat engine is not registered')
      }

      emit({
        message: {
          attachments: request.attachments ?? [],
          content: request.content,
          createdAt: options.now(),
          messageId: `user-${session.sessionId}-${Date.now()}`,
          role: 'user',
          sessionId: session.sessionId
        },
        type: 'message-created'
      })

      const nextSessionTitle =
        session.title ?? createSessionTitleFromMessage(request.content)
      const startingSession = updateSession({
        ...session,
        state: 'native-starting',
        ...(nextSessionTitle ? { title: nextSessionTitle } : {}),
        updatedAt: options.now()
      })

      const sharedInput = {
        attachments: request.attachments ?? [],
        content: request.content,
        contextManifest: request.contextManifest,
        modelName: normalizeOptionalText(
          request.modelName ?? request.contextManifest.modelName
        ),
        session: startingSession,
        workspaceRoot: request.workspaceRoot
      }

      try {
        await runWithChangedFileSummary(
          startingSession.sessionId,
          request.workspaceRoot,
          () =>
            runEngineEvents(
              startingSession,
              startingSession.nativeSessionId
                ? adapter.sendMessage({
                    ...sharedInput,
                    nativeSessionId: startingSession.nativeSessionId
                  })
                : adapter.startSession(sharedInput)
            )
        )
      } catch (error) {
        const errorDetails = getAgentChatErrorDetails(error)
        const failedSession = {
          ...startingSession,
          state: 'failed',
          updatedAt: options.now()
        } satisfies AgentChatSession
        emit({
          diagnostic: createAgentChatDiagnostic({
            code: 'turn-failed',
            details: errorDetails,
            message: createAgentChatTurnFailedMessage(error)
          }),
          session: failedSession,
          type: 'session-failed'
        })
        throw error
      }
    },
    stopSession: async (request) => {
      const session = getSession(state, request.sessionId, request.workspaceRoot)
      if (!session) {
        throw new Error('Agent Chat session not found')
      }

      const adapter = adapters.get(session.engineId)
      if (!adapter) {
        throw new Error('Agent Chat engine is not registered')
      }

      const stoppingSession = updateSession({
        ...session,
        state: 'stopping',
        updatedAt: options.now()
      })

      await runWithChangedFileSummary(
        stoppingSession.sessionId,
        request.workspaceRoot,
        () =>
          runEngineEvents(
            stoppingSession,
            adapter.stopSession({
              nativeSessionId: session.nativeSessionId,
              session,
              workspaceRoot: request.workspaceRoot
            })
          )
      )
    },
    subscribe: (sessionId, listener) => {
      const listeners = listenersBySession.get(sessionId) ?? new Set()
      listeners.add(listener)
      listenersBySession.set(sessionId, listeners)

      return () => {
        const activeListeners = listenersBySession.get(sessionId)
        activeListeners?.delete(listener)
        if (activeListeners?.size === 0) {
          listenersBySession.delete(sessionId)
        }
      }
    }
  }
}
