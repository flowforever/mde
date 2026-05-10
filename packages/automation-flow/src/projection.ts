import type {
  AutomationFlowTaskCandidate,
  AutomationProjectedTask,
  AutomationReportOverlay,
  AutomationRunOverlay,
  AutomationSignalStackProjection,
  AutomationTaskBucket
} from './types'

interface TaskOverlay {
  readonly candidate?: AutomationFlowTaskCandidate
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

const isActiveRun = (run: AutomationRunOverlay): boolean =>
  run.state === 'needs-me' || run.state === 'running'

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

  return runs.find((run) => run.state === 'running')
}

const getProjectedTaskTitle = (overlay: TaskOverlay): string =>
  overlay.candidate?.title ?? overlay.latestReport?.title ?? overlay.taskId

const createProjectedTask = (
  overlay: TaskOverlay
): AutomationProjectedTask | null => {
  const activeRun = pickActiveRun(overlay.runs.filter(isActiveRun))

  if (activeRun?.state === 'needs-me') {
    return Object.freeze({
      activeRunId: activeRun.runId,
      automationFlowId: activeRun.automationFlowId,
      bucket: 'needs-me',
      engine: overlay.candidate?.engine,
      latestReportId: overlay.latestReport?.reportId,
      sourceItemId: activeRun.sourceItemId,
      sourceType: overlay.candidate?.sourceType,
      taskId: overlay.taskId,
      title: getProjectedTaskTitle(overlay)
    })
  }

  if (activeRun?.state === 'running') {
    return Object.freeze({
      activeRunId: activeRun.runId,
      automationFlowId: activeRun.automationFlowId,
      bucket: 'running',
      engine: overlay.candidate?.engine,
      latestReportId: overlay.latestReport?.reportId,
      sourceItemId: activeRun.sourceItemId,
      sourceType: overlay.candidate?.sourceType,
      taskId: overlay.taskId,
      title: getProjectedTaskTitle(overlay)
    })
  }

  if (overlay.latestReport !== undefined) {
    return Object.freeze({
      automationFlowId: overlay.latestReport.automationFlowId,
      bucket: 'done',
      latestReportId: overlay.latestReport.reportId,
      sourceItemId: overlay.latestReport.sourceItemId,
      taskId: overlay.taskId,
      title: getProjectedTaskTitle(overlay)
    })
  }

  if (overlay.candidate !== undefined) {
    return Object.freeze({
      automationFlowId: overlay.candidate.automationFlowId,
      bucket: 'ready',
      engine: overlay.candidate.engine,
      sourceItemId: overlay.candidate.sourceItemId,
      sourceType: overlay.candidate.sourceType,
      taskId: overlay.taskId,
      title: overlay.candidate.title
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
  reports,
  runs
}: {
  readonly candidates: readonly AutomationFlowTaskCandidate[]
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
