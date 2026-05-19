import type {
  AgentEngineId,
  AutomationFlowLifecycle,
  AutomationFlowScope,
  AutomationFlowSourceType,
  AutomationFlowStatus,
  AutomationFlowTemplateId,
  AutomationFlowDiagnostic,
  AutomationFlowExecutorType,
  AutomationRunKind,
  AutomationRunState,
  AutomationTaskBucket
} from '@mde/automation-flow'

export type { AutomationRunKind, AutomationRunState } from '@mde/automation-flow'

export interface AutomationTaskCard {
  readonly activeRunId?: string
  readonly automationFlowId: string
  readonly automationFlowOwnerKey?: string
  readonly blockingDiagnostics?: readonly AutomationFlowDiagnostic[]
  readonly bucket: AutomationTaskBucket
  readonly eligibleExecutors?: readonly AutomationTaskExecutorSummary[]
  readonly engine?: AgentEngineId
  readonly executionRoot?: string
  readonly executorSnapshotId?: string
  readonly latestReportId?: string
  readonly primaryExecutor?: AutomationTaskExecutorSummary
  readonly priority?: number
  readonly relativePath?: string
  readonly sourceItemId: string
  readonly sourcePath?: string
  readonly sourceType?: AutomationFlowSourceType
  readonly sourceUri?: string
  readonly taskId: string
  readonly taskKey?: string
  readonly taskDataId?: string
  readonly taskDataSnapshotId?: string
  readonly title: string
  readonly workspaceId?: string
}

export interface AutomationFlowRow {
  readonly automationFlowId: string
  readonly automationFlowOwnerKey?: string
  readonly definitionPath?: string
  readonly diagnosticCount?: number
  readonly lifecycle: AutomationFlowLifecycle
  readonly name: string
  readonly scope: AutomationFlowScope
  readonly sourceTypes: readonly AutomationFlowSourceType[]
  readonly status: AutomationFlowStatus
  readonly taskCount: number
  readonly workspaceId?: string
}

export interface AutomationDiagnostic {
  readonly automationFlowId?: string
  readonly code: string
  readonly diagnosticId: string
  readonly executionRoot?: string
  readonly message: string
  readonly messageKey?: string
  readonly missingField?: string
  readonly severity: 'error' | 'warning'
  readonly sectionName?: string
  readonly sourceFile?: string
  readonly taskId?: string
  readonly taskTitle?: string
  readonly technicalMessage?: string
  readonly userSafeReason?: string
}

export interface AutomationDecision {
  readonly createdAt: string
  readonly decisionId: string
  readonly options?: readonly string[]
  readonly prompt: string
  readonly resolvedAt?: string
  readonly response?: string
  readonly runId: string
  readonly status: 'approved' | 'pending' | 'rejected' | 'resolved' | 'resuming'
  readonly taskId: string
  readonly type: 'approval' | 'choice' | 'input'
}

export interface AutomationReportSummary {
  readonly completedAt: string
  readonly evidencePath?: string
  readonly outcome: 'blocked' | 'cancelled' | 'failed' | 'succeeded'
  readonly reportId: string
  readonly runId?: string
  readonly summary?: string
  readonly taskId: string
  readonly title: string
}

export interface AutomationRunReportReference {
  readonly completedAt: string
  readonly evidencePath?: string
  readonly outcome: AutomationReportSummary['outcome']
  readonly reportId: string
  readonly summary?: string
  readonly title: string
}

export type AutomationRunAction =
  | 'abandon'
  | 'open-native-session'
  | 'resume'
  | 'retry'
  | 'view-evidence'

export interface AutomationRunDiscoverySourceSummary {
  readonly executionRoot?: string
  readonly relativePath?: string
  readonly sourceItemId: string
  readonly sourcePath?: string
  readonly sourceType: AutomationFlowSourceType
  readonly sourceUri?: string
  readonly title: string
}

export interface AutomationRunDiscoveryResultSummary {
  readonly sourceCount: number
  readonly sources: readonly AutomationRunDiscoverySourceSummary[]
}

export type AutomationRunProcessStep =
  | {
      readonly createdAt: string
      readonly type: 'started'
    }
  | {
      readonly createdAt: string
      readonly sourceCount: number
      readonly type: 'discovered-task-sources'
    }
  | {
      readonly createdAt: string
      readonly state: AutomationRunState
      readonly type: 'state-updated'
    }

