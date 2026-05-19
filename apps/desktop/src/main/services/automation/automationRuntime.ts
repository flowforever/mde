import { randomUUID } from 'node:crypto'
import { realpath, stat } from 'node:fs/promises'
import { isAbsolute, win32 } from 'node:path'

import { normalizeAutomationDiscoveredTaskSources } from '@mde/automation-flow'
import type {
  AgentEngineId,
  AutomationDiscoveredTaskSource,
  AutomationFlow,
  AutomationFlowExecutorRef,
  AutomationFlowTaskCandidate,
  AutomationRunState
} from '@mde/automation-flow'

import type {
  AgentCliCommandResult,
  AgentCliCapabilityProbeReport,
  AgentCliNormalizedEvent
} from './agentCliAdapters'
import type { AutomationAdapterRegistry } from './automationAdapterRegistry'
import type {
  AutomationStoredDecision,
  AutomationStoredRun,
  AutomationStore
} from './automationStore'
import type { MdeRuntimeBridge } from './mdeRuntimeBridge'
import type {
  AutomationReportSummary,
  AutomationRunAction
} from '../../../shared/automation'
import { createAutomationPromptBundle } from './automationPromptBundle'
import { createAutomationFlowOwnerKey } from './automationFlowOwnerIdentity'
import { createAutomationRunLockKey } from './automationRunLocks'

export type AutomationRuntimeAction = AutomationRunAction

export type AutomationRuntimePhaseStatus = 'done' | 'failed' | 'pending' | 'running'

export interface AutomationRuntimePhase {
  readonly status: AutomationRuntimePhaseStatus
  readonly title: string
}

export interface AutomationRuntimePhaseEvent {
  readonly phaseTitle: string
  readonly status: Exclude<AutomationRuntimePhaseStatus, 'pending'>
}

interface AutomationRuntimeOptions {
  readonly adapterRegistry: AutomationAdapterRegistry
  readonly createId?: (prefix: string) => string
  readonly createRuntimeToken?: () => string
  readonly profileId?: string
  readonly runtimeBridge: MdeRuntimeBridge
  readonly store: AutomationStore
}

interface StartRunInput {
  readonly automationFlow: AutomationFlow
  readonly candidate: AutomationFlowTaskCandidate
  readonly executorSnapshot?: AutomationFlowExecutorRef
  readonly taskSource?: AutomationDiscoveredTaskSource
  readonly workspaceRoot?: string
}

interface StartRunResult {
  readonly adapterCapabilityReport: AgentCliCapabilityProbeReport
  readonly automationFlowSnapshotId: string
  readonly created: boolean
  readonly decision?: AutomationStoredDecision
  readonly runId: string
  readonly state: AutomationRunState
}

interface ResumeRunInput {
  readonly adapterSessionId?: string
  readonly response?: string
  readonly runId: string
}

interface ResumeRunResult {
  readonly adapterSessionLineage: readonly string[]
  readonly runId: string
}

interface CompleteRunInput {
  readonly outcome: AutomationReportSummary['outcome']
  readonly runId: string
  readonly summary?: string
  readonly title: string
}

interface GetRunActionsInput {
  readonly engine: AgentEngineId
  readonly runId: string
  readonly workspaceRoot?: string
}

export class AutomationRunCancellationError extends Error {
  readonly diagnostic?: AgentCliCommandResult['diagnostic']
  readonly runId: string

  constructor({
    diagnostic,
    runId
  }: {
    readonly diagnostic?: AgentCliCommandResult['diagnostic']
    readonly runId: string
  }) {
    super(diagnostic?.technicalMessage ?? 'Automation run cancellation was not accepted.')
    this.name = 'AutomationRunCancellationError'
    this.diagnostic = diagnostic
    this.runId = runId
  }
}

