import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { dirname, join } from 'node:path'

import type {
  AgentEngineId,
  AutomationDiscoveredTaskSource,
  AutomationRunKind,
  AutomationRunState
} from '@mde/automation-flow'
import { isValidAutomationDiscoverySourceInput } from '@mde/automation-flow'

import type {
  AutomationProjectionFilters,
  AutomationReportSummary
} from '../../../shared/automation'
import { assertAutomationEvidencePath } from './automationPathSafety'
import { isAutomationRunLockActive } from './automationRunLocks'

interface AutomationStoreOptions {
  readonly appDataPath: string
  readonly now?: () => string
}

interface CreateRunInput {
  readonly automationFlowOwnerKey?: string
  readonly adapterSessionId?: string
  readonly adapterSessionLineage?: readonly string[]
  readonly automationFlowId: string
  readonly automationFlowSnapshot?: unknown
  readonly automationFlowSnapshotId?: string
  readonly engine: AgentEngineId
  readonly promptBundleMetadata?: AutomationPromptBundleMetadata
  readonly runId: string
  readonly runKind: AutomationRunKind
  readonly runLockKey?: string
  readonly executorId?: string
  readonly executorSnapshotId?: string
  readonly sourceItemId?: string
  readonly sourcePath?: string
  readonly sourceSnapshotHash?: string
  readonly taskSourceSnapshot?: AutomationDiscoveredTaskSource
  readonly state: AutomationRunState
  readonly taskId: string
  readonly taskDataId?: string
  readonly taskDataSnapshotId?: string
  readonly title?: string
  readonly workspaceRoot?: string
}

interface AppendEventInput {
  readonly createdAt?: string
  readonly eventId: string
  readonly evidencePath?: string
  readonly summary?: string
  readonly type: string
}

export interface AutomationPromptBundleMetadata {
  readonly automationFlowSnapshotId: string
  readonly bundleId: string
  readonly createdAt: string
  readonly runKind: AutomationRunKind
  readonly sourceSnapshotHash?: string
}

interface CreateDecisionInput {
  readonly decisionId: string
  readonly prompt: string
  readonly taskId: string
  readonly type: 'approval' | 'choice' | 'input'
}

interface CreateReportInput {
  readonly completedAt?: string
  readonly evidencePath?: string
  readonly outcome: AutomationReportSummary['outcome']
  readonly reportId: string
  readonly runId?: string
  readonly summary?: string
  readonly taskId: string
  readonly title: string
}

export interface AutomationStoredRun {
  readonly adapterSessionId?: string
  readonly adapterSessionLineage?: readonly string[]
  readonly automationFlowId: string
  readonly automationFlowOwnerKey?: string
  readonly automationFlowSnapshot?: unknown
  readonly automationFlowSnapshotId?: string
  readonly engine: AgentEngineId
  readonly interruptedAt?: string
  readonly promptBundleMetadata?: AutomationPromptBundleMetadata
  readonly recoverable: boolean
  readonly runId: string
  readonly runKind: AutomationRunKind
  readonly runLockKey?: string
  readonly executorId?: string
  readonly executorSnapshotId?: string
  readonly sourceItemId?: string
  readonly sourcePath?: string
  readonly sourceSnapshotHash?: string
  readonly startedAt: string
  readonly state: AutomationRunState
  readonly taskId: string
  readonly taskDataId?: string
  readonly taskDataSnapshotId?: string
  readonly taskSourceSnapshot?: AutomationDiscoveredTaskSource
  readonly title?: string
  readonly updatedAt: string
  readonly workspaceRoot?: string
}

export interface AutomationStoredEvent {
  readonly createdAt: string
  readonly eventId: string
  readonly evidencePath?: string
  readonly summary?: string
  readonly type: string
}

export interface AutomationStoredDecision {
  readonly createdAt: string
  readonly decisionId: string
  readonly prompt: string
  readonly resolvedAt?: string
  readonly response?: string
  readonly runId: string
  readonly status: 'approved' | 'pending' | 'rejected' | 'resolved' | 'resuming'
  readonly taskId: string
  readonly type: 'approval' | 'choice' | 'input'
}

