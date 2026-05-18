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

const CODEX_TURN_FAILED_PREFIX = /^Codex app-server turn failed:?\s*/iu
const SENSITIVE_ASSIGNMENT =
  /\b(api[_-]?key|authorization|password|secret|token)\s*[:=]\s*([^\s,;]+)/giu
const BEARER_TOKEN = /\bBearer\s+[^\s,;]+/giu
const ABSOLUTE_PATH = /(^|\s)\/[^\s,;]+/gu

const redactSensitiveAssignment = (
  _match: string,
  key: string,
  value: string
): string => {
  const trailingPunctuation = /[.!?]$/u.test(value) ? value.slice(-1) : ''

  return `${key}=[redacted]${trailingPunctuation}`
}

const trimDiagnosticMessage = (message: string): string =>
  message.length > 240 ? `${message.slice(0, 237)}...` : message

export const createAgentChatTurnFailedMessage = (error: unknown): string => {
  const details = getAgentChatErrorDetails(error)
    .replace(CODEX_TURN_FAILED_PREFIX, '')
    .replace(/\s+/gu, ' ')
    .trim()

  if (!details) {
    return 'turn-failed'
  }

  return trimDiagnosticMessage(
    details
      .replace(SENSITIVE_ASSIGNMENT, redactSensitiveAssignment)
      .replace(BEARER_TOKEN, 'Bearer [redacted]')
      .replace(ABSOLUTE_PATH, '$1[path]')
      .trim()
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
