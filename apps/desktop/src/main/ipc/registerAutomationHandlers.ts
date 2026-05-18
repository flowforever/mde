import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

import type { IpcMain, IpcMainInvokeEvent } from 'electron'

import {
  listBuiltInAutomationFlowTemplates,
  type AutomationDiscoveredTaskSource,
  type AutomationFlowDiagnostic,
  type AutomationFlowExecutorRef,
  type AutomationFlowTaskCandidate,
  type AutomationProjectedTask,
  type AutomationReportOverlay,
  type AutomationRunOverlay,
  resolveAutomationFlowExecutors,
  type ParsedAutomationFlow
} from '@mde/automation-flow'

import type {
  AutomationAdapterCapabilityReport,
  AutomationArchiveFlowCommand,
  AutomationCenterFilters,
  AutomationCenterScopeId,
  AutomationCommandResponse,
  AutomationCreateFlowFromTemplateRequest,
  AutomationApplyGlobalFlowRequest,
  AutomationDeleteFlowCommand,
  AutomationDiagnostic,
  AutomationCreateExecutorDraftRequest,
  AutomationCreateFlowDraftRequest,
  AutomationFlowDefinitionDocument,
  AutomationFlowRow,
  AutomationGetProjectionRequest,
  AutomationOpenManagementTargetRequest,
  AutomationOpenManagementTargetResponse,
  AutomationLoadFlowDefinitionCommand,
  AutomationProjection,
  AutomationRenameFlowCommand,
  AutomationRunAction,
  AutomationRunDiscoveryResultSummary,
  AutomationRunProcessStep,
  AutomationRunSummary,
  AutomationSaveFlowDefinitionCommand,
  AutomationSetFlowLifecycleCommand,
  AutomationStartRunRequest,
  AutomationSubmitDecisionRequest,
  AutomationTaskExecutorSummary,
  AutomationValidateTemplateInputResponse
} from '../../shared/automation'
import { AUTOMATION_CHANNELS } from './channels'
import type { AgentCliCapabilityProbeReport } from '../services/automation/agentCliAdapters'
import {
  AutomationAdapterCapabilityError,
  type AutomationAdapterRegistry
} from '../services/automation/automationAdapterRegistry'
import { createAutomationFlowDefinitionService } from '../services/automation/automationFlowDefinitionService'
import { loadAutomationFlowLibrary } from '../services/automation/automationFlowLibrary'
import { buildAutomationIndex } from '../services/automation/automationIndexService'
import {
  createAppliedGlobalFlowOwnerKey,
  createAutomationFlowOwnerKey,
  getStoredAutomationFlowOwnerKey
} from '../services/automation/automationFlowOwnerIdentity'
import {
  loadAppliedGlobalFlowRefs,
  saveAppliedGlobalFlowRefs
} from '../services/automation/automationAppliedGlobalFlows'
import { listMarkdownExecutorFiles } from '../services/automation/automationExecutorLibrary'
import {
  assertUserAutomationFlowPath,
  assertWorkspaceAutomationFlowPath,
  getUserAutomationFlowRoot,
  getWorkspaceAutomationFlowRoot
} from '../services/automation/automationPathSafety'
import { createAutomationSkillCatalogProvider } from '../services/automation/automationSkillCatalog'
import {
  AUTOMATION_NO_WORKSPACE_ID,
  normalizeAutomationProjectionFilters
} from '../services/automation/automationProjectionFilters'
import type {
  AutomationStoredRun,
  AutomationStore,
  AutomationTaskDataSnapshotRecord
} from '../services/automation/automationStore'
import {
  AutomationRunCancellationError,
  type AutomationRuntime
} from '../services/automation/automationRuntime'
import { isAutomationRunLockActive } from '../services/automation/automationRunLocks'

interface RegisterAutomationHandlersOptions {
  readonly adapterRegistry: AutomationAdapterRegistry
  readonly getActiveWorkspaceRoot: (
    event?: Pick<IpcMainInvokeEvent, 'sender'> | null
  ) => string | null
  readonly homePath: string
  readonly ipcMain: Pick<IpcMain, 'handle'>
  readonly now?: () => string
  readonly repoRoot?: string
  readonly runtime: AutomationRuntime
  readonly store: AutomationStore
}

interface AutomationContext {
  readonly candidates: readonly AutomationFlowTaskCandidate[]
  readonly discoveredSources: readonly AutomationDiscoveredTaskSource[]
  readonly executorsByOwnerKey: ReadonlyMap<string, readonly AutomationFlowExecutorRef[]>
  readonly flows: readonly ParsedAutomationFlow[]
  readonly ownerKeyByFlow: ReadonlyMap<ParsedAutomationFlow, string>
  readonly projection: AutomationProjection
}

interface BuildAutomationContextOptions {
  readonly includeAllScopes?: boolean
  readonly startDiscovery?: boolean
}

const createDiagnostic = (
  code: string,
  technicalMessage: string,
  severity: AutomationDiagnostic['severity'] = 'error'
): AutomationDiagnostic =>
  Object.freeze({
    code,
    diagnosticId: `automation:${code}`,
    message: code,
    messageKey: `automation.diagnostics.${code}`,
    severity,
    technicalMessage
  })

const mapFlowDiagnostic = (
  diagnostic: AutomationFlowDiagnostic
): AutomationDiagnostic =>
  Object.freeze({
    code: diagnostic.code,
    diagnosticId: `automation-flow:${diagnostic.code}:${diagnostic.sourceFile ?? 'inline'}`,
    message: diagnostic.code,
    messageKey: diagnostic.messageKey,
    ...(diagnostic.missingField !== undefined
      ? { missingField: diagnostic.missingField }
      : {}),
    severity: diagnostic.severity,
    ...(diagnostic.sectionName !== undefined
      ? { sectionName: diagnostic.sectionName }
      : {}),
    ...(diagnostic.sourceFile !== undefined
      ? { sourceFile: diagnostic.sourceFile }
      : {}),
    ...(diagnostic.technicalMessage !== undefined
      ? { technicalMessage: diagnostic.technicalMessage }
      : {})
  })

const mapAutomationAdapterCapabilityError = (
  error: AutomationAdapterCapabilityError,
  fallbackCode: string
): AutomationDiagnostic => {
  switch (error.reason) {
    case 'authentication-required':
      return createDiagnostic(
        'automationAdapter.authenticationRequired',
        error.message
      )
    case 'missing-required-capability':
      return createDiagnostic(
        fallbackCode,
        error.message
      )
    case 'capability-unavailable':
      return createDiagnostic(
        fallbackCode,
        error.message
      )
  }
}

const mapAutomationRunStartError = (
  error: unknown,
  fallbackCode: string,
  fallbackTechnicalMessage: string
): AutomationDiagnostic =>
  error instanceof AutomationAdapterCapabilityError
    ? mapAutomationAdapterCapabilityError(error, fallbackCode)
    : createDiagnostic(
        fallbackCode,
        error instanceof Error ? error.message : fallbackTechnicalMessage
      )

const mapCapabilityReport = (
  report: AgentCliCapabilityProbeReport
): AutomationAdapterCapabilityReport =>
  Object.freeze({
    authenticated: report.authenticated,
    capabilities: Object.freeze({ ...report.capabilities }),
    checkedAt: report.checkedAt,
    ...(report.commandPath !== undefined ? { commandPath: report.commandPath } : {}),
    detected: report.detected,
    diagnostics: report.diagnostics,
    engine: report.engine,
    verdict: report.verdict,
    ...(report.version !== undefined ? { version: report.version } : {}),
    workspaceSupported: report.workspaceSupported
  })

const mapDefinitionDocument = (
  document: Awaited<
    ReturnType<
      ReturnType<typeof createAutomationFlowDefinitionService>['loadEditableDocument']
    >
  >
): AutomationFlowDefinitionDocument =>
  Object.freeze({
    diagnostics: document.validation.diagnostics.map(mapFlowDiagnostic),
    markdown: document.markdown,
    path: document.path,
    valid: document.validation.ok
  })

const assertRecord = (value: unknown, name: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object`)
  }

  return value as Record<string, unknown>
}

const assertString = (value: unknown, name: string): string => {
  if (typeof value !== 'string') {
    throw new Error(`${name} must be a string`)
  }

  return value
}

const assertOptionalStringArray = (
  value: unknown,
  name: string
): readonly string[] | undefined => {
  if (value === undefined) {
    return undefined
  }

  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array`)
  }

  return Object.freeze(
    value.map((item, index) => assertString(item, `${name}[${index}]`))
  )
}

const assertProjectionFilters = (
  value: unknown
): AutomationCenterFilters => {
  if (value === undefined) {
    return Object.freeze({})
  }

  const filters = assertRecord(value, 'Automation filters')

  const scopeIds = assertOptionalStringArray(
    filters.scopeIds,
    'Scope ids'
  )?.filter(
    (scopeId): scopeId is AutomationCenterScopeId =>
      scopeId === 'global' || scopeId.startsWith('workspace:')
  )

  return Object.freeze({
    ...(typeof filters.archivedVisible === 'boolean'
      ? { archivedVisible: filters.archivedVisible }
      : {}),
    ...(typeof filters.bucket === 'string' ? { bucket: filters.bucket as never } : {}),
    ...(filters.flowIds !== undefined
      ? { flowIds: assertOptionalStringArray(filters.flowIds, 'Flow ids') }
      : {}),
    ...(filters.flowOwnerKeys !== undefined
      ? {
          flowOwnerKeys: assertOptionalStringArray(
            filters.flowOwnerKeys,
            'Flow owner keys'
          )
        }
      : {}),
    ...(scopeIds !== undefined ? { scopeIds: Object.freeze(scopeIds) } : {}),
    ...(filters.workspaceIds !== undefined
      ? {
          workspaceIds: assertOptionalStringArray(
            filters.workspaceIds,
            'Workspace ids'
          )
        }
      : {})
  })
}