export interface AutomationTaskDataSnapshotRecord {
  readonly automationFlowId: string
  readonly automationFlowOwnerKey?: string
  readonly discoveredAt: string
  readonly lastSeenDiscoveryRunId: string
  readonly removedAt?: string
  readonly sourceItemId: string
  readonly sourceSnapshotHash: string
  readonly sourceType: AutomationDiscoveredTaskSource['sourceType']
  readonly taskDataId: string
  readonly taskDataSnapshotId: string
  readonly taskSourceSnapshot: AutomationDiscoveredTaskSource
}

interface StoredRunFile {
  readonly decisions: readonly AutomationStoredDecision[]
  readonly events: readonly AutomationStoredEvent[]
  readonly run: AutomationStoredRun
}

export interface AutomationStorePaths {
  readonly automationRoot: string
  readonly discoveredSourcesRoot: string
  readonly reportsRoot: string
  readonly runsRoot: string
  readonly runtimeRoot: string
  readonly taskDataSnapshotsRoot: string
  readonly userTaskPromptsRoot: string
  readonly workspacesRoot: string
}

export interface AutomationStore {
  readonly appendAdapterSession: (
    runId: string,
    adapterSessionId: string
  ) => Promise<AutomationStoredRun>
  readonly appendEvent: (
    runId: string,
    event: AppendEventInput
  ) => Promise<AutomationStoredEvent>
  readonly createReport: (
    report: CreateReportInput
  ) => Promise<AutomationReportSummary>
  readonly createRun: (run: CreateRunInput) => Promise<AutomationStoredRun>
  readonly findActiveRunByLockKey: (
    runLockKey: string
  ) => Promise<AutomationStoredRun | null>
  readonly initialize: () => Promise<void>
  readonly getRun: (runId: string) => Promise<AutomationStoredRun>
  readonly listDecisions: () => Promise<readonly AutomationStoredDecision[]>
  readonly listDiscoveredTaskSources: () => Promise<
    readonly AutomationDiscoveredTaskSource[]
  >
  readonly listTaskDataSnapshots: () => Promise<
    readonly AutomationTaskDataSnapshotRecord[]
  >
  readonly listReports: () => Promise<readonly AutomationReportSummary[]>
  readonly listRuns: () => Promise<readonly AutomationStoredRun[]>
  readonly loadFilterState: () => Promise<AutomationProjectionFilters>
  readonly claimDecisionForResume: (
    decisionId: string
  ) => Promise<AutomationStoredDecision>
  readonly markNeedsMe: (
    runId: string,
    decision: CreateDecisionInput
  ) => Promise<AutomationStoredDecision>
  readonly recoverInterruptedRuns: () => Promise<void>
  readonly resolveDecision: (
    decisionId: string,
    response: string
  ) => Promise<AutomationStoredDecision>
  readonly rollbackDecisionResumeClaim: (
    decisionId: string
  ) => Promise<AutomationStoredDecision>
  readonly replaceDiscoveredTaskSources: (
    automationFlowId: string,
    sources: readonly AutomationDiscoveredTaskSource[],
    ownerKey?: string
  ) => Promise<readonly AutomationDiscoveredTaskSource[]>
  readonly replaceTaskDataSnapshots: (
    ownerKey: string,
    sources: readonly AutomationDiscoveredTaskSource[],
    discoveryRunId: string
  ) => Promise<readonly AutomationTaskDataSnapshotRecord[]>
  readonly saveFilterState: (filters: AutomationProjectionFilters) => Promise<void>
  readonly updateRunState: (
    runId: string,
    input: {
      readonly adapterSessionId?: string
      readonly interruptedAt?: string
      readonly recoverable?: boolean
      readonly state: AutomationRunState
    }
  ) => Promise<AutomationStoredRun>
}

const runStatesInFlight = new Set<AutomationRunState>(['running', 'starting'])

const encodeStorageId = (id: string): string => `${encodeURIComponent(id)}.json`

const encodeOwnerStorageId = (id: string): string =>
  `owner-${createHash('sha256').update(id).digest('hex').slice(0, 32)}.json`

export const getAutomationStorePaths = (
  appDataPath: string
): AutomationStorePaths => {
  const automationRoot = join(appDataPath, 'automation')

  return Object.freeze({
    automationRoot,
    discoveredSourcesRoot: join(automationRoot, 'discovered-sources'),
    reportsRoot: join(automationRoot, 'reports'),
    runsRoot: join(automationRoot, 'runs'),
    runtimeRoot: join(automationRoot, 'automation-flow-runtime'),
    taskDataSnapshotsRoot: join(automationRoot, 'task-data-snapshots'),
    userTaskPromptsRoot: join(automationRoot, 'user-task-prompts'),
    workspacesRoot: join(automationRoot, 'workspaces')
  })
}