export interface AutomationRuntime {
  readonly cancelRun: (runId: string) => Promise<AutomationStoredRun>
  readonly completeRun: (
    input: CompleteRunInput
  ) => Promise<AutomationReportSummary>
  readonly derivePhaseProgress: (input: {
    readonly automationFlow: AutomationFlow
    readonly phaseEvents?: readonly AutomationRuntimePhaseEvent[]
    readonly taskTitle: string
  }) => readonly AutomationRuntimePhase[]
  readonly getRunActions: (
    input: GetRunActionsInput
  ) => Promise<readonly AutomationRuntimeAction[]>
  readonly openNativeSession: (runId: string) => Promise<boolean>
  readonly resumeRun: (input: ResumeRunInput) => Promise<ResumeRunResult>
  readonly startDiscoveryRun: (input: {
    readonly automationFlow: AutomationFlow
    readonly automationFlowOwnerKey?: string
    readonly workspaceRoot?: string
  }) => Promise<StartRunResult>
  readonly startRun: (input: StartRunInput) => Promise<StartRunResult>
}

const createDefaultIdFactory = (): ((prefix: string) => string) => {
  let counter = 0

  return (prefix: string): string => {
    counter += 1

    return `${prefix}-${counter}`
  }
}

const getRequestedExecutionRoot = (
  inputWorkspaceRoot: string | undefined,
  candidate: AutomationFlowTaskCandidate
): string | undefined =>
  candidate.executionRoot ?? inputWorkspaceRoot

const getWorkspaceScope = (
  workspaceRoot: string | undefined,
  candidate: AutomationFlowTaskCandidate
): string =>
  workspaceRoot === undefined
    ? `source:${candidate.sourceItemId}`
    : `workspace:${workspaceRoot}`

const hasControlCharacters = (value: string): boolean =>
  Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0

    return codePoint <= 0x1f || codePoint === 0x7f
  })

const hasUriScheme = (value: string): boolean =>
  !win32.isAbsolute(value) && /^[a-z][a-z0-9+.-]*:/iu.test(value)

const hasTraversalSegment = (value: string): boolean =>
  value.split(/[\\/]+/u).includes('..')

const isAbsoluteLocalPath = (value: string): boolean =>
  isAbsolute(value) || win32.isAbsolute(value)

export class AutomationExecutionRootError extends Error {
  readonly code = 'automationRun.invalidExecutionRoot'
  readonly executionRoot: string
  readonly reason: string
  readonly taskTitle: string

  constructor({
    executionRoot,
    reason,
    taskTitle
  }: {
    readonly executionRoot: string
    readonly reason: string
    readonly taskTitle: string
  }) {
    super(
      `Task "${taskTitle}" requested executionRoot "${executionRoot}", but ${reason}.`
    )
    this.name = 'AutomationExecutionRootError'
    this.executionRoot = executionRoot
    this.reason = reason
    this.taskTitle = taskTitle
  }
}

const resolveEffectiveExecutionRoot = async ({
  candidate,
  inputWorkspaceRoot
}: {
  readonly candidate: AutomationFlowTaskCandidate
  readonly inputWorkspaceRoot?: string
}): Promise<string | undefined> => {
  const executionRoot = getRequestedExecutionRoot(inputWorkspaceRoot, candidate)

  if (executionRoot === undefined) {
    return undefined
  }

  if (executionRoot.trim().length === 0 || executionRoot.trim() !== executionRoot) {
    throw new AutomationExecutionRootError({
      executionRoot,
      reason: 'the path is empty or malformed',
      taskTitle: candidate.title
    })
  }

  if (
    hasControlCharacters(executionRoot) ||
    hasUriScheme(executionRoot) ||
    hasTraversalSegment(executionRoot) ||
    !isAbsoluteLocalPath(executionRoot)
  ) {
    throw new AutomationExecutionRootError({
      executionRoot,
      reason: 'the path is not a valid absolute local path',
      taskTitle: candidate.title
    })
  }

  const canonicalExecutionRoot = await realpath(executionRoot).catch(() => null)
  const executionRootStats =
    canonicalExecutionRoot === null
      ? null
      : await stat(canonicalExecutionRoot).catch(() => null)

  if (
    canonicalExecutionRoot === null ||
    executionRootStats?.isDirectory() !== true
  ) {
    throw new AutomationExecutionRootError({
      executionRoot,
      reason: 'the path is not an existing directory',
      taskTitle: candidate.title
    })
  }

  return canonicalExecutionRoot
}

