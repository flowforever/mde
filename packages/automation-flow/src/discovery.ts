import type {
  AutomationDiscoveredTaskSource,
  AutomationFlow,
  AutomationFlowTaskCandidate
} from './types'

export interface AutomationDiscoverySourceInput {
  readonly adapterId?: AutomationDiscoveredTaskSource['adapterId']
  readonly authDiagnostic?: AutomationDiscoveredTaskSource['authDiagnostic']
  readonly contentSnapshot?: string
  readonly engine?: AutomationDiscoveredTaskSource['engine']
  readonly externalId?: string
  readonly priority?: number
  readonly provider?: string
  readonly relativePath?: string
  readonly sourceItemId: string
  readonly sourcePath?: string
  readonly sourceSnapshotHash?: string
  readonly sourceType: AutomationDiscoveredTaskSource['sourceType']
  readonly sourceUri?: string
  readonly tags?: readonly string[]
  readonly title: string
  readonly workspaceId?: string
}

interface NormalizeAutomationDiscoveredTaskSourcesInput {
  readonly automationFlow: AutomationFlow
  readonly discoveredAt: string
  readonly sources: readonly AutomationDiscoverySourceInput[]
}

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }

  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(',')}}`
  }

  return JSON.stringify(value)
}

const createStableHash = (value: unknown): string => {
  const input = stableStringify(value)
  let hash = 0x811c9dc5

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export const normalizeAutomationDiscoveredTaskSources = ({
  automationFlow,
  discoveredAt,
  sources
}: NormalizeAutomationDiscoveredTaskSourcesInput): readonly AutomationDiscoveredTaskSource[] =>
  Object.freeze(
    sources.map((source) => {
      const hashInput = {
        automationFlowId: automationFlow.id,
        contentSnapshot: source.contentSnapshot,
        externalId: source.externalId,
        provider: source.provider,
        relativePath: source.relativePath,
        sourceItemId: source.sourceItemId,
        sourcePath: source.sourcePath,
        sourceType: source.sourceType,
        sourceUri: source.sourceUri,
        title: source.title,
        workspaceId: source.workspaceId
      }

      return Object.freeze({
        ...(source.adapterId !== undefined ? { adapterId: source.adapterId } : {}),
        ...(source.authDiagnostic !== undefined
          ? { authDiagnostic: source.authDiagnostic }
          : {}),
        automationFlowId: automationFlow.id,
        ...(source.contentSnapshot !== undefined
          ? { contentSnapshot: source.contentSnapshot }
          : {}),
        discoveredAt,
        ...(source.engine !== undefined ? { engine: source.engine } : {}),
        ...(source.externalId !== undefined ? { externalId: source.externalId } : {}),
        ...(source.priority !== undefined ? { priority: source.priority } : {}),
        ...(source.provider !== undefined ? { provider: source.provider } : {}),
        ...(source.relativePath !== undefined ? { relativePath: source.relativePath } : {}),
        sourceItemId: source.sourceItemId,
        ...(source.sourcePath !== undefined ? { sourcePath: source.sourcePath } : {}),
        sourceSnapshotHash:
          source.sourceSnapshotHash ?? createStableHash(hashInput),
        sourceType: source.sourceType,
        ...(source.sourceUri !== undefined ? { sourceUri: source.sourceUri } : {}),
        ...(source.tags !== undefined ? { tags: source.tags } : {}),
        title: source.title,
        ...(source.workspaceId !== undefined ? { workspaceId: source.workspaceId } : {})
      }) satisfies AutomationDiscoveredTaskSource
    })
  )

export const createAutomationTaskCandidateFromDiscoveredSource = (
  automationFlow: AutomationFlow,
  source: AutomationDiscoveredTaskSource
): AutomationFlowTaskCandidate | null => {
  if (
    automationFlow.lifecycle !== 'enabled' ||
    source.automationFlowId !== automationFlow.id
  ) {
    return null
  }

  const engine =
    source.engine !== undefined &&
    automationFlow.allowedEngines.includes(source.engine)
      ? source.engine
      : automationFlow.defaultEngine

  return Object.freeze({
    automationFlowId: automationFlow.id,
    ...(source.authDiagnostic !== undefined
      ? { authDiagnostic: source.authDiagnostic }
      : {}),
    engine,
    ...(source.externalId !== undefined ? { externalId: source.externalId } : {}),
    priority: source.priority,
    ...(source.provider !== undefined ? { provider: source.provider } : {}),
    relativePath: source.relativePath,
    sourceItemId: source.sourceItemId,
    sourcePath: source.sourcePath,
    sourceSnapshotHash: source.sourceSnapshotHash,
    sourceType: source.sourceType,
    ...(source.sourceUri !== undefined ? { sourceUri: source.sourceUri } : {}),
    taskId: `${automationFlow.id}:${source.sourceItemId}`,
    title: source.title,
    workspaceId: source.workspaceId
  })
}
