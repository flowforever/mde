import type { AgentChatCodexUserInputItem } from '../context'

export type CodexRequestId = string

export type CodexApprovalPolicy = 'never'
export type CodexSandboxMode = 'danger-full-access'
export interface CodexSandboxPolicy {
  readonly type: 'dangerFullAccess'
}

export interface CodexInitializeParams {
  readonly capabilities: {
    readonly experimentalApi: boolean
    readonly optOutNotificationMethods?: readonly string[] | null
  } | null
  readonly clientInfo: {
    readonly name: string
    readonly title: string | null
    readonly version: string
  }
}

export interface CodexInitializeResponse {
  readonly codexHome: string
  readonly platformFamily: string
  readonly platformOs: string
  readonly userAgent: string
}

export interface CodexClientNotification {
  readonly method: 'initialized'
}

export interface CodexThreadStartParams {
  readonly approvalPolicy?: CodexApprovalPolicy
  readonly cwd?: string | null
  readonly developerInstructions?: string | null
  readonly experimentalRawEvents: boolean
  readonly model?: string | null
  readonly persistExtendedHistory: boolean
  readonly sandbox?: CodexSandboxMode | null
}

export interface CodexThreadResumeParams {
  readonly approvalPolicy?: CodexApprovalPolicy
  readonly cwd?: string | null
  readonly excludeTurns?: boolean
  readonly model?: string | null
  readonly persistExtendedHistory: boolean
  readonly sandbox?: CodexSandboxMode | null
  readonly threadId: string
}

export interface CodexThreadListParams {
  readonly cwd?: string | readonly string[] | null
  readonly limit?: number | null
}

export interface CodexTurnStartParams {
  readonly approvalPolicy?: CodexApprovalPolicy
  readonly cwd?: string | null
  readonly input: readonly CodexUserInput[]
  readonly model?: string | null
  readonly sandboxPolicy?: CodexSandboxPolicy | null
  readonly threadId: string
}

export interface CodexTurnInterruptParams {
  readonly threadId: string
  readonly turnId: string
}

export type CodexUserInput = AgentChatCodexUserInputItem

export type CodexClientRequest =
  | {
      readonly id: CodexRequestId
      readonly method: 'initialize'
      readonly params: CodexInitializeParams
    }
  | {
      readonly id: CodexRequestId
      readonly method: 'thread/start'
      readonly params: CodexThreadStartParams
    }
  | {
      readonly id: CodexRequestId
      readonly method: 'thread/resume'
      readonly params: CodexThreadResumeParams
    }
  | {
      readonly id: CodexRequestId
      readonly method: 'thread/list'
      readonly params: CodexThreadListParams
    }
  | {
      readonly id: CodexRequestId
      readonly method: 'turn/start'
      readonly params: CodexTurnStartParams
    }
  | {
      readonly id: CodexRequestId
      readonly method: 'turn/interrupt'
      readonly params: CodexTurnInterruptParams
    }

export interface CodexThread {
  readonly cwd?: string
  readonly id: string
  readonly name?: string | null
  readonly preview?: string
  readonly updatedAt?: number
}

export interface CodexThreadStartResponse {
  readonly thread: CodexThread
}

export interface CodexThreadResumeResponse {
  readonly thread: CodexThread
}

export interface CodexThreadListResponse {
  readonly data: readonly CodexThread[]
}

export interface CodexTurn {
  readonly id: string
  readonly status?: string
}

export interface CodexTurnStartResponse {
  readonly turn: CodexTurn
}

export interface CodexJsonRpcResponse<T> {
  readonly error?: { readonly code?: number; readonly message: string }
  readonly id: CodexRequestId
  readonly result?: T
}

export type CodexServerNotification =
  | {
      readonly method: 'thread/started'
      readonly params: { readonly thread: CodexThread }
    }
  | {
      readonly method: 'turn/started'
      readonly params: { readonly threadId: string; readonly turn: CodexTurn }
    }
  | {
      readonly method: 'item/agentMessage/delta'
      readonly params: {
        readonly delta: string
        readonly itemId: string
        readonly threadId: string
        readonly turnId: string
      }
    }
  | {
      readonly method: 'turn/completed'
      readonly params: { readonly threadId: string; readonly turn: CodexTurn }
    }
  | {
      readonly method: 'turn/diff/updated'
      readonly params: unknown
    }
  | {
      readonly method: 'error'
      readonly params: { readonly message?: string }
    }