const assertOptionalProjectionRequest = (
  value: unknown
): AutomationGetProjectionRequest | undefined => {
  if (value === undefined) {
    return undefined
  }

  const request = assertRecord(value, 'Automation projection request')

  return Object.freeze({
    ...(request.filters !== undefined
      ? { filters: assertProjectionFilters(request.filters) }
      : {}),
    ...(typeof request.workspaceRoot === 'string'
      ? { workspaceRoot: request.workspaceRoot }
      : {}),
    ...(request.workspaceRoots !== undefined
      ? {
          workspaceRoots: assertOptionalStringArray(
            request.workspaceRoots,
            'Workspace roots'
          )
        }
      : {})
  })
}

const getWorkspaceRoot = (
  event: Pick<IpcMainInvokeEvent, 'sender'>,
  getActiveWorkspaceRoot: RegisterAutomationHandlersOptions['getActiveWorkspaceRoot'],
  request?: AutomationGetProjectionRequest
): string | undefined => {
  const activeWorkspaceRoot = getActiveWorkspaceRoot(event)
  const requestedWorkspaceRoot = request?.workspaceRoot

  if (
    activeWorkspaceRoot !== null &&
    requestedWorkspaceRoot !== undefined &&
    requestedWorkspaceRoot !== activeWorkspaceRoot
  ) {
    throw new Error('Workspace changed before automation operation completed')
  }

  return requestedWorkspaceRoot ?? activeWorkspaceRoot ?? undefined
}

const getRequiredWorkspaceRoot = (
  event: Pick<IpcMainInvokeEvent, 'sender'>,
  getActiveWorkspaceRoot: RegisterAutomationHandlersOptions['getActiveWorkspaceRoot'],
  request?: AutomationGetProjectionRequest
): string => {
  const workspaceRoot = getWorkspaceRoot(event, getActiveWorkspaceRoot, request)

  if (workspaceRoot === undefined) {
    throw new Error('Open a workspace before using workspace automation')
  }

  return workspaceRoot
}

const createDefinitionService = ({
  homePath,
  workspaceRoot
}: {
  readonly homePath: string
  readonly workspaceRoot?: string
}) =>
  createAutomationFlowDefinitionService({
    homePath,
    workspaceRoot
  })

const assertCreateTemplateRequest = (
  value: unknown
): AutomationCreateFlowFromTemplateRequest => {
  const request = assertRecord(value, 'Automation template request')

  return {
    defaultEngine: assertString(request.defaultEngine, 'Default engine'),
    flowId: assertString(request.flowId, 'Flow id'),
    scope: assertString(request.scope, 'Scope') as AutomationCreateFlowFromTemplateRequest['scope'],
    templateId: assertString(
      request.templateId,
      'Template id'
    ) as AutomationCreateFlowFromTemplateRequest['templateId']
  }
}

const assertArchiveFlowCommand = (value: unknown): AutomationArchiveFlowCommand => {
  const command = assertRecord(value, 'Automation archive command')

  return {
    filePath: assertString(command.filePath, 'File path')
  }
}

const assertDeleteFlowCommand = (value: unknown): AutomationDeleteFlowCommand => {
  const command = assertRecord(value, 'Automation delete command')

  return {
    filePath: assertString(command.filePath, 'File path')
  }
}

const assertRenameFlowCommand = (value: unknown): AutomationRenameFlowCommand => {
  const command = assertRecord(value, 'Automation rename command')
  const name = assertString(command.name, 'Name').trim()

  if (name.length === 0) {
    throw new Error('Name is required')
  }

  return {
    filePath: assertString(command.filePath, 'File path'),
    name
  }
}

const assertLoadFlowDefinitionCommand = (
  value: unknown
): AutomationLoadFlowDefinitionCommand => {
  const command = assertRecord(value, 'Automation load definition command')

  return {
    filePath: assertString(command.filePath, 'File path')
  }
}

const assertSaveFlowDefinitionCommand = (
  value: unknown
): AutomationSaveFlowDefinitionCommand => {
  const command = assertRecord(value, 'Automation save definition command')

  return {
    filePath: assertString(command.filePath, 'File path'),
    markdown: assertString(command.markdown, 'Markdown')
  }
}

const assertSetLifecycleCommand = (
  value: unknown
): AutomationSetFlowLifecycleCommand => {
  const command = assertRecord(value, 'Automation lifecycle command')

  return {
    filePath: assertString(command.filePath, 'File path'),
    lifecycle: assertString(
      command.lifecycle,
      'Lifecycle'
    ) as AutomationSetFlowLifecycleCommand['lifecycle'],
    ...(typeof command.workspaceRoot === 'string'
      ? { workspaceRoot: command.workspaceRoot }
      : {})
  }
}

type AutomationStartRunInput = Pick<AutomationStartRunRequest, 'taskId'> &
  Partial<Omit<AutomationStartRunRequest, 'taskId'>>

const assertStartRunRequest = (value: unknown): AutomationStartRunInput => {
  const command = assertRecord(value, 'Automation start command')

  return {
    ...(typeof command.executorId === 'string'
      ? { executorId: command.executorId }
      : {}),
    ...(typeof command.executorSnapshotId === 'string'
      ? { executorSnapshotId: command.executorSnapshotId }
      : {}),
    ...(typeof command.taskDataId === 'string'
      ? { taskDataId: command.taskDataId }
      : {}),
    ...(typeof command.taskDataSnapshotId === 'string'
      ? { taskDataSnapshotId: command.taskDataSnapshotId }
      : {}),
    taskId: assertString(command.taskId, 'Task id')
  }
}

const SAFE_DRAFT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,80}$/u

const assertSafeDraftId = (value: unknown, name: string): string => {
  const id = assertString(value, name).trim()

  if (!SAFE_DRAFT_ID_PATTERN.test(id) || id.includes('..')) {
    throw new Error(`${name} must be a safe automation id`)
  }

  return id
}

const assertCreateFlowDraftRequest = (
  value: unknown
): AutomationCreateFlowDraftRequest => {
  const request = assertRecord(value, 'Automation flow draft request')

  return {
    displayName: assertString(request.displayName, 'Display name'),
    flowId: assertSafeDraftId(request.flowId, 'Flow id'),
    ...(request.scope === 'user' || request.scope === 'workspace'
      ? { scope: request.scope }
      : {}),
    ...(typeof request.workspaceRoot === 'string'
      ? { workspaceRoot: request.workspaceRoot }
      : {})
  }
}

const assertCreateExecutorDraftRequest = (
  value: unknown
): AutomationCreateExecutorDraftRequest => {
  const request = assertRecord(value, 'Automation executor draft request')

  return {
    displayName: assertString(request.displayName, 'Display name'),
    executorId: assertSafeDraftId(request.executorId, 'Executor id'),
    flowId: assertSafeDraftId(request.flowId, 'Flow id'),
    ...(request.scope === 'user' || request.scope === 'workspace'
      ? { scope: request.scope }
      : {}),
    ...(typeof request.workspaceRoot === 'string'
      ? { workspaceRoot: request.workspaceRoot }
      : {})
  }
}

const assertApplyGlobalFlowRequest = (
  value: unknown
): AutomationApplyGlobalFlowRequest => {
  const request = assertRecord(value, 'Automation global flow request')

  return {
    flowId: assertSafeDraftId(request.flowId, 'Flow id'),
    ...(typeof request.workspaceRoot === 'string'
      ? { workspaceRoot: request.workspaceRoot }
      : {})
  }
}

const assertOpenManagementTargetRequest = (
  value: unknown
): AutomationOpenManagementTargetRequest => {
  const request = assertRecord(value, 'Automation management target request')
  const target = assertString(request.target, 'Target')

  if (target !== 'global' && target !== 'workspace') {
    throw new Error('Target must be global or workspace')
  }

  return {
    ...(typeof request.flowId === 'string'
      ? { flowId: assertSafeDraftId(request.flowId, 'Flow id') }
      : {}),
    target,
    ...(typeof request.workspaceRoot === 'string'
      ? { workspaceRoot: request.workspaceRoot }
      : {})
  }
}

const assertSubmitDecisionRequest = (
  value: unknown
): AutomationSubmitDecisionRequest => {
  const command = assertRecord(value, 'Automation decision command')

  return {
    decisionId: assertString(command.decisionId, 'Decision id'),
    response: assertString(command.response, 'Decision response')
  }
}

const getTemplateById = (
  templateId: AutomationCreateFlowFromTemplateRequest['templateId']
) => listBuiltInAutomationFlowTemplates().find((template) => template.id === templateId)

const validateTemplateInput = (
  request: AutomationCreateFlowFromTemplateRequest,
  workspaceRoot: string | undefined
): AutomationValidateTemplateInputResponse => {
  const template = getTemplateById(request.templateId)
  const diagnostics: AutomationDiagnostic[] = []

  if (template === undefined) {
    diagnostics.push(
      createDiagnostic(
        'automationFlowTemplate.unknownTemplate',
        'Unknown automation-flow template.'
      )
    )
  }

  if (request.flowId.trim().length === 0) {
    diagnostics.push(
      createDiagnostic(
        'automationFlowTemplate.invalidFlowId',
        'Automation-flow id is required.'
      )
    )
  }

  if (
    template !== undefined &&
    !template.allowedScopes.includes(request.scope)
  ) {
    diagnostics.push(
      createDiagnostic(
        'automationFlowTemplate.unsupportedScope',
        'Automation-flow template does not support the requested scope.'
      )
    )
  }

  if (request.scope === 'workspace' && workspaceRoot === undefined) {
    diagnostics.push(
      createDiagnostic(
        'automationFlowTemplate.workspaceRequired',
        'Workspace root is required.'
      )
    )
  }

  return Object.freeze({
    diagnostics,
    ok: diagnostics.length === 0
  })
}

