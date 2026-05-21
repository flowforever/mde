import { readFile, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'

import {
  matchesAutomationFlowSourceItem,
  normalizeAutomationDiscoveredTaskSources,
  type AutomationDiscoverySourceInput,
  type AutomationDiscoveredTaskSource,
  type AutomationFlowSourceItem,
  type ParsedAutomationFlow
} from '@mde/automation-flow'

import { AUTOMATION_NO_WORKSPACE_ID } from './automationProjectionFilters'
import { assertWorkspaceTaskDocumentPath } from './automationPathSafety'
import { parseAutomationSourceMarkdown } from './automationSourceScanner'

interface FilterValidDiscoveredSourcesForCurrentOwnersInput {
  readonly automationFlows: readonly ParsedAutomationFlow[]
  readonly ownerKeyByFlow: ReadonlyMap<ParsedAutomationFlow, string>
  readonly sources: readonly AutomationDiscoveredTaskSource[]
  readonly workspaceRoot?: string
}

interface CurrentedDiscoveredSource {
  readonly source: AutomationDiscoveredTaskSource
  readonly sourceItem: AutomationFlowSourceItem
}

const localPathBackedSourceTypes = new Set<
  AutomationDiscoveredTaskSource['sourceType']
>(['local-file', 'user-prompt', 'workspace-markdown'])

const normalizeSourceRelativePath = (path: string): string =>
  path.replace(/\\/gu, '/').replace(/^\.\//u, '')

const resolveSourcePath = ({
  sourcePath,
  workspaceRoot
}: {
  readonly sourcePath: string
  readonly workspaceRoot?: string
}): string =>
  isAbsolute(sourcePath) || workspaceRoot === undefined
    ? resolve(sourcePath)
    : resolve(workspaceRoot, sourcePath)

const getCurrentFlowOwnerKey = (
  ownerKeyByFlow: ReadonlyMap<ParsedAutomationFlow, string>,
  automationFlow: ParsedAutomationFlow
): string => {
  const ownerKey = ownerKeyByFlow.get(automationFlow)

  if (ownerKey === undefined) {
    throw new Error('Automation-flow owner key was not calculated.')
  }

  return ownerKey
}

const getFlowsById = (
  automationFlows: readonly ParsedAutomationFlow[]
): ReadonlyMap<string, readonly ParsedAutomationFlow[]> => {
  const flowsById = new Map<string, ParsedAutomationFlow[]>()

  for (const automationFlow of automationFlows) {
    flowsById.set(automationFlow.id, [
      ...(flowsById.get(automationFlow.id) ?? []),
      automationFlow
    ])
  }

  return flowsById
}

export const isLegacyDiscoveredSourceSafelyOwnedByFlow = ({
  automationFlow,
  source,
  workspaceRoot
}: {
  readonly automationFlow: ParsedAutomationFlow
  readonly source: AutomationDiscoveredTaskSource
  readonly workspaceRoot?: string
}): boolean => {
  if (
    source.automationFlowOwnerKey !== undefined ||
    source.automationFlowId !== automationFlow.id ||
    (source.sourceType !== 'adapter-discovered' &&
      !automationFlow.sourceTypes.includes(source.sourceType))
  ) {
    return false
  }

  if (automationFlow.scope === 'user') {
    return (
      source.workspaceId === undefined ||
      source.workspaceId === AUTOMATION_NO_WORKSPACE_ID
    )
  }

  return workspaceRoot !== undefined && source.workspaceId === workspaceRoot
}

export const isDiscoveredSourceOwnedByCurrentFlow = ({
  automationFlow,
  ownerKeyByFlow,
  source,
  workspaceRoot
}: {
  readonly automationFlow: ParsedAutomationFlow
  readonly ownerKeyByFlow: ReadonlyMap<ParsedAutomationFlow, string>
  readonly source: AutomationDiscoveredTaskSource
  readonly workspaceRoot?: string
}): boolean => {
  if (source.automationFlowOwnerKey !== undefined) {
    return (
      source.automationFlowId === automationFlow.id &&
      source.automationFlowOwnerKey ===
        getCurrentFlowOwnerKey(ownerKeyByFlow, automationFlow)
    )
  }

  return isLegacyDiscoveredSourceSafelyOwnedByFlow({
    automationFlow,
    source,
    workspaceRoot
  })
}

const getCurrentFlowMatchesForDiscoveredSource = ({
  automationFlows,
  exactOwnerKeysWithSources,
  ownerKeyByFlow,
  source,
  workspaceRoot
}: {
  readonly automationFlows: readonly ParsedAutomationFlow[]
  readonly exactOwnerKeysWithSources: ReadonlySet<string>
  readonly ownerKeyByFlow: ReadonlyMap<ParsedAutomationFlow, string>
  readonly source: AutomationDiscoveredTaskSource
  readonly workspaceRoot?: string
}): readonly ParsedAutomationFlow[] => {
  if (source.automationFlowOwnerKey !== undefined) {
    return Object.freeze(
      automationFlows.filter((automationFlow) =>
        isDiscoveredSourceOwnedByCurrentFlow({
          automationFlow,
          ownerKeyByFlow,
          source,
          workspaceRoot
        })
      )
    )
  }

  const flowsById = getFlowsById(automationFlows)

  return Object.freeze(
    (flowsById.get(source.automationFlowId) ?? []).filter((automationFlow) => {
      const ownerKey = getCurrentFlowOwnerKey(ownerKeyByFlow, automationFlow)

      return (
        !exactOwnerKeysWithSources.has(ownerKey) &&
        isLegacyDiscoveredSourceSafelyOwnedByFlow({
          automationFlow,
          source,
          workspaceRoot
        })
      )
    })
  )
}

const isLocalPathBackedDiscoveredSource = (
  source: AutomationDiscoveredTaskSource
): source is AutomationDiscoveredTaskSource & { readonly sourcePath: string } =>
  source.sourcePath !== undefined && localPathBackedSourceTypes.has(source.sourceType)

const getCanonicalLocalSourceType = ({
  automationFlow,
  source
}: {
  readonly automationFlow: ParsedAutomationFlow
  readonly source: AutomationDiscoveredTaskSource
}): AutomationFlowSourceItem['sourceType'] =>
  source.sourceType === 'local-file' &&
  automationFlow.sourceTypes.includes('workspace-markdown')
    ? 'workspace-markdown'
    : source.sourceType

const createSourceItemFromCachedSource = ({
  automationFlow,
  source
}: {
  readonly automationFlow: ParsedAutomationFlow
  readonly source: AutomationDiscoveredTaskSource
}): AutomationFlowSourceItem =>
  Object.freeze({
    ...(source.sourceType !== 'workspace-markdown'
      ? { automationStatus: 'ready' as const }
      : {}),
    ...(source.engine !== undefined ? { engine: source.engine } : {}),
    ...(source.executionRoot !== undefined
      ? { executionRoot: source.executionRoot }
      : {}),
    ...(source.priority !== undefined ? { priority: source.priority } : {}),
    ...(source.relativePath !== undefined ? { relativePath: source.relativePath } : {}),
    sourceItemId: source.sourceItemId,
    ...(source.sourcePath !== undefined ? { sourcePath: source.sourcePath } : {}),
    sourceType: getCanonicalLocalSourceType({ automationFlow, source }),
    ...(source.tags !== undefined ? { tags: source.tags } : {}),
    title: source.title,
    ...(source.workspaceId !== undefined ? { workspaceId: source.workspaceId } : {})
  } satisfies AutomationFlowSourceItem)

const getSafeCurrentLocalSourcePath = async ({
  source,
  workspaceRoot
}: {
  readonly source: AutomationDiscoveredTaskSource & { readonly sourcePath: string }
  readonly workspaceRoot?: string
}): Promise<string | null> => {
  const sourcePath = resolveSourcePath({
    sourcePath: source.sourcePath,
    workspaceRoot
  })

  if (source.sourceType === 'user-prompt') {
    return null
  }

  if (workspaceRoot === undefined) {
    return null
  }

  return assertWorkspaceTaskDocumentPath(workspaceRoot, sourcePath).catch(() => null)
}

const createCurrentLocalDiscoverySourceInput = ({
  contentSnapshot,
  parsedTags,
  parsedTitle,
  relativePath,
  source,
  sourcePath
}: {
  readonly contentSnapshot: string
  readonly parsedTags?: readonly string[]
  readonly parsedTitle: string
  readonly relativePath?: string
  readonly source: AutomationDiscoveredTaskSource
  readonly sourcePath: string
}): AutomationDiscoverySourceInput =>
  Object.freeze({
    ...(source.adapterId !== undefined ? { adapterId: source.adapterId } : {}),
    ...(source.authDiagnostic !== undefined
      ? { authDiagnostic: source.authDiagnostic }
      : {}),
    ...(source.automationFlowOwnerKey !== undefined
      ? { automationFlowOwnerKey: source.automationFlowOwnerKey }
      : {}),
    contentSnapshot,
    ...(source.engine !== undefined ? { engine: source.engine } : {}),
    ...(source.executionRoot !== undefined
      ? { executionRoot: source.executionRoot }
      : {}),
    ...(source.externalId !== undefined ? { externalId: source.externalId } : {}),
    ...(source.priority !== undefined ? { priority: source.priority } : {}),
    ...(source.provider !== undefined ? { provider: source.provider } : {}),
    ...(relativePath !== undefined ? { relativePath } : {}),
    ...(source.requiredExecutorId !== undefined
      ? { requiredExecutorId: source.requiredExecutorId }
      : {}),
    ...(source.requiredExecutorRef !== undefined
      ? { requiredExecutorRef: source.requiredExecutorRef }
      : {}),
    sourceItemId: source.sourceItemId,
    sourcePath,
    sourceType: source.sourceType,
    ...(source.sourceUri !== undefined ? { sourceUri: source.sourceUri } : {}),
    ...(parsedTags !== undefined
      ? { tags: parsedTags }
      : source.tags !== undefined
        ? { tags: source.tags }
        : {}),
    ...(source.taskType !== undefined ? { taskType: source.taskType } : {}),
    title: parsedTitle,
    ...(source.workspaceId !== undefined ? { workspaceId: source.workspaceId } : {})
  } satisfies AutomationDiscoverySourceInput)

const currentLocalPathBackedSource = async ({
  automationFlow,
  source,
  workspaceRoot
}: {
  readonly automationFlow: ParsedAutomationFlow
  readonly source: AutomationDiscoveredTaskSource & { readonly sourcePath: string }
  readonly workspaceRoot?: string
}): Promise<CurrentedDiscoveredSource | null> => {
  const sourcePath = await getSafeCurrentLocalSourcePath({
    source,
    workspaceRoot
  })

  if (sourcePath === null) {
    return null
  }

  const sourceStats = await stat(sourcePath).catch(() => null)

  if (sourceStats?.isFile() !== true) {
    return null
  }

  const isWorkspaceLocalSource =
    source.sourceType === 'workspace-markdown' || source.sourceType === 'local-file'
  const workspaceRelativePath =
    isWorkspaceLocalSource && workspaceRoot !== undefined
    ? normalizeSourceRelativePath(relative(resolve(workspaceRoot), sourcePath))
    : undefined

  const contentSnapshot = await readFile(sourcePath, 'utf8').catch(() => null)

  if (contentSnapshot === null) {
    return null
  }

  const parsedSource = parseAutomationSourceMarkdown(contentSnapshot, sourcePath)

  if (parsedSource.diagnostics.length > 0) {
    return null
  }

  const [currentSource] = normalizeAutomationDiscoveredTaskSources({
    automationFlow,
    discoveredAt: source.discoveredAt,
    sources: [
      createCurrentLocalDiscoverySourceInput({
        contentSnapshot,
        parsedTags: parsedSource.tags,
        parsedTitle: parsedSource.title,
        relativePath: workspaceRelativePath ?? source.relativePath,
        source,
        sourcePath
      })
    ]
  })

  if (currentSource === undefined) {
    return null
  }

  const sourceItem = Object.freeze({
    ...(source.engine !== undefined ? { engine: source.engine } : {}),
    ...(source.executionRoot !== undefined
      ? { executionRoot: source.executionRoot }
      : {}),
    ...(parsedSource.automationStatus !== undefined
      ? { automationStatus: parsedSource.automationStatus }
      : {}),
    ...(source.priority !== undefined ? { priority: source.priority } : {}),
    ...(currentSource.relativePath !== undefined
      ? { relativePath: currentSource.relativePath }
      : {}),
    sourceItemId: source.sourceItemId,
    sourcePath,
    sourceType: getCanonicalLocalSourceType({
      automationFlow,
      source: currentSource
    }),
    ...(currentSource.tags !== undefined ? { tags: currentSource.tags } : {}),
    title: currentSource.title,
    ...(currentSource.workspaceId !== undefined
      ? { workspaceId: currentSource.workspaceId }
      : {})
  } satisfies AutomationFlowSourceItem)

  return Object.freeze({
    source: currentSource,
    sourceItem
  })
}

const currentDiscoveredSource = async ({
  automationFlow,
  source,
  workspaceRoot
}: {
  readonly automationFlow: ParsedAutomationFlow
  readonly source: AutomationDiscoveredTaskSource
  readonly workspaceRoot?: string
}): Promise<CurrentedDiscoveredSource | null> =>
  isLocalPathBackedDiscoveredSource(source)
    ? currentLocalPathBackedSource({
        automationFlow,
        source,
        workspaceRoot
      })
    : Object.freeze({
        source,
        sourceItem: createSourceItemFromCachedSource({
          automationFlow,
          source
        })
      })

const matchesCurrentAutomationFlow = ({
  automationFlow,
  source,
  sourceItem
}: {
  readonly automationFlow: ParsedAutomationFlow
  readonly source: AutomationDiscoveredTaskSource
  readonly sourceItem: AutomationFlowSourceItem
}): boolean => {
  const isPathlessLegacyLocalSource =
    source.sourcePath === undefined &&
    (source.sourceType === 'local-file' ||
      source.sourceType === 'workspace-markdown')
  const needsLegacyAdapterCompatibility =
    source.sourceType === 'adapter-discovered' || isPathlessLegacyLocalSource
  const matchFlow = needsLegacyAdapterCompatibility
    ? Object.freeze({
        ...automationFlow,
        match: Object.freeze({
          ...automationFlow.match,
          taskPathGlobs: undefined
        }),
        sourceTypes: automationFlow.sourceTypes.includes(sourceItem.sourceType)
          ? automationFlow.sourceTypes
          : Object.freeze([...automationFlow.sourceTypes, sourceItem.sourceType])
      } satisfies ParsedAutomationFlow)
    : automationFlow

  return (
    source.automationFlowId === automationFlow.id &&
    matchesAutomationFlowSourceItem(matchFlow, sourceItem)
  )
}

export const filterValidDiscoveredSourcesForCurrentOwners = async ({
  automationFlows,
  ownerKeyByFlow,
  sources,
  workspaceRoot
}: FilterValidDiscoveredSourcesForCurrentOwnersInput): Promise<
  readonly AutomationDiscoveredTaskSource[]
> => {
  const currentOwnerKeys = new Set(ownerKeyByFlow.values())
  const exactOwnerKeysWithSources = new Set(
    sources
      .map((source) => source.automationFlowOwnerKey)
      .filter(
        (ownerKey): ownerKey is string =>
          ownerKey !== undefined && currentOwnerKeys.has(ownerKey)
      )
  )
  const sourceValidity = await Promise.all(
    sources.map(async (source) => {
      const ownerMatches = getCurrentFlowMatchesForDiscoveredSource({
        automationFlows,
        exactOwnerKeysWithSources,
        ownerKeyByFlow,
        source,
        workspaceRoot
      })

      for (const automationFlow of ownerMatches) {
        const currentedSource = await currentDiscoveredSource({
          automationFlow,
          source,
          workspaceRoot
        })

        if (
          currentedSource !== null &&
          matchesCurrentAutomationFlow({
            automationFlow,
            source: currentedSource.source,
            sourceItem: currentedSource.sourceItem
          })
        ) {
          return currentedSource.source
        }
      }

      return null
    })
  )

  return Object.freeze(
    sourceValidity.filter(
      (source): source is AutomationDiscoveredTaskSource => source !== null
    )
  )
}