const createDiscoveryRunLockKey = ({
  automationFlow,
  automationFlowOwnerKey,
  profileId,
  workspaceRoot
}: {
  readonly automationFlow: AutomationFlow
  readonly automationFlowOwnerKey?: string
  readonly profileId: string
  readonly workspaceRoot?: string
}): string =>
  createAutomationRunLockKey({
    automationFlowId: automationFlow.id,
    automationFlowOwnerKey,
    profileId,
    sourceItemId: `discovery:${automationFlow.id}`,
    taskId: `discovery:${automationFlow.id}`,
    workspaceScope:
      workspaceRoot === undefined
        ? `scope:${automationFlow.scope}`
        : `workspace:${workspaceRoot}`
  })

const toLineage = (run: AutomationStoredRun): readonly string[] =>
  Object.freeze([...(run.adapterSessionLineage ?? [])])

const normalizeExecutionPhaseTitle = (line: string): string =>
  line
    .trim()
    .replace(/^[-*]\s+/u, '')
    .replace(/^\d+[.)]\s+/u, '')
    .trim()

const extractExecutionPhases = (
  automationFlow: AutomationFlow,
  taskTitle: string
): readonly string[] => {
  const phases = automationFlow.sections.executionStandard
    .split(/\r?\n/u)
    .map(normalizeExecutionPhaseTitle)
    .filter((line) => line.length > 0)

  if (phases.length > 0) {
    return Object.freeze(phases)
  }

  return Object.freeze([`Review ${taskTitle}`])
}

const createSourceSnapshotFromCandidate = (
  candidate: AutomationFlowTaskCandidate
): AutomationDiscoveredTaskSource =>
  Object.freeze({
    automationFlowId: candidate.automationFlowId,
    ...(candidate.automationFlowOwnerKey !== undefined
      ? { automationFlowOwnerKey: candidate.automationFlowOwnerKey }
      : {}),
    discoveredAt: new Date(0).toISOString(),
    ...(candidate.engine !== undefined ? { engine: candidate.engine } : {}),
    ...(candidate.executionRoot !== undefined
      ? { executionRoot: candidate.executionRoot }
      : {}),
    ...(candidate.externalId !== undefined ? { externalId: candidate.externalId } : {}),
    ...(candidate.priority !== undefined ? { priority: candidate.priority } : {}),
    ...(candidate.provider !== undefined ? { provider: candidate.provider } : {}),
    ...(candidate.relativePath !== undefined ? { relativePath: candidate.relativePath } : {}),
    sourceItemId: candidate.sourceItemId,
    ...(candidate.sourcePath !== undefined ? { sourcePath: candidate.sourcePath } : {}),
    sourceSnapshotHash:
      candidate.sourceSnapshotHash ?? `candidate:${candidate.sourceItemId}`,
    sourceType: candidate.sourceType,
    ...(candidate.sourceUri !== undefined ? { sourceUri: candidate.sourceUri } : {}),
    ...(candidate.taskDataId !== undefined ? { taskDataId: candidate.taskDataId } : {}),
    ...(candidate.taskDataSnapshotId !== undefined
      ? { taskDataSnapshotId: candidate.taskDataSnapshotId }
      : {}),
    title: candidate.title,
    ...(candidate.workspaceId !== undefined ? { workspaceId: candidate.workspaceId } : {})
  })

const normalizeTaskSourceExecutionRoot = ({
  executionRoot,
  taskSource
}: {
  readonly executionRoot?: string
  readonly taskSource: AutomationDiscoveredTaskSource
}): AutomationDiscoveredTaskSource =>
  taskSource.executionRoot === undefined || executionRoot === undefined
    ? taskSource
    : Object.freeze({
        ...taskSource,
        executionRoot
      })

