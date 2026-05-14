export type AgentEngineId = 'codex' | 'claude-code' | (string & {})

export type AutomationFlowScope = 'user' | 'workspace'

export type AutomationFlowStatus = 'formal' | 'draft'

export type AutomationFlowLifecycle = 'enabled' | 'disabled' | 'archived'

export type AutomationRunKind = 'discovery' | 'task'

export type AutomationFlowSourceType =
  | 'adapter-discovered'
  | 'local-file'
  | 'remote-doc'
  | 'remote-issue'
  | 'remote-mr'
  | 'user-prompt'
  | 'workspace-markdown'

export type AutomationFlowLoopMode = 'continuous' | 'manual'

export type AutomationFlowOnEmpty = 'wait' | 'stop'

export type AutomationFlowOnBlocked =
  | 'skip-and-continue'
  | 'pause-automation-flow'

export type AutomationFlowDiagnosticSeverity = 'error' | 'warning'

export type AutomationFlowTemplateId =
  | 'bug-fix'
  | 'local-dev-task'
  | 'manual-approval'
  | 'requirement-implementation'
  | 'research-and-notes'

export type AutomationFlowTemplateInputType = 'engine' | 'scope' | 'string'

export type AutomationSourceStatus = 'disabled' | 'draft' | 'ready'

export type AutomationTaskBucket = 'done' | 'needs-me' | 'ready' | 'running'

export type AutomationRunState =
  | 'cancelled'
  | 'done'
  | 'failed'
  | 'needs-me'
  | 'running'
  | 'starting'

export type AutomationFlowLoopPlanAction =
  | 'at-capacity'
  | 'idle'
  | 'pause-automation-flow'
  | 'start-run'
  | 'stop'
  | 'wait'

export interface AutomationFlowDiagnostic {
  readonly code: string
  readonly messageKey: string
  readonly severity: AutomationFlowDiagnosticSeverity
  readonly missingField?: string
  readonly sectionName?: string
  readonly sourceFile?: string
  readonly technicalMessage?: string
}

export interface AutomationFlowTemplateInputDefinition {
  readonly id: string
  readonly label: string
  readonly required: boolean
  readonly type: AutomationFlowTemplateInputType
}

export interface AutomationFlowTemplateDefaults {
  readonly allowedEngines: readonly AgentEngineId[]
  readonly confirmationPolicy: AutomationFlowConfirmationPolicy
  readonly defaultEngine: AgentEngineId
  readonly loopPolicy: AutomationFlowLoopPolicy
  readonly match: AutomationFlowMatchRules
  readonly pickOrder: readonly string[]
  readonly priority: number
  readonly reportPattern: string
  readonly sourceTypes: readonly AutomationFlowSourceType[]
}

export interface AutomationFlowTemplateSections {
  readonly acceptanceStandard: string
  readonly executionStandard: string
  readonly pickRules: string
  readonly reportPattern: string
  readonly verificationExpectations: string
}

export interface AutomationFlowTemplate {
  readonly allowedScopes: readonly AutomationFlowScope[]
  readonly defaults: AutomationFlowTemplateDefaults
  readonly id: AutomationFlowTemplateId
  readonly name: string
  readonly requiredInputs: readonly AutomationFlowTemplateInputDefinition[]
  readonly sections: AutomationFlowTemplateSections
}

export interface AutomationFlowTemplateRenderInputs {
  readonly allowedEngines?: readonly AgentEngineId[]
  readonly defaultEngine?: AgentEngineId
  readonly flowId?: string
  readonly name?: string
  readonly promptTags?: readonly string[]
  readonly scope: AutomationFlowScope
  readonly taskPathGlobs?: readonly string[]
  readonly titleIncludes?: readonly string[]
}

export interface AutomationFlowSourceItem {
  readonly automationStatus?: AutomationSourceStatus
  readonly engine?: AgentEngineId
  readonly priority?: number
  readonly relativePath?: string
  readonly sourceItemId: string
  readonly sourcePath?: string
  readonly sourceType: AutomationFlowSourceType
  readonly tags?: readonly string[]
  readonly title: string
  readonly workspaceId?: string
}

export interface AutomationSourceAuthDiagnostic {
  readonly code: string
  readonly message: string
  readonly provider?: string
}

export interface AutomationDiscoveredTaskSource {
  readonly adapterId?: AgentEngineId
  readonly authDiagnostic?: AutomationSourceAuthDiagnostic
  readonly automationFlowId: string
  readonly automationFlowOwnerKey?: string
  readonly contentSnapshot?: string
  readonly discoveredAt: string
  readonly engine?: AgentEngineId
  readonly externalId?: string
  readonly priority?: number
  readonly provider?: string
  readonly relativePath?: string
  readonly sourceItemId: string
  readonly sourcePath?: string
  readonly sourceSnapshotHash: string
  readonly sourceType: AutomationFlowSourceType
  readonly sourceUri?: string
  readonly tags?: readonly string[]
  readonly title: string
  readonly workspaceId?: string
}

