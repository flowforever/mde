import type {
  AgentChatCreateDraftSessionRequest,
  AgentChatEvent,
  AgentChatMessage,
  AgentChatSession,
  AgentChatState
} from './types'

let sessionCounter = 0

const createIdSuffix = (timestamp: string): string =>
  timestamp.replace(/[^0-9a-z]/gi, '').toLowerCase()

const freezeSession = (session: AgentChatSession): AgentChatSession =>
  Object.freeze(session)

const freezeMessage = (message: AgentChatMessage): AgentChatMessage =>
  Object.freeze({
    ...message,
    attachments: Object.freeze([...message.attachments])
  })

const replaceSession = (
  sessions: readonly AgentChatSession[],
  nextSession: AgentChatSession
): readonly AgentChatSession[] =>
  Object.freeze(
    sessions.map((session) =>
      session.sessionId === nextSession.sessionId ? freezeSession(nextSession) : session
    )
  )

const upsertMessage = (
  messages: readonly AgentChatMessage[],
  nextMessage: AgentChatMessage
): readonly AgentChatMessage[] =>
  Object.freeze(
    messages.some((message) => message.messageId === nextMessage.messageId)
      ? messages.map((message) =>
          message.messageId === nextMessage.messageId
            ? freezeMessage(nextMessage)
            : message
        )
      : [...messages, freezeMessage(nextMessage)]
  )

export const createDraftAgentChatSession = (
  input: AgentChatCreateDraftSessionRequest & {
    readonly now: () => string
  }
): AgentChatSession => {
  const timestamp = input.now()
  sessionCounter += 1

  return freezeSession({
    createdAt: timestamp,
    engineId: input.engineId,
    host: input.host,
    permissionMode: 'max-permission',
    sessionId: `mde-chat-${createIdSuffix(timestamp)}-${sessionCounter}`,
    sessionPurpose: input.sessionPurpose,
    state: 'draft',
    updatedAt: timestamp,
    workspaceRoot: input.workspaceRoot
  })
}

export const reduceAgentChatState = (
  state: AgentChatState,
  event: AgentChatEvent
): AgentChatState => {
  if (
    event.type === 'session-started' ||
    event.type === 'session-updated' ||
    event.type === 'session-stopped'
  ) {
    return Object.freeze({
      messages: state.messages,
      sessions: replaceSession(state.sessions, event.session)
    })
  }

  if (event.type === 'session-failed') {
    return Object.freeze({
      messages: state.messages,
      sessions: replaceSession(state.sessions, event.session)
    })
  }

  if (
    event.type === 'message-created' ||
    event.type === 'assistant-message-completed' ||
    event.type === 'thinking-updated'
  ) {
    return Object.freeze({
      messages: upsertMessage(state.messages, event.message),
      sessions: state.sessions
    })
  }

  return state
}
