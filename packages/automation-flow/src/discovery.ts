import { normalize, parse, win32 } from 'node:path'

import type {
  AutomationFlowSourceType,
  AutomationDiscoveredTaskSource,
  AutomationFlow,
  AutomationFlowTaskCandidate
} from './types'
import {
  createAutomationTaskDataId,
  createAutomationTaskDataSnapshotId,
  createAutomationTaskId
} from './taskIdentity'

export interface AutomationDiscoverySourceInput {
  readonly adapterId?: AutomationDiscoveredTaskSource['adapterId']
  readonly authDiagnostic?: AutomationDiscoveredTaskSource['authDiagnostic']
  readonly automationFlowOwnerKey?: string
  readonly contentSnapshot?: string
  readonly engine?: AutomationDiscoveredTaskSource['engine']
  readonly executionRoot?: string
  readonly externalId?: string
  readonly priority?: number
  readonly provider?: string
  readonly relativePath?: string
  readonly requiredExecutorId?: string
  readonly requiredExecutorRef?: string
  readonly sourceItemId: string
  readonly sourcePath?: string
  readonly sourceSnapshotHash?: string
  readonly sourceType: AutomationDiscoveredTaskSource['sourceType']
  readonly sourceUri?: string
  readonly tags?: readonly string[]
  readonly taskType?: string
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

const AUTOMATION_SOURCE_TYPES = new Set<AutomationFlowSourceType>([
  'adapter-discovered',
  'local-file',
  'remote-doc',
  'remote-issue',
  'remote-mr',
  'user-prompt',
  'workspace-markdown'
])

const hasControlCharacters = (value: string): boolean =>
  Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0

    return codePoint <= 0x1f || codePoint === 0x7f
  })

const isAbsoluteLikePath = (value: string): boolean =>
  value.startsWith('/') ||
  value.startsWith('\\\\') ||
  /^[A-Za-z]:[\\/]/u.test(value)

const stripTrailingSeparatorsUnlessRoot = (
  normalized: string,
  root: string
): string => {
  if (normalized === root) {
    return normalized
  }

  const withoutTrailingSeparator = normalized.replace(/[\\/]+$/u, '')

  return withoutTrailingSeparator.length === 0 ? normalized : withoutTrailingSeparator
}

const normalizeExecutionRoot = (value: string | undefined): string | undefined => {
  if (value === undefined) {
    return undefined
  }

  if (value.startsWith('\\\\') || /^[A-Za-z]:[\\/]/u.test(value)) {
    const normalized = win32.normalize(value)

    return stripTrailingSeparatorsUnlessRoot(
      normalized,
      win32.parse(normalized).root
    )
  }

  const normalized = normalize(value)

  return stripTrailingSeparatorsUnlessRoot(normalized, parse(normalized).root)
}

const hasTraversalSegment = (value: string): boolean =>
  value.split(/[\\/]+/u).includes('..')

const hasUriScheme = (value: string): boolean =>
  !/^[A-Za-z]:[\\/]/u.test(value) && /^[a-z][a-z0-9+.-]*:/iu.test(value)

const isSafeRelativePath = (value: string | undefined): boolean =>
  value === undefined ||
  (value.trim().length > 0 &&
    !hasControlCharacters(value) &&
    !isAbsoluteLikePath(value) &&
    !hasUriScheme(value) &&
    !hasTraversalSegment(value))

const isSafeSourcePath = (value: string | undefined): boolean =>
  value === undefined ||
  (value.trim().length > 0 &&
    !hasControlCharacters(value) &&
    !hasUriScheme(value) &&
    !hasTraversalSegment(value))

const isSafeSourceUri = (value: string | undefined): boolean => {
  if (value === undefined) {
    return true
  }

  if (value.trim().length === 0 || hasControlCharacters(value)) {
    return false
  }

  try {
    const url = new URL(value)

    return url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'file:'
  } catch {
    return false
  }
}

const isSafeExecutionRoot = (value: string | undefined): boolean =>
  value === undefined ||
  (value.trim().length > 0 &&
    value.trim() === value &&
    !hasControlCharacters(value) &&
    isAbsoluteLikePath(value) &&
    !hasUriScheme(value) &&
    !hasTraversalSegment(value))

const isSafeDiscoveryString = (value: string): boolean =>
  value.trim().length > 0 && !hasControlCharacters(value)

export const isValidAutomationDiscoverySourceInput = (
  source: AutomationDiscoverySourceInput
): boolean =>
  isSafeDiscoveryString(source.sourceItemId) &&
  isSafeDiscoveryString(source.title) &&
  (source.automationFlowOwnerKey === undefined ||
    isSafeDiscoveryString(source.automationFlowOwnerKey)) &&
  AUTOMATION_SOURCE_TYPES.has(source.sourceType) &&
  (source.workspaceId === undefined || isSafeDiscoveryString(source.workspaceId)) &&
  isSafeExecutionRoot(source.executionRoot) &&
  isSafeRelativePath(source.relativePath) &&
  isSafeSourcePath(source.sourcePath) &&
  isSafeSourceUri(source.sourceUri)