export interface AutomationFlowTaskCandidate {
  readonly automationFlowId: string
  readonly automationFlowOwnerKey?: string
  readonly authDiagnostic?: AutomationSourceAuthDiagnostic
  readonly engine: AgentEngineId
  readonly externalId?: string
  readonly priority?: number
  readonly provider?: string
  readonly relativePath?: string
  readonly sourceItemId: string
  readonly sourcePath?: string
  readonly sourceSnapshotHash?: string
  readonly sourceType: AutomationFlowSourceType
  readonly sourceUri?: string
  readonly taskId: string
  readonly title: string
  readonly workspaceId?: string
}

export interface AutomationFlowSourceMatch {
  readonly automationFlow: AutomationFlow
  readonly sourceItem: AutomationFlowSourceItem
}

export interface AutomationFlowOwnershipResult {
  readonly candidates: readonly AutomationFlowTaskCandidate[]
  readonly diagnostics: readonly AutomationFlowDiagnostic[]
}

export interface AutomationRunOverlay {
  readonly automationFlowId: string
  readonly runKind?: AutomationRunKind
  readonly runId: string
  readonly sourceItemId: string
  readonly state: AutomationRunState
  readonly taskId: string
}

export interface AutomationReportOverlay {
  readonly automationFlowId: string
  readonly completedAt: string
  readonly engine?: AgentEngineId
  readonly priority?: number
  readonly relativePath?: string
  readonly reportId: string
  readonly sourceItemId: string
  readonly sourcePath?: string
  readonly sourceType?: AutomationFlowSourceType
  readonly sourceUri?: string
  readonly taskId: string
  readonly title?: string
  readonly workspaceId?: string
}

export interface AutomationProjectedTask {
  readonly activeRunId?: string
  readonly automationFlowId: string
  readonly automationFlowOwnerKey?: string
  readonly bucket: AutomationTaskBucket
  readonly engine?: AgentEngineId
  readonly latestReportId?: string
  readonly priority?: number
  readonly relativePath?: string
  readonly sourceItemId: string
  readonly sourcePath?: string
  readonly sourceType?: AutomationFlowSourceType
  readonly sourceUri?: string
  readonly taskId: string
  readonly title: string
  readonly workspaceId?: string
}

export interface AutomationSignalStackBuckets {
  readonly done: readonly AutomationProjectedTask[]
  readonly needsMe: readonly AutomationProjectedTask[]
  readonly ready: readonly AutomationProjectedTask[]
  readonly running: readonly AutomationProjectedTask[]
}

export interface AutomationSignalStackProjection {
  readonly buckets: AutomationSignalStackBuckets
  readonly tasks: readonly AutomationProjectedTask[]
}

export interface AutomationFlowLoopPlan {
  readonly action: AutomationFlowLoopPlanAction
  readonly blockedRunId?: string
  readonly nextScanAt?: string
  readonly reason?: string
  readonly taskId?: string
}

export interface AutomationFlowSections {
  readonly acceptanceStandard: string
  readonly executionStandard: string
  readonly pickRules: string
  readonly reportPattern: string
  readonly verificationExpectations: string
}

export interface AutomationFlowMatchRules {
  readonly promptTags?: readonly string[]
  readonly taskPathGlobs?: readonly string[]
  readonly titleIncludes?: readonly string[]
}

export interface AutomationFlowLoopPolicy {
  readonly intervalMinutes: number
  readonly maxActiveRuns: number
  readonly mode: AutomationFlowLoopMode
  readonly onBlocked: AutomationFlowOnBlocked
  readonly onEmpty: AutomationFlowOnEmpty
}

export interface AutomationFlowConfirmationPolicy {
  readonly fileWrites: 'automation-flow-controlled' | 'require-user' | 'allow'
  readonly highRisk: 'require-user' | 'allow'
  readonly unclearScope: 'require-user' | 'allow'
}

export interface AutomationFlow {
  readonly allowedEngines: readonly AgentEngineId[]
  readonly confirmationPolicy: AutomationFlowConfirmationPolicy
  readonly defaultEngine: AgentEngineId
  readonly id: string
  readonly lifecycle: AutomationFlowLifecycle
  readonly loopPolicy: AutomationFlowLoopPolicy
  readonly match: AutomationFlowMatchRules
  readonly name: string
  readonly pickOrder: readonly string[]
  readonly priority: number
  readonly reportPattern: string
  readonly scope: AutomationFlowScope
  readonly sections: AutomationFlowSections
  readonly sourceTypes: readonly AutomationFlowSourceType[]
  readonly status: AutomationFlowStatus
}

export interface ParsedAutomationFlow extends AutomationFlow {
  readonly sourceFile?: string
}

export type AutomationFlowParseResult =
  | {
      readonly automationFlow: ParsedAutomationFlow
      readonly diagnostics: readonly AutomationFlowDiagnostic[]
      readonly ok: true
    }
  | {
      readonly diagnostics: readonly AutomationFlowDiagnostic[]
      readonly ok: false
    }
