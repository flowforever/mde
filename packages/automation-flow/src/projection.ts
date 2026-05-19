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
  readonly taskKey: string
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

const encodeProjectionKeyPart = (value: string | undefined): string =>
  encodeURIComponent(value?.trim() ?? '')

export const createAutomationTaskProjectionKey = ({
  automationFlowId,
  automationFlowOwnerKey,
  executionRoot,
  sourceItemId,
  taskId,
  workspaceId
}: {
  readonly automationFlowId: string
  readonly automationFlowOwnerKey?: string
  readonly executionRoot?: string
  readonly sourceItemId: string
  readonly taskId: string
  readonly workspaceId?: string
}): string =>
  [
    'automation-task-projection',
    automationFlowOwnerKey ?? automationFlowId,
    taskId,
    sourceItemId,
    executionRoot ?? workspaceId
  ]
    .map(encodeProjectionKeyPart)
    .join(':')

const getCandidateTaskKey = (
  candidate: AutomationFlowTaskCandidate
): string =>
  createAutomationTaskProjectionKey({
    automationFlowId: candidate.automationFlowId,
    automationFlowOwnerKey: candidate.automationFlowOwnerKey,
    executionRoot: candidate.executionRoot,
    sourceItemId: candidate.sourceItemId,
    taskId: candidate.taskId,
    workspaceId: candidate.workspaceId
  })

const getReportTaskKey = (report: AutomationReportOverlay): string =>
  createAutomationTaskProjectionKey({
    automationFlowId: report.automationFlowId,
    automationFlowOwnerKey: report.automationFlowOwnerKey,
    executionRoot: report.executionRoot,
    sourceItemId: report.sourceItemId,
    taskId: report.taskId,
    workspaceId: report.workspaceId
  })

const getRunTaskKey = (run: AutomationRunOverlay): string =>
  createAutomationTaskProjectionKey({
    automationFlowId: run.automationFlowId,
    automationFlowOwnerKey: run.automationFlowOwnerKey,
    executionRoot: run.executionRoot,
    sourceItemId: run.sourceItemId,
    taskId: run.taskId,
    workspaceId: run.workspaceId
  })