const normalizeCandidateExecutionRoot = ({
  candidate,
  executionRoot
}: {
  readonly candidate: AutomationFlowTaskCandidate
  readonly executionRoot?: string
}): AutomationFlowTaskCandidate =>
  candidate.executionRoot === undefined || executionRoot === undefined
    ? candidate
    : Object.freeze({
        ...candidate,
        executionRoot
      })

const normalizeDiscoveredSourcesForOwner = ({
  automationFlow,
  ownerKey,
  sources
}: {
  readonly automationFlow: AutomationFlow
  readonly ownerKey: string
  readonly sources: readonly AutomationDiscoveredTaskSource[]
}): readonly AutomationDiscoveredTaskSource[] =>
  Object.freeze(
    sources.flatMap((source) =>
      normalizeAutomationDiscoveredTaskSources({
        automationFlow,
        discoveredAt: source.discoveredAt,
        sources: [
          Object.freeze({
            ...source,
            automationFlowOwnerKey: ownerKey
          })
        ]
      })
    )
  )

const getStateAfterAdapterEvents = (
  events: readonly { readonly type: string; readonly outcome?: string }[]
): AutomationRunState => {
  const finalReport = [...events]
    .reverse()
    .find((event) => event.type === 'final-report')

  if (finalReport?.outcome === 'succeeded') {
    return 'done'
  }

  if (finalReport?.outcome === 'failed') {
    return 'failed'
  }

  if (finalReport?.outcome === 'cancelled') {
    return 'cancelled'
  }

  if (
    finalReport?.outcome === 'blocked' ||
    events.some((event) => event.type === 'decision-required')
  ) {
    return 'needs-me'
  }

  return 'running'
}

