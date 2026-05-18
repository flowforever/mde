import { createHash } from 'node:crypto'

import {
  createAutomationTaskCandidateFromDiscoveredSource,
  createAutomationExecutorSnapshotId,
  projectAutomationFlowSignalStack,
  resolveAutomationFlowExecutors,
  type AutomationFlow,
  type AutomationDiscoveredTaskSource,
  type AutomationFlowDiagnostic,
  type AutomationFlowExecutorRef,
  type AutomationFlowTaskCandidate,
  type AutomationReportOverlay,
  type AutomationRunOverlay,
  type AutomationSignalStackProjection
} from '@mde/automation-flow'

interface BuildAutomationIndexInput {
  readonly automationFlows: readonly AutomationFlow[]
  readonly discoveredSources: readonly AutomationDiscoveredTaskSource[]
  readonly executorsByOwnerKey?: ReadonlyMap<string, readonly AutomationFlowExecutorRef[]>
  readonly ownerKeyByFlow?: ReadonlyMap<AutomationFlow, string>
  readonly reports?: readonly AutomationReportOverlay[]
  readonly runs?: readonly AutomationRunOverlay[]
}

export interface AutomationIndexResult {
  readonly candidates: readonly AutomationFlowTaskCandidate[]
  readonly diagnostics: readonly AutomationFlowDiagnostic[]
  readonly executorsByOwnerKey: ReadonlyMap<string, readonly AutomationFlowExecutorRef[]>
  readonly projection: AutomationSignalStackProjection
}

const createFingerprint = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex')

const withSnapshotIds = (
  ownerKey: string,
  executors: readonly AutomationFlowExecutorRef[]
): readonly AutomationFlowExecutorRef[] =>
  Object.freeze(
    executors.map((executor) =>
      Object.freeze({
        ...executor,
        executorSnapshotId:
          executor.executorSnapshotId ??
          createAutomationExecutorSnapshotId({
            executorDefinitionFingerprint: createFingerprint({
              autoDiscovered: executor.autoDiscovered,
              displayName: executor.displayName,
              enabled: executor.enabled,
              handles: executor.handles,
              resolvedSource: executor.resolvedSource,
              sourceClass: executor.sourceClass,
              skillRef: executor.skillRef,
              sourcePath: executor.sourcePath,
              tags: executor.tags,
              type: executor.type
            }),
            executorId: executor.executorId,
            ownerKey
          })
      })
    )
  )

const ownerKeyForFlow = (
  flow: AutomationFlow,
  ownerKeyByFlow: ReadonlyMap<AutomationFlow, string> | undefined
): string =>
  ownerKeyByFlow?.get(flow) ??
  (flow.scope === 'user'
    ? `global:flow:${flow.id}`
    : `workspace:${flow.id}:flow:${flow.id}`)

const encodedOwnerKeySuffix = (
  kind: 'applied-global' | 'flow',
  flowId: string
): string => `:${kind}:${encodeURIComponent(flowId.trim())}`

const findExistingExecutorsForFlow = (
  flow: AutomationFlow,
  ownerKey: string,
  executorsByOwnerKey: ReadonlyMap<string, readonly AutomationFlowExecutorRef[]> | undefined
): readonly AutomationFlowExecutorRef[] | undefined => {
  if (executorsByOwnerKey === undefined) {
    return undefined
  }

  const directExecutors =
    executorsByOwnerKey.get(ownerKey) ?? executorsByOwnerKey.get(flow.id)

  if (directExecutors !== undefined) {
    return directExecutors
  }

  const flowSuffix = encodedOwnerKeySuffix('flow', flow.id)
  const appliedGlobalSuffix = encodedOwnerKeySuffix('applied-global', flow.id)

  return [...executorsByOwnerKey.entries()].find(
    ([candidateOwnerKey]) =>
      candidateOwnerKey.endsWith(flowSuffix) ||
      candidateOwnerKey.endsWith(appliedGlobalSuffix)
  )?.[1]
}

export const buildAutomationIndex = ({
  automationFlows,
  discoveredSources,
  executorsByOwnerKey,
  ownerKeyByFlow,
  reports = [],
  runs = []
}: BuildAutomationIndexInput): AutomationIndexResult => {
  const flowEntries = automationFlows.map((flow) =>
    Object.freeze({
      flow,
      ownerKey: ownerKeyForFlow(flow, ownerKeyByFlow)
    })
  )
  const flowById = new Map(automationFlows.map((flow) => [flow.id, flow]))
  const flowByIdAndOwnerKey = new Map(
    flowEntries.map(({ flow, ownerKey }) => [`${flow.id}\0${ownerKey}`, flow])
  )
  const resolvedExecutorsByOwnerKey = new Map(executorsByOwnerKey ?? [])
  for (const { flow, ownerKey } of flowEntries) {
    const existingExecutors = findExistingExecutorsForFlow(
      flow,
      ownerKey,
      executorsByOwnerKey
    )
    const resolved = existingExecutors ??
      resolveAutomationFlowExecutors({
        autoDiscoveredMarkdownExecutors: [],
        declarations: flow.executors ?? [],
        flowId: flow.id
      }).executors

    const executors = withSnapshotIds(ownerKey, resolved)

    resolvedExecutorsByOwnerKey.set(ownerKey, executors)
    if (!resolvedExecutorsByOwnerKey.has(flow.id)) {
      resolvedExecutorsByOwnerKey.set(flow.id, executors)
    }
  }
  const candidates = discoveredSources.flatMap((source) => {
    const automationFlow =
      source.automationFlowOwnerKey === undefined
        ? flowById.get(source.automationFlowId)
        : flowByIdAndOwnerKey.get(
            `${source.automationFlowId}\0${source.automationFlowOwnerKey}`
          ) ?? flowById.get(source.automationFlowId)

    if (automationFlow === undefined) {
      return []
    }

    const candidate = createAutomationTaskCandidateFromDiscoveredSource(
      automationFlow,
      source
    )

    return candidate === null ? [] : [candidate]
  })
  const projection = projectAutomationFlowSignalStack({
    candidates,
    executorsByOwnerKey: resolvedExecutorsByOwnerKey,
    reports,
    runs
  })

  return Object.freeze({
    candidates: Object.freeze(candidates),
    diagnostics: Object.freeze([] satisfies AutomationFlowDiagnostic[]),
    executorsByOwnerKey: resolvedExecutorsByOwnerKey,
    projection
  })
}