const renderFlowDraftMarkdown = ({
  displayName,
  flowId,
  scope
}: {
  readonly displayName: string
  readonly flowId: string
  readonly scope: 'user' | 'workspace'
}): string => `---
id: ${flowId}
name: ${displayName}
scope: ${scope}
status: draft
lifecycle: enabled
allowedEngines:
  - codex
defaultEngine: codex
reportPattern: draft-report
sourceTypes:
  - ${scope === 'user' ? 'user-prompt' : 'workspace-markdown'}
loopPolicy:
  mode: manual
  intervalMinutes: 15
  maxActiveRuns: 1
  onBlocked: pause-automation-flow
  onEmpty: wait
executors:
  - id: implementation
    type: markdown
    path: ./${flowId}/implementation.md
    enabled: false
---

# ${displayName}

## Pick Rules

Describe what task data this flow should produce.

## Execution Standard

Describe how executors should run selected task data.

## Acceptance Standard

Describe when executor output is acceptable.

## Verification Expectations

Describe how results should be verified.

## Report Pattern

Describe the final report format.
`

const renderExecutorDraftMarkdown = (displayName: string): string => `# ${displayName}

## Purpose

Describe what this executor does with task data.

## Inputs

- Task data title
- Task data source
- Flow requirements

## Steps

1. Inspect the task data.
2. Execute the required work.
3. Report changed files and verification.

## Output

Return a concise implementation or verification report.
`

const mapTask = (task: AutomationProjectedTask) =>
  Object.freeze({
    activeRunId: task.activeRunId,
    automationFlowId: task.automationFlowId,
    ...(task.automationFlowOwnerKey !== undefined
      ? { automationFlowOwnerKey: task.automationFlowOwnerKey }
      : {}),
    ...(task.blockingDiagnostics !== undefined
      ? { blockingDiagnostics: task.blockingDiagnostics }
      : {}),
    bucket: task.bucket,
    ...(task.eligibleExecutors !== undefined
      ? {
          eligibleExecutors: task.eligibleExecutors.map((executor) =>
            Object.freeze({
              displayName: executor.displayName,
              executorId: executor.executorId,
              ...(executor.executorSnapshotId !== undefined
                ? { executorSnapshotId: executor.executorSnapshotId }
                : {}),
              ...(executor.sourcePath !== undefined
                ? { sourcePath: executor.sourcePath }
                : {}),
              ...(executor.sourceClass !== undefined
                ? { sourceClass: executor.sourceClass }
                : {}),
              type: executor.type
            })
          )
        }
      : {}),
    engine: task.engine,
    executorSnapshotId: task.executorSnapshotId,
    latestReportId: task.latestReportId,
    ...(task.primaryExecutor !== undefined
      ? {
          primaryExecutor: Object.freeze({
            displayName: task.primaryExecutor.displayName,
            executorId: task.primaryExecutor.executorId,
            ...(task.primaryExecutor.executorSnapshotId !== undefined
              ? { executorSnapshotId: task.primaryExecutor.executorSnapshotId }
              : {}),
            ...(task.primaryExecutor.sourcePath !== undefined
              ? { sourcePath: task.primaryExecutor.sourcePath }
              : {}),
            ...(task.primaryExecutor.sourceClass !== undefined
              ? { sourceClass: task.primaryExecutor.sourceClass }
              : {}),
            type: task.primaryExecutor.type
          })
        }
      : {}),
    priority: task.priority,
    relativePath: task.relativePath,
    sourceItemId: task.sourceItemId,
    sourcePath: task.sourcePath,
    sourceType: task.sourceType,
    sourceUri: task.sourceUri,
    taskId: task.taskId,
    taskDataId: task.taskDataId,
    taskDataSnapshotId: task.taskDataSnapshotId,
    title: task.title,
    workspaceId: getTaskWorkspaceId(task)
  })

const mapRunSummary = (
  run: AutomationStoredRun,
  availableActions: readonly AutomationRunAction[] = Object.freeze([]),
  discoveryResult?: AutomationRunDiscoveryResultSummary,
  processSteps: readonly AutomationRunProcessStep[] = Object.freeze([])
): AutomationRunSummary =>
  Object.freeze({
    ...(run.adapterSessionId !== undefined
      ? { adapterSessionId: run.adapterSessionId }
      : {}),
    ...(run.adapterSessionLineage !== undefined
      ? { adapterSessionLineage: run.adapterSessionLineage }
      : {}),
    automationFlowId: run.automationFlowId,
    ...(run.automationFlowOwnerKey !== undefined
      ? { automationFlowOwnerKey: run.automationFlowOwnerKey }
      : {}),
    ...(run.automationFlowSnapshotId !== undefined
      ? { automationFlowSnapshotId: run.automationFlowSnapshotId }
      : {}),
    availableActions: Object.freeze([...availableActions]),
    ...(discoveryResult !== undefined ? { discoveryResult } : {}),
    engine: run.engine,
    ...(run.executorId !== undefined ? { executorId: run.executorId } : {}),
    ...(run.executorSnapshotId !== undefined
      ? { executorSnapshotId: run.executorSnapshotId }
      : {}),
    processSteps: Object.freeze([...processSteps]),
    runId: run.runId,
    runKind: run.runKind,
    ...(run.sourceItemId !== undefined ? { sourceItemId: run.sourceItemId } : {}),
    ...(run.sourcePath !== undefined ? { sourcePath: run.sourcePath } : {}),
    ...(run.sourceSnapshotHash !== undefined
      ? { sourceSnapshotHash: run.sourceSnapshotHash }
      : {}),
    startedAt: run.startedAt,
    state: run.state,
    taskId: run.taskId,
    ...(run.taskDataId !== undefined ? { taskDataId: run.taskDataId } : {}),
    ...(run.taskDataSnapshotId !== undefined
      ? { taskDataSnapshotId: run.taskDataSnapshotId }
      : {}),
    ...(run.title !== undefined ? { title: run.title } : {}),
    updatedAt: run.updatedAt,
    ...(run.workspaceRoot !== undefined ? { workspaceId: run.workspaceRoot } : {})
  })

const resolveRunActionMap = async (
  runs: readonly AutomationStoredRun[],
  runtime: AutomationRuntime
): Promise<ReadonlyMap<string, readonly AutomationRunAction[]>> =>
  new Map(
    await Promise.all(
      runs.map(async (run) => {
        try {
          const actions = await runtime.getRunActions({
            engine: run.engine,
            runId: run.runId,
            workspaceRoot: run.workspaceRoot
          })

          return [run.runId, actions] as const
        } catch {
          return [run.runId, Object.freeze([])] as const
        }
      })
    )
  )

const mapDiscoveryResultByRunId = (
  snapshots: readonly AutomationTaskDataSnapshotRecord[]
): ReadonlyMap<string, AutomationRunDiscoveryResultSummary> => {
  const sourcesByRunId = new Map<
    string,
    AutomationRunDiscoveryResultSummary['sources'][number][]
  >()

  for (const snapshot of snapshots) {
    const source = snapshot.taskSourceSnapshot

    sourcesByRunId.set(snapshot.lastSeenDiscoveryRunId, [
      ...(sourcesByRunId.get(snapshot.lastSeenDiscoveryRunId) ?? []),
      Object.freeze({
        ...(source.relativePath !== undefined
          ? { relativePath: source.relativePath }
          : {}),
        sourceItemId: source.sourceItemId,
        ...(source.sourcePath !== undefined ? { sourcePath: source.sourcePath } : {}),
        sourceType: source.sourceType,
        ...(source.sourceUri !== undefined ? { sourceUri: source.sourceUri } : {}),
        title: source.title
      })
    ])
  }

  return new Map(
    Array.from(sourcesByRunId.entries()).map(([runId, sources]) => [
      runId,
      Object.freeze({
        sourceCount: sources.length,
        sources: Object.freeze(
          [...sources].sort(
            (left, right) =>
              left.title.localeCompare(right.title) ||
              left.sourceItemId.localeCompare(right.sourceItemId)
          )
        )
      })
    ])
  )
}

const createRunProcessSteps = (
  run: AutomationStoredRun,
  discoveryResult: AutomationRunDiscoveryResultSummary | undefined
): readonly AutomationRunProcessStep[] =>
  Object.freeze([
    Object.freeze({
      createdAt: run.startedAt,
      type: 'started'
    } satisfies AutomationRunProcessStep),
    ...(run.runKind === 'discovery'
      ? [
          Object.freeze({
            createdAt: run.updatedAt,
            sourceCount: discoveryResult?.sourceCount ?? 0,
            type: 'discovered-task-sources'
          } satisfies AutomationRunProcessStep)
        ]
      : []),
    Object.freeze({
      createdAt: run.updatedAt,
      state: run.state,
      type: 'state-updated'
    } satisfies AutomationRunProcessStep)
  ])

const mapFilterBucketToTaskBucket = (
  bucket: AutomationCenterFilters['bucket']
): AutomationProjectedTask['bucket'] | undefined => {
  if (bucket === 'needsMe') {
    return 'needs-me'
  }

  return bucket
}

const getWorkspaceIdFromOwnerKey = (ownerKey: string | undefined): string | undefined => {
  const match = /^workspace:([^:]+):(flow|applied-global):/u.exec(ownerKey ?? '')

  return match?.[1] === undefined ? undefined : decodeURIComponent(match[1])
}

const getTaskScopeId = (task: {
  readonly automationFlowOwnerKey?: string
  readonly workspaceId?: string
}): AutomationCenterScopeId => {
  const workspaceId =
    task.workspaceId === undefined || task.workspaceId === AUTOMATION_NO_WORKSPACE_ID
      ? getWorkspaceIdFromOwnerKey(task.automationFlowOwnerKey)
      : task.workspaceId

  return workspaceId === undefined || workspaceId === AUTOMATION_NO_WORKSPACE_ID
    ? 'global'
    : `workspace:${workspaceId}`
}

const getFlowRowScopeId = (flow: AutomationFlowRow): AutomationCenterScopeId =>
  flow.scope === 'user' &&
  !getStoredAutomationFlowOwnerKey({
    automationFlowId: flow.automationFlowId,
    automationFlowOwnerKey: flow.automationFlowOwnerKey,
    workspaceRoot: flow.workspaceId
  }).includes(':applied-global:')
    ? 'global'
    : `workspace:${flow.workspaceId ?? AUTOMATION_NO_WORKSPACE_ID}`