const createTaskOverlayIdentityKey = ({
  automationFlowId,
  automationFlowOwnerKey,
  sourceItemId,
  taskDataSnapshotId,
  taskId
}: {
  readonly automationFlowId: string
  readonly automationFlowOwnerKey?: string
  readonly sourceItemId: string
  readonly taskDataSnapshotId?: string
  readonly taskId: string
}): string | undefined =>
  taskDataSnapshotId === undefined
    ? undefined
    : [
        automationFlowOwnerKey ?? automationFlowId,
        taskId,
        sourceItemId,
        taskDataSnapshotId
      ]
        .map(encodeProjectionKeyPart)
        .join(':')

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
  | 'executionRoot'
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
    ...(overlay.candidate?.executionRoot !== undefined
      ? { executionRoot: overlay.candidate.executionRoot }
      : overlay.latestReport?.executionRoot !== undefined
        ? { executionRoot: overlay.latestReport.executionRoot }
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
        : overlay.latestReport?.taskDataId !== undefined
          ? { taskDataId: overlay.latestReport.taskDataId }
        : {}),
    ...(activeRun?.taskDataSnapshotId !== undefined
      ? { taskDataSnapshotId: activeRun.taskDataSnapshotId }
      : overlay.candidate?.taskDataSnapshotId !== undefined
        ? { taskDataSnapshotId: overlay.candidate.taskDataSnapshotId }
        : overlay.latestReport?.taskDataSnapshotId !== undefined
          ? { taskDataSnapshotId: overlay.latestReport.taskDataSnapshotId }
        : {})
  })

  if (activeRun?.state === 'needs-me') {
    return Object.freeze({
      activeRunId: activeRun.runId,
      automationFlowId: activeRun.automationFlowId,
      ...(activeRun.automationFlowOwnerKey !== undefined
        ? { automationFlowOwnerKey: activeRun.automationFlowOwnerKey }
        : overlay.candidate?.automationFlowOwnerKey !== undefined
          ? { automationFlowOwnerKey: overlay.candidate.automationFlowOwnerKey }
        : {}),
      bucket: 'needs-me',
      engine: overlay.candidate?.engine,
      ...(activeRun.executionRoot !== undefined
        ? { executionRoot: activeRun.executionRoot }
        : overlay.candidate?.executionRoot !== undefined
          ? { executionRoot: overlay.candidate.executionRoot }
          : {}),
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
      taskKey: overlay.taskKey,
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
      ...(activeRun.automationFlowOwnerKey !== undefined
        ? { automationFlowOwnerKey: activeRun.automationFlowOwnerKey }
        : overlay.candidate?.automationFlowOwnerKey !== undefined
          ? { automationFlowOwnerKey: overlay.candidate.automationFlowOwnerKey }
        : {}),
      bucket: 'running',
      engine: overlay.candidate?.engine,
      ...(activeRun.executionRoot !== undefined
        ? { executionRoot: activeRun.executionRoot }
        : overlay.candidate?.executionRoot !== undefined
          ? { executionRoot: overlay.candidate.executionRoot }
          : {}),
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
      taskKey: overlay.taskKey,
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
      taskKey: overlay.taskKey,
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
      ...(overlay.candidate.executionRoot !== undefined
        ? { executionRoot: overlay.candidate.executionRoot }
        : {}),
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
      taskKey: overlay.taskKey,
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
  candidateOrderByTaskKey: ReadonlyMap<string, number>,
  candidatePriorityByTaskKey: ReadonlyMap<string, number>,
  latestReportByTaskKey: ReadonlyMap<string, AutomationReportOverlay>,
  left: AutomationProjectedTask,
  right: AutomationProjectedTask
): number => {
  const bucketDelta = bucketOrder[left.bucket] - bucketOrder[right.bucket]

  if (bucketDelta !== 0) {
    return bucketDelta
  }

  const leftCandidateOrder =
    candidateOrderByTaskKey.get(left.taskKey) ?? Number.POSITIVE_INFINITY
  const rightCandidateOrder =
    candidateOrderByTaskKey.get(right.taskKey) ?? Number.POSITIVE_INFINITY
  const candidateOrderDelta = leftCandidateOrder - rightCandidateOrder

  if (candidateOrderDelta !== 0) {
    return candidateOrderDelta
  }

  const priorityDelta =
    (candidatePriorityByTaskKey.get(right.taskKey) ?? 0) -
    (candidatePriorityByTaskKey.get(left.taskKey) ?? 0)

  if (priorityDelta !== 0) {
    return priorityDelta
  }

  if (left.bucket === 'done' && right.bucket === 'done') {
    const leftReport = latestReportByTaskKey.get(left.taskKey)
    const rightReport = latestReportByTaskKey.get(right.taskKey)

    if (leftReport !== undefined && rightReport !== undefined) {
      const reportDelta = compareReportsDescending(leftReport, rightReport)

      if (reportDelta !== 0) {
        return reportDelta
      }
    }
  }

  return left.taskKey.localeCompare(right.taskKey)
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
  const taskKeys = new Set<string>()
  const taskIdByTaskKey = new Map<string, string>()
  const candidateByTaskKey = new Map<string, AutomationFlowTaskCandidate>()
  const candidateOrderByTaskKey = new Map<string, number>()
  const candidatePriorityByTaskKey = new Map<string, number>()
  const candidateTaskKeyByIdentity = new Map<string, string | null>()
  const reportsByTaskKey = new Map<string, AutomationReportOverlay[]>()
  const runsByTaskKey = new Map<string, AutomationRunOverlay[]>()

  for (const [index, candidate] of candidates.entries()) {
    const taskKey = getCandidateTaskKey(candidate)
    const identityKey = createTaskOverlayIdentityKey(candidate)

    taskKeys.add(taskKey)
    taskIdByTaskKey.set(taskKey, candidate.taskId)
    if (!candidateByTaskKey.has(taskKey)) {
      candidateByTaskKey.set(taskKey, candidate)
    }
    if (!candidateOrderByTaskKey.has(taskKey)) {
      candidateOrderByTaskKey.set(taskKey, index)
    }
    candidatePriorityByTaskKey.set(taskKey, candidate.priority ?? 0)
    if (identityKey !== undefined) {
      const existingTaskKey = candidateTaskKeyByIdentity.get(identityKey)

      candidateTaskKeyByIdentity.set(
        identityKey,
        existingTaskKey === undefined || existingTaskKey === taskKey
          ? taskKey
          : null
      )
    }
  }

  for (const report of reports) {
    const exactTaskKey = getReportTaskKey(report)
    const identityKey = createTaskOverlayIdentityKey(report)
    const candidateTaskKey =
      identityKey === undefined
        ? undefined
        : candidateTaskKeyByIdentity.get(identityKey)
    const taskKey =
      !taskKeys.has(exactTaskKey) &&
      candidateTaskKey !== undefined &&
      candidateTaskKey !== null
        ? candidateTaskKey
        : exactTaskKey

    taskKeys.add(taskKey)
    taskIdByTaskKey.set(taskKey, report.taskId)
    reportsByTaskKey.set(taskKey, [
      ...(reportsByTaskKey.get(taskKey) ?? []),
      report
    ])
  }

  for (const run of runs) {
    const exactTaskKey = getRunTaskKey(run)
    const identityKey = createTaskOverlayIdentityKey(run)
    const candidateTaskKey =
      identityKey === undefined
        ? undefined
        : candidateTaskKeyByIdentity.get(identityKey)
    const taskKey =
      !taskKeys.has(exactTaskKey) &&
      candidateTaskKey !== undefined &&
      candidateTaskKey !== null
        ? candidateTaskKey
        : exactTaskKey

    taskKeys.add(taskKey)
    taskIdByTaskKey.set(taskKey, run.taskId)
    runsByTaskKey.set(taskKey, [
      ...(runsByTaskKey.get(taskKey) ?? []),
      run
    ])
  }

  const latestReportByTaskKey = new Map(
    [...taskKeys].flatMap((taskKey) => {
      const latestReport = pickLatestReport(reportsByTaskKey.get(taskKey) ?? [])

      return latestReport === undefined ? [] : [[taskKey, latestReport]]
    })
  )

  const tasks = [...taskKeys]
    .map((taskKey) => {
      const candidate = candidateByTaskKey.get(taskKey)
      const taskId = taskIdByTaskKey.get(taskKey) ?? taskKey

      return createProjectedTask({
        candidate,
        eligibleExecutors:
          executorsByOwnerKey.get(
            candidate?.automationFlowOwnerKey ??
              candidate?.automationFlowId ??
              ''
          ) ?? [],
        latestReport: latestReportByTaskKey.get(taskKey),
        runs: runsByTaskKey.get(taskKey) ?? [],
        taskId,
        taskKey
      })
    })
    .filter((task): task is AutomationProjectedTask => task !== null)
    .sort((left, right) =>
      compareProjectedTasks(
        candidateOrderByTaskKey,
        candidatePriorityByTaskKey,
        latestReportByTaskKey,
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