const redactSensitiveText = (text: string): string =>
  text
    .replace(
      /\b(?:authorization:\s*bearer|api[_-]?key|password|token)\s*[:=]\s*[^\s,;]+/giu,
      (match) => `${match.split(/[:=]/u)[0]}=[redacted]`
    )
    .replace(/\bBearer\s+[^\s,;]+/giu, 'Bearer [redacted]')

const JSON_READ_RETRY_DELAYS_MS = Object.freeze([10, 40, 100])

const isRetryableJsonReadError = (error: unknown): boolean =>
  error instanceof SyntaxError

const readJsonFile = async <Value>(filePath: string): Promise<Value> => {
  let lastError: unknown

  for (const retryDelayMs of [0, ...JSON_READ_RETRY_DELAYS_MS]) {
    if (retryDelayMs > 0) {
      await delay(retryDelayMs)
    }

    try {
      return JSON.parse(await readFile(filePath, 'utf8')) as Value
    } catch (error) {
      lastError = error

      if (!isRetryableJsonReadError(error)) {
        throw error
      }
    }
  }

  throw lastError
}

const writeJsonFile = async (filePath: string, value: unknown): Promise<void> => {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`

  try {
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    await rename(tempPath, filePath)
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined)
    throw error
  }
}

const normalizeStoredFilterState = (value: unknown): AutomationProjectionFilters => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return Object.freeze({})
  }

  const record = value as Record<string, unknown>
  const flowIds = Array.isArray(record.flowIds)
    ? record.flowIds.filter((item): item is string => typeof item === 'string')
    : typeof record.flowId === 'string'
      ? [record.flowId]
      : undefined
  const workspaceIds = Array.isArray(record.workspaceIds)
    ? record.workspaceIds.filter((item): item is string => typeof item === 'string')
    : typeof record.workspaceId === 'string'
      ? [record.workspaceId]
      : undefined
  const flowOwnerKeys = Array.isArray(record.flowOwnerKeys)
    ? record.flowOwnerKeys.filter((item): item is string => typeof item === 'string')
    : undefined
  const scopeIds = Array.isArray(record.scopeIds)
    ? record.scopeIds.filter((item): item is string => typeof item === 'string')
    : undefined

  return Object.freeze({
    ...(typeof record.archivedVisible === 'boolean'
      ? { archivedVisible: record.archivedVisible }
      : {}),
    ...(typeof record.bucket === 'string'
      ? { bucket: record.bucket as AutomationProjectionFilters['bucket'] }
      : {}),
    ...(flowIds !== undefined ? { flowIds: Object.freeze(flowIds) } : {}),
    ...(flowOwnerKeys !== undefined
      ? { flowOwnerKeys: Object.freeze(flowOwnerKeys) }
      : {}),
    ...(scopeIds !== undefined ? { scopeIds: Object.freeze(scopeIds) } : {}),
    ...(workspaceIds !== undefined
      ? { workspaceIds: Object.freeze(workspaceIds) }
      : {})
  })
}

const createDefaultRunFile = (run: AutomationStoredRun): StoredRunFile =>
  Object.freeze({
    decisions: Object.freeze([]),
    events: Object.freeze([]),
    run
  })

const appendUnique = (
  values: readonly string[] | undefined,
  nextValue: string
): readonly string[] => {
  const currentValues = values ?? []

  return Object.freeze(
    currentValues.includes(nextValue)
      ? [...currentValues]
      : [...currentValues, nextValue]
  )
}

const getTerminalRunState = (
  outcome: AutomationReportSummary['outcome']
): AutomationRunState => {
  switch (outcome) {
    case 'blocked':
      return 'needs-me'
    case 'cancelled':
      return 'cancelled'
    case 'failed':
      return 'failed'
    case 'succeeded':
      return 'done'
  }
}

const isTerminalRunState = (state: AutomationRunState): boolean =>
  state === 'cancelled' || state === 'done'

const isTerminalReportOutcome = (
  outcome: AutomationReportSummary['outcome']
): boolean => outcome === 'cancelled' || outcome === 'failed' || outcome === 'succeeded'

const resetResumingDecision = (
  decision: AutomationStoredDecision
): AutomationStoredDecision =>
  Object.freeze({
    createdAt: decision.createdAt,
    decisionId: decision.decisionId,
    prompt: decision.prompt,
    runId: decision.runId,
    status: 'pending',
    taskId: decision.taskId,
    type: decision.type
  })

export const createAutomationStore = ({
  appDataPath,
  now = () => new Date().toISOString()
}: AutomationStoreOptions): AutomationStore => {
  const paths = getAutomationStorePaths(appDataPath)
  const decisionResumeClaims = new Set<string>()
  const discoveredSourcesPath = (
    automationFlowId: string,
    ownerKey?: string
  ): string =>
    join(
      paths.discoveredSourcesRoot,
      ownerKey === undefined
        ? encodeStorageId(automationFlowId)
        : encodeOwnerStorageId(ownerKey)
    )
  const taskDataSnapshotsPath = (ownerKey: string): string =>
    join(paths.taskDataSnapshotsRoot, encodeOwnerStorageId(ownerKey))
  const runPath = (runId: string): string => join(paths.runsRoot, encodeStorageId(runId))
  const reportPath = (reportId: string): string =>
    join(paths.reportsRoot, encodeStorageId(reportId))
  const filterStatePath = join(paths.runtimeRoot, 'filter-state.json')

  const initialize = async (): Promise<void> => {
    await Promise.all([
      mkdir(paths.reportsRoot, { recursive: true }),
      mkdir(paths.discoveredSourcesRoot, { recursive: true }),
      mkdir(paths.runsRoot, { recursive: true }),
      mkdir(paths.runtimeRoot, { recursive: true }),
      mkdir(paths.taskDataSnapshotsRoot, { recursive: true }),
      mkdir(paths.userTaskPromptsRoot, { recursive: true }),
      mkdir(paths.workspacesRoot, { recursive: true })
    ])
    await writeFile(join(paths.automationRoot, '.initialized'), 'v1\n', 'utf8')
  }

  const loadRunFile = async (runId: string): Promise<StoredRunFile> =>
    readJsonFile<StoredRunFile>(runPath(runId))

  const saveRunFile = async (runFile: StoredRunFile): Promise<void> => {
    await writeJsonFile(runPath(runFile.run.runId), runFile)
  }

  const updateDecision = async (
    decisionId: string,
    update: (
      decision: AutomationStoredDecision,
      timestamp: string
    ) => AutomationStoredDecision
  ): Promise<AutomationStoredDecision> => {
    const entries = await readdir(paths.runsRoot, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue
      }

      const filePath = join(paths.runsRoot, entry.name)
      const runFile = await readJsonFile<StoredRunFile>(filePath)
      const decisionIndex = runFile.decisions.findIndex(
        (decision) => decision.decisionId === decisionId
      )

      if (decisionIndex === -1) {
        continue
      }

      const timestamp = now()
      const storedDecision = update(runFile.decisions[decisionIndex], timestamp)
      const decisions = Object.freeze(
        runFile.decisions.map((decision, index) =>
          index === decisionIndex ? storedDecision : decision
        )
      )

      await writeJsonFile(
        filePath,
        Object.freeze({
          ...runFile,
          decisions,
          run: Object.freeze({
            ...runFile.run,
            updatedAt: timestamp
          })
        })
      )

      return storedDecision
    }

    throw new Error('Automation decision not found')
  }

  const normalizeEvidencePath = async (
    evidencePath: string | undefined,
    workspaceRoot: string | undefined
  ): Promise<string | undefined> => {
    if (evidencePath === undefined) {
      return undefined
    }

    return assertAutomationEvidencePath({
      appDataPath,
      targetPath: evidencePath,
      workspaceRoot
    })
  }

  const store: AutomationStore = {
    async appendAdapterSession(runId: string, adapterSessionId: string) {
      const runFile = await loadRunFile(runId)
      const timestamp = now()
      const nextRun = Object.freeze({
        ...runFile.run,
        adapterSessionId,
        adapterSessionLineage: appendUnique(
          runFile.run.adapterSessionLineage,
          adapterSessionId
        ),
        updatedAt: timestamp
      }) satisfies AutomationStoredRun

      await saveRunFile(
        Object.freeze({
          ...runFile,
          run: nextRun
        })
      )

      return nextRun
    },
    async appendEvent(runId: string, event: AppendEventInput) {
      const runFile = await loadRunFile(runId)
      const evidencePath = await normalizeEvidencePath(
        event.evidencePath,
        runFile.run.workspaceRoot
      )
      const storedEvent = Object.freeze({
        createdAt: event.createdAt ?? now(),
        eventId: event.eventId,
        ...(evidencePath !== undefined ? { evidencePath } : {}),
        ...(event.summary !== undefined
          ? { summary: redactSensitiveText(event.summary) }
          : {}),
        type: event.type
      }) satisfies AutomationStoredEvent
      const nextRunFile = Object.freeze({
        ...runFile,
        events: Object.freeze([...runFile.events, storedEvent]),
        run: Object.freeze({
          ...runFile.run,
          updatedAt: now()
        })
      })

      await saveRunFile(nextRunFile)

      return storedEvent
    },
    async createReport(report: CreateReportInput) {
      const completedAt = report.completedAt ?? now()
      const runFile =
        report.runId === undefined ? undefined : await loadRunFile(report.runId)
      const evidencePath = await normalizeEvidencePath(
        report.evidencePath,
        runFile?.run.workspaceRoot
      )
      const storedReport = Object.freeze({
        completedAt,
        outcome: report.outcome,
        reportId: report.reportId,
        ...(report.runId !== undefined ? { runId: report.runId } : {}),
        ...(report.summary !== undefined
          ? { summary: redactSensitiveText(report.summary) }
          : {}),
        ...(evidencePath !== undefined ? { evidencePath } : {}),
        taskId: report.taskId,
        title: report.title
      }) satisfies AutomationReportSummary

      await writeJsonFile(reportPath(report.reportId), storedReport)

      if (runFile !== undefined) {
        await saveRunFile(
          Object.freeze({
            ...runFile,
            run: Object.freeze({
              ...runFile.run,
              recoverable: false,
              state: getTerminalRunState(report.outcome),
              updatedAt: completedAt
            })
          })
        )
      }

      return storedReport
    },
    async createRun(run: CreateRunInput) {
      const timestamp = now()
      const adapterSessionLineage =
        run.adapterSessionLineage ??
        (run.adapterSessionId === undefined
          ? undefined
          : Object.freeze([run.adapterSessionId]))
      const storedRun = Object.freeze({
        ...(run.adapterSessionId !== undefined
          ? { adapterSessionId: run.adapterSessionId }
          : {}),
        ...(adapterSessionLineage !== undefined
          ? { adapterSessionLineage }
          : {}),
        automationFlowId: run.automationFlowId,
        ...(run.automationFlowOwnerKey !== undefined
          ? { automationFlowOwnerKey: run.automationFlowOwnerKey }
          : {}),
        ...(run.automationFlowSnapshot !== undefined
          ? { automationFlowSnapshot: run.automationFlowSnapshot }
          : {}),
        ...(run.automationFlowSnapshotId !== undefined
          ? { automationFlowSnapshotId: run.automationFlowSnapshotId }
          : {}),
        engine: run.engine,
        ...(run.promptBundleMetadata !== undefined
          ? { promptBundleMetadata: run.promptBundleMetadata }
          : {}),
        recoverable: false,
        runId: run.runId,
        runKind: run.runKind,
        ...(run.runLockKey !== undefined ? { runLockKey: run.runLockKey } : {}),
        ...(run.executorId !== undefined ? { executorId: run.executorId } : {}),
        ...(run.executorSnapshotId !== undefined
          ? { executorSnapshotId: run.executorSnapshotId }
          : {}),
        ...(run.sourceItemId !== undefined ? { sourceItemId: run.sourceItemId } : {}),
        ...(run.sourcePath !== undefined ? { sourcePath: run.sourcePath } : {}),
        ...(run.sourceSnapshotHash !== undefined
          ? { sourceSnapshotHash: run.sourceSnapshotHash }
          : {}),
        startedAt: timestamp,
        state: run.state,
        taskId: run.taskId,
        ...(run.taskDataId !== undefined ? { taskDataId: run.taskDataId } : {}),
        ...(run.taskDataSnapshotId !== undefined
          ? { taskDataSnapshotId: run.taskDataSnapshotId }
          : {}),
        ...(run.taskSourceSnapshot !== undefined
          ? { taskSourceSnapshot: run.taskSourceSnapshot }
          : {}),
        ...(run.title !== undefined ? { title: run.title } : {}),
        updatedAt: timestamp,
        ...(run.workspaceRoot !== undefined ? { workspaceRoot: run.workspaceRoot } : {})
      }) satisfies AutomationStoredRun

      await saveRunFile(createDefaultRunFile(storedRun))

      return storedRun
    },
    async findActiveRunByLockKey(runLockKey) {
      const runs = await store.listRuns()

      return (
        runs.find(
          (run) =>
            run.runLockKey === runLockKey && isAutomationRunLockActive(run)
        ) ?? null
      )
    },
    initialize,
    async getRun(runId: string) {
      return (await loadRunFile(runId)).run
    },
    async listDecisions() {
      const entries = await readdir(paths.runsRoot, { withFileTypes: true })
      const runFiles = await Promise.all(
        entries
          .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
          .map((entry) =>
            readJsonFile<StoredRunFile>(join(paths.runsRoot, entry.name))
          )
      )

      return Object.freeze(
        runFiles
          .flatMap((runFile) => runFile.decisions)
          .sort((left, right) =>
            left.createdAt.localeCompare(right.createdAt) ||
            left.decisionId.localeCompare(right.decisionId)
          )
      )
    },
    async listDiscoveredTaskSources() {
      const entries = await readdir(paths.discoveredSourcesRoot, {
        withFileTypes: true
      })
      const sourceGroups = await Promise.all(
        entries
          .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
          .map((entry) =>
            readJsonFile<readonly AutomationDiscoveredTaskSource[]>(
              join(paths.discoveredSourcesRoot, entry.name)
            )
          )
      )

      return Object.freeze(
        sourceGroups
          .flatMap((sources) => sources)
          .sort((left, right) =>
            left.discoveredAt.localeCompare(right.discoveredAt) ||
            left.automationFlowId.localeCompare(right.automationFlowId) ||
            left.sourceItemId.localeCompare(right.sourceItemId)
          )
      )
    },
    async listTaskDataSnapshots() {
      try {
        const entries = await readdir(paths.taskDataSnapshotsRoot, {
          withFileTypes: true
        })
        const snapshotGroups = await Promise.all(
          entries
            .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
            .map((entry) =>
              readJsonFile<readonly AutomationTaskDataSnapshotRecord[]>(
                join(paths.taskDataSnapshotsRoot, entry.name)
              )
            )
        )

        return Object.freeze(
          snapshotGroups
            .flatMap((snapshots) => snapshots)
            .sort((left, right) =>
              left.taskDataId.localeCompare(right.taskDataId) ||
              left.taskDataSnapshotId.localeCompare(right.taskDataSnapshotId)
            )
        )
      } catch {
        return Object.freeze([])
      }
    },
    async listReports() {
      const entries = await readdir(paths.reportsRoot, { withFileTypes: true })
      const reports = await Promise.all(
        entries
          .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
          .map((entry) =>
            readJsonFile<AutomationReportSummary>(join(paths.reportsRoot, entry.name))
          )
      )

      return Object.freeze(
        reports.sort((left, right) =>
          left.completedAt.localeCompare(right.completedAt) ||
          left.reportId.localeCompare(right.reportId)
        )
      )
    },
    async listRuns() {
      const entries = await readdir(paths.runsRoot, { withFileTypes: true })
      const runFiles = await Promise.all(
        entries
          .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
          .map((entry) =>
            readJsonFile<StoredRunFile>(join(paths.runsRoot, entry.name))
          )
      )

      return Object.freeze(
        runFiles
          .map((runFile) => runFile.run)
          .sort((left, right) =>
            left.startedAt.localeCompare(right.startedAt) ||
            left.runId.localeCompare(right.runId)
          )
      )
    },
    async loadFilterState() {
      try {
        return normalizeStoredFilterState(await readJsonFile<unknown>(filterStatePath))
      } catch {
        return Object.freeze({})
      }
    },
    async claimDecisionForResume(decisionId) {
      if (decisionResumeClaims.has(decisionId)) {
        throw new Error('Automation decision is already being resumed')
      }

      decisionResumeClaims.add(decisionId)

      try {
        return await updateDecision(decisionId, (decision) => {
          if (decision.status !== 'pending') {
            throw new Error('Automation decision is not pending')
          }

          return Object.freeze({
            ...decision,
            status: 'resuming'
          }) satisfies AutomationStoredDecision
        })
      } catch (error) {
        decisionResumeClaims.delete(decisionId)
        throw error
      }
    },
    async markNeedsMe(runId: string, decision: CreateDecisionInput) {
      const runFile = await loadRunFile(runId)
      const timestamp = now()
      const storedDecision = Object.freeze({
        createdAt: timestamp,
        decisionId: decision.decisionId,
        prompt: decision.prompt,
        runId,
        status: 'pending',
        taskId: decision.taskId,
        type: decision.type
      }) satisfies AutomationStoredDecision

      const nextRun = Object.freeze({
        ...runFile.run,
        state: 'needs-me',
        updatedAt: timestamp
      }) satisfies AutomationStoredRun

      await saveRunFile(
        Object.freeze({
          ...runFile,
          decisions: Object.freeze([...runFile.decisions, storedDecision]),
          run: nextRun
        })
      )

      return storedDecision
    },
    async recoverInterruptedRuns() {
      const entries = await readdir(paths.runsRoot, { withFileTypes: true })
      const terminalReportRunIds = new Set(
        (await store.listReports())
          .filter((report) => isTerminalReportOutcome(report.outcome))
          .map((report) => report.runId)
          .filter((runId): runId is string => runId !== undefined)
      )

      await Promise.all(
        entries
          .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
          .map(async (entry) => {
            const filePath = join(paths.runsRoot, entry.name)
            const runFile = await readJsonFile<StoredRunFile>(filePath)
            const interrupted = runStatesInFlight.has(runFile.run.state)
            const retryableResumingDecisionFound =
              !isTerminalRunState(runFile.run.state) &&
              !terminalReportRunIds.has(runFile.run.runId) &&
              runFile.decisions.some((decision) => decision.status === 'resuming')

            if (!interrupted && !retryableResumingDecisionFound) {
              return
            }

            const timestamp = now()
            const interruptedRun = interrupted
              ? ({
                  ...runFile.run,
                  interruptedAt: timestamp,
                  recoverable: true,
                  state: 'failed',
                  updatedAt: timestamp
                } satisfies AutomationStoredRun)
              : runFile.run
            const decisions = retryableResumingDecisionFound
              ? Object.freeze(
                  runFile.decisions.map((decision) =>
                    decision.status === 'resuming'
                      ? resetResumingDecision(decision)
                      : decision
                  )
                )
              : runFile.decisions
            const run = retryableResumingDecisionFound
              ? (() => {
                  const runWithoutInterruptedAt = {
                    ...interruptedRun
                  } as {
                    -readonly [Key in keyof AutomationStoredRun]: AutomationStoredRun[Key]
                  }

                  delete runWithoutInterruptedAt.interruptedAt

                  return Object.freeze({
                    ...runWithoutInterruptedAt,
                    recoverable: false,
                    state: 'needs-me',
                    updatedAt: timestamp
                  }) satisfies AutomationStoredRun
                })()
              : interruptedRun

            await writeJsonFile(filePath, {
              ...runFile,
              decisions,
              run
            })
          })
      )
    },
    async resolveDecision(decisionId, response) {
      try {
        return await updateDecision(decisionId, (decision, timestamp) => {
          if (decision.status !== 'resuming') {
            throw new Error('Automation decision has not been claimed for resume')
          }

          return Object.freeze({
            ...decision,
            resolvedAt: timestamp,
            response: redactSensitiveText(response),
            status: response === 'approved' ? 'approved' : 'resolved'
          }) satisfies AutomationStoredDecision
        })
      } finally {
        decisionResumeClaims.delete(decisionId)
      }
    },
    async rollbackDecisionResumeClaim(decisionId) {
      try {
        return await updateDecision(decisionId, (decision) => {
          if (decision.status !== 'resuming') {
            throw new Error('Automation decision is not being resumed')
          }

          return Object.freeze({
            createdAt: decision.createdAt,
            decisionId: decision.decisionId,
            prompt: decision.prompt,
            runId: decision.runId,
            status: 'pending',
            taskId: decision.taskId,
            type: decision.type
          }) satisfies AutomationStoredDecision
        })
      } finally {
        decisionResumeClaims.delete(decisionId)
      }
    },
    async replaceDiscoveredTaskSources(automationFlowId, sources, ownerKey) {
      const normalizedSources = Object.freeze(
        sources.filter(isValidAutomationDiscoverySourceInput).map((source) =>
          Object.freeze({
            ...source,
            automationFlowId,
            ...(ownerKey !== undefined ? { automationFlowOwnerKey: ownerKey } : {})
          })
        )
      )

      await writeJsonFile(
        discoveredSourcesPath(automationFlowId, ownerKey),
        normalizedSources
      )

      return normalizedSources
    },
    async replaceTaskDataSnapshots(ownerKey, sources, discoveryRunId) {
      const timestamp = now()
      const existingSnapshots = await readJsonFile<
        readonly AutomationTaskDataSnapshotRecord[]
      >(taskDataSnapshotsPath(ownerKey)).catch(() => [])
      const validSources = sources
        .filter(isValidAutomationDiscoverySourceInput)
        .filter(
          (source) =>
            source.taskDataId !== undefined &&
            source.taskDataSnapshotId !== undefined
        )
      const seenTaskDataIds = new Set(
        validSources.map((source) => source.taskDataId)
      )
      const existingBySnapshotId = new Map(
        existingSnapshots.map((snapshot) => [
          snapshot.taskDataSnapshotId,
          snapshot
        ])
      )
      const nextSnapshots = [
        ...validSources.map((source) => {
          const existing = existingBySnapshotId.get(source.taskDataSnapshotId!)

          return Object.freeze({
            ...(existing ?? {}),
            automationFlowId: source.automationFlowId,
            ...(source.automationFlowOwnerKey !== undefined
              ? { automationFlowOwnerKey: source.automationFlowOwnerKey }
              : {}),
            discoveredAt: source.discoveredAt,
            lastSeenDiscoveryRunId: discoveryRunId,
            sourceItemId: source.sourceItemId,
            sourceSnapshotHash: source.sourceSnapshotHash,
            sourceType: source.sourceType,
            taskDataId: source.taskDataId!,
            taskDataSnapshotId: source.taskDataSnapshotId!,
            taskSourceSnapshot: source
          }) satisfies AutomationTaskDataSnapshotRecord
        }),
        ...existingSnapshots
          .filter(
            (snapshot) =>
              !seenTaskDataIds.has(snapshot.taskDataId) &&
              !validSources.some(
                (source) =>
                  source.taskDataSnapshotId === snapshot.taskDataSnapshotId
              )
          )
          .map((snapshot) =>
            snapshot.removedAt !== undefined
              ? snapshot
              : Object.freeze({
                  ...snapshot,
                  removedAt: timestamp
                }) satisfies AutomationTaskDataSnapshotRecord
          )
      ].sort((left, right) =>
        left.taskDataId.localeCompare(right.taskDataId) ||
        left.taskDataSnapshotId.localeCompare(right.taskDataSnapshotId)
      )

      await writeJsonFile(taskDataSnapshotsPath(ownerKey), nextSnapshots)

      return Object.freeze(nextSnapshots)
    },
    async saveFilterState(filters: AutomationProjectionFilters) {
      await writeJsonFile(filterStatePath, {
        ...(filters.archivedVisible !== undefined
          ? { archivedVisible: filters.archivedVisible }
          : {}),
        ...(filters.bucket !== undefined ? { bucket: filters.bucket } : {}),
        ...(filters.flowIds !== undefined ? { flowIds: filters.flowIds } : {}),
        ...(filters.flowOwnerKeys !== undefined
          ? { flowOwnerKeys: filters.flowOwnerKeys }
          : {}),
        ...(filters.scopeIds !== undefined ? { scopeIds: filters.scopeIds } : {}),
        ...(filters.workspaceIds !== undefined
          ? { workspaceIds: filters.workspaceIds }
          : {})
      })
    },
    async updateRunState(runId, input) {
      const runFile = await loadRunFile(runId)
      const timestamp = now()
      const nextRun = Object.freeze({
        ...runFile.run,
        ...(input.adapterSessionId !== undefined
          ? {
              adapterSessionId: input.adapterSessionId,
              adapterSessionLineage: appendUnique(
                runFile.run.adapterSessionLineage,
                input.adapterSessionId
              )
            }
          : {}),
        ...(input.interruptedAt !== undefined
          ? { interruptedAt: input.interruptedAt }
          : {}),
        recoverable: input.recoverable ?? runFile.run.recoverable,
        state: input.state,
        updatedAt: timestamp
      }) satisfies AutomationStoredRun

      await saveRunFile(
        Object.freeze({
          ...runFile,
          run: nextRun
        })
      )

      return nextRun
    }
  }

  return Object.freeze(store)
}
