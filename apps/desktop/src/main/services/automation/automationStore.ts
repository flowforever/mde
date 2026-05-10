import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type {
  AgentEngineId,
  AutomationDiscoveredTaskSource,
  AutomationRunKind,
  AutomationRunState
} from '@mde/automation-flow'

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
  readonly sourceItemId?: string
  readonly sourcePath?: string
  readonly sourceSnapshotHash?: string
  readonly taskSourceSnapshot?: AutomationDiscoveredTaskSource
  readonly state: AutomationRunState
  readonly taskId: string
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
  readonly automationFlowSnapshot?: unknown
  readonly automationFlowSnapshotId?: string
  readonly engine: AgentEngineId
  readonly interruptedAt?: string
  readonly promptBundleMetadata?: AutomationPromptBundleMetadata
  readonly recoverable: boolean
  readonly runId: string
  readonly runKind: AutomationRunKind
  readonly runLockKey?: string
  readonly sourceItemId?: string
  readonly sourcePath?: string
  readonly sourceSnapshotHash?: string
  readonly startedAt: string
  readonly state: AutomationRunState
  readonly taskId: string
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
  readonly status: 'approved' | 'pending' | 'rejected' | 'resolved'
  readonly taskId: string
  readonly type: 'approval' | 'choice' | 'input'
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
  readonly listReports: () => Promise<readonly AutomationReportSummary[]>
  readonly listRuns: () => Promise<readonly AutomationStoredRun[]>
  readonly loadFilterState: () => Promise<AutomationProjectionFilters>
  readonly markNeedsMe: (
    runId: string,
    decision: CreateDecisionInput
  ) => Promise<AutomationStoredDecision>
  readonly recoverInterruptedRuns: () => Promise<void>
  readonly resolveDecision: (
    decisionId: string,
    response: string
  ) => Promise<AutomationStoredDecision>
  readonly replaceDiscoveredTaskSources: (
    automationFlowId: string,
    sources: readonly AutomationDiscoveredTaskSource[]
  ) => Promise<readonly AutomationDiscoveredTaskSource[]>
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

const readJsonFile = async <Value>(filePath: string): Promise<Value> =>
  JSON.parse(await readFile(filePath, 'utf8')) as Value

const writeJsonFile = async (filePath: string, value: unknown): Promise<void> => {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
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

export const createAutomationStore = ({
  appDataPath,
  now = () => new Date().toISOString()
}: AutomationStoreOptions): AutomationStore => {
  const paths = getAutomationStorePaths(appDataPath)
  const discoveredSourcesPath = (automationFlowId: string): string =>
    join(paths.discoveredSourcesRoot, encodeStorageId(automationFlowId))
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
        ...(run.sourceItemId !== undefined ? { sourceItemId: run.sourceItemId } : {}),
        ...(run.sourcePath !== undefined ? { sourcePath: run.sourcePath } : {}),
        ...(run.sourceSnapshotHash !== undefined
          ? { sourceSnapshotHash: run.sourceSnapshotHash }
          : {}),
        startedAt: timestamp,
        state: run.state,
        taskId: run.taskId,
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
        return await readJsonFile<AutomationProjectionFilters>(filterStatePath)
      } catch {
        return Object.freeze({})
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

      await Promise.all(
        entries
          .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
          .map(async (entry) => {
            const filePath = join(paths.runsRoot, entry.name)
            const runFile = await readJsonFile<StoredRunFile>(filePath)

            if (!runStatesInFlight.has(runFile.run.state)) {
              return
            }

            await writeJsonFile(filePath, {
              ...runFile,
              run: {
                ...runFile.run,
                interruptedAt: now(),
                recoverable: true,
                state: 'failed',
                updatedAt: now()
              }
            })
          })
      )
    },
    async resolveDecision(decisionId, response) {
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
        const storedDecision = Object.freeze({
          ...runFile.decisions[decisionIndex],
          resolvedAt: timestamp,
          response: redactSensitiveText(response),
          status: response === 'approved' ? 'approved' : 'resolved'
        }) satisfies AutomationStoredDecision
        const decisions = runFile.decisions.map((decision, index) =>
          index === decisionIndex ? storedDecision : decision
        )

        await writeJsonFile(filePath, {
          ...runFile,
          decisions,
          run: {
            ...runFile.run,
            recoverable: false,
            state: 'running',
            updatedAt: timestamp
          }
        })

        return storedDecision
      }

      throw new Error('Automation decision not found')
    },
    async replaceDiscoveredTaskSources(automationFlowId, sources) {
      const normalizedSources = Object.freeze(
        sources.map((source) =>
          Object.freeze({
            ...source,
            automationFlowId
          })
        )
      )

      await writeJsonFile(discoveredSourcesPath(automationFlowId), normalizedSources)

      return normalizedSources
    },
    async saveFilterState(filters: AutomationProjectionFilters) {
      await writeJsonFile(filterStatePath, filters)
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
