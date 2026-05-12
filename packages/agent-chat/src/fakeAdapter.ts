import { createAgentChatDiagnostic } from './diagnostics'
import type {
  AgentChatCapabilityReport,
  AgentChatEngineAdapter,
  AgentChatEngineEvent,
  AgentChatEngineId,
  AgentChatEngineResumeInput,
  AgentChatEngineSendInput,
  AgentChatEngineStartInput,
  AgentChatEngineStopInput,
  AgentChatListNativeSessionsInput,
  AgentChatNativeSession
} from './types'

export interface FakeAgentChatAdapterOptions {
  readonly engineId: AgentChatEngineId
  readonly supported?: boolean
}

const now = (): string => new Date().toISOString()

async function* emitFakeTurn(
  input: AgentChatEngineStartInput | AgentChatEngineSendInput | AgentChatEngineResumeInput
): AsyncIterable<AgentChatEngineEvent> {
  await Promise.resolve()

  const nativeSessionId =
    'nativeSessionId' in input ? input.nativeSessionId : `fake-${input.session.sessionId}`

  if (nativeSessionId) {
    yield {
      nativeSessionId,
      sessionId: input.session.sessionId,
      type: 'session-started'
    }
  }

  if (input.content) {
    const messageId = `assistant-${input.session.sessionId}`
    const createdAt = now()
    yield {
      createdAt,
      delta: `Fake ${input.session.engineId} response`,
      messageId,
      sessionId: input.session.sessionId,
      type: 'assistant-message-delta'
    }
    yield {
      message: {
        attachments: [],
        content: `Fake ${input.session.engineId} response`,
        createdAt,
        messageId,
        role: 'assistant',
        sessionId: input.session.sessionId
      },
      type: 'assistant-message-completed'
    }
  }
}

export const createFakeAgentChatAdapter = (
  options: FakeAgentChatAdapterOptions
): AgentChatEngineAdapter => {
  const supported = options.supported ?? true

  return {
    engineId: options.engineId,
    listNativeSessions: (
      input: AgentChatListNativeSessionsInput
    ): Promise<readonly AgentChatNativeSession[]> =>
      Promise.resolve(
        supported
          ? [
              {
                cwd: input.workspaceRoot,
                nativeSessionId: `fake-${options.engineId}-thread`,
                title: `Fake ${options.engineId} session`
              }
            ]
          : []
      ),
    probeCapabilities: (): Promise<AgentChatCapabilityReport> =>
      Promise.resolve(
        supported
          ? {
              engineId: options.engineId,
              nativeVersion: 'fake',
              verdict: 'supported'
            }
          : {
              diagnostic: createAgentChatDiagnostic({
                code: 'protocol-unsupported',
                recoverable: false
              }),
              engineId: options.engineId,
              verdict: 'unsupported'
            }
      ),
    resumeSession: emitFakeTurn,
    sendMessage: emitFakeTurn,
    startSession: emitFakeTurn,
    stopSession: async function* (
      input: AgentChatEngineStopInput
    ): AsyncIterable<AgentChatEngineEvent> {
      await Promise.resolve()

      yield {
        nativeSessionId: input.nativeSessionId,
        sessionId: input.session.sessionId,
        type: 'session-stopped'
      }
    }
  }
}
