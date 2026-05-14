import type { AgentChatDiagnostic, AgentChatDiagnosticCode } from './types'

export const getAgentChatErrorDetails = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const isAgentChatExecutableMissingError = (error: unknown): boolean => {
  const details = getAgentChatErrorDetails(error)

  return (
    /\bspawn\s+codex\s+ENOENT\b/iu.test(details) ||
    /(?:^|[\s:])codex:\s*command not found\b/iu.test(details) ||
    /\bcommand not found:\s*codex\b/iu.test(details)
  )
}

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
