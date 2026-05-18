import type {
  AutomationDecision,
  AutomationDiagnostic,
  AutomationFlowRow,
  AutomationProjection,
  AutomationTaskCard
} from '../../../shared/automation'
import type { AppTextKey } from '../i18n/appLanguage'

export interface AutomationReadyFlowlinePreview {
  readonly engine: string
  readonly flowName: string
  readonly phases: readonly AppTextKey[]
  readonly sourceSummary: string
}

export type AutomationFlowlinePhaseStatus =
  | AutomationTaskCard['bucket']
  | 'pending'

export interface AutomationFlowlinePhase {
  readonly descriptionKey: AppTextKey
  readonly phaseId: string
  readonly status: AutomationFlowlinePhaseStatus
  readonly titleKey: AppTextKey
}

export interface AutomationCenterViewModel {
  readonly diagnostics: readonly AutomationDiagnostic[]
  readonly doneTasks: readonly AutomationTaskCard[]
  readonly needsMeTasks: readonly AutomationTaskCard[]
  readonly phases: readonly AutomationFlowlinePhase[]
  readonly readyTasks: readonly AutomationTaskCard[]
  readonly readyPreview?: AutomationReadyFlowlinePreview
  readonly runningTasks: readonly AutomationTaskCard[]
  readonly selectedDecision?: AutomationDecision
  readonly selectedTask?: AutomationTaskCard
  readonly tasks: readonly AutomationTaskCard[]
  readonly visibleTasks?: readonly AutomationTaskCard[]
}

const getSourceSummary = (task: AutomationTaskCard): string =>
  task.relativePath ??
  task.sourceUri ??
  task.sourcePath ??
  task.sourceType ??
  task.sourceItemId

const getFlowName = (
  flows: readonly AutomationFlowRow[],
  task: AutomationTaskCard
): string =>
  flows.find((flow) => flow.automationFlowId === task.automationFlowId)?.name ??
  task.automationFlowId

const getReadyPreviewPhases = (task: AutomationTaskCard): readonly AppTextKey[] =>
  Object.freeze([
    task.sourceType === 'workspace-markdown'
      ? 'automation.readyPhaseReviewWorkspaceSource'
      : 'automation.readyPhaseReviewSource',
    'automation.readyPhaseRunFlow',
    task.engine === undefined
      ? 'automation.readyPhaseVerifyResult'
      : 'automation.readyPhaseVerifyEngineResult'
  ])

const getReviewSourceDescriptionKey = (
  task: AutomationTaskCard
): AppTextKey =>
  task.sourceType === 'workspace-markdown'
    ? 'automation.readyPhaseReviewWorkspaceSourceDescription'
    : 'automation.readyPhaseReviewSourceDescription'

const getVerifyResultDescriptionKey = (
  task: AutomationTaskCard
): AppTextKey =>
  task.engine === undefined
    ? 'automation.readyPhaseVerifyResultDescription'
    : 'automation.readyPhaseVerifyEngineResultDescription'

const getRunPhaseStatus = (
  task: AutomationTaskCard
): AutomationFlowlinePhaseStatus => {
  switch (task.bucket) {
    case 'done':
      return 'done'
    case 'needs-me':
      return 'needs-me'
    case 'running':
      return 'running'
    case 'ready':
      return 'ready'
  }
}

const getVerifyPhaseStatus = (
  task: AutomationTaskCard
): AutomationFlowlinePhaseStatus => (task.bucket === 'done' ? 'done' : 'pending')

const createFlowlinePhases = (
  task: AutomationTaskCard
): readonly AutomationFlowlinePhase[] =>
  Object.freeze([
    Object.freeze({
      descriptionKey: getReviewSourceDescriptionKey(task),
      phaseId: `${task.taskId}:review-source`,
      status: 'done',
      titleKey:
        task.sourceType === 'workspace-markdown'
          ? 'automation.readyPhaseReviewWorkspaceSource'
          : 'automation.readyPhaseReviewSource'
    }),
    Object.freeze({
      descriptionKey: 'automation.readyPhaseRunFlowDescription',
      phaseId: `${task.taskId}:run-flow`,
      status: getRunPhaseStatus(task),
      titleKey: 'automation.readyPhaseRunFlow'
    }),
    Object.freeze({
      descriptionKey: getVerifyResultDescriptionKey(task),
      phaseId: `${task.taskId}:verify-result`,
      status: getVerifyPhaseStatus(task),
      titleKey:
        task.engine === undefined
          ? 'automation.readyPhaseVerifyResult'
          : 'automation.readyPhaseVerifyEngineResult'
    })
  ])

const getVisibleTasks = (
  projection: AutomationProjection
): readonly AutomationTaskCard[] => {
  switch (projection.filters.bucket ?? 'ready') {
    case 'done':
      return projection.buckets.done
    case 'needsMe':
      return projection.buckets.needsMe
    case 'running':
      return projection.buckets.running
    case 'ready':
      return projection.buckets.ready
  }
}

export const createAutomationCenterViewModel = (
  projection: AutomationProjection,
  selectedTaskId?: string | null
): AutomationCenterViewModel => {
  const projectionSelectedTaskId = selectedTaskId ?? projection.selectedTaskId
  const visibleTasks = getVisibleTasks(projection)
  const selectedTask =
    selectedTaskId === null
      ? undefined
      : projectionSelectedTaskId === undefined
      ? visibleTasks[0]
      : visibleTasks.find(
          (task) => task.taskId === projectionSelectedTaskId
        ) ?? visibleTasks[0]

  const phases =
    selectedTask === undefined
      ? []
      : createFlowlinePhases(selectedTask)
  const selectedDecision =
    selectedTask === undefined
      ? undefined
      : projection.decisions.find(
          (decision) =>
            decision.taskId === selectedTask.taskId &&
            decision.status === 'pending'
        )
  const readyPreview =
    selectedTask?.bucket === 'ready'
      ? Object.freeze({
          engine: selectedTask.engine ?? 'codex',
          flowName: getFlowName(projection.flows, selectedTask),
          phases: getReadyPreviewPhases(selectedTask),
          sourceSummary: getSourceSummary(selectedTask)
        })
      : undefined

  return Object.freeze({
    diagnostics: projection.diagnostics,
    doneTasks: projection.buckets.done,
    needsMeTasks: projection.buckets.needsMe,
    phases: Object.freeze(phases),
    readyTasks: projection.buckets.ready,
    ...(readyPreview !== undefined ? { readyPreview } : {}),
    runningTasks: projection.buckets.running,
    ...(selectedDecision !== undefined ? { selectedDecision } : {}),
    ...(selectedTask !== undefined ? { selectedTask } : {}),
    tasks: projection.tasks,
    visibleTasks
  })
}
