import type {
  AgentEngineId,
  AutomationFlowLifecycle,
  AutomationFlowScope,
  AutomationFlowSourceType,
  AutomationFlowStatus,
  AutomationFlowTemplateId,
  AutomationRunKind,
  AutomationRunState,
  AutomationTaskBucket
} from '@mde/automation-flow'

export type { AutomationRunKind, AutomationRunState } from '@mde/automation-flow'

export interface AutomationTaskCard {
  readonly activeRunId?: string
  readonly automationFlowId: string
  readonly bucket: AutomationTaskBucket
  readonly engine?: AgentEngineId
  readonly latestReportId?: string
  readonly priority?: number
  readonly relativePath?: string
  readonly sourceItemId: string
  readonly sourcePath?: string
  readonly sourceType?: AutomationFlowSourceType
  readonly taskId: string
  readonly title: string
  readonly workspaceId?: string
}

export interface AutomationFlowRow {
  readonly automationFlowId: string
  readonly definitionPath?: string
  readonly diagnosticCount?: number
  readonly lifecycle: AutomationFlowLifecycle
  readonly name: string
  readonly scope: AutomationFlowScope
  readonly sourceTypes: readonly AutomationFlowSourceType[]
  readonly status: AutomationFlowStatus
  readonly taskCount: number
}

export interface AutomationDiagnostic {
  readonly automationFlowId?: string
  readonly code: string
  readonly diagnosticId: string
  readonly message: string
  readonly messageKey?: string
  readonly severity: 'error' | 'warning'
  readonly sourceFile?: string
  readonly taskId?: string
  readonly technicalMessage?: string
}

export interface AutomationDecision {
  readonly createdAt: string
  readonly decisionId: string
  readonly options?: readonly string[]
  readonly prompt: string
  readonly resolvedAt?: string
  readonly response?: string
  readonly runId: string
  readonly status: 'approved' | 'pending' | 'rejected' | 'resolved'
  readonly taskId: string
  readonly type: 'approval' | 'choice' | 'input'
}

export interface AutomationReportSummary {
  readonly completedAt: string
  readonly outcome: 'blocked' | 'cancelled' | 'failed' | 'succeeded'
  readonly reportId: string
  readonly runId?: string
  readonly summary?: string
  readonly taskId: string
  readonly title: string
}

export interface AutomationRunSummary {
  readonly adapterSessionId?: string
  readonly adapterSessionLineage?: readonly string[]
  readonly automationFlowId: string
  readonly automationFlowSnapshotId?: string
  readonly engine: AgentEngineId
  readonly runId: string
  readonly runKind: AutomationRunKind
  readonly sourceItemId?: string
  readonly sourcePath?: string
  readonly sourceSnapshotHash?: string
  readonly startedAt: string
  readonly state: AutomationRunState
  readonly taskId: string
  readonly title?: string
  readonly updatedAt: string
}

export interface AgentCliCapabilities {
  readonly resumeSession: boolean
  readonly streamingEvents: boolean
  readonly structuredToolCalls: boolean
  readonly fileRead?: boolean
  readonly fileWrite?: boolean
  readonly notifications?: boolean
}

export interface AgentCliCapabilityReport {
  readonly capabilities: AgentCliCapabilities
  readonly checkedAt: string
  readonly commandPath?: string
  readonly detected: boolean
  readonly diagnostics?: readonly AutomationDiagnostic[]
  readonly engine: AgentEngineId
  readonly version?: string
}

export interface AutomationAdapterCapabilityReport {
  readonly authenticated?: boolean
  readonly capabilities: Readonly<Record<string, boolean>>
  readonly checkedAt: string
  readonly commandPath?: string
  readonly detected: boolean
  readonly diagnostics?: readonly AutomationDiagnostic[]
  readonly engine: AgentEngineId
  readonly verdict?: 'full' | 'limited' | 'unsupported'
  readonly version?: string
  readonly workspaceSupported?: boolean
}

export interface AutomationFlowTemplateSummary {
  readonly allowedScopes: readonly AutomationFlowScope[]
  readonly name: string
  readonly requiredInputs: readonly {
    readonly id: string
    readonly label: string
    readonly required: boolean
    readonly type: string
  }[]
  readonly templateId: AutomationFlowTemplateId
}

export interface AutomationFlowDefinitionDocument {
  readonly markdown: string
  readonly path: string
  readonly valid: boolean
  readonly diagnostics: readonly AutomationDiagnostic[]
}

export interface AutomationProjectionFilters {
  readonly archivedVisible?: boolean
  readonly bucket?: AutomationTaskBucket
  readonly flowId?: string
  readonly workspaceId?: string
}

export interface AutomationProjection {
  readonly buckets: {
    readonly done: readonly AutomationTaskCard[]
    readonly needsMe: readonly AutomationTaskCard[]
    readonly ready: readonly AutomationTaskCard[]
    readonly running: readonly AutomationTaskCard[]
  }
  readonly decisions: readonly AutomationDecision[]
  readonly diagnostics: readonly AutomationDiagnostic[]
  readonly filters: AutomationProjectionFilters
  readonly flows: readonly AutomationFlowRow[]
  readonly generatedAt: string
  readonly reports: readonly AutomationReportSummary[]
  readonly runs: readonly AutomationRunSummary[]
  readonly selectedTaskId?: string
  readonly tasks: readonly AutomationTaskCard[]
}

export interface AutomationGetProjectionRequest {
  readonly filters?: AutomationProjectionFilters
  readonly workspaceRoot?: string
}

export interface AutomationGetProjectionResponse {
  readonly projection: AutomationProjection
}