export const createAutomationRuntime = ({
  adapterRegistry,
  createId = createDefaultIdFactory(),
  createRuntimeToken = randomUUID,
  profileId = 'default-profile',
  runtimeBridge,
  store
}: AutomationRuntimeOptions): AutomationRuntime => {
  const runStartLocks = new Map<string, Promise<StartRunResult>>()

  const runWithStartLock = async (
    runLockKey: string,
    task: () => Promise<StartRunResult>
  ): Promise<StartRunResult> => {
    const existingTask = runStartLocks.get(runLockKey)

    if (existingTask !== undefined) {
      return existingTask
    }

    const nextTask = task().finally(() => {
      if (runStartLocks.get(runLockKey) === nextTask) {
        runStartLocks.delete(runLockKey)
      }
    })

    runStartLocks.set(runLockKey, nextTask)

    return nextTask
  }

  const derivePhaseProgress: AutomationRuntime['derivePhaseProgress'] = ({
    automationFlow,
    phaseEvents = [],
    taskTitle
  }) => {
    const eventByTitle = new Map(
      phaseEvents.map((event) => [event.phaseTitle, event.status])
    )

    return Object.freeze(
      extractExecutionPhases(automationFlow, taskTitle).map((title) =>
        Object.freeze({
          status: eventByTitle.get(title) ?? 'pending',
          title
        })
      )
    )
  }

  const persistTaskAdapterEvents = async ({
    events,
    runId,
    taskId
  }: {
    readonly events: readonly AgentCliNormalizedEvent[]
    readonly runId: string
    readonly taskId: string
  }): Promise<AutomationStoredDecision | undefined> => {
    let decision: AutomationStoredDecision | undefined

    for (const event of events) {
      if (
        event.type === 'phase-update' &&
        event.phaseTitle !== undefined &&
        event.status !== undefined
      ) {
        await store.appendEvent(runId, {
          eventId: createId('event'),
          summary: `${event.phaseTitle}: ${event.status}`,
          type: 'phase-update'
        })
      }

      if (event.type === 'decision-required' && event.prompt !== undefined) {
        decision = await store.markNeedsMe(runId, {
          decisionId: createId('decision'),
          prompt: event.prompt,
          taskId,
          type: 'input'
        })
      }

      if (
        event.type === 'final-report' &&
        event.outcome !== undefined &&
        event.title !== undefined
      ) {
        await store.createReport({
          ...(event.evidencePath !== undefined
            ? { evidencePath: event.evidencePath }
            : {}),
          outcome: event.outcome,
          reportId: createId('report'),
          runId,
          ...(event.summary !== undefined ? { summary: event.summary } : {}),
          taskId,
          title: event.title
        })
      }
    }

    return decision
  }

  const runtime: AutomationRuntime = {
    async cancelRun(runId) {
      const run = await store.getRun(runId)
      const result = await adapterRegistry.cancelRun(run.engine, {
        ...(run.adapterSessionId !== undefined
          ? { adapterSessionId: run.adapterSessionId }
          : {}),
        runId,
        ...(run.workspaceRoot !== undefined ? { workspaceRoot: run.workspaceRoot } : {})
      })

      if (!result.accepted) {
        throw new AutomationRunCancellationError({
          diagnostic: result.diagnostic,
          runId
        })
      }

      return store.updateRunState(runId, {
        recoverable: false,
        state: 'cancelled'
      })
    },
    async completeRun({ outcome, runId, summary, title }) {
      const run = await store.getRun(runId)

      return store.createReport({
        outcome,
        reportId: createId('report'),
        runId,
        ...(summary !== undefined ? { summary } : {}),
        taskId: run.taskId,
        title
      })
    },
    derivePhaseProgress,
    async getRunActions({ engine, runId, workspaceRoot }) {
      const run = await store.getRun(runId)
      const report = await adapterRegistry.probe(engine, { workspaceRoot })
      const actions: AutomationRuntimeAction[] = []

      if (run.state === 'needs-me' || run.state === 'failed') {
        actions.push('resume')
      }

      if (run.state === 'failed') {
        actions.push('retry', 'view-evidence', 'abandon')
      }

      if (
        report.capabilities.openNativeSession &&
        run.adapterSessionId !== undefined
      ) {
        actions.push('open-native-session')
      }

      return Object.freeze(actions)
    },
    async resumeRun({ adapterSessionId, response = '', runId }) {
      const existingRun = await store.getRun(runId)
      const nextAdapterSessionId =
        adapterSessionId ?? existingRun.adapterSessionId ?? createId('adapter-session')
      const promptBundle = createAutomationPromptBundle({
        automationFlow:
          (existingRun.automationFlowSnapshot as AutomationFlow | undefined) ??
          ({
            allowedEngines: [existingRun.engine],
            confirmationPolicy: {
              fileWrites: 'automation-flow-controlled',
              highRisk: 'require-user',
              unclearScope: 'require-user'
            },
            defaultEngine: existingRun.engine,
            id: existingRun.automationFlowId,
            lifecycle: 'enabled',
            loopPolicy: {
              intervalMinutes: 15,
              maxActiveRuns: 1,
              mode: 'manual',
              onBlocked: 'pause-automation-flow',
              onEmpty: 'wait'
            },
            match: {},
            name: existingRun.automationFlowId,
            pickOrder: [],
            priority: 0,
            reportPattern: '',
            scope: 'workspace',
            sections: {
              acceptanceStandard: '',
              executionStandard: '',
              pickRules: '',
              reportPattern: '',
              verificationExpectations: ''
            },
            sourceTypes: ['adapter-discovered'],
            status: 'formal'
          } satisfies AutomationFlow),
        automationFlowSnapshotId:
          existingRun.automationFlowSnapshotId ?? createId('snapshot'),
        runId,
        runKind: existingRun.runKind,
        ...(existingRun.taskSourceSnapshot !== undefined
          ? { taskSource: existingRun.taskSourceSnapshot }
          : {}),
        ...(existingRun.executionRoot !== undefined
          ? { executionRoot: existingRun.executionRoot }
          : {}),
        workspaceRoot: existingRun.workspaceRoot
      })

      const adapterResult = await adapterRegistry.resumeRun(existingRun.engine, {
        adapterSessionId: nextAdapterSessionId,
        promptBundle: `${promptBundle.prompt}\n\n## User Response\n\n${response}`,
        runId,
        workspaceRoot: existingRun.workspaceRoot
      })
      await store.appendAdapterSession(runId, adapterResult.adapterSessionId)
      await persistTaskAdapterEvents({
        events: adapterResult.events,
        runId,
        taskId: existingRun.taskId
      })
      const state = getStateAfterAdapterEvents(adapterResult.events)
      const run =
        state === 'done' || state === 'failed' || state === 'cancelled'
          ? await store.getRun(runId)
          : await store.updateRunState(runId, {
              adapterSessionId: adapterResult.adapterSessionId,
              recoverable: false,
              state
            })

      return Object.freeze({
        adapterSessionLineage: toLineage(run),
        runId
      })
    },
    async openNativeSession(runId) {
      const run = await store.getRun(runId)

      if (run.adapterSessionId === undefined) {
        return false
      }

      const result = await adapterRegistry.openNativeSession(run.engine, {
        adapterSessionId: run.adapterSessionId,
        workspaceRoot: run.workspaceRoot
      })

      return result.accepted
    },
    async startDiscoveryRun({
      automationFlow,
      automationFlowOwnerKey: inputAutomationFlowOwnerKey,
      workspaceRoot
    }) {
      const automationFlowOwnerKey =
        inputAutomationFlowOwnerKey ??
        createAutomationFlowOwnerKey({
          automationFlow,
          workspaceRoot
        })
      const runLockKey = createDiscoveryRunLockKey({
        automationFlow,
        automationFlowOwnerKey,
        profileId,
        workspaceRoot
      })

      return runWithStartLock(runLockKey, async () => {
        const activeRun = await store.findActiveRunByLockKey(runLockKey)

        if (activeRun !== null) {
          return Object.freeze({
            adapterCapabilityReport: await adapterRegistry.probe(
              automationFlow.defaultEngine,
              { workspaceRoot }
            ),
            automationFlowSnapshotId:
              activeRun.automationFlowSnapshotId ?? createId('snapshot'),
            created: false,
            runId: activeRun.runId,
            state: activeRun.state
          })
        }

        const capabilityReport = await adapterRegistry.assertCanStartRun(
          automationFlow.defaultEngine,
          { workspaceRoot }
        )
        const runId = createId('run')
        const automationFlowSnapshotId = createId('snapshot')
        const adapterSessionId = createId('adapter-session')
        const promptBundle = createAutomationPromptBundle({
          automationFlow,
          automationFlowSnapshotId,
          runId,
          runKind: 'discovery',
          workspaceRoot
        })

        await store.createRun({
          adapterSessionId,
          adapterSessionLineage: [adapterSessionId],
          automationFlowId: automationFlow.id,
          automationFlowOwnerKey,
          automationFlowSnapshot: automationFlow,
          automationFlowSnapshotId,
          engine: automationFlow.defaultEngine,
          promptBundleMetadata: promptBundle.metadata,
          runId,
          runKind: 'discovery',
          runLockKey,
          sourceItemId: `discovery:${automationFlow.id}`,
          state: 'starting',
          taskId: `discovery:${automationFlow.id}`,
          title: `${automationFlow.name} discovery`,
          ...(workspaceRoot !== undefined ? { workspaceRoot } : {})
        })

        const adapterResult = await adapterRegistry.startRun(
          automationFlow.defaultEngine,
          {
            automationFlow,
            automationFlowOwnerKey,
            automationFlowSnapshotId,
            preferredAdapterSessionId: adapterSessionId,
            promptBundle: promptBundle.prompt,
            runId,
            runKind: 'discovery',
            workspaceRoot
          }
        )
        const discoveredEvent = adapterResult.events.find(
          (event) => event.type === 'discovered-task-sources'
        )

        if (discoveredEvent?.type === 'discovered-task-sources') {
          const ownedSources = normalizeDiscoveredSourcesForOwner({
            automationFlow,
            ownerKey: automationFlowOwnerKey,
            sources: discoveredEvent.sources
          })

          await store.replaceDiscoveredTaskSources(
            automationFlow.id,
            ownedSources,
            automationFlowOwnerKey
          )
          await store.replaceTaskDataSnapshots(
            automationFlowOwnerKey,
            ownedSources,
            runId
          )
        }

        const state: AutomationRunState =
          discoveredEvent?.type === 'discovered-task-sources'
            ? 'done'
            : getStateAfterAdapterEvents(adapterResult.events)

        await store.updateRunState(runId, {
          adapterSessionId: adapterResult.adapterSessionId,
          recoverable: false,
          state
        })

        return Object.freeze({
          adapterCapabilityReport: capabilityReport,
          automationFlowSnapshotId,
          created: true,
          runId,
          state
        })
      })
    },
    async startRun({
      automationFlow,
      candidate,
      executorSnapshot,
      taskSource,
      workspaceRoot
    }) {
      if (executorSnapshot === undefined) {
        throw new Error('Automation task cannot start without a selected executor.')
      }

      const resolvedWorkspaceRoot = await resolveEffectiveExecutionRoot({
        candidate,
        inputWorkspaceRoot: workspaceRoot
      })
      const resolvedCandidate = normalizeCandidateExecutionRoot({
        candidate,
        executionRoot: resolvedWorkspaceRoot
      })
      const automationFlowOwnerKey =
        resolvedCandidate.automationFlowOwnerKey ??
        createAutomationFlowOwnerKey({
          automationFlow,
          workspaceRoot: resolvedWorkspaceRoot
        })
      const selectedExecutorSnapshotId =
        executorSnapshot.executorSnapshotId ?? executorSnapshot.executorId
      const selectedTaskDataSnapshotId =
        taskSource?.taskDataSnapshotId ??
        resolvedCandidate.taskDataSnapshotId ??
        resolvedCandidate.sourceSnapshotHash ??
        resolvedCandidate.sourceItemId
      const runLockKey = createAutomationRunLockKey({
        automationFlowId: automationFlow.id,
        automationFlowOwnerKey,
        executorSnapshotId: selectedExecutorSnapshotId,
        profileId,
        sourceItemId: resolvedCandidate.sourceItemId,
        taskDataSnapshotId: selectedTaskDataSnapshotId,
        taskId: resolvedCandidate.taskId,
        workspaceScope: getWorkspaceScope(resolvedWorkspaceRoot, resolvedCandidate)
      })

      return runWithStartLock(runLockKey, async () => {
        const activeRun = await store.findActiveRunByLockKey(runLockKey)

        if (activeRun !== null) {
          return Object.freeze({
            adapterCapabilityReport: await adapterRegistry.probe(
              resolvedCandidate.engine,
              {
                workspaceRoot: resolvedWorkspaceRoot
              }
            ),
            automationFlowSnapshotId:
              activeRun.automationFlowSnapshotId ?? createId('snapshot'),
            created: false,
            runId: activeRun.runId,
            state: activeRun.state
          })
        }

        const capabilityReport = await adapterRegistry.assertCanStartRun(
          resolvedCandidate.engine,
          {
            workspaceRoot: resolvedWorkspaceRoot
          }
        )
        const runId = createId('run')
        const automationFlowSnapshotId = createId('snapshot')
        const adapterSessionId = createId('adapter-session')
        const runtimeToken = createRuntimeToken()
        const resolvedTaskSource = normalizeTaskSourceExecutionRoot({
          executionRoot: resolvedWorkspaceRoot,
          taskSource: taskSource ?? createSourceSnapshotFromCandidate(resolvedCandidate)
        })
        const promptBundle = createAutomationPromptBundle({
          automationFlow,
          automationFlowSnapshotId,
          ...(executorSnapshot !== undefined ? { executorSnapshot } : {}),
          runId,
          runKind: 'task',
          taskSource: resolvedTaskSource,
          ...(resolvedWorkspaceRoot !== undefined
            ? { executionRoot: resolvedWorkspaceRoot }
            : {}),
          workspaceRoot: resolvedWorkspaceRoot
        })

        await store.createRun({
          adapterSessionId,
          adapterSessionLineage: [adapterSessionId],
          automationFlowId: automationFlow.id,
          automationFlowOwnerKey,
          automationFlowSnapshot: automationFlow,
          automationFlowSnapshotId,
          engine: resolvedCandidate.engine,
          ...(resolvedWorkspaceRoot !== undefined
            ? { executionRoot: resolvedWorkspaceRoot }
            : {}),
          promptBundleMetadata: promptBundle.metadata,
          runId,
          runKind: 'task',
          runLockKey,
          ...(executorSnapshot !== undefined
            ? {
                executorId: executorSnapshot.executorId,
                ...(executorSnapshot.executorSnapshotId !== undefined
                  ? { executorSnapshotId: executorSnapshot.executorSnapshotId }
                  : {})
              }
            : {}),
          sourceItemId: resolvedCandidate.sourceItemId,
          ...(resolvedCandidate.sourcePath !== undefined
            ? { sourcePath: resolvedCandidate.sourcePath }
            : {}),
          sourceSnapshotHash: resolvedTaskSource.sourceSnapshotHash,
          state: 'starting',
          taskId: resolvedCandidate.taskId,
          ...(resolvedCandidate.taskDataId !== undefined
            ? { taskDataId: resolvedCandidate.taskDataId }
            : {}),
          ...(resolvedCandidate.taskDataSnapshotId !== undefined
            ? { taskDataSnapshotId: resolvedCandidate.taskDataSnapshotId }
            : {}),
          taskSourceSnapshot: resolvedTaskSource,
          title: resolvedCandidate.title,
          ...(resolvedWorkspaceRoot !== undefined
            ? { workspaceRoot: resolvedWorkspaceRoot }
            : {})
        })

        if (
          resolvedCandidate.sourcePath !== undefined &&
          resolvedWorkspaceRoot !== undefined
        ) {
          runtimeBridge.registerRun({
            automationFlowSnapshotId,
            runId,
            sourceItemId: resolvedCandidate.sourceItemId,
            sourcePath: resolvedCandidate.sourcePath,
            taskId: resolvedCandidate.taskId,
            token: runtimeToken,
            workspaceRoot: resolvedWorkspaceRoot
          })
        }

        if (!capabilityReport.capabilities.autonomyGate) {
          const decision = await store.markNeedsMe(runId, {
            decisionId: createId('decision'),
            prompt: automationFlow.sections.acceptanceStandard,
            taskId: resolvedCandidate.taskId,
            type: 'approval'
          })

          return Object.freeze({
            adapterCapabilityReport: capabilityReport,
            automationFlowSnapshotId,
            created: true,
            decision,
            runId,
            state: 'needs-me'
          })
        }

        const adapterResult = await adapterRegistry.startRun(resolvedCandidate.engine, {
          automationFlow,
          automationFlowOwnerKey,
          automationFlowSnapshotId,
          candidate: resolvedCandidate,
          preferredAdapterSessionId: adapterSessionId,
          promptBundle: promptBundle.prompt,
          runId,
          runKind: 'task',
          taskSource: resolvedTaskSource,
          workspaceRoot: resolvedWorkspaceRoot
        })
        await store.appendAdapterSession(runId, adapterResult.adapterSessionId)
        const decision = await persistTaskAdapterEvents({
          events: adapterResult.events,
          runId,
          taskId: resolvedCandidate.taskId
        })

        const state = getStateAfterAdapterEvents(adapterResult.events)

        if (state !== 'done' && state !== 'failed' && state !== 'cancelled') {
          await store.updateRunState(runId, {
            adapterSessionId: adapterResult.adapterSessionId,
            recoverable: false,
            state
          })
        }

        if (
          (state === 'done' || state === 'failed' || state === 'cancelled') &&
          automationFlow.loopPolicy.mode === 'continuous'
        ) {
          await runtime.startDiscoveryRun({
            automationFlow,
            workspaceRoot: resolvedWorkspaceRoot
          })
        }

        return Object.freeze({
          adapterCapabilityReport: capabilityReport,
          automationFlowSnapshotId,
          created: true,
          ...(decision !== undefined ? { decision } : {}),
          runId,
          state
        })
      })
    }
  }

  return Object.freeze(runtime)
}