export interface AutomationRunSummary {
  readonly adapterSessionId?: string
  readonly adapterSessionLineage?: readonly string[]
  readonly automationFlowId: string
  readonly automationFlowOwnerKey?: string
  readonly automationFlowSnapshotId?: string
  readonly availableActions?: readonly AutomationRunAction[]
  readonly discoveryResult?: AutomationRunDiscoveryResultSummary
  readonly engine: AgentEngineId
  readonly executionRoot?: string
  readonly executorId?: string
  readonly executorSnapshotId?: string
  readonly processSteps?: readonly AutomationRunProcessStep[]
  readonly reportReference?: AutomationRunReportReference
  readonly runId: string
  readonly runKind: AutomationRunKind
  readonly sourceItemId?: string
  readonly sourcePath?: string
  readonly sourceSnapshotHash?: string
  readonly startedAt: string
  readonly state: AutomationRunState
  readonly taskId: string
  readonly taskKey?: string
  readonly taskDataId?: string
  readonly taskDataSnapshotId?: string
  readonly title?: string
  readonly updatedAt: string
  readonly workspaceId?: string
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

export type AutomationProjectionBucketFilter =
  | 'needsMe'
  | 'running'
  | 'ready'
  | 'done'

export type AutomationCenterScopeId = 'global' | `workspace:${string}`

export interface AutomationTaskExecutorSummary {
  readonly displayName: string
  readonly executorId: string
  readonly executorSnapshotId?: string
  readonly sourceClass?: string
  readonly sourcePath?: string
  readonly type: AutomationFlowExecutorType
}

export interface AutomationProjectionFilters {
  readonly archivedVisible?: boolean
  readonly bucket?: AutomationProjectionBucketFilter
  readonly flowIds?: readonly string[]
  readonly flowOwnerKeys?: readonly string[]
  readonly scopeIds?: readonly string[]
  readonly workspaceIds?: readonly string[]
}

export interface AutomationCenterFilters extends AutomationProjectionFilters {
  readonly scopeIds?: readonly AutomationCenterScopeId[]
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
  readonly filters: AutomationCenterFilters
  readonly flows: readonly AutomationFlowRow[]
  readonly generatedAt: string
  readonly reports: readonly AutomationReportSummary[]
  readonly runs: readonly AutomationRunSummary[]
  readonly selectedTaskId?: string
  readonly tasks: readonly AutomationTaskCard[]
  readonly workspaceRoot?: string
}

export interface AutomationGetProjectionRequest {
  readonly filters?: AutomationCenterFilters
  readonly selectedTaskId?: string
  readonly selectedTaskKey?: string
  readonly workspaceRoot?: string
  readonly workspaceRoots?: readonly string[]
}

export interface AutomationGetProjectionResponse {
  readonly projection: AutomationProjection
}

export interface AutomationStartRunCommand {
  readonly executorId: string
  readonly executorSnapshotId?: string
  readonly taskDataId: string
  readonly taskDataSnapshotId: string
  readonly taskId: string
  readonly taskKey?: string
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
  readonly filters: AutomationCenterFilters
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
  readonly workspaceRoot?: string
}

export interface AutomationArchiveFlowCommand {
  readonly filePath: string
}

export interface AutomationDeleteFlowCommand {
  readonly filePath: string
}

export interface AutomationRenameFlowCommand {
  readonly filePath: string
  readonly name: string
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

export interface AutomationGetExplorerProjectionRequest {
  readonly workspaceRoot?: string
}

export interface AutomationExecutorSummary {
  readonly diagnostics?: readonly AutomationDiagnostic[]
  readonly displayName: string
  readonly executorId: string
  readonly sourceClass?: string
  readonly sourcePath?: string
  readonly type: AutomationFlowExecutorType
}

export interface AutomationExplorerFlowSummary {
  readonly appliedToWorkspace?: boolean
  readonly executors: readonly AutomationExecutorSummary[]
  readonly flowOwnerKey?: string
  readonly id: string
  readonly name: string
  readonly scope: AutomationFlowScope
  readonly sourceFile?: string
}

export interface AutomationExplorerProjection {
  readonly diagnostics: readonly AutomationDiagnostic[]
  readonly flows: readonly AutomationExplorerFlowSummary[]
  readonly workspaceRoot?: string
}

export interface AutomationGetExplorerProjectionResponse {
  readonly projection: AutomationExplorerProjection
}

export interface AutomationCreateFlowDraftRequest {
  readonly displayName: string
  readonly flowId: string
  readonly scope?: AutomationFlowScope
  readonly workspaceRoot?: string
}

export interface AutomationCreateExecutorDraftRequest {
  readonly displayName: string
  readonly executorId: string
  readonly flowId: string
  readonly scope?: AutomationFlowScope
  readonly workspaceRoot?: string
}

export interface AutomationApplyGlobalFlowRequest {
  readonly flowId: string
  readonly workspaceRoot?: string
}

export interface AutomationOpenManagementTargetRequest {
  readonly flowId?: string
  readonly target: 'global' | 'workspace'
  readonly workspaceRoot?: string
}

export interface AutomationOpenManagementTargetResponse {
  readonly flowPath?: string
  readonly rootPath: string
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
  readonly deleteFlow: (
    command: AutomationDeleteFlowCommand
  ) => Promise<AutomationCommandResponse>
  readonly applyGlobalFlowToWorkspace: (
    request: AutomationApplyGlobalFlowRequest
  ) => Promise<AutomationCommandResponse>
  readonly createExecutorDraft: (
    request: AutomationCreateExecutorDraftRequest
  ) => Promise<AutomationFlowDefinitionDocument>
  readonly createFlowDraft: (
    request: AutomationCreateFlowDraftRequest
  ) => Promise<AutomationFlowDefinitionDocument>
  readonly getExplorerAutomationProjection: (
    request?: AutomationGetExplorerProjectionRequest
  ) => Promise<AutomationGetExplorerProjectionResponse>
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
  readonly openAutomationManagementTarget: (
    request: AutomationOpenManagementTargetRequest
  ) => Promise<AutomationOpenManagementTargetResponse>
  readonly refreshSkillCatalog: () => Promise<AutomationCommandResponse>
  readonly removeAppliedGlobalFlowFromWorkspace: (
    request: AutomationApplyGlobalFlowRequest
  ) => Promise<AutomationCommandResponse>
  readonly renameFlow: (
    command: AutomationRenameFlowCommand
  ) => Promise<AutomationFlowDefinitionDocument>
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
