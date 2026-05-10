import type {
  AutomationDecision,
  AutomationDiagnostic,
  AutomationProjection,
  AutomationTaskCard
} from '../../../shared/automation'

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
  readonly runningTasks: readonly AutomationTaskCard[]
  readonly selectedDecision?: AutomationDecision
  readonly selectedTask?: AutomationTaskCard
  readonly tasks: readonly AutomationTaskCard[]
}

export const createAutomationCenterViewModel = (
  projection: AutomationProjection
): AutomationCenterViewModel => {
  const selectedTask =
    projection.selectedTaskId === undefined
      ? projection.tasks[0]
      : projection.tasks.find(
          (task) => task.taskId === projection.selectedTaskId
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

  return Object.freeze({
    diagnostics: projection.diagnostics,
    doneTasks: projection.buckets.done,
    needsMeTasks: projection.buckets.needsMe,
    phases: Object.freeze(phases),
    readyTasks: projection.buckets.ready,
    runningTasks: projection.buckets.running,
    ...(selectedDecision !== undefined ? { selectedDecision } : {}),
    ...(selectedTask !== undefined ? { selectedTask } : {}),
    tasks: projection.tasks
  })
}
