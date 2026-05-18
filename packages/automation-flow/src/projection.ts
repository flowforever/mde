import { selectAutomationFlowExecutor } from './executors'
import type {
  AutomationFlowExecutorRef,
  AutomationFlowTaskCandidate,
  AutomationFlowDiagnostic,
  AutomationProjectedTask,
  AutomationReportOverlay,
  AutomationRunOverlay,
  AutomationSignalStackProjection,
  AutomationTaskBucket
} from './types'

interface TaskOverlay {
  readonly candidate?: AutomationFlowTaskCandidate
  readonly eligibleExecutors: readonly AutomationFlowExecutorRef[]
  readonly latestReport?: AutomationReportOverlay
  readonly runs: readonly AutomationRunOverlay[]
  readonly taskId: string
}

const bucketOrder: Record<AutomationTaskBucket, number> = {
  'needs-me': 0,
  running: 1,
  ready: 2,
  done: 3
}

const isRunningLikeRun = (run: AutomationRunOverlay): boolean =>
  run.state === 'running' || run.state === 'starting'

const isActiveRun = (run: AutomationRunOverlay): boolean =>
  run.state === 'needs-me' || isRunningLikeRun(run)

const compareReportsDescending = (
  left: AutomationReportOverlay,
  right: AutomationReportOverlay
): number => {
  const timeDelta =
    Date.parse(right.completedAt) - Date.parse(left.completedAt)

  if (timeDelta !== 0) {
    return timeDelta
  }

  return right.reportId.localeCompare(left.reportId)
}

const pickLatestReport = (
  reports: readonly AutomationReportOverlay[]
): AutomationReportOverlay | undefined =>
  [...reports].sort(compareReportsDescending)[0]

const pickActiveRun = (
  runs: readonly AutomationRunOverlay[]
): AutomationRunOverlay | undefined => {
  const needsMeRun = runs.find((run) => run.state === 'needs-me')

  if (needsMeRun !== undefined) {
    return needsMeRun
  }

  return runs.find(isRunningLikeRun)
}

const getProjectedTaskTitle = (overlay: TaskOverlay): string =>
  overlay.candidate?.title ?? overlay.latestReport?.title ?? overlay.taskId

const hasBlockingExecutorDiagnostic = (
  executor: AutomationFlowExecutorRef
): boolean =>
  executor.diagnostics.some((diagnostic) => diagnostic.severity === 'error')

const getEligibleExecutors = (
  executors: readonly AutomationFlowExecutorRef[]
): readonly AutomationFlowExecutorRef[] =>
  Object.freeze(
    executors.filter(
      (executor) => executor.enabled && !hasBlockingExecutorDiagnostic(executor)
    )
  )

const getExecutorProjection = (
  candidate: AutomationFlowTaskCandidate | undefined,
  executors: readonly AutomationFlowExecutorRef[]
): {
  readonly blockingDiagnostics: readonly AutomationFlowDiagnostic[]
  readonly eligibleExecutors: readonly AutomationFlowExecutorRef[]
  readonly primaryExecutor?: AutomationFlowExecutorRef
} => {
  if (candidate === undefined) {
    return Object.freeze({
      blockingDiagnostics: Object.freeze([]),
      eligibleExecutors: Object.freeze([])
    })
  }

  const eligibleExecutors = getEligibleExecutors(executors)
  const selection = selectAutomationFlowExecutor({
    executors,
    requiredExecutorId: candidate.requiredExecutorId,
    requiredExecutorRef: candidate.requiredExecutorRef,
    sourceType: candidate.sourceType,
    tags: [],
    taskType: candidate.taskType
  })

  return Object.freeze({
    blockingDiagnostics: selection.diagnostics,
    eligibleExecutors,
    ...(selection.executor !== undefined &&
    eligibleExecutors.some(
      (executor) => executor.executorId === selection.executor?.executorId
    )
      ? { primaryExecutor: selection.executor }
      : {})
  })
}

const getDoneTaskMetadata = (
  overlay: TaskOverlay
): Pick<
  AutomationProjectedTask,
  | 'engine'
  | 'priority'
  | 'relativePath'
  | 'sourcePath'
  | 'sourceType'
  | 'sourceUri'
  | 'workspaceId'
