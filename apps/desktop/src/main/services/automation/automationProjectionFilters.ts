import type {
  AutomationFlowRow,
  AutomationProjectionBucketFilter,
  AutomationProjectionFilters
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

const getKnownWorkspaceIds = (
  flows: readonly AutomationFlowRow[],
  currentWorkspaceId: string | undefined
): readonly string[] =>
  uniqueStrings([
    ...(currentWorkspaceId === undefined ? [] : [currentWorkspaceId]),
    AUTOMATION_NO_WORKSPACE_ID,
    ...flows.map(getFlowWorkspaceId)
  ])

const getDefaultWorkspaceIds = (
  currentWorkspaceId: string | undefined,
  knownWorkspaceIds: readonly string[]
): readonly string[] =>
  uniqueStrings([
    ...(currentWorkspaceId === undefined ? [] : [currentWorkspaceId]),
    ...(knownWorkspaceIds.includes(AUTOMATION_NO_WORKSPACE_ID)
      ? [AUTOMATION_NO_WORKSPACE_ID]
      : [])
  ])

export const normalizeAutomationProjectionFilters = ({
  currentWorkspaceId,
  filters,
  flows
}: {
  readonly currentWorkspaceId?: string
  readonly filters?: AutomationProjectionFilters
  readonly flows: readonly AutomationFlowRow[]
}): AutomationProjectionFilters => {
  const knownWorkspaceIds = getKnownWorkspaceIds(flows, currentWorkspaceId)
  const knownWorkspaceIdSet = new Set(knownWorkspaceIds)
  const requestedWorkspaceIds = uniqueStrings(filters?.workspaceIds)
  const workspaceIds = Object.freeze(
    requestedWorkspaceIds.length === 0
      ? getDefaultWorkspaceIds(currentWorkspaceId, knownWorkspaceIds)
      : requestedWorkspaceIds.filter((workspaceId) =>
          knownWorkspaceIdSet.has(workspaceId)
        )
  )
  const normalizedWorkspaceIds =
    workspaceIds.length === 0
      ? getDefaultWorkspaceIds(currentWorkspaceId, knownWorkspaceIds)
      : workspaceIds
  const selectedWorkspaceIds = new Set(normalizedWorkspaceIds)
  const flowById = new Map(flows.map((flow) => [flow.automationFlowId, flow]))
  const flowIds = uniqueStrings(filters?.flowIds).filter((flowId) => {
    const flow = flowById.get(flowId)

    return (
      flow !== undefined && selectedWorkspaceIds.has(getFlowWorkspaceId(flow))
    )
  })

  return Object.freeze({
    archivedVisible: filters?.archivedVisible ?? false,
    bucket: isProjectionBucket(filters?.bucket) ? filters.bucket : 'ready',
    flowIds: Object.freeze(flowIds),
    workspaceIds: normalizedWorkspaceIds
  })
}
