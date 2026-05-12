import { createJsonRpcProcessClient } from './jsonRpc'
import type { AgentChatChildProcess } from '../host'
import type { AgentChatEngineEvent } from '../types'
import type {
  CodexServerNotification,
  CodexThreadListParams,
  CodexThreadListResponse,
  CodexThreadResumeParams,
  CodexThreadResumeResponse,
  CodexThreadStartParams,
  CodexThreadStartResponse,
  CodexTurnInterruptParams,
  CodexTurnStartParams,
  CodexTurnStartResponse,
  CodexClientRequest,
  CodexInitializeResponse
} from './protocolTypes'

export interface CodexAppServerClient {
  readonly close: () => void
  readonly subscribeNotifications: (
    listener: (notification: CodexServerNotification) => void
  ) => () => void
  readonly threadList: (
    params: CodexThreadListParams
  ) => Promise<CodexThreadListResponse>
  readonly threadResume: (
    params: CodexThreadResumeParams
  ) => Promise<CodexThreadResumeResponse>
  readonly threadStart: (
    params: CodexThreadStartParams
  ) => Promise<CodexThreadStartResponse>
  readonly turnInterrupt: (
    params: CodexTurnInterruptParams
  ) => Promise<void>
  readonly turnStart: (
    params: CodexTurnStartParams
  ) => Promise<CodexTurnStartResponse>
}

export interface CodexAppServerClientOptions {
  readonly child: AgentChatChildProcess
  readonly idPrefix?: string
}

export const createCodexAppServerClient = (
  options: CodexAppServerClientOptions
): CodexAppServerClient => {
  const jsonRpc = createJsonRpcProcessClient(options)
  let initializePromise: Promise<void> | undefined

  const ensureInitialized = async (): Promise<void> => {
    initializePromise ??= jsonRpc
      .request<CodexInitializeResponse>('initialize', {
        capabilities: { experimentalApi: true },
        clientInfo: {
          name: 'mde',
          title: 'MDE',
          version: '1.0.0'
        }
      })
      .then(() => {
        jsonRpc.notify('initialized')
      })

    await initializePromise
  }

  const requestAfterInitialize = async <T>(
    method: CodexClientRequest['method'],
    params: CodexClientRequest['params']
  ): Promise<T> => {
    await ensureInitialized()
    return jsonRpc.request<T>(method, params)
  }

  return {
    close: jsonRpc.close,
    subscribeNotifications: jsonRpc.subscribeNotifications,
    threadList: (params) => requestAfterInitialize('thread/list', params),
    threadResume: (params) => requestAfterInitialize('thread/resume', params),
    threadStart: (params) => requestAfterInitialize('thread/start', params),
    turnInterrupt: async (params) => {
      await requestAfterInitialize('turn/interrupt', params)
    },
    turnStart: (params) => requestAfterInitialize('turn/start', params)
  }
}

export interface CodexNotificationMapper {
  readonly map: (
    notification: CodexServerNotification
  ) => AgentChatEngineEvent | undefined
}

export const createCodexNotificationMapper = (input: {
  readonly now: () => string
  readonly sessionId: string
}): CodexNotificationMapper => {
  const contentByItemId = new Map<string, string>()
  let lastMessageId: string | undefined

  return {
    map: (notification) => {
      if (notification.method === 'thread/started') {
        return {
          nativeSessionId: notification.params.thread.id,
          sessionId: input.sessionId,
          type: 'session-started'
        }
      }

      if (notification.method === 'item/agentMessage/delta') {
        lastMessageId = notification.params.itemId
        contentByItemId.set(
          notification.params.itemId,
          `${contentByItemId.get(notification.params.itemId) ?? ''}${
            notification.params.delta
          }`
        )
        return {
          createdAt: input.now(),
          delta: notification.params.delta,
          messageId: notification.params.itemId,
          sessionId: input.sessionId,
          type: 'assistant-message-delta'
        }
      }

      if (notification.method === 'turn/completed' && lastMessageId) {
        return {
          message: {
            attachments: [],
            content: contentByItemId.get(lastMessageId) ?? '',
            createdAt: input.now(),
            messageId: lastMessageId,
            role: 'assistant',
            sessionId: input.sessionId
          },
          type: 'assistant-message-completed'
        }
      }

      return undefined
    }
  }
}