> =>
  Object.freeze({
    ...(overlay.candidate?.engine !== undefined
      ? { engine: overlay.candidate.engine }
      : overlay.latestReport?.engine !== undefined
        ? { engine: overlay.latestReport.engine }
        : {}),
    ...(overlay.candidate?.priority !== undefined
      ? { priority: overlay.candidate.priority }
      : overlay.latestReport?.priority !== undefined
        ? { priority: overlay.latestReport.priority }
        : {}),
    ...(overlay.candidate?.relativePath !== undefined
      ? { relativePath: overlay.candidate.relativePath }
      : overlay.latestReport?.relativePath !== undefined
        ? { relativePath: overlay.latestReport.relativePath }
        : {}),
    ...(overlay.candidate?.sourcePath !== undefined
      ? { sourcePath: overlay.candidate.sourcePath }
      : overlay.latestReport?.sourcePath !== undefined
        ? { sourcePath: overlay.latestReport.sourcePath }
        : {}),
    ...(overlay.candidate?.sourceType !== undefined
      ? { sourceType: overlay.candidate.sourceType }
      : overlay.latestReport?.sourceType !== undefined
        ? { sourceType: overlay.latestReport.sourceType }
        : {}),
    ...(overlay.candidate?.sourceUri !== undefined
      ? { sourceUri: overlay.candidate.sourceUri }
      : overlay.latestReport?.sourceUri !== undefined
        ? { sourceUri: overlay.latestReport.sourceUri }
        : {}),
    ...(overlay.candidate?.workspaceId !== undefined
      ? { workspaceId: overlay.candidate.workspaceId }
      : overlay.latestReport?.workspaceId !== undefined
        ? { workspaceId: overlay.latestReport.workspaceId }
        : {})
  })