const applyTaskFilters = <
  Task extends {
    readonly automationFlowId: string
    readonly automationFlowOwnerKey?: string
    readonly bucket?: AutomationProjectedTask['bucket']
    readonly workspaceId?: string
  }
>(
  tasks: readonly Task[],
  filters: AutomationCenterFilters,
  options: {
    readonly includeBucket?: boolean
  } = {}
): readonly Task[] =>
  Object.freeze(
    tasks.filter((task) => {
      const shouldFilterBucket = options.includeBucket ?? true
      const bucket = shouldFilterBucket
        ? mapFilterBucketToTaskBucket(filters.bucket)
        : undefined
      const flowOwnerKeys = filters.flowOwnerKeys ?? []
      const scopeIds = filters.scopeIds ?? []
      const taskScopeId = getTaskScopeId(task)

      return (
        (bucket === undefined || task.bucket === undefined || task.bucket === bucket) &&
        scopeIds.includes(taskScopeId) &&
        (flowOwnerKeys.length === 0 ||
          (task.automationFlowOwnerKey !== undefined &&
            flowOwnerKeys.includes(task.automationFlowOwnerKey)))
      )
    })
  )

const getTaskWorkspaceId = (task: {
  readonly workspaceId?: string
}): string => task.workspaceId ?? AUTOMATION_NO_WORKSPACE_ID

const areStringArraysEqual = (
  left: readonly string[] | undefined,
  right: readonly string[] | undefined
): boolean => {
  const leftValues = left ?? []
  const rightValues = right ?? []

  return (
    leftValues.length === rightValues.length &&
    leftValues.every((value, index) => value === rightValues[index])
  )
}

const areProjectionFiltersEqual = (
  left: AutomationCenterFilters,
  right: AutomationCenterFilters
): boolean =>
  (left.archivedVisible ?? false) === (right.archivedVisible ?? false) &&
  (left.bucket ?? 'ready') === (right.bucket ?? 'ready') &&
  areStringArraysEqual(left.flowIds, right.flowIds) &&
  areStringArraysEqual(left.flowOwnerKeys, right.flowOwnerKeys) &&
  areStringArraysEqual(left.scopeIds, right.scopeIds) &&
  areStringArraysEqual(left.workspaceIds, right.workspaceIds)

const hasProjectionFilterProperty = (
  filters: AutomationCenterFilters,
  property: keyof AutomationCenterFilters
): boolean => Object.prototype.hasOwnProperty.call(filters, property)

const normalizeStoredProjectionFiltersForPersistence = ({
  normalized,
  stored
}: {
  readonly normalized: AutomationCenterFilters
  readonly stored: AutomationCenterFilters
}): AutomationCenterFilters => Object.freeze({
  ...stored,
  ...(hasProjectionFilterProperty(stored, 'archivedVisible')
    ? { archivedVisible: normalized.archivedVisible }
    : {}),
  ...(hasProjectionFilterProperty(stored, 'bucket')
    ? { bucket: normalized.bucket }
    : {}),
  ...(hasProjectionFilterProperty(stored, 'flowIds')
    ? { flowIds: normalized.flowIds }
    : {}),
  ...(hasProjectionFilterProperty(stored, 'flowOwnerKeys')
    ? { flowOwnerKeys: normalized.flowOwnerKeys }
    : {}),
  ...(hasProjectionFilterProperty(stored, 'scopeIds')
    ? { scopeIds: normalized.scopeIds }
    : {}),
  ...(hasProjectionFilterProperty(stored, 'workspaceIds')
    ? { workspaceIds: normalized.workspaceIds }
    : {})
})

const getCurrentFlowOwnerKey = (
  ownerKeyByFlow: ReadonlyMap<ParsedAutomationFlow, string>,
  automationFlow: ParsedAutomationFlow
): string => {
  const ownerKey = ownerKeyByFlow.get(automationFlow)

  if (ownerKey === undefined) {
    throw new Error('Automation-flow owner key was not calculated.')
  }

  return ownerKey
}

const isAppliedGlobalFlowOwnerKey = (ownerKey: string | undefined): boolean =>
  ownerKey?.includes(':applied-global:') ?? false

const resolveFlowWorkspaceId = ({
  ownerKey,
  scope,
  workspaceRoot
}: {
  readonly ownerKey?: string
  readonly scope: ParsedAutomationFlow['scope']
  readonly workspaceRoot?: string
}): string =>
  isAppliedGlobalFlowOwnerKey(ownerKey)
    ? (workspaceRoot ?? AUTOMATION_NO_WORKSPACE_ID)
    : scope === 'user'
      ? AUTOMATION_NO_WORKSPACE_ID
      : (workspaceRoot ?? AUTOMATION_NO_WORKSPACE_ID)

const getFlowsById = (
  automationFlows: readonly ParsedAutomationFlow[]
): ReadonlyMap<string, readonly ParsedAutomationFlow[]> => {
  const flowsById = new Map<string, ParsedAutomationFlow[]>()

  for (const automationFlow of automationFlows) {
    flowsById.set(automationFlow.id, [
      ...(flowsById.get(automationFlow.id) ?? []),
      automationFlow
    ])
  }

  return flowsById
}

const isLegacySourceSafelyOwnedByFlow = ({
  automationFlow,
  source,
  workspaceRoot
}: {
  readonly automationFlow: ParsedAutomationFlow
  readonly source: AutomationDiscoveredTaskSource
  readonly workspaceRoot?: string
}): boolean => {
  if (
    source.automationFlowOwnerKey !== undefined ||
    source.automationFlowId !== automationFlow.id ||
    (source.sourceType !== 'adapter-discovered' &&
      !automationFlow.sourceTypes.includes(source.sourceType))
  ) {
    return false
  }

  if (automationFlow.scope === 'user') {
    return (
      source.workspaceId === undefined ||
      source.workspaceId === AUTOMATION_NO_WORKSPACE_ID
    )
  }

  return workspaceRoot !== undefined && source.workspaceId === workspaceRoot
}

const getLegacyCompatibleOwnerKeys = ({
  flowsById,
  ownerKeyByFlow,
  source,
  workspaceRoot
}: {
  readonly flowsById: ReadonlyMap<string, readonly ParsedAutomationFlow[]>
  readonly ownerKeyByFlow: ReadonlyMap<ParsedAutomationFlow, string>
  readonly source: AutomationDiscoveredTaskSource
  readonly workspaceRoot?: string
}): readonly string[] =>
  Object.freeze(
    (flowsById.get(source.automationFlowId) ?? [])
      .filter((automationFlow) =>
        isLegacySourceSafelyOwnedByFlow({
          automationFlow,
          source,
          workspaceRoot
        })
      )
      .map((automationFlow) =>
        getCurrentFlowOwnerKey(ownerKeyByFlow, automationFlow)
      )
  )

const filterDiscoveredSourcesForCurrentOwners = ({
  automationFlows,
  ownerKeyByFlow,
  sources,
  workspaceRoot
}: {
  readonly automationFlows: readonly ParsedAutomationFlow[]
  readonly ownerKeyByFlow: ReadonlyMap<ParsedAutomationFlow, string>
  readonly sources: readonly AutomationDiscoveredTaskSource[]
  readonly workspaceRoot?: string
}): readonly AutomationDiscoveredTaskSource[] => {
  const flowsById = getFlowsById(automationFlows)
  const currentOwnerKeys = new Set(ownerKeyByFlow.values())
  const exactOwnerKeysWithSources = new Set(
    sources
      .map((source) => source.automationFlowOwnerKey)
      .filter((ownerKey): ownerKey is string =>
        ownerKey !== undefined && currentOwnerKeys.has(ownerKey)
      )
  )

  return Object.freeze(
    sources.filter((source) => {
      if (source.automationFlowOwnerKey !== undefined) {
        return currentOwnerKeys.has(source.automationFlowOwnerKey)
      }

      const compatibleOwnerKeys = getLegacyCompatibleOwnerKeys({
        flowsById,
        ownerKeyByFlow,
        source,
        workspaceRoot
      })

      return (
        compatibleOwnerKeys.length > 0 &&
        compatibleOwnerKeys.some(
          (ownerKey) => !exactOwnerKeysWithSources.has(ownerKey)
        )
      )
    })
  )
}

const sourceMatchesCandidate = (
  source: AutomationDiscoveredTaskSource,
  candidate: AutomationFlowTaskCandidate
): boolean =>
  source.automationFlowId === candidate.automationFlowId &&
  source.sourceItemId === candidate.sourceItemId

const findTaskSource = (
  sources: readonly AutomationDiscoveredTaskSource[],
  candidate: AutomationFlowTaskCandidate
): AutomationDiscoveredTaskSource | undefined => {
  const matchingSources = sources.filter((source) =>
    sourceMatchesCandidate(source, candidate)
  )

  if (candidate.automationFlowOwnerKey !== undefined) {
    return (
      matchingSources.find(
        (source) =>
          source.automationFlowOwnerKey === candidate.automationFlowOwnerKey
      ) ??
      matchingSources.find(
        (source) => source.automationFlowOwnerKey === undefined
      )
    )
  }

  return matchingSources.find(
    (source) => source.automationFlowOwnerKey === undefined
  )
}

const findTaskSourceForStart = (
  sources: readonly AutomationDiscoveredTaskSource[],
  candidate: AutomationFlowTaskCandidate,
  command: AutomationStartRunInput
): AutomationDiscoveredTaskSource | undefined =>
  findTaskSource(sources, candidate) ??
  sources.find(
    (source) =>
      source.taskDataId === command.taskDataId &&
      source.taskDataSnapshotId === command.taskDataSnapshotId
  )

const findStartTask = (
  projection: AutomationProjection,
  command: AutomationStartRunInput
) =>
  projection.tasks.find(
    (task) =>
      task.taskId === command.taskId &&
      (command.taskDataId === undefined ||
        task.taskDataId === command.taskDataId) &&
      (command.taskDataSnapshotId === undefined ||
        task.taskDataSnapshotId === command.taskDataSnapshotId)
  )

