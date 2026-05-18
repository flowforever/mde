import type {
  AutomationCenterFilters,
  AutomationCenterScopeId,
  AutomationFlowRow,
  AutomationProjectionBucketFilter,
} from '../../../shared/automation'

export const AUTOMATION_NO_WORKSPACE_ID = 'mde:no-workspace'

export const AUTOMATION_PROJECTION_BUCKETS = Object.freeze([
  'needsMe',
  'running',
  'ready',
  'done'
] as const satisfies readonly AutomationProjectionBucketFilter[])

const uniqueStrings = (
  values: readonly string[] | undefined
): readonly string[] =>
  Object.freeze(
    Array.from(
      new Set(
        (values ?? [])
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
      )
    )
  )

const isProjectionBucket = (
  value: string | undefined
): value is AutomationProjectionBucketFilter =>
  value !== undefined &&
  AUTOMATION_PROJECTION_BUCKETS.includes(
    value as AutomationProjectionBucketFilter
  )

const getFlowWorkspaceId = (flow: AutomationFlowRow): string =>
  flow.workspaceId ??
  (flow.scope === 'user' ? AUTOMATION_NO_WORKSPACE_ID : AUTOMATION_NO_WORKSPACE_ID)

const getFlowOwnerKey = (flow: AutomationFlowRow): string =>
  flow.automationFlowOwnerKey ?? flow.automationFlowId

const isAppliedGlobalFlow = (flow: AutomationFlowRow): boolean =>
  getFlowOwnerKey(flow).includes(':applied-global:')

const getFlowScopeId = (flow: AutomationFlowRow): AutomationCenterScopeId =>
  flow.scope === 'user' && !isAppliedGlobalFlow(flow)
    ? 'global'
    : `workspace:${getFlowWorkspaceId(flow)}`

const getKnownWorkspaceIds = (
  flows: readonly AutomationFlowRow[],
  currentWorkspaceId: string | undefined
): readonly string[] =>
  uniqueStrings([
    ...(currentWorkspaceId === undefined ? [] : [currentWorkspaceId]),
    AUTOMATION_NO_WORKSPACE_ID,
    ...flows.map(getFlowWorkspaceId)
  ])

export const normalizeAutomationProjectionFilters = ({
  currentWorkspaceId,
  filters,
  flows
}: {
  readonly currentWorkspaceId?: string
  readonly filters?: AutomationCenterFilters
  readonly flows: readonly AutomationFlowRow[]
}): AutomationCenterFilters => {
  const knownWorkspaceIds = getKnownWorkspaceIds(flows, currentWorkspaceId)
  const knownWorkspaceIdSet = new Set(knownWorkspaceIds)
  const requestedWorkspaceIds = uniqueStrings(filters?.workspaceIds)
  const legacyWorkspaceIds = requestedWorkspaceIds.filter((workspaceId) =>
    knownWorkspaceIdSet.has(workspaceId)
  )
  const knownScopeIds = new Set(
    flows.map(getFlowScopeId).filter((scopeId) =>
      scopeId === 'global' ||
      knownWorkspaceIdSet.has(scopeId.replace(/^workspace:/u, ''))
    )
  )
  const requestedScopeIds = uniqueStrings(filters?.scopeIds)
  const hasExplicitScopeIds =
    filters !== undefined && Object.prototype.hasOwnProperty.call(filters, 'scopeIds')
  const scopeIds = Object.freeze(
    hasExplicitScopeIds && requestedScopeIds.length === 0
      ? []
      : requestedScopeIds.filter(
          (scopeId): scopeId is AutomationCenterScopeId =>
            scopeId === 'global' || knownScopeIds.has(scopeId as AutomationCenterScopeId)
        )
  )
  const defaultScopeIds =
    currentWorkspaceId === undefined
      ? []
      : ([`workspace:${currentWorkspaceId}`] as const)
  const effectiveScopeIds =
    scopeIds.length > 0 || hasExplicitScopeIds
      ? scopeIds
      : legacyWorkspaceIds.length > 0
        ? legacyWorkspaceIds.map((workspaceId): AutomationCenterScopeId =>
            workspaceId === AUTOMATION_NO_WORKSPACE_ID
              ? 'global'
              : `workspace:${workspaceId}`
          )
        : defaultScopeIds
  const selectedScopeIds = new Set(effectiveScopeIds)
  const flowByOwnerKey = new Map(flows.map((flow) => [getFlowOwnerKey(flow), flow]))
  const flowOwnerKeys =
    selectedScopeIds.size === 0
      ? []
      : uniqueStrings(filters?.flowOwnerKeys).filter((ownerKey) => {
          const flow = flowByOwnerKey.get(ownerKey)

          return flow !== undefined && selectedScopeIds.has(getFlowScopeId(flow))
        })

  return Object.freeze({
    archivedVisible: filters?.archivedVisible ?? false,
    bucket: isProjectionBucket(filters?.bucket) ? filters.bucket : 'ready',
    flowOwnerKeys: Object.freeze(flowOwnerKeys),
    scopeIds: effectiveScopeIds
  })
}
