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

export interface AutomationCenterViewModel {
  readonly diagnostics: readonly AutomationDiagnostic[]
  readonly doneTasks: readonly AutomationTaskCard[]
  readonly needsMeTasks: readonly AutomationTaskCard[]
  readonly phases: readonly {
    readonly phaseId: string
    readonly status: AutomationTaskCard['bucket']
    readonly title: string
  }[]
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

export const createAutomationCenterViewModel = (
  projection: AutomationProjection,
  selectedTaskId?: string
): AutomationCenterViewModel => {
  const selectedTask =
    selectedTaskId === undefined && projection.selectedTaskId === undefined
      ? projection.tasks[0]
      : projection.tasks.find(
          (task) => task.taskId === (selectedTaskId ?? projection.selectedTaskId)
        ) ?? projection.tasks[0]

  const phases =
    selectedTask === undefined
      ? []
      : [
          Object.freeze({
            phaseId: `task:${selectedTask.taskId}`,
            status: selectedTask.bucket,
            title: selectedTask.title
          })
        ]
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
    visibleTasks: projection.tasks
  })
}