const findStartCandidate = (
  candidates: readonly AutomationFlowTaskCandidate[],
  command: AutomationStartRunInput
): AutomationFlowTaskCandidate | undefined =>
  candidates.find(
    (candidate) =>
      candidate.taskId === command.taskId &&
      (command.taskDataId === undefined ||
        candidate.taskDataId === command.taskDataId) &&
      (command.taskDataSnapshotId === undefined ||
        candidate.taskDataSnapshotId === command.taskDataSnapshotId)
  )

const toExecutorRuntimeSnapshot = (
  executor: AutomationTaskExecutorSummary | undefined,
  executorsByOwnerKey: ReadonlyMap<string, readonly AutomationFlowExecutorRef[]>,
  ownerKey: string | undefined
): AutomationFlowExecutorRef | undefined => {
  if (executor === undefined || ownerKey === undefined) {
    return undefined
  }

  return executorsByOwnerKey.get(ownerKey)?.find(
    (candidate) =>
      candidate.executorId === executor.executorId &&
      (executor.executorSnapshotId === undefined ||
        candidate.executorSnapshotId === executor.executorSnapshotId)
  )
}

const resolveStartOwnerKey = ({
  automationFlow,
  candidate,
  ownerKeyByFlow,
  projectedTask
}: {
  readonly automationFlow: ParsedAutomationFlow | undefined
  readonly candidate: AutomationFlowTaskCandidate | undefined
  readonly ownerKeyByFlow: ReadonlyMap<ParsedAutomationFlow, string>
  readonly projectedTask:
    | {
        readonly automationFlowOwnerKey?: string
      }
    | undefined
}): string | undefined =>
  candidate?.automationFlowOwnerKey ??
  projectedTask?.automationFlowOwnerKey ??
  (automationFlow === undefined
    ? undefined
    : getCurrentFlowOwnerKey(ownerKeyByFlow, automationFlow))

const mapFlowRows = (
  flows: readonly ParsedAutomationFlow[],
  candidates: readonly AutomationFlowTaskCandidate[],
  diagnostics: readonly AutomationDiagnostic[],
  ownerKeyByFlow: ReadonlyMap<ParsedAutomationFlow, string>,
  workspaceRoot: string | undefined
): readonly AutomationFlowRow[] =>
  Object.freeze(
    flows.map((flow) => {
      const ownerKey = getCurrentFlowOwnerKey(ownerKeyByFlow, flow)

      return Object.freeze({
        automationFlowId: flow.id,
        automationFlowOwnerKey: ownerKey,
        ...(flow.sourceFile !== undefined ? { definitionPath: flow.sourceFile } : {}),
        diagnosticCount: diagnostics.filter(
          (diagnostic) => diagnostic.automationFlowId === flow.id
        ).length,
        lifecycle: flow.lifecycle,
        name: flow.name,
        scope: flow.scope,
        sourceTypes: flow.sourceTypes,
        status: flow.status,
        taskCount: candidates.filter(
          (candidate) =>
            candidate.automationFlowId === flow.id &&
            (candidate.automationFlowOwnerKey === ownerKey ||
              candidate.automationFlowOwnerKey === undefined)
        ).length,
        workspaceId: resolveFlowWorkspaceId({
          ownerKey,
          scope: flow.scope,
          workspaceRoot
        })
      })
    })
  )

const createReportOverlays = (
  reports: Awaited<ReturnType<AutomationStore['listReports']>>,
  runs: readonly AutomationStoredRun[]
): readonly AutomationReportOverlay[] => {
  const runById = new Map(runs.map((run) => [run.runId, run]))

  return Object.freeze(
    reports.flatMap((report) => {
      const run = report.runId === undefined ? undefined : runById.get(report.runId)

      if (run?.sourceItemId === undefined || run.runKind !== 'task') {
        return []
      }

      const sourceSnapshot = run.taskSourceSnapshot

      return [
        Object.freeze({
          automationFlowId: run.automationFlowId,
          completedAt: report.completedAt,
          engine: sourceSnapshot?.engine ?? run.engine,
          ...(sourceSnapshot?.priority !== undefined
            ? { priority: sourceSnapshot.priority }
            : {}),
          ...(sourceSnapshot?.relativePath !== undefined
            ? { relativePath: sourceSnapshot.relativePath }
            : {}),
          reportId: report.reportId,
          sourceItemId: run.sourceItemId,
          ...(sourceSnapshot?.sourcePath !== undefined
            ? { sourcePath: sourceSnapshot.sourcePath }
            : run.sourcePath !== undefined
              ? { sourcePath: run.sourcePath }
              : {}),
          ...(sourceSnapshot?.sourceType !== undefined
            ? { sourceType: sourceSnapshot.sourceType }
            : {}),
          ...(sourceSnapshot?.sourceUri !== undefined
            ? { sourceUri: sourceSnapshot.sourceUri }
            : {}),
          taskId: report.taskId,
          title: report.title,
          ...(sourceSnapshot?.workspaceId !== undefined
            ? { workspaceId: sourceSnapshot.workspaceId }
            : {})
        })
      ]
    })
  )
}

const createRunOverlays = (
  runs: readonly AutomationStoredRun[]
): readonly AutomationRunOverlay[] =>
  Object.freeze(
    runs.flatMap((run) =>
      run.sourceItemId === undefined || run.runKind !== 'task'
        ? []
        : [
            Object.freeze({
              automationFlowId: run.automationFlowId,
              ...(run.executorId !== undefined
                ? { executorId: run.executorId }
                : {}),
              ...(run.executorSnapshotId !== undefined
                ? { executorSnapshotId: run.executorSnapshotId }
                : {}),
              runKind: run.runKind,
              runId: run.runId,
              sourceItemId: run.sourceItemId,
              state: run.state,
              taskId: run.taskId,
              ...(run.taskDataId !== undefined
                ? { taskDataId: run.taskDataId }
                : {}),
              ...(run.taskDataSnapshotId !== undefined
                ? { taskDataSnapshotId: run.taskDataSnapshotId }
                : {})
            })
          ]
    )
  )

const isPathInside = (parentPath: string, childPath: string): boolean => {
  const relativePath = relative(parentPath, childPath)

  return (
    relativePath === '' ||
    (!relativePath.startsWith('..') && !isAbsolute(relativePath))
  )
}

const resolveMarkdownExecutorPath = ({
  executor,
  flowDefinitionPath,
  flowId
}: {
  readonly executor: AutomationFlowExecutorRef
  readonly flowDefinitionPath: string | undefined
  readonly flowId: string
}): string | undefined => {
  if (
    executor.type !== 'markdown' ||
    executor.sourcePath === undefined ||
    flowDefinitionPath === undefined
  ) {
    return undefined
  }

  const flowDefinitionRoot = dirname(flowDefinitionPath)
  const executorRoot = resolve(flowDefinitionRoot, flowId)
  const executorPath = isAbsolute(executor.sourcePath)
    ? resolve(executor.sourcePath)
    : resolve(flowDefinitionRoot, executor.sourcePath)

  return isPathInside(executorRoot, executorPath) ? executorPath : undefined
}

const resolveExecutorRuntimeSources = async ({
  executors,
  flowDefinitionPath,
  flowId,
  markdownSourceByPath,
  skillCatalogProvider
}: {
  readonly executors: readonly AutomationFlowExecutorRef[]
  readonly flowDefinitionPath?: string
  readonly flowId: string
  readonly markdownSourceByPath: ReadonlyMap<string, string>
  readonly skillCatalogProvider: ReturnType<typeof createAutomationSkillCatalogProvider>
}): Promise<readonly AutomationFlowExecutorRef[]> =>
  Object.freeze(
    await Promise.all(
      executors.map(async (executor) => {
        if (executor.type === 'skill' && executor.skillRef !== undefined) {
          const skillSource = await skillCatalogProvider.resolveSkillRef(
            executor.skillRef
          )

          return Object.freeze({
            ...executor,
            sourceClass: skillSource.sourceClass,
            ...(skillSource.content !== undefined
              ? { resolvedSource: skillSource.content }
              : {}),
            ...(skillSource.sourcePath !== undefined
              ? { sourcePath: skillSource.sourcePath }
              : {})
          })
        }

        const markdownPath = resolveMarkdownExecutorPath({
          executor,
          flowDefinitionPath,
          flowId
        })

        if (markdownPath === undefined) {
          return executor
        }

        const discoveredSource = markdownSourceByPath.get(markdownPath)

        if (discoveredSource !== undefined) {
          return Object.freeze({
            ...executor,
            resolvedSource: discoveredSource,
            sourcePath: markdownPath
          })
        }

        try {
          return Object.freeze({
            ...executor,
            resolvedSource: await readFile(markdownPath, 'utf8'),
            sourcePath: markdownPath
          })
        } catch {
          return executor
        }
      })
    )
  )