export interface AutomationStartRunCommand {
  readonly taskId: string
  readonly type: 'start-run'
}

export interface AutomationResumeRunCommand {
  readonly runId: string
  readonly type: 'resume-run'
}

export interface AutomationCancelRunCommand {
  readonly runId: string
  readonly type: 'cancel-run'
}

export interface AutomationSubmitDecisionCommand {
  readonly decisionId: string
  readonly response: string
  readonly type: 'submit-decision'
}

export interface AutomationUpdateFiltersCommand {
  readonly filters: AutomationProjectionFilters
  readonly type: 'update-filters'
}

export type AutomationCommand =
  | AutomationCancelRunCommand
  | AutomationResumeRunCommand
  | AutomationStartRunCommand
  | AutomationSubmitDecisionCommand
  | AutomationUpdateFiltersCommand

export interface AutomationCommandResponse {
  readonly accepted: boolean
  readonly decisionId?: string
  readonly diagnostic?: AutomationDiagnostic
  readonly runId?: string
}

export type AutomationStartRunRequest = Omit<AutomationStartRunCommand, 'type'>
export type AutomationResumeRunRequest = Omit<AutomationResumeRunCommand, 'type'>
export type AutomationCancelRunRequest = Omit<AutomationCancelRunCommand, 'type'>
export type AutomationSubmitDecisionRequest = Omit<
  AutomationSubmitDecisionCommand,
  'type'
>
export type AutomationUpdateFiltersRequest = Omit<
  AutomationUpdateFiltersCommand,
  'type'
>

export interface AutomationCreateFlowFromTemplateRequest {
  readonly defaultEngine: AgentEngineId
  readonly flowId: string
  readonly scope: AutomationFlowScope
  readonly templateId: AutomationFlowTemplateId
}

export interface AutomationValidateTemplateInputResponse {
  readonly diagnostics: readonly AutomationDiagnostic[]
  readonly ok: boolean
}

export interface AutomationSetFlowLifecycleCommand {
  readonly filePath: string
  readonly lifecycle: AutomationFlowLifecycle
}

export interface AutomationArchiveFlowCommand {
  readonly filePath: string
}

export interface AutomationLoadFlowDefinitionCommand {
  readonly filePath: string
}

export interface AutomationSaveFlowDefinitionCommand {
  readonly filePath: string
  readonly markdown: string
}

export interface AutomationOpenNativeSessionCommand {
  readonly runId: string
}

export interface AutomationApi {
  readonly archiveFlow: (
    command: AutomationArchiveFlowCommand
  ) => Promise<AutomationFlowDefinitionDocument>
  readonly cancelRun: (
    command: AutomationCancelRunRequest
  ) => Promise<AutomationCommandResponse>
  readonly createFlowFromTemplate: (
    request: AutomationCreateFlowFromTemplateRequest
  ) => Promise<AutomationFlowDefinitionDocument>
  readonly getProjection: (
    request?: AutomationGetProjectionRequest
  ) => Promise<AutomationGetProjectionResponse>
  readonly listCapabilityReports: (
    request?: AutomationGetProjectionRequest
  ) => Promise<{ readonly reports: readonly AutomationAdapterCapabilityReport[] }>
  readonly listReports: () => Promise<{
    readonly reports: readonly AutomationReportSummary[]
  }>
  readonly listTemplates: () => Promise<{
    readonly templates: readonly AutomationFlowTemplateSummary[]
  }>
  readonly loadFlowDefinition: (
    command: AutomationLoadFlowDefinitionCommand
  ) => Promise<AutomationFlowDefinitionDocument>
  readonly openNativeSession: (
    command: AutomationOpenNativeSessionCommand
  ) => Promise<AutomationCommandResponse>
  readonly restoreFlow: (
    command: AutomationArchiveFlowCommand
  ) => Promise<AutomationFlowDefinitionDocument>
  readonly resumeRun: (
    command: AutomationResumeRunRequest
  ) => Promise<AutomationCommandResponse>
  readonly saveFlowDefinition: (
    command: AutomationSaveFlowDefinitionCommand
  ) => Promise<AutomationFlowDefinitionDocument>
  readonly setFlowLifecycle: (
    command: AutomationSetFlowLifecycleCommand
  ) => Promise<AutomationFlowDefinitionDocument>
  readonly startRun: (
    command: AutomationStartRunRequest
  ) => Promise<AutomationCommandResponse>
  readonly submitDecision: (
    command: AutomationSubmitDecisionRequest
  ) => Promise<AutomationCommandResponse>
  readonly updateFilters: (
    command: AutomationUpdateFiltersRequest
  ) => Promise<AutomationCommandResponse>
  readonly validateTemplateInput: (
    request: AutomationCreateFlowFromTemplateRequest
  ) => Promise<AutomationValidateTemplateInputResponse>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const hasStringProperty = (
  value: Record<string, unknown>,
  propertyName: string
): boolean => typeof value[propertyName] === 'string'

export const isAutomationCommand = (
  value: unknown
): value is AutomationCommand => {
  if (!isRecord(value) || !hasStringProperty(value, 'type')) {
    return false
  }

  switch (value.type) {
    case 'cancel-run':
    case 'resume-run':
      return hasStringProperty(value, 'runId')
    case 'start-run':
      return hasStringProperty(value, 'taskId')
    case 'submit-decision':
      return (
        hasStringProperty(value, 'decisionId') &&
        hasStringProperty(value, 'response')
      )
    case 'update-filters':
      return isRecord(value.filters)
    default:
      return false
  }
}
