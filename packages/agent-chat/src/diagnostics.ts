import type { AgentChatDiagnostic, AgentChatDiagnosticCode } from './types'

export const createAgentChatDiagnostic = (input: {
  readonly code: AgentChatDiagnosticCode
  readonly details?: string
  readonly message?: string
  readonly recoverable?: boolean
}): AgentChatDiagnostic =>
  Object.freeze({
    code: input.code,
    details: input.details,
    message: input.message ?? input.code,
    recoverable: input.recoverable ?? true
  })