export const registerAutomationHandlers = ({
  adapterRegistry,
  getActiveWorkspaceRoot,
  homePath,
  ipcMain,
  now = () => new Date().toISOString(),
  repoRoot = process.cwd(),
  runtime,
  store
}: RegisterAutomationHandlersOptions): void => {
  let initialized = false
  const ensureInitialized = async (): Promise<void> => {
    if (initialized) {
      return
    }

    await store.initialize()
    initialized = true
  }

  const buildContext = async (
    event: Pick<IpcMainInvokeEvent, 'sender'>,
    request?: AutomationGetProjectionRequest,
    options: BuildAutomationContextOptions = {}
  ): Promise<AutomationContext> => {
    await ensureInitialized()

    const workspaceRoot = getWorkspaceRoot(event, getActiveWorkspaceRoot, request)
    const library = await loadAutomationFlowLibrary({ homePath, workspaceRoot })
    const appliedGlobalFlowRefs =
      workspaceRoot === undefined
        ? Object.freeze({ diagnostics: Object.freeze([]), flowIds: Object.freeze([]) })
        : await loadAppliedGlobalFlowRefs(workspaceRoot)
    const globalFlowById = new Map(
      library.automationFlows
        .filter((automationFlow) => automationFlow.scope === 'user')
        .map((automationFlow) => [automationFlow.id, automationFlow])
    )
    const appliedGlobalFlows =
      workspaceRoot === undefined
        ? []
        : appliedGlobalFlowRefs.flowIds.flatMap((flowId) => {
            const globalFlow = globalFlowById.get(flowId)

            return globalFlow === undefined ? [] : [{ ...globalFlow }]
          })
    const automationFlows = Object.freeze([
      ...library.automationFlows,
      ...appliedGlobalFlows
    ])
    let runs = await store.listRuns()
    const ownerKeyByFlow = new Map(
      library.automationFlows.map((automationFlow) => [
        automationFlow,
        createAutomationFlowOwnerKey({ automationFlow, workspaceRoot })
      ])
    )
    for (const automationFlow of appliedGlobalFlows) {
      if (workspaceRoot !== undefined) {
        ownerKeyByFlow.set(
          automationFlow,
          createAppliedGlobalFlowOwnerKey({
            flowId: automationFlow.id,
            workspaceId: workspaceRoot
          })
        )
      }
    }
    let discoveredSources = filterDiscoveredSourcesForCurrentOwners({
      automationFlows,
      ownerKeyByFlow,
      sources: await store.listDiscoveredTaskSources(),
      workspaceRoot
    })
    const hasDiscoveredSources = (automationFlow: ParsedAutomationFlow): boolean => {
      const ownerKey = getCurrentFlowOwnerKey(ownerKeyByFlow, automationFlow)

      return discoveredSources.some((source) =>
        source.automationFlowOwnerKey === undefined
          ? isLegacySourceSafelyOwnedByFlow({
              automationFlow,
              source,
              workspaceRoot
            })
          : source.automationFlowOwnerKey === ownerKey
      )
    }
    const hasActiveDiscoveryRun = (
      automationFlow: ParsedAutomationFlow
    ): boolean => {
      const ownerKey = getCurrentFlowOwnerKey(ownerKeyByFlow, automationFlow)

      return runs.some(
        (run) =>
          run.runKind === 'discovery' &&
          isAutomationRunLockActive(run) &&
          getStoredAutomationFlowOwnerKey({
            automationFlowId: run.automationFlowId,
            automationFlowOwnerKey: run.automationFlowOwnerKey,
            workspaceRoot: run.workspaceRoot
          }) === ownerKey
      )
    }
    const discoveryDiagnostics: AutomationDiagnostic[] = []

    if (options.startDiscovery !== false) {
      for (const automationFlow of automationFlows) {
        if (
          automationFlow.lifecycle !== 'enabled' ||
          hasDiscoveredSources(automationFlow) ||
          hasActiveDiscoveryRun(automationFlow)
        ) {
          continue
        }

        try {
          await runtime.startDiscoveryRun({
            automationFlow,
            automationFlowOwnerKey: getCurrentFlowOwnerKey(
              ownerKeyByFlow,
              automationFlow
            ),
            workspaceRoot
          })
        } catch (error) {
          discoveryDiagnostics.push(
            mapAutomationRunStartError(
              error,
              'automationDiscovery.runCapabilityUnavailable',
              'Discovery run could not be started.'
            )
          )
        }
      }
    }

    runs = await store.listRuns()
    discoveredSources = filterDiscoveredSourcesForCurrentOwners({
      automationFlows,
      ownerKeyByFlow,
      sources: await store.listDiscoveredTaskSources(),
      workspaceRoot
    })
    const decisions = await store.listDecisions()
    const reports = await store.listReports()
    const taskDataSnapshots = await store.listTaskDataSnapshots()
    const skillCatalogProvider = createAutomationSkillCatalogProvider({
      homePath,
      repoRoot,
      workspaceRoot
    })
    await skillCatalogProvider.refresh('manual')
    const executorEntries = await Promise.all(
      automationFlows.map(async (automationFlow) => {
        const autoDiscoveredMarkdownExecutors =
          automationFlow.sourceFile === undefined
            ? []
            : await listMarkdownExecutorFiles({
                flowDefinitionPath: automationFlow.sourceFile,
                flowId: automationFlow.id
              })
        const resolvedExecutors = resolveAutomationFlowExecutors({
          autoDiscoveredMarkdownExecutors,
          declarations: automationFlow.executors ?? [],
          flowId: automationFlow.id
        }).executors
        const markdownSourceByPath = new Map(
          autoDiscoveredMarkdownExecutors.map((executor) => [
            resolve(executor.path),
            executor.content
          ])
        )
        const runtimeExecutors = await resolveExecutorRuntimeSources({
          executors: resolvedExecutors,
          flowDefinitionPath: automationFlow.sourceFile,
          flowId: automationFlow.id,
          markdownSourceByPath,
          skillCatalogProvider
        })

        return [
          getCurrentFlowOwnerKey(ownerKeyByFlow, automationFlow),
          runtimeExecutors
        ] as const
      })
    )
    const executorsByOwnerKey = new Map(executorEntries)
    const index = buildAutomationIndex({
      automationFlows,
      discoveredSources,
      executorsByOwnerKey,
      ownerKeyByFlow,
      reports: createReportOverlays(reports, runs),
      runs: createRunOverlays(runs)
    })
    const diagnostics = Object.freeze([
      ...library.diagnostics.map(mapFlowDiagnostic),
      ...appliedGlobalFlowRefs.diagnostics.map(mapFlowDiagnostic),
      ...discoveryDiagnostics,
      ...index.diagnostics.map(mapFlowDiagnostic)
    ])
    const flowRows = mapFlowRows(
      automationFlows,
      index.candidates,
      diagnostics,
      ownerKeyByFlow,
      workspaceRoot
    )
    const sidecarWorkspaceRoots = Array.from(
      new Set(
        (request?.workspaceRoots ?? [])
          .map((requestedWorkspaceRoot) => requestedWorkspaceRoot.trim())
          .filter((requestedWorkspaceRoot) => requestedWorkspaceRoot.length > 0)
          .map((requestedWorkspaceRoot) => resolve(requestedWorkspaceRoot))
      )
    ).filter(
      (requestedWorkspaceRoot) =>
        workspaceRoot === undefined ||
        resolve(workspaceRoot) !== requestedWorkspaceRoot
    )
    const sidecarFlowRows = Object.freeze(
      (
        await Promise.all(
          sidecarWorkspaceRoots.map(async (sidecarWorkspaceRoot) => {
            const sidecarLibrary = await loadAutomationFlowLibrary({
              homePath,
              workspaceRoot: sidecarWorkspaceRoot
            })
            const sidecarWorkspaceFlows = sidecarLibrary.automationFlows.filter(
              (automationFlow) => automationFlow.scope !== 'user'
            )
            const sidecarOwnerKeyByFlow = new Map(
              sidecarWorkspaceFlows.map((automationFlow) => [
                automationFlow,
                createAutomationFlowOwnerKey({
                  automationFlow,
                  workspaceRoot: sidecarWorkspaceRoot
                })
              ])
            )

            return mapFlowRows(
              sidecarWorkspaceFlows,
              [],
              [],
              sidecarOwnerKeyByFlow,
              sidecarWorkspaceRoot
            )
          })
        )
      ).flat()
    )
    const projectionFlowRows = Object.freeze([...flowRows, ...sidecarFlowRows])
    const storedFilters = (await store.loadFilterState()) as AutomationCenterFilters
    const allScopeIds = Object.freeze(
      Array.from(new Set(projectionFlowRows.map(getFlowRowScopeId)))
    )
    const projectionFilters = normalizeAutomationProjectionFilters({
      currentWorkspaceId: workspaceRoot,
      filters:
        request?.filters ??
        (options.includeAllScopes ? { scopeIds: allScopeIds } : storedFilters),
      flows: projectionFlowRows
    })
    const normalizedStoredFilters = normalizeStoredProjectionFiltersForPersistence({
      normalized: projectionFilters,
      stored: storedFilters
    })
    if (!areProjectionFiltersEqual(normalizedStoredFilters, storedFilters)) {
      await store.saveFilterState(normalizedStoredFilters)
    }
    const filteredBuckets = Object.freeze({
      done: applyTaskFilters(index.projection.buckets.done, projectionFilters, {
        includeBucket: false
      }),
      needsMe: applyTaskFilters(
        index.projection.buckets.needsMe,
        projectionFilters,
        { includeBucket: false }
      ),
      ready: applyTaskFilters(index.projection.buckets.ready, projectionFilters, {
        includeBucket: false
      }),
      running: applyTaskFilters(
        index.projection.buckets.running,
        projectionFilters,
        { includeBucket: false }
      )
    })
    const filteredTasks = applyTaskFilters(index.projection.tasks, projectionFilters)
    const runActionsById = await resolveRunActionMap(runs, runtime)
    const discoveryResultsByRunId = mapDiscoveryResultByRunId(taskDataSnapshots)
    const projection: AutomationProjection = Object.freeze({
      buckets: Object.freeze({
        done: Object.freeze(filteredBuckets.done.map(mapTask)),
        needsMe: Object.freeze(filteredBuckets.needsMe.map(mapTask)),
        ready: Object.freeze(filteredBuckets.ready.map(mapTask)),
        running: Object.freeze(filteredBuckets.running.map(mapTask))
      }),
      decisions,
      diagnostics,
      filters: projectionFilters,
      flows: projectionFlowRows,
      generatedAt: now(),
      reports,
      runs: Object.freeze(
        runs.map((run) => {
          const discoveryResult =
            run.runKind === 'discovery'
              ? discoveryResultsByRunId.get(run.runId) ??
                Object.freeze({
                  sourceCount: 0,
                  sources: Object.freeze([])
                } satisfies AutomationRunDiscoveryResultSummary)
              : undefined

          return mapRunSummary(
            run,
            runActionsById.get(run.runId),
            discoveryResult,
            createRunProcessSteps(run, discoveryResult)
          )
        })
      ),
      tasks: Object.freeze(filteredTasks.map(mapTask)),
      ...(workspaceRoot !== undefined ? { workspaceRoot } : {})
    })

    return Object.freeze({
      candidates: index.candidates,
      discoveredSources,
      executorsByOwnerKey: index.executorsByOwnerKey,
      flows: automationFlows,
      ownerKeyByFlow,
      projection
    })
  }

  ipcMain.handle(AUTOMATION_CHANNELS.getProjection, async (event, request) => ({
    projection: (await buildContext(
      event,
      assertOptionalProjectionRequest(request)
    )).projection
  }))

  ipcMain.handle(
    AUTOMATION_CHANNELS.getExplorerAutomationProjection,
    async (event, request) => {
      const context = await buildContext(
        event,
        assertOptionalProjectionRequest(request),
        { startDiscovery: false }
      )
      const flows = context.flows.map((flow) => {
        const flowOwnerKey = getCurrentFlowOwnerKey(
          context.ownerKeyByFlow,
          flow
        )
        const executors = (
          context.executorsByOwnerKey.get(flowOwnerKey) ?? []
        ).map((executor) =>
          Object.freeze({
            diagnostics: executor.diagnostics.map(mapFlowDiagnostic),
            displayName: executor.displayName,
            executorId: executor.executorId,
            ...(executor.sourceClass !== undefined
              ? { sourceClass: executor.sourceClass }
              : {}),
            ...(executor.sourcePath !== undefined
              ? { sourcePath: executor.sourcePath }
              : {}),
            type: executor.type
          })
        )

        return Object.freeze({
          appliedToWorkspace: isAppliedGlobalFlowOwnerKey(flowOwnerKey),
          executors: Object.freeze(executors),
          flowOwnerKey,
          id: flow.id,
          name: flow.name,
          scope: flow.scope,
          ...(flow.sourceFile !== undefined ? { sourceFile: flow.sourceFile } : {})
        })
      })

      return {
        projection: Object.freeze({
          diagnostics: context.projection.diagnostics,
          flows: Object.freeze(flows),
          ...(context.projection.workspaceRoot !== undefined
            ? { workspaceRoot: context.projection.workspaceRoot }
            : {})
        })
      }
    }
  )

  ipcMain.handle(AUTOMATION_CHANNELS.createFlowDraft, async (event, rawRequest) => {
    const request = assertCreateFlowDraftRequest(rawRequest)
    const workspaceRoot = getWorkspaceRoot(
      event,
      getActiveWorkspaceRoot,
      request.workspaceRoot === undefined
        ? undefined
        : { workspaceRoot: request.workspaceRoot }
    )
    const scope = request.scope ?? 'workspace'
    const targetRoot =
      scope === 'user'
        ? getUserAutomationFlowRoot(homePath)
        : getWorkspaceAutomationFlowRoot(
            workspaceRoot ?? getRequiredWorkspaceRoot(event, getActiveWorkspaceRoot)
          )
    const targetPath =
      scope === 'user'
        ? join(targetRoot, `${request.flowId}.md`)
        : join(targetRoot, `${request.flowId}.md`)

    await mkdir(targetRoot, { recursive: true })

    const safePath =
      scope === 'user'
        ? await assertUserAutomationFlowPath(homePath, targetPath)
        : await assertWorkspaceAutomationFlowPath(
            workspaceRoot ?? getRequiredWorkspaceRoot(event, getActiveWorkspaceRoot),
            targetPath
          )
    const markdown = renderFlowDraftMarkdown({
      displayName: request.displayName,
      flowId: request.flowId,
      scope
    })

    await mkdir(dirname(safePath), { recursive: true })
    await writeFile(safePath, markdown, 'utf8')

    return Object.freeze({
      diagnostics: Object.freeze([]),
      markdown,
      path: safePath,
      valid: true
    })
  })

  ipcMain.handle(
    AUTOMATION_CHANNELS.createExecutorDraft,
    async (event, rawRequest) => {
      const request = assertCreateExecutorDraftRequest(rawRequest)
      const scope = request.scope ?? 'workspace'
      const workspaceRoot =
        scope === 'workspace'
          ? getRequiredWorkspaceRoot(
              event,
              getActiveWorkspaceRoot,
              request.workspaceRoot === undefined
                ? undefined
                : { workspaceRoot: request.workspaceRoot }
            )
          : undefined
      const targetRoot =
        scope === 'user'
          ? getUserAutomationFlowRoot(homePath)
          : getWorkspaceAutomationFlowRoot(workspaceRoot!)
      const targetPath = join(targetRoot, request.flowId, `${request.executorId}.md`)

      await mkdir(targetRoot, { recursive: true })

      const safePath =
        scope === 'user'
          ? await assertUserAutomationFlowPath(homePath, targetPath)
          : await assertWorkspaceAutomationFlowPath(workspaceRoot!, targetPath)
      const markdown = renderExecutorDraftMarkdown(request.displayName)

      await mkdir(dirname(safePath), { recursive: true })
      await writeFile(safePath, markdown, 'utf8')

      return Object.freeze({
        diagnostics: Object.freeze([]),
        markdown,
        path: safePath,
        valid: true
      })
    }
  )

  ipcMain.handle(
    AUTOMATION_CHANNELS.applyGlobalFlowToWorkspace,
    async (event, rawRequest) => {
      const request = assertApplyGlobalFlowRequest(rawRequest)
      const workspaceRoot = getRequiredWorkspaceRoot(
        event,
        getActiveWorkspaceRoot,
        request.workspaceRoot === undefined
          ? undefined
          : { workspaceRoot: request.workspaceRoot }
      )
      const refs = await loadAppliedGlobalFlowRefs(workspaceRoot)

      await saveAppliedGlobalFlowRefs(workspaceRoot, [
        ...refs.flowIds,
        request.flowId
      ])

      return { accepted: true } satisfies AutomationCommandResponse
    }
  )

  ipcMain.handle(
    AUTOMATION_CHANNELS.removeAppliedGlobalFlowFromWorkspace,
    async (event, rawRequest) => {
      const request = assertApplyGlobalFlowRequest(rawRequest)
      const workspaceRoot = getRequiredWorkspaceRoot(
        event,
        getActiveWorkspaceRoot,
        request.workspaceRoot === undefined
          ? undefined
          : { workspaceRoot: request.workspaceRoot }
      )
      const refs = await loadAppliedGlobalFlowRefs(workspaceRoot)

      await saveAppliedGlobalFlowRefs(
        workspaceRoot,
        refs.flowIds.filter((flowId) => flowId !== request.flowId)
      )

      return { accepted: true } satisfies AutomationCommandResponse
    }
  )

  ipcMain.handle(
    AUTOMATION_CHANNELS.openAutomationManagementTarget,
    (event, rawRequest): AutomationOpenManagementTargetResponse => {
      const request = assertOpenManagementTargetRequest(rawRequest)
      const rootPath =
        request.target === 'global'
          ? join(homePath, '.mde')
          : request.workspaceRoot ??
            getRequiredWorkspaceRoot(event, getActiveWorkspaceRoot)

      return Object.freeze({
        ...(request.flowId !== undefined
          ? {
              flowPath:
                request.target === 'global'
                  ? join(getUserAutomationFlowRoot(homePath), `${request.flowId}.md`)
                  : join(
                      getWorkspaceAutomationFlowRoot(rootPath),
                      `${request.flowId}.md`
                    )
            }
          : {}),
        rootPath
      })
    }
  )

  ipcMain.handle(AUTOMATION_CHANNELS.refreshSkillCatalog, () => ({
    accepted: true
  } satisfies AutomationCommandResponse))

  ipcMain.handle(AUTOMATION_CHANNELS.listCapabilityReports, async (event, request) => {
    await ensureInitialized()

    return {
      reports: (
        await adapterRegistry.probeAll({
          workspaceRoot: getWorkspaceRoot(
            event,
            getActiveWorkspaceRoot,
            assertOptionalProjectionRequest(request)
          )
        })
      ).map(mapCapabilityReport)
    }
  })

  ipcMain.handle(AUTOMATION_CHANNELS.listReports, async () => {
    await ensureInitialized()

    return { reports: await store.listReports() }
  })

  ipcMain.handle(AUTOMATION_CHANNELS.listTemplates, () => ({
    templates: listBuiltInAutomationFlowTemplates().map((template) =>
      Object.freeze({
        allowedScopes: template.allowedScopes,
        name: template.name,
        requiredInputs: template.requiredInputs,
        templateId: template.id
      })
    )
  }))

  ipcMain.handle(AUTOMATION_CHANNELS.validateTemplateInput, (event, rawRequest) => {
    const request = assertCreateTemplateRequest(rawRequest)
    const workspaceRoot = getWorkspaceRoot(event, getActiveWorkspaceRoot)

    return validateTemplateInput(request, workspaceRoot)
  })

  ipcMain.handle(
    AUTOMATION_CHANNELS.createFlowFromTemplate,
    async (event, rawRequest) => {
      const request = assertCreateTemplateRequest(rawRequest)
      const workspaceRoot =
        request.scope === 'workspace'
          ? getRequiredWorkspaceRoot(event, getActiveWorkspaceRoot)
          : getWorkspaceRoot(event, getActiveWorkspaceRoot)
      const validation = validateTemplateInput(request, workspaceRoot)

      if (!validation.ok) {
        throw new Error(validation.diagnostics[0]?.message ?? 'Invalid template input')
      }

      return mapDefinitionDocument(
        await createDefinitionService({ homePath, workspaceRoot }).createFromTemplate(
          request
        )
      )
    }
  )

  ipcMain.handle(AUTOMATION_CHANNELS.setFlowLifecycle, async (event, rawCommand) => {
    const command = assertSetLifecycleCommand(rawCommand)
    const workspaceRoot =
      command.workspaceRoot ?? getWorkspaceRoot(event, getActiveWorkspaceRoot)

    return mapDefinitionDocument(
      await createDefinitionService({ homePath, workspaceRoot }).setLifecycle(
        command.filePath,
        command.lifecycle
      )
    )
  })

  ipcMain.handle(
    AUTOMATION_CHANNELS.loadFlowDefinition,
    async (event, rawCommand) => {
      const command = assertLoadFlowDefinitionCommand(rawCommand)
      const workspaceRoot = getWorkspaceRoot(event, getActiveWorkspaceRoot)

      return mapDefinitionDocument(
        await createDefinitionService({ homePath, workspaceRoot })
          .loadEditableDocument(command.filePath)
      )
    }
  )

  ipcMain.handle(
    AUTOMATION_CHANNELS.saveFlowDefinition,
    async (event, rawCommand) => {
      const command = assertSaveFlowDefinitionCommand(rawCommand)
      const workspaceRoot = getWorkspaceRoot(event, getActiveWorkspaceRoot)

      return mapDefinitionDocument(
        await createDefinitionService({ homePath, workspaceRoot }).saveDefinition(
          command.filePath,
          command.markdown
        )
      )
    }
  )

  ipcMain.handle(AUTOMATION_CHANNELS.archiveFlow, async (event, rawCommand) => {
    const command = assertArchiveFlowCommand(rawCommand)
    const workspaceRoot = getWorkspaceRoot(event, getActiveWorkspaceRoot)

    return mapDefinitionDocument(
      await createDefinitionService({ homePath, workspaceRoot }).archiveDefinition(
        command.filePath
      )
    )
  })

  ipcMain.handle(AUTOMATION_CHANNELS.renameFlow, async (event, rawCommand) => {
    const command = assertRenameFlowCommand(rawCommand)
    const workspaceRoot = getWorkspaceRoot(event, getActiveWorkspaceRoot)

    return mapDefinitionDocument(
      await createDefinitionService({ homePath, workspaceRoot }).renameDefinition(
        command.filePath,
        command.name
      )
    )
  })

  ipcMain.handle(AUTOMATION_CHANNELS.deleteFlow, async (event, rawCommand) => {
    const command = assertDeleteFlowCommand(rawCommand)
    const workspaceRoot = getWorkspaceRoot(event, getActiveWorkspaceRoot)

    await createDefinitionService({ homePath, workspaceRoot }).deleteDefinition(
      command.filePath
    )

    return { accepted: true } satisfies AutomationCommandResponse
  })

  ipcMain.handle(AUTOMATION_CHANNELS.restoreFlow, async (event, rawCommand) => {
    const command = assertArchiveFlowCommand(rawCommand)
    const workspaceRoot = getWorkspaceRoot(event, getActiveWorkspaceRoot)

    return mapDefinitionDocument(
      await createDefinitionService({ homePath, workspaceRoot }).restoreDefinition(
        command.filePath
      )
    )
  })

  ipcMain.handle(AUTOMATION_CHANNELS.startRun, async (event, rawCommand) => {
    const command = assertStartRunRequest(rawCommand)
    const context = await buildContext(event, undefined, {
      includeAllScopes: true
    })
    const projectedTask = findStartTask(context.projection, command)
    const candidate = findStartCandidate(context.candidates, command)
    const taskSource =
      candidate === undefined
        ? undefined
        : findTaskSourceForStart(context.discoveredSources, candidate, command)
    const automationFlow = context.flows.find(
      (flow) =>
        flow.id === candidate?.automationFlowId &&
        getCurrentFlowOwnerKey(context.ownerKeyByFlow, flow) ===
          candidate.automationFlowOwnerKey
    ) ?? context.flows.find(
      (flow) => flow.id === candidate?.automationFlowId
    )
    const selectedExecutor = projectedTask?.eligibleExecutors?.find(
      (executor) =>
        executor.executorId ===
          (command.executorId ?? projectedTask.primaryExecutor?.executorId) &&
        (command.executorSnapshotId === undefined ||
          executor.executorSnapshotId === command.executorSnapshotId)
    )
    const selectedOwnerKey = resolveStartOwnerKey({
      automationFlow,
      candidate,
      ownerKeyByFlow: context.ownerKeyByFlow,
      projectedTask
    })
    const selectedExecutorSnapshot = toExecutorRuntimeSnapshot(
      selectedExecutor,
      context.executorsByOwnerKey,
      selectedOwnerKey
    )

    if (
      candidate === undefined ||
      automationFlow === undefined ||
      projectedTask === undefined ||
      taskSource === undefined ||
      projectedTask.blockingDiagnostics?.some(
        (diagnostic) => diagnostic.severity === 'error'
      ) === true ||
      selectedExecutor === undefined ||
      selectedExecutorSnapshot === undefined
    ) {
      return {
        accepted: false,
        diagnostic: createDiagnostic(
          'automationRun.taskNotFound',
          'Automation task is stale, blocked, or missing the selected executor.'
        )
      } satisfies AutomationCommandResponse
    }

    try {
      const result = await runtime.startRun({
        automationFlow,
        candidate,
        executorSnapshot: selectedExecutorSnapshot,
        ...(taskSource !== undefined ? { taskSource } : {}),
        workspaceRoot: getWorkspaceRoot(event, getActiveWorkspaceRoot)
      })

      return {
        accepted: true,
        ...(result.decision !== undefined
          ? { decisionId: result.decision.decisionId }
          : {}),
        runId: result.runId
      } satisfies AutomationCommandResponse
    } catch (error) {
      return {
        accepted: false,
        diagnostic: mapAutomationRunStartError(
          error,
          'automationAdapter.runCapabilityUnavailable',
          'Required adapter capabilities are unavailable.'
        )
      } satisfies AutomationCommandResponse
    }
  })

  ipcMain.handle(AUTOMATION_CHANNELS.resumeRun, async (_event, rawCommand) => {
    const command = assertRecord(rawCommand, 'Automation resume command')
    const runId = assertString(command.runId, 'Run id')

    try {
      const result = await runtime.resumeRun({ runId })

      return { accepted: true, runId: result.runId } satisfies AutomationCommandResponse
    } catch (error) {
      return {
        accepted: false,
        diagnostic: createDiagnostic(
          'automationRun.resumeFailed',
          error instanceof Error
            ? error.message
            : 'Automation run could not be resumed.'
        ),
        runId
      } satisfies AutomationCommandResponse
    }
  })

  ipcMain.handle(AUTOMATION_CHANNELS.cancelRun, async (_event, rawCommand) => {
    const command = assertRecord(rawCommand, 'Automation cancel command')
    const runId = assertString(command.runId, 'Run id')

    try {
      const run = await runtime.cancelRun(runId)

      return { accepted: true, runId: run.runId } satisfies AutomationCommandResponse
    } catch (error) {
      return {
        accepted: false,
        diagnostic:
          error instanceof AutomationRunCancellationError &&
          error.diagnostic !== undefined
            ? error.diagnostic
            : createDiagnostic(
                'automationRun.cancelFailed',
                error instanceof Error
                  ? error.message
                  : 'Automation run could not be cancelled.'
              ),
        runId
      } satisfies AutomationCommandResponse
    }
  })

  ipcMain.handle(AUTOMATION_CHANNELS.submitDecision, async (_event, rawCommand) => {
    const command = assertSubmitDecisionRequest(rawCommand)
    let pendingDecision: Awaited<
      ReturnType<AutomationStore['claimDecisionForResume']>
    >

    try {
      pendingDecision = await store.claimDecisionForResume(command.decisionId)
    } catch {
      const currentDecision = (await store.listDecisions()).find(
        (decision) => decision.decisionId === command.decisionId
      )

      return {
        accepted: false,
        decisionId: command.decisionId,
        diagnostic: createDiagnostic(
          'automationRun.decisionUnavailable',
          'automationRun.decisionUnavailable'
        ),
        ...(currentDecision?.runId !== undefined
          ? { runId: currentDecision.runId }
          : {})
      } satisfies AutomationCommandResponse
    }

    try {
      await runtime.resumeRun({
        response: command.response,
        runId: pendingDecision.runId
      })
    } catch (error) {
      await store.rollbackDecisionResumeClaim(pendingDecision.decisionId).catch(() => {
        // Keep the original adapter startup failure as the user-visible result.
      })

      return {
        accepted: false,
        decisionId: pendingDecision.decisionId,
        diagnostic: Object.freeze({
          code: 'automationRun.resumeFailed',
          diagnosticId: 'automation:automationRun.resumeFailed',
          message: 'automationRun.resumeFailed',
          messageKey: 'automation.diagnostics.automationRun.resumeFailed',
          severity: 'error',
          ...(error instanceof Error ? { technicalMessage: error.message } : {})
        }),
        runId: pendingDecision.runId
      } satisfies AutomationCommandResponse
    }

    const decision = await store.resolveDecision(
      command.decisionId,
      command.response
    )

    return {
      accepted: true,
      decisionId: decision.decisionId,
      runId: decision.runId
    } satisfies AutomationCommandResponse
  })

  ipcMain.handle(AUTOMATION_CHANNELS.updateFilters, async (_event, rawCommand) => {
    const command = assertRecord(rawCommand, 'Automation filter command')

    await store.saveFilterState(assertProjectionFilters(command.filters))

    return { accepted: true } satisfies AutomationCommandResponse
  })

  ipcMain.handle(AUTOMATION_CHANNELS.openNativeSession, async (_event, rawCommand) => {
    const command = assertRecord(rawCommand, 'Automation native session command')
    const runId = assertString(command.runId, 'Run id')
    const run = await store.getRun(runId)
    const actions = await runtime.getRunActions({
      engine: run.engine,
      runId,
      workspaceRoot: run.workspaceRoot
    })

    if (!actions.includes('open-native-session')) {
      return {
        accepted: false,
        diagnostic: createDiagnostic(
          'automationRun.nativeSessionUnavailable',
          'Native adapter session is unavailable.'
        ),
        runId
      } satisfies AutomationCommandResponse
    }

    return {
      accepted: await runtime.openNativeSession(runId),
      runId
    } satisfies AutomationCommandResponse
  })
}
