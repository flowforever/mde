export const AGENT_CHAT_ENGINE_IDS = ['codex', 'claude'] as const

export type AgentChatEngineId = (typeof AGENT_CHAT_ENGINE_IDS)[number]

export type AgentChatHost = 'editor' | 'automation-center'
export type AgentChatSessionPurpose = 'document-chat' | 'automation-task' | 'debug'
export type AgentChatPermissionMode = 'max-permission'
export type AgentChatSessionState =
  | 'draft'
  | 'native-starting'
  | 'active'
  | 'stopping'
  | 'stopped'
  | 'failed'

export type AgentChatMessageRole = 'user' | 'assistant' | 'system' | 'thinking'

export interface AgentChatAttachment {
  readonly attachmentId: string
  readonly fileName: string
  readonly mimeType: string
  readonly safePath: string
  readonly sizeBytes: number
}

export interface AgentChatMessage {
  readonly attachments: readonly AgentChatAttachment[]
  readonly content: string
  readonly createdAt: string
  readonly isStreaming?: boolean
  readonly messageId: string
  readonly role: AgentChatMessageRole
  readonly sessionId: string
}

export interface AgentChatSession {
  readonly createdAt: string
  readonly engineId: AgentChatEngineId
  readonly host: AgentChatHost
  readonly nativeSessionId?: string
  readonly permissionMode: AgentChatPermissionMode
  readonly sessionId: string
  readonly sessionPurpose: AgentChatSessionPurpose
  readonly state: AgentChatSessionState
  readonly title?: string
  readonly updatedAt: string
  readonly workspaceRoot: string
}

export interface AgentChatSessionBinding {
  readonly nativeSessionId: string
  readonly sessionId: string
  readonly updatedAt: string
  readonly workspaceRoot: string
}

export interface AgentChatContextManifest {
  readonly currentDocumentPath?: string
  readonly currentDocumentSnapshot: string
  readonly modelName?: string
  readonly permissionMode: AgentChatPermissionMode
  readonly selectedBlockIds: readonly string[]
  readonly selectedText: string
  readonly sessionPurpose: AgentChatSessionPurpose
  readonly workspaceRoot: string
}

export type AgentChatDiagnosticCode =
  | 'authentication-required'
  | 'attachment-write-failed'
  | 'changed-files-unavailable'
  | 'engine-missing'
  | 'engine-not-registered'
  | 'invalid-attachment'
  | 'invalid-context'
  | 'native-session-unavailable'
  | 'protocol-unsupported'
  | 'resume-failed'
  | 'session-not-found'
  | 'turn-failed'
  | 'workspace-missing'

export interface AgentChatDiagnostic {
  readonly code: AgentChatDiagnosticCode
  readonly details?: string
  readonly message: string
  readonly recoverable: boolean
}

export interface AgentChatChangedFile {
  readonly changeType: 'added' | 'deleted' | 'modified'
  readonly path: string
}

export interface AgentChatChangedFilesSummary {
  readonly available: boolean
  readonly diagnostic?: AgentChatDiagnostic
  readonly files: readonly AgentChatChangedFile[]
}

export interface AgentChatState {
  readonly messages: readonly AgentChatMessage[]
  readonly sessions: readonly AgentChatSession[]
}

export type AgentChatEvent =
  | {
      readonly session: AgentChatSession
      readonly type: 'session-started' | 'session-updated' | 'session-stopped'
    }
  | {
      readonly diagnostic: AgentChatDiagnostic
      readonly session: AgentChatSession
      readonly type: 'session-failed'
    }
  | {
      readonly message: AgentChatMessage
      readonly type:
        | 'message-created'
        | 'assistant-message-completed'
        | 'thinking-updated'
    }
  | {
      readonly createdAt: string
      readonly delta: string
      readonly messageId: string
      readonly sessionId: string
      readonly type: 'assistant-message-delta'
    }
  | {
      readonly diagnostic: AgentChatDiagnostic
      readonly sessionId?: string
      readonly type: 'diagnostic'
    }
  | {
      readonly sessionId: string
      readonly summary: AgentChatChangedFilesSummary
      readonly type: 'changed-files-updated'
    }

export interface AgentChatNativeSession {
  readonly cwd?: string
  readonly nativeSessionId: string
  readonly title?: string
  readonly updatedAt?: string
}

export interface AgentChatWorkspaceFileSnapshot {
  readonly changeType?: 'added' | 'deleted' | 'modified'
  readonly hash: string
  readonly path: string
}

export interface AgentChatCapabilityProbeInput {
  readonly modelName?: string
  readonly workspaceRoot: string
}

export interface AgentChatCapabilityReport {
  readonly authenticated?: boolean
  readonly diagnostic?: AgentChatDiagnostic
  readonly engineId: AgentChatEngineId
  readonly nativeVersion?: string
  readonly verdict: 'supported' | 'unsupported'
}