const createProjectedTask = (
  overlay: TaskOverlay
): AutomationProjectedTask | null => {
  const activeRun = pickActiveRun(overlay.runs.filter(isActiveRun))
  const executorProjection = getExecutorProjection(
    overlay.candidate,
    overlay.eligibleExecutors
  )
  const executorFields = Object.freeze({
    ...(executorProjection.blockingDiagnostics.length > 0
      ? { blockingDiagnostics: executorProjection.blockingDiagnostics }
      : {}),
    ...(executorProjection.eligibleExecutors.length > 0
      ? { eligibleExecutors: executorProjection.eligibleExecutors }
      : {}),
    ...(activeRun?.executorSnapshotId !== undefined
      ? { executorSnapshotId: activeRun.executorSnapshotId }
      : executorProjection.primaryExecutor?.executorSnapshotId !== undefined
        ? { executorSnapshotId: executorProjection.primaryExecutor.executorSnapshotId }
        : {}),
    ...(executorProjection.primaryExecutor !== undefined
      ? { primaryExecutor: executorProjection.primaryExecutor }
      : {})
  })
  const taskDataFields = Object.freeze({
    ...(activeRun?.taskDataId !== undefined
      ? { taskDataId: activeRun.taskDataId }
      : overlay.candidate?.taskDataId !== undefined
        ? { taskDataId: overlay.candidate.taskDataId }
        : {}),
    ...(activeRun?.taskDataSnapshotId !== undefined
      ? { taskDataSnapshotId: activeRun.taskDataSnapshotId }
      : overlay.candidate?.taskDataSnapshotId !== undefined
        ? { taskDataSnapshotId: overlay.candidate.taskDataSnapshotId }
        : {})
  })

  if (activeRun?.state === 'needs-me') {
    return Object.freeze({
      activeRunId: activeRun.runId,
      automationFlowId: activeRun.automationFlowId,
      ...(overlay.candidate?.automationFlowOwnerKey !== undefined
        ? { automationFlowOwnerKey: overlay.candidate.automationFlowOwnerKey }
        : {}),
      bucket: 'needs-me',
      engine: overlay.candidate?.engine,
      latestReportId: overlay.latestReport?.reportId,
      ...executorFields,
      ...(overlay.candidate?.priority !== undefined
        ? { priority: overlay.candidate.priority }
        : {}),
      ...(overlay.candidate?.relativePath !== undefined
        ? { relativePath: overlay.candidate.relativePath }
        : {}),
      sourceItemId: activeRun.sourceItemId,
      ...(overlay.candidate?.sourcePath !== undefined
        ? { sourcePath: overlay.candidate.sourcePath }
        : {}),
      sourceType: overlay.candidate?.sourceType,
      ...(overlay.candidate?.sourceUri !== undefined
        ? { sourceUri: overlay.candidate.sourceUri }
        : {}),
      taskId: overlay.taskId,
      ...taskDataFields,
      title: getProjectedTaskTitle(overlay),
      ...(overlay.candidate?.workspaceId !== undefined
        ? { workspaceId: overlay.candidate.workspaceId }
        : {})
    })
  }

  if (activeRun !== undefined && isRunningLikeRun(activeRun)) {
    return Object.freeze({
      activeRunId: activeRun.runId,
      automationFlowId: activeRun.automationFlowId,
      ...(overlay.candidate?.automationFlowOwnerKey !== undefined
        ? { automationFlowOwnerKey: overlay.candidate.automationFlowOwnerKey }
        : {}),
      bucket: 'running',
      engine: overlay.candidate?.engine,
      latestReportId: overlay.latestReport?.reportId,
      ...executorFields,
      ...(overlay.candidate?.priority !== undefined
        ? { priority: overlay.candidate.priority }
        : {}),
      ...(overlay.candidate?.relativePath !== undefined
        ? { relativePath: overlay.candidate.relativePath }
        : {}),
      sourceItemId: activeRun.sourceItemId,
      ...(overlay.candidate?.sourcePath !== undefined
        ? { sourcePath: overlay.candidate.sourcePath }
        : {}),
      sourceType: overlay.candidate?.sourceType,
      ...(overlay.candidate?.sourceUri !== undefined
        ? { sourceUri: overlay.candidate.sourceUri }
        : {}),
      taskId: overlay.taskId,
      ...taskDataFields,
      title: getProjectedTaskTitle(overlay),
      ...(overlay.candidate?.workspaceId !== undefined
        ? { workspaceId: overlay.candidate.workspaceId }
        : {})
    })
  }

  if (overlay.latestReport !== undefined) {
    return Object.freeze({
      automationFlowId: overlay.latestReport.automationFlowId,
      ...(overlay.candidate?.automationFlowOwnerKey !== undefined
        ? { automationFlowOwnerKey: overlay.candidate.automationFlowOwnerKey }
        : {}),
      bucket: 'done',
      ...getDoneTaskMetadata(overlay),
      ...executorFields,
      latestReportId: overlay.latestReport.reportId,
      sourceItemId: overlay.latestReport.sourceItemId,
      taskId: overlay.taskId,
      ...taskDataFields,
      title: getProjectedTaskTitle(overlay)
    })
  }

  if (overlay.candidate !== undefined) {
    return Object.freeze({
      automationFlowId: overlay.candidate.automationFlowId,
      ...(overlay.candidate.automationFlowOwnerKey !== undefined
        ? { automationFlowOwnerKey: overlay.candidate.automationFlowOwnerKey }
        : {}),
      bucket: 'ready',
      engine: overlay.candidate.engine,
      ...executorFields,
      ...(overlay.candidate.priority !== undefined
        ? { priority: overlay.candidate.priority }
        : {}),
      ...(overlay.candidate.relativePath !== undefined
        ? { relativePath: overlay.candidate.relativePath }
        : {}),
      sourceItemId: overlay.candidate.sourceItemId,
      ...(overlay.candidate.sourcePath !== undefined
        ? { sourcePath: overlay.candidate.sourcePath }
        : {}),
      sourceType: overlay.candidate.sourceType,
      ...(overlay.candidate.sourceUri !== undefined
        ? { sourceUri: overlay.candidate.sourceUri }
        : {}),
      taskId: overlay.taskId,
      ...taskDataFields,
      title: overlay.candidate.title,
      ...(overlay.candidate.workspaceId !== undefined
        ? { workspaceId: overlay.candidate.workspaceId }
        : {})
    })
  }

  return null
}

