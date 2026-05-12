import { resolve } from 'node:path'

import type {
  AgentChatNativeSession,
  AgentChatSessionBinding,
  AgentChatSession
} from './types'

export const mapCodexThreadToNativeSession = (thread: {
  readonly cwd?: string
  readonly id: string
  readonly name?: string | null
  readonly preview?: string
  readonly updatedAt?: number
}): AgentChatNativeSession =>
  Object.freeze({
    cwd: thread.cwd,
    nativeSessionId: thread.id,
    title: thread.name ?? thread.preview,
    updatedAt: thread.updatedAt
      ? new Date(thread.updatedAt * 1000).toISOString()
      : undefined
  })

export const filterNativeSessionsForWorkspace = (input: {
  readonly sessions: readonly AgentChatNativeSession[]
  readonly workspaceRoot: string
}): readonly AgentChatNativeSession[] => {
  const workspaceRoot = resolve(input.workspaceRoot)
  return Object.freeze(
    input.sessions.filter((session) =>
      session.cwd ? resolve(session.cwd) === workspaceRoot : false
    )
  )
}

export const bindMdeSessionToNativeSession = (input: {
  readonly nativeSessionId: string
  readonly now: () => string
  readonly session: AgentChatSession
}): AgentChatSessionBinding =>
  Object.freeze({
    nativeSessionId: input.nativeSessionId,
    sessionId: input.session.sessionId,
    updatedAt: input.now(),
    workspaceRoot: input.session.workspaceRoot
  })