export interface AgentChatEngineStartInput {
  readonly attachments: readonly AgentChatAttachment[]
  readonly content: string
  readonly contextManifest: AgentChatContextManifest
  readonly modelName?: string
  readonly session: AgentChatSession
  readonly workspaceRoot: string
}

export interface AgentChatEngineSendInput {
  readonly attachments: readonly AgentChatAttachment[]
  readonly content: string
  readonly contextManifest: AgentChatContextManifest
  readonly modelName?: string
  readonly nativeSessionId: string
  readonly session: AgentChatSession
  readonly workspaceRoot: string
}

export interface AgentChatEngineResumeInput {
  readonly content?: string
  readonly contextManifest?: AgentChatContextManifest
  readonly modelName?: string
  readonly nativeSessionId: string
  readonly session: AgentChatSession
  readonly workspaceRoot: string
}

export interface AgentChatEngineStopInput {
  readonly nativeSessionId?: string
  readonly session: AgentChatSession
  readonly workspaceRoot: string
}

export interface AgentChatListNativeSessionsInput {
  readonly workspaceRoot: string
}

export type AgentChatEngineEvent =
  | {
      readonly nativeSessionId: string
      readonly sessionId: string
      readonly title?: string
      readonly type: 'session-started'
    }
  | {
      readonly message: AgentChatMessage
      readonly type: 'message-created'
    }
  | {
      readonly createdAt: string
      readonly delta: string
      readonly messageId: string
      readonly sessionId: string
      readonly type: 'assistant-message-delta'
    }
  | {
      readonly message: AgentChatMessage
      readonly type: 'assistant-message-completed'
    }
  | {
      readonly message: AgentChatMessage
      readonly type: 'thinking-updated'
    }
  | {
      readonly diagnostic: AgentChatDiagnostic
      readonly sessionId?: string
      readonly type: 'diagnostic'
    }
  | {
      readonly sessionId: string
      readonly summary: AgentChatChangedFilesSummary
      readonly type: 'changed-files-updated'
    }
  | {
      readonly nativeSessionId?: string
      readonly sessionId: string
      readonly type: 'session-stopped'
    }

export interface AgentChatEngineAdapter {
  readonly createCapabilityCacheKey?: (
    input: AgentChatCapabilityProbeInput
  ) => Promise<string | undefined>
  readonly engineId: AgentChatEngineId
  readonly listNativeSessions: (
    input: AgentChatListNativeSessionsInput
  ) => Promise<readonly AgentChatNativeSession[]>
  readonly probeCapabilities: (
    input: AgentChatCapabilityProbeInput
  ) => Promise<AgentChatCapabilityReport>
  readonly resumeSession: (
    input: AgentChatEngineResumeInput
  ) => AsyncIterable<AgentChatEngineEvent>
  readonly sendMessage: (
    input: AgentChatEngineSendInput
  ) => AsyncIterable<AgentChatEngineEvent>
  readonly startSession: (
    input: AgentChatEngineStartInput
  ) => AsyncIterable<AgentChatEngineEvent>
  readonly stopSession: (
    input: AgentChatEngineStopInput
  ) => AsyncIterable<AgentChatEngineEvent>
}

export interface AgentChatAvailabilityRequest {
  readonly modelName?: string
  readonly selectedEngineId: AgentChatEngineId
  readonly workspaceRoot: string
}

export interface AgentChatAvailabilityResponse {
  readonly available: boolean
  readonly diagnostic?: AgentChatDiagnostic
  readonly engineId?: AgentChatEngineId
  readonly reason?:
    | 'engine-not-registered'
    | 'engine-not-selected'
    | 'authentication-required'
    | 'protocol-unsupported'
    | 'workspace-missing'
}

export interface AgentChatCreateDraftSessionRequest {
  readonly engineId: AgentChatEngineId
  readonly host: AgentChatHost
  readonly sessionPurpose: AgentChatSessionPurpose
  readonly workspaceRoot: string
}

export interface AgentChatListSessionsRequest {
  readonly selectedEngineId: AgentChatEngineId
  readonly workspaceRoot: string
}

export interface AgentChatReleaseWorkspaceSubscriptionsRequest {
  readonly workspaceRoot: string
}

export interface AgentChatSaveAttachmentRequest {
  readonly bytes: Uint8Array
  readonly fileName: string
  readonly mimeType: string
  readonly sessionId: string
  readonly workspaceRoot: string
}

export interface AgentChatSendMessageRequest {
  readonly attachments?: readonly AgentChatAttachment[]
  readonly contextManifest: AgentChatContextManifest
  readonly content: string
  readonly modelName?: string
  readonly sessionId: string
  readonly workspaceRoot: string
}

export interface AgentChatResumeSessionRequest {
  readonly contextManifest?: AgentChatContextManifest
  readonly content?: string
  readonly modelName?: string
  readonly nativeSessionId?: string
  readonly sessionId?: string
  readonly workspaceRoot: string
}

export interface AgentChatStopSessionRequest {
  readonly sessionId: string
  readonly workspaceRoot: string
}