const compareProjectedTasks = (
  candidateOrderByTaskId: ReadonlyMap<string, number>,
  candidatePriorityByTaskId: ReadonlyMap<string, number>,
  latestReportByTaskId: ReadonlyMap<string, AutomationReportOverlay>,
  left: AutomationProjectedTask,
  right: AutomationProjectedTask
): number => {
  const bucketDelta = bucketOrder[left.bucket] - bucketOrder[right.bucket]

  if (bucketDelta !== 0) {
    return bucketDelta
  }

  const leftCandidateOrder =
    candidateOrderByTaskId.get(left.taskId) ?? Number.POSITIVE_INFINITY
  const rightCandidateOrder =
    candidateOrderByTaskId.get(right.taskId) ?? Number.POSITIVE_INFINITY
  const candidateOrderDelta = leftCandidateOrder - rightCandidateOrder

  if (candidateOrderDelta !== 0) {
    return candidateOrderDelta
  }

  const priorityDelta =
    (candidatePriorityByTaskId.get(right.taskId) ?? 0) -
    (candidatePriorityByTaskId.get(left.taskId) ?? 0)

  if (priorityDelta !== 0) {
    return priorityDelta
  }

  if (left.bucket === 'done' && right.bucket === 'done') {
    const leftReport = latestReportByTaskId.get(left.taskId)
    const rightReport = latestReportByTaskId.get(right.taskId)

    if (leftReport !== undefined && rightReport !== undefined) {
      const reportDelta = compareReportsDescending(leftReport, rightReport)

      if (reportDelta !== 0) {
        return reportDelta
      }
    }
  }

  return left.taskId.localeCompare(right.taskId)
}

export const projectAutomationFlowSignalStack = ({
  candidates,
  executorsByOwnerKey = new Map(),
  reports,
  runs
}: {
  readonly candidates: readonly AutomationFlowTaskCandidate[]
  readonly executorsByOwnerKey?: ReadonlyMap<string, readonly AutomationFlowExecutorRef[]>
  readonly reports: readonly AutomationReportOverlay[]
  readonly runs: readonly AutomationRunOverlay[]
}): AutomationSignalStackProjection => {
  const taskIds = new Set<string>()
  const candidateByTaskId = new Map<string, AutomationFlowTaskCandidate>()
  const candidateOrderByTaskId = new Map<string, number>()
  const candidatePriorityByTaskId = new Map<string, number>()
  const reportsByTaskId = new Map<string, AutomationReportOverlay[]>()
  const runsByTaskId = new Map<string, AutomationRunOverlay[]>()

  for (const [index, candidate] of candidates.entries()) {
    taskIds.add(candidate.taskId)
    candidateByTaskId.set(candidate.taskId, candidate)
    if (!candidateOrderByTaskId.has(candidate.taskId)) {
      candidateOrderByTaskId.set(candidate.taskId, index)
    }
    candidatePriorityByTaskId.set(candidate.taskId, candidate.priority ?? 0)
  }

  for (const report of reports) {
    taskIds.add(report.taskId)
    reportsByTaskId.set(report.taskId, [
      ...(reportsByTaskId.get(report.taskId) ?? []),
      report
    ])
  }

  for (const run of runs) {
    taskIds.add(run.taskId)
    runsByTaskId.set(run.taskId, [
      ...(runsByTaskId.get(run.taskId) ?? []),
      run
    ])
  }

  const latestReportByTaskId = new Map(
    [...taskIds].flatMap((taskId) => {
      const latestReport = pickLatestReport(reportsByTaskId.get(taskId) ?? [])

      return latestReport === undefined ? [] : [[taskId, latestReport]]
    })
  )

  const tasks = [...taskIds]
    .map((taskId) =>
      createProjectedTask({
        candidate: candidateByTaskId.get(taskId),
        eligibleExecutors:
          executorsByOwnerKey.get(
            candidateByTaskId.get(taskId)?.automationFlowOwnerKey ??
              candidateByTaskId.get(taskId)?.automationFlowId ??
              ''
          ) ?? [],
        latestReport: latestReportByTaskId.get(taskId),
        runs: runsByTaskId.get(taskId) ?? [],
        taskId
      })
    )
    .filter((task): task is AutomationProjectedTask => task !== null)
    .sort((left, right) =>
      compareProjectedTasks(
        candidateOrderByTaskId,
        candidatePriorityByTaskId,
        latestReportByTaskId,
        left,
        right
      )
    )

  return Object.freeze({
    buckets: Object.freeze({
      done: Object.freeze(tasks.filter((task) => task.bucket === 'done')),
      needsMe: Object.freeze(
        tasks.filter((task) => task.bucket === 'needs-me')
      ),
      ready: Object.freeze(tasks.filter((task) => task.bucket === 'ready')),
      running: Object.freeze(
        tasks.filter((task) => task.bucket === 'running')
      )
    }),
    tasks: Object.freeze(tasks)
  })
}