export const normalizeAutomationDiscoveredTaskSources = ({
  automationFlow,
  discoveredAt,
  sources
}: NormalizeAutomationDiscoveredTaskSourcesInput): readonly AutomationDiscoveredTaskSource[] =>
  Object.freeze(
    sources.flatMap((source) => {
      if (!isValidAutomationDiscoverySourceInput(source)) {
        return []
      }

      const executionRoot = normalizeExecutionRoot(source.executionRoot)
      const hashInput = {
        automationFlowId: automationFlow.id,
        automationFlowOwnerKey: source.automationFlowOwnerKey,
        contentSnapshot: source.contentSnapshot,
        executionRoot,
        externalId: source.externalId,
        provider: source.provider,
        relativePath: source.relativePath,
        requiredExecutorId: source.requiredExecutorId,
        requiredExecutorRef: source.requiredExecutorRef,
        sourceItemId: source.sourceItemId,
        sourcePath: source.sourcePath,
        sourceType: source.sourceType,
        sourceUri: source.sourceUri,
        tags: source.tags,
        taskType: source.taskType,
        title: source.title,
        workspaceId: source.workspaceId
      }
      const ownerKey = source.automationFlowOwnerKey ?? automationFlow.id
      const taskDataId = createAutomationTaskDataId({
        ownerKey,
        sourceItemId: source.sourceItemId
      })
      const sourceSnapshotHash =
        source.sourceSnapshotHash ?? createStableHash(hashInput)
      const taskDataSnapshotId = createAutomationTaskDataSnapshotId({
        normalizedTaskPayloadHash: createStableHash(hashInput),
        sourceSnapshotHash,
        taskDataId
      })

      return [Object.freeze({
        ...(source.adapterId !== undefined ? { adapterId: source.adapterId } : {}),
        ...(source.authDiagnostic !== undefined
          ? { authDiagnostic: source.authDiagnostic }
          : {}),
        automationFlowId: automationFlow.id,
        ...(source.automationFlowOwnerKey !== undefined
          ? { automationFlowOwnerKey: source.automationFlowOwnerKey }
          : {}),
        ...(source.contentSnapshot !== undefined
          ? { contentSnapshot: source.contentSnapshot }
          : {}),
        discoveredAt,
        ...(source.engine !== undefined ? { engine: source.engine } : {}),
        ...(executionRoot !== undefined
          ? { executionRoot }
          : {}),
        ...(source.externalId !== undefined ? { externalId: source.externalId } : {}),
        ...(source.priority !== undefined ? { priority: source.priority } : {}),
        ...(source.provider !== undefined ? { provider: source.provider } : {}),
        ...(source.relativePath !== undefined ? { relativePath: source.relativePath } : {}),
        ...(source.requiredExecutorId !== undefined
          ? { requiredExecutorId: source.requiredExecutorId }
          : {}),
        ...(source.requiredExecutorRef !== undefined
          ? { requiredExecutorRef: source.requiredExecutorRef }
          : {}),
        sourceItemId: source.sourceItemId,
        ...(source.sourcePath !== undefined ? { sourcePath: source.sourcePath } : {}),
        sourceSnapshotHash,
        sourceType: source.sourceType,
        ...(source.sourceUri !== undefined ? { sourceUri: source.sourceUri } : {}),
        ...(source.tags !== undefined ? { tags: source.tags } : {}),
        taskDataId,
        taskDataSnapshotId,
        ...(source.taskType !== undefined ? { taskType: source.taskType } : {}),
        title: source.title,
        ...(source.workspaceId !== undefined ? { workspaceId: source.workspaceId } : {})
      }) satisfies AutomationDiscoveredTaskSource]
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
  const ownerKey = source.automationFlowOwnerKey ?? automationFlow.id
  const taskDataId =
    source.taskDataId ??
    createAutomationTaskDataId({
      ownerKey,
      sourceItemId: source.sourceItemId
    })
  const taskDataSnapshotId =
    source.taskDataSnapshotId ??
    createAutomationTaskDataSnapshotId({
      normalizedTaskPayloadHash: createStableHash({
        priority: source.priority,
        executionRoot: source.executionRoot,
        relativePath: source.relativePath,
        requiredExecutorId: source.requiredExecutorId,
        requiredExecutorRef: source.requiredExecutorRef,
        sourceItemId: source.sourceItemId,
        sourcePath: source.sourcePath,
        sourceType: source.sourceType,
        sourceUri: source.sourceUri,
        tags: source.tags,
        taskType: source.taskType,
        title: source.title,
        workspaceId: source.workspaceId
      }),
      sourceSnapshotHash: source.sourceSnapshotHash,
      taskDataId
    })

  return Object.freeze({
    automationFlowId: automationFlow.id,
    ...(source.automationFlowOwnerKey !== undefined
      ? { automationFlowOwnerKey: source.automationFlowOwnerKey }
      : {}),
    ...(source.authDiagnostic !== undefined
      ? { authDiagnostic: source.authDiagnostic }
      : {}),
    engine,
    ...(source.externalId !== undefined ? { externalId: source.externalId } : {}),
    ...(source.executionRoot !== undefined
      ? { executionRoot: source.executionRoot }
      : {}),
    priority: source.priority,
    ...(source.provider !== undefined ? { provider: source.provider } : {}),
    relativePath: source.relativePath,
    ...(source.requiredExecutorId !== undefined
      ? { requiredExecutorId: source.requiredExecutorId }
      : {}),
    ...(source.requiredExecutorRef !== undefined
      ? { requiredExecutorRef: source.requiredExecutorRef }
      : {}),
    sourceItemId: source.sourceItemId,
    sourcePath: source.sourcePath,
    sourceSnapshotHash: source.sourceSnapshotHash,
    sourceType: source.sourceType,
    ...(source.sourceUri !== undefined ? { sourceUri: source.sourceUri } : {}),
    taskId: createAutomationTaskId({
      automationFlowId: ownerKey,
      sourceItemId: source.sourceItemId
    }),
    taskDataId,
    taskDataSnapshotId,
    ...(source.taskType !== undefined ? { taskType: source.taskType } : {}),
    title: source.title,
    workspaceId: source.workspaceId
  })
}
