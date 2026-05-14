export type {
  AgentChatAttachment,
  AgentChatAvailabilityRequest,
  AgentChatAvailabilityResponse,
  AgentChatChangedFilesSummary,
  AgentChatContextManifest,
  AgentChatCreateDraftSessionRequest,
  AgentChatDiagnostic,
  AgentChatEngineId,
  AgentChatEvent,
  AgentChatHost,
  AgentChatListSessionsRequest,
  AgentChatMessage,
  AgentChatReleaseWorkspaceSubscriptionsRequest,
  AgentChatResumeSessionRequest,
  AgentChatSaveAttachmentRequest,
  AgentChatSendMessageRequest,
  AgentChatSession,
  AgentChatStopSessionRequest
} from '@mde/agent-chat'

import type {
  AgentChatAttachment,
  AgentChatAvailabilityRequest,
  AgentChatAvailabilityResponse,
  AgentChatCreateDraftSessionRequest,
  AgentChatEvent,
  AgentChatListSessionsRequest,
  AgentChatReleaseWorkspaceSubscriptionsRequest,
  AgentChatResumeSessionRequest,
  AgentChatSaveAttachmentRequest,
  AgentChatSendMessageRequest,
  AgentChatSession,
  AgentChatStopSessionRequest
} from '@mde/agent-chat'

export interface AgentChatApi {
  readonly createDraftSession: (
    request: AgentChatCreateDraftSessionRequest
  ) => Promise<AgentChatSession>
  readonly getAvailability: (
    request: AgentChatAvailabilityRequest
  ) => Promise<AgentChatAvailabilityResponse>
  readonly listSessions: (
    request: AgentChatListSessionsRequest
  ) => Promise<readonly AgentChatSession[]>
  readonly onEvent: (listener: (event: AgentChatEvent) => void) => () => void
  readonly releaseWorkspaceSubscriptions: (
    request: AgentChatReleaseWorkspaceSubscriptionsRequest
  ) => Promise<void>
  readonly resumeSession: (
    request: AgentChatResumeSessionRequest
  ) => Promise<AgentChatSession>
  readonly saveAttachment: (
    request: AgentChatSaveAttachmentRequest
  ) => Promise<AgentChatAttachment>
  readonly sendMessage: (request: AgentChatSendMessageRequest) => Promise<void>
  readonly stopSession: (request: AgentChatStopSessionRequest) => Promise<void>
}
