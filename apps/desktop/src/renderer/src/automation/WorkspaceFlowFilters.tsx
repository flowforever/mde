import { ArrowLeft, ChevronRight, FolderCog, Power } from 'lucide-react'
import { useState } from 'react'
import type { JSX } from 'react'

import { COMPONENT_IDS } from '../componentIds'
import type { AppText } from '../i18n/appLanguage'
import type {
  AutomationFlowRow,
  AutomationCenterFilters,
  AutomationCenterScopeId,
  AutomationProjectionBucketFilter,
  AutomationRunSummary,
} from '../../../shared/automation'
import { AutomationRunHistory } from './AutomationRunHistory'

type AutomationFlowScope = AutomationFlowRow['scope']
type ToggleableAutomationFlowLifecycle = Extract<
  AutomationFlowRow['lifecycle'],
  'disabled' | 'enabled'
>

export interface AutomationFlowCreateTarget {
  readonly scope: AutomationFlowScope
  readonly workspaceId?: string
}

export interface AutomationWorkspaceFilterEntry {
  readonly name: string
  readonly rootPath: string
}

interface WorkspaceFlowFiltersProps {
  readonly flows: readonly AutomationFlowRow[]
  readonly onCreateFlow?: (target?: AutomationFlowCreateTarget) => void
  readonly onManageScope?: (target: {
    readonly scopeId: AutomationCenterScopeId
    readonly workspaceId?: string
  }) => void
  readonly onSetFlowLifecycle?: (
    flow: AutomationFlowRow,
    lifecycle: ToggleableAutomationFlowLifecycle
  ) => void
  readonly onOpenNativeSession?: (runId: string) => void
  readonly onReturnToWorkspace?: () => void
  readonly onUpdateFilters?: (filters: AutomationCenterFilters) => void
  readonly filters?: AutomationCenterFilters
  readonly runs?: readonly AutomationRunSummary[]
  readonly taskStackCounts?: AutomationTaskStackCounts
  readonly text: AppText
  readonly currentWorkspaceRoot?: string
  readonly workspaceName?: string
  readonly workspaces?: readonly AutomationWorkspaceFilterEntry[]
}

interface AutomationTaskStackCounts {
  readonly done: number
  readonly needsMe: number
  readonly ready: number
  readonly running: number
}

interface WorkspaceFlowGroup {
  readonly flows: readonly AutomationFlowRow[]
  readonly scope: AutomationFlowScope
  readonly scopeId: AutomationCenterScopeId
  readonly subtitle: string
  readonly title: string
  readonly workspaceId?: string
}

interface ArchivedVisibilityOverride {
  readonly filters: AutomationCenterFilters
  readonly visible: boolean
}

type FlowSourceKind = 'bug' | 'personal' | 'requirement' | 'task'

const AUTOMATION_NO_WORKSPACE_ID = 'mde:no-workspace'

const EMPTY_TASK_STACK_COUNTS: AutomationTaskStackCounts = Object.freeze({
  done: 0,
  needsMe: 0,
  ready: 0,
  running: 0
})
const EMPTY_FILTERS: AutomationCenterFilters = Object.freeze({})

const getStatusLight = (
  flow: AutomationFlowRow
): {
  readonly className: string
  readonly labelKey:
    | 'automation.statusArchived'
    | 'automation.statusDisabled'
    | 'automation.statusEnabled'
    | 'automation.statusSetup'
} => {
  if (flow.lifecycle === 'archived') {
    return {
      className: 'automation-status-light--archived',
      labelKey: 'automation.statusArchived'
    }
  }

  if (flow.lifecycle === 'disabled') {
    return {
      className: 'automation-status-light--disabled',
      labelKey: 'automation.statusDisabled'
    }
  }

  if (flow.status === 'draft' || (flow.diagnosticCount ?? 0) > 0) {
    return {
      className: 'automation-status-light--setup',
      labelKey: 'automation.statusSetup'
    }
  }

  return {
    className: 'automation-status-light--enabled',
    labelKey: 'automation.statusEnabled'
  }
}

const sumTaskCount = (flows: readonly AutomationFlowRow[]): number =>
  flows.reduce((total, flow) => total + flow.taskCount, 0)

const formatCount = (count: number, label: string): string => `${count} ${label}`

const resolveFlowSourceKind = (flow: AutomationFlowRow): FlowSourceKind => {
  const flowName = flow.name.toLowerCase()

  if (flow.scope === 'user' || flow.sourceTypes.includes('user-prompt')) {
    return 'personal'
  }

  if (flowName.includes('requirement')) {
    return 'requirement'
  }

  if (flowName.includes('bug')) {
    return 'bug'
  }

  return 'task'
}

const flowSourceOrder: Readonly<Record<FlowSourceKind, number>> = Object.freeze({
  task: 0,
  requirement: 1,
  bug: 2,
  personal: 3
})

const sortFlowsForWorkspaceTree = (
  nextFlows: readonly AutomationFlowRow[]
): readonly AutomationFlowRow[] =>
  Object.freeze(
    [...nextFlows].sort((left, right) => {
      const sourceDelta =
        flowSourceOrder[resolveFlowSourceKind(left)] -
        flowSourceOrder[resolveFlowSourceKind(right)]

      return sourceDelta === 0 ? left.name.localeCompare(right.name) : sourceDelta
    })
  )

const getFlowSourceLabel = (flow: AutomationFlowRow, text: AppText): string => {
  switch (resolveFlowSourceKind(flow)) {
    case 'bug':
      return text('automation.bugReportsSource')
    case 'personal':
      return text('automation.personalPromptsSource')
    case 'requirement':
      return text('automation.requirementsSource')
    case 'task':
      return text('automation.taskDocsSource')
  }
}

const hasControlCharacters = (value: string): boolean =>
  Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0

    return codePoint <= 0x1f || codePoint === 0x7f
  })

const getWorkspaceDisplayTitle = (workspaceName: string, text: AppText): string => {
  const trimmedName = workspaceName.trim()
  const normalized = trimmedName.replace(/\\/gu, '/')
  const pathName = normalized.includes('/')
    ? normalized.split('/').filter(Boolean).at(-1)
    : trimmedName

  if (
    pathName === undefined ||
    pathName === '.' ||
    pathName === '..' ||
    pathName.length === 0 ||
    hasControlCharacters(pathName)
  ) {
    return text('automation.workspaceUnknown')
  }

  return pathName
}

const getFlowOwnerKey = (flow: AutomationFlowRow): string =>
  flow.automationFlowOwnerKey ?? flow.automationFlowId

const isAppliedGlobalFlow = (flow: AutomationFlowRow): boolean =>
  getFlowOwnerKey(flow).includes(':applied-global:')

const getFlowWorkspaceId = (
  flow: AutomationFlowRow,
  fallbackWorkspaceId?: string
): string | undefined => {
  if (
    flow.workspaceId !== undefined &&
    flow.workspaceId !== AUTOMATION_NO_WORKSPACE_ID
  ) {
    return flow.workspaceId
  }

  return flow.scope === 'workspace' || isAppliedGlobalFlow(flow)
    ? fallbackWorkspaceId
    : undefined
}

const getFlowScopeId = (
  flow: AutomationFlowRow,
  fallbackWorkspaceId?: string
): AutomationCenterScopeId =>
  flow.scope === 'user' && !isAppliedGlobalFlow(flow)
    ? 'global'
    : `workspace:${
        getFlowWorkspaceId(flow, fallbackWorkspaceId) ?? AUTOMATION_NO_WORKSPACE_ID
      }`

const uniqueStrings = (values: readonly string[]): readonly string[] =>
  Object.freeze(Array.from(new Set(values)))

export const WorkspaceFlowFilters = ({
  flows,
  onManageScope,
  onOpenNativeSession,
  onReturnToWorkspace,
  onSetFlowLifecycle,
  onUpdateFilters,
  filters = EMPTY_FILTERS,
  runs = [],
  taskStackCounts = EMPTY_TASK_STACK_COUNTS,
  text,
  currentWorkspaceRoot,
  workspaceName = text('automation.workspaceUnknown'),
  workspaces = []
}: WorkspaceFlowFiltersProps): JSX.Element => {
  const archivedVisible = filters.archivedVisible ?? false
  const [archivedOverride, setArchivedOverride] =
    useState<ArchivedVisibilityOverride | null>(null)
  const showArchivedFlows =
    archivedOverride?.filters === filters
      ? archivedOverride.visible
      : archivedVisible
  const visibleFlows = flows.filter(
    (flow) => showArchivedFlows || flow.lifecycle !== 'archived'
  )
  const userFlows = sortFlowsForWorkspaceTree(
    visibleFlows.filter(
      (flow) => flow.scope === 'user' && !isAppliedGlobalFlow(flow)
    )
  )
  const workspaceFlows = sortFlowsForWorkspaceTree(
    visibleFlows.filter((flow) =>
      getFlowScopeId(flow, currentWorkspaceRoot).startsWith('workspace:')
    )
  )
  const workspaceIdsFromFlows = uniqueStrings(
    workspaceFlows.flatMap((flow) => {
      const workspaceId = getFlowWorkspaceId(flow, currentWorkspaceRoot)

      return workspaceId === undefined ? [] : [workspaceId]
    })
  )
  const currentWorkspaceId =
    currentWorkspaceRoot ?? workspaceIdsFromFlows[0] ?? undefined
  const workspaceByRoot = new Map(
    workspaces
      .filter((workspace) => workspace.rootPath.trim().length > 0)
      .map((workspace) => [workspace.rootPath, workspace])
  )
  const workspaceIds = uniqueStrings([
    ...(currentWorkspaceId === undefined ? [] : [currentWorkspaceId]),
    ...workspaces.map((workspace) => workspace.rootPath),
    ...workspaceIdsFromFlows
  ]).filter((workspaceId) => workspaceId !== AUTOMATION_NO_WORKSPACE_ID)
  const workspaceGroups = workspaceIds
    .map((workspaceId): WorkspaceFlowGroup => {
      const groupFlows = sortFlowsForWorkspaceTree(
        workspaceFlows.filter(
          (flow) => getFlowWorkspaceId(flow, currentWorkspaceId) === workspaceId
        )
      )
      const workspaceEntry = workspaceByRoot.get(workspaceId)
      const title =
        workspaceId === currentWorkspaceId && workspaceEntry === undefined
          ? getWorkspaceDisplayTitle(workspaceName, text)
          : getWorkspaceDisplayTitle(workspaceEntry?.name ?? workspaceId, text)

      return {
        flows: groupFlows,
        scope: 'workspace',
        scopeId: `workspace:${workspaceId}`,
        subtitle: formatCount(
          groupFlows.length,
          text('automation.automationFlowsLabel')
        ),
        title,
        workspaceId
      }
    })
    .sort((left, right) => {
      if (left.workspaceId === currentWorkspaceId) {
        return -1
      }

      if (right.workspaceId === currentWorkspaceId) {
        return 1
      }

      return left.title.localeCompare(right.title)
    })
  const globalFlowGroup: WorkspaceFlowGroup = {
    flows: userFlows,
    scope: 'user',
    scopeId: 'global',
    subtitle: text('automation.globalAutomationFlowsSubtitle'),
    title: text('automation.globalAutomationFlows'),
    workspaceId: AUTOMATION_NO_WORKSPACE_ID
  }
  const enabledWorkspaceGroups = workspaceGroups.filter(
    (group) => group.flows.length > 0
  )
  const notEnabledWorkspaceGroups = workspaceGroups.filter(
    (group) => group.flows.length === 0
  )
  const defaultScopeIds: readonly AutomationCenterScopeId[] =
    currentWorkspaceId === undefined ? [] : [`workspace:${currentWorkspaceId}`]
  const selectedScopeIds = filters.scopeIds ?? defaultScopeIds
  const selectedFlowOwnerKeys = filters.flowOwnerKeys ?? []
  const taskStackRows = [
    {
      bucket: 'needsMe',
      count: taskStackCounts.needsMe,
      description: text('automation.needsMeDescription'),
      label: text('automation.needsMe')
    },
    {
      bucket: 'running',
      count: taskStackCounts.running,
      description: text('automation.runningDescription'),
      label: text('automation.running')
    },
    {
      bucket: 'ready',
      count: taskStackCounts.ready,
      description: text('automation.readyDescription'),
      label: text('automation.ready')
    },
    {
      bucket: 'done',
      count: taskStackCounts.done,
      description: text('automation.doneDescription'),
      label: text('automation.done')
    }
  ] as const satisfies readonly {
    readonly bucket: AutomationProjectionBucketFilter
    readonly count: number
    readonly description: string
    readonly label: string
  }[]
  const getVisibleFlowOwnerKeysForScopes = (
    scopeIds: readonly AutomationCenterScopeId[]
  ): readonly string[] =>
    visibleFlows
      .filter((flow) => scopeIds.includes(getFlowScopeId(flow, currentWorkspaceId)))
      .map(getFlowOwnerKey)
  const normalizeSelectedFlowOwnerKeys = (
    nextFlowOwnerKeys: readonly string[],
    nextScopeIds: readonly AutomationCenterScopeId[]
  ): readonly string[] =>
    nextFlowOwnerKeys.length === getVisibleFlowOwnerKeysForScopes(nextScopeIds).length &&
    nextFlowOwnerKeys.length > 1
      ? []
      : nextFlowOwnerKeys
  const isFlowSelected = (flow: AutomationFlowRow): boolean => {
    const ownerKey = getFlowOwnerKey(flow)
    const scopeId = getFlowScopeId(flow, currentWorkspaceId)

    return (
      selectedScopeIds.includes(scopeId) &&
      (selectedFlowOwnerKeys.length === 0 ||
        selectedFlowOwnerKeys.includes(ownerKey))
    )
  }
  const toggleFlow = (flow: AutomationFlowRow): void => {
    const ownerKey = getFlowOwnerKey(flow)
    const scopeId = getFlowScopeId(flow, currentWorkspaceId)
    const scopeIdsWithFlow = selectedScopeIds.includes(scopeId)
      ? selectedScopeIds
      : [...selectedScopeIds, scopeId]
    const selectedOwnerKeys =
      selectedFlowOwnerKeys.length === 0
        ? getVisibleFlowOwnerKeysForScopes(selectedScopeIds)
        : selectedFlowOwnerKeys
    const nextSelectedOwnerKeys = selectedOwnerKeys.includes(ownerKey)
      ? selectedOwnerKeys.filter((item) => item !== ownerKey)
      : uniqueStrings([...selectedOwnerKeys, ownerKey])
    const nextScopeIds =
      nextSelectedOwnerKeys.length === 0
        ? selectedScopeIds.filter((item) => item !== scopeId)
        : scopeIdsWithFlow.filter((item) =>
            visibleFlows.some(
              (visibleFlow) =>
                getFlowScopeId(visibleFlow, currentWorkspaceId) === item &&
                nextSelectedOwnerKeys.includes(getFlowOwnerKey(visibleFlow))
            )
          )

    onUpdateFilters?.({
      ...filters,
      flowOwnerKeys: normalizeSelectedFlowOwnerKeys(
        nextSelectedOwnerKeys,
        nextScopeIds
      ),
      scopeIds: nextScopeIds
    })
  }
  const toggleScope = (scopeId: AutomationCenterScopeId): void => {
    const selecting = !selectedScopeIds.includes(scopeId)
    const nextScopeIds = selecting
      ? [...selectedScopeIds, scopeId]
      : selectedScopeIds.filter((item) => item !== scopeId)
    const flowOwnerKeysFromNewScope = selecting
      ? visibleFlows
          .filter((flow) => getFlowScopeId(flow, currentWorkspaceId) === scopeId)
          .map(getFlowOwnerKey)
      : []
    const nextFlowOwnerKeys =
      selectedFlowOwnerKeys.length === 0
        ? []
        : normalizeSelectedFlowOwnerKeys(
            uniqueStrings([
              ...selectedFlowOwnerKeys.filter((ownerKey) => {
                const flow = visibleFlows.find(
                  (visibleFlow) => getFlowOwnerKey(visibleFlow) === ownerKey
                )

                return (
                  flow !== undefined &&
                  nextScopeIds.includes(getFlowScopeId(flow, currentWorkspaceId))
                )
              }),
              ...flowOwnerKeysFromNewScope
            ]),
            nextScopeIds
          )

    onUpdateFilters?.({
      ...filters,
      flowOwnerKeys: nextFlowOwnerKeys,
      scopeIds: nextScopeIds
    })
  }
  const renderFlowLifecycleButton = (
    flow: AutomationFlowRow
  ): JSX.Element | null => {
    if (flow.lifecycle === 'archived' || flow.definitionPath === undefined) {
      return null
    }

    const nextLifecycle: ToggleableAutomationFlowLifecycle =
      flow.lifecycle === 'disabled' ? 'enabled' : 'disabled'
    const textKey =
      nextLifecycle === 'enabled'
        ? 'automation.enableFlowNamed'
        : 'automation.disableFlowNamed'

    return (
      <button
        aria-label={text(textKey, { name: flow.name })}
        aria-pressed={flow.lifecycle === 'enabled'}
        className="automation-icon-action automation-flow-row__lifecycle-button"
        data-component-id={COMPONENT_IDS.automation.flowLifecycleButton}
        disabled={onSetFlowLifecycle === undefined}
        onClick={(event) => {
          event.stopPropagation()
          onSetFlowLifecycle?.(flow, nextLifecycle)
        }}
        title={text(textKey, { name: flow.name })}
        type="button"
      >
        <Power aria-hidden="true" focusable="false" size={13} />
      </button>
    )
  }
  const renderFlowList = (group: WorkspaceFlowGroup): JSX.Element => (
    <div className="automation-flow-list">
      {group.flows.length === 0 ? (
        <div className="automation-flow-empty">
          <span>{text('automation.noActiveFlows')}</span>
        </div>
      ) : null}
      {group.flows.map((flow) => {
        const statusLight = getStatusLight(flow)
        const selected = isFlowSelected(flow)

        return (
          <article
            className={`automation-flow-row${
              selected ? ' automation-flow-row--selected' : ''
            }`}
            data-component-id={COMPONENT_IDS.automation.flowRow}
            key={getFlowOwnerKey(flow)}
          >
            <span
              aria-label={text(statusLight.labelKey)}
              className={`automation-status-light ${statusLight.className}`}
              data-component-id={COMPONENT_IDS.automation.statusLight}
              role="img"
            />
            <button
              aria-pressed={selected}
              className="automation-flow-row__button"
              data-component-id={COMPONENT_IDS.automation.flowFilterToggle}
              onClick={() => {
                toggleFlow(flow)
              }}
              type="button"
            >
              <span>{flow.name}</span>
              <small>{getFlowSourceLabel(flow, text)}</small>
            </button>
            <div className="automation-flow-row__actions">
              {renderFlowLifecycleButton(flow)}
            </div>
          </article>
        )
      })}
    </div>
  )
  const renderScopeManagementButton = (group: WorkspaceFlowGroup): JSX.Element => (
    <button
      aria-label={text('automation.manageAutomationFlowsForScope', {
        workspace: group.title
      })}
      className="automation-icon-action"
      data-component-id={COMPONENT_IDS.automation.scopeFilterManagementButton}
      onClick={(event) => {
        event.stopPropagation()
        onManageScope?.({
          scopeId: group.scopeId,
          ...(group.scope === 'workspace' &&
          group.workspaceId !== undefined &&
          group.workspaceId !== AUTOMATION_NO_WORKSPACE_ID
            ? { workspaceId: group.workspaceId }
            : {})
        })
      }}
      title={text('automation.manageAutomationFlows')}
      type="button"
    >
      <FolderCog aria-hidden="true" size={14} />
    </button>
  )
  const renderScopeFilterButton = (group: WorkspaceFlowGroup): JSX.Element => (
    <button
      aria-pressed={selectedScopeIds.includes(group.scopeId)}
      className="automation-scope-filter-button"
      data-component-id={COMPONENT_IDS.automation.scopeFilterToggle}
      onClick={(event) => {
        event.stopPropagation()
        toggleScope(group.scopeId)
      }}
      type="button"
    >
      <div>
        <div className="automation-workspace-title">{group.title}</div>
        <div className="automation-workspace-subtitle">{group.subtitle}</div>
      </div>
    </button>
  )
  const renderWorkspaceGroup = (group: WorkspaceFlowGroup): JSX.Element => (
    <details
      className="automation-workspace-card"
      data-component-id={COMPONENT_IDS.automation.workspaceFilterCard}
      key={group.scopeId}
    >
      <summary>
        <span className="automation-details-chevron" aria-hidden="true">
          <ChevronRight focusable="false" size={13} />
        </span>
        {renderScopeFilterButton(group)}
        <span className="automation-workspace-actions">
          <span className="automation-workspace-pill">
            {formatCount(sumTaskCount(group.flows), text('automation.tasksCountLabel'))}
          </span>
          {renderScopeManagementButton(group)}
        </span>
      </summary>
      {renderFlowList(group)}
    </details>
  )

  return (
    <section
      aria-label={text('automation.workspaceFlows')}
      className="automation-workspace-filters explorer-pane"
      data-component-id={COMPONENT_IDS.automation.workspaceFilters}
    >
      <div className="explorer-header-row">
        <button
          aria-label={text('automation.returnToWorkspace')}
          className="explorer-icon-button automation-return-workspace-button"
          data-component-id={COMPONENT_IDS.automation.returnWorkspaceButton}
          onClick={onReturnToWorkspace}
          title={text('automation.returnToWorkspace')}
          type="button"
        >
          <ArrowLeft aria-hidden="true" focusable="false" size={17} />
        </button>
        <div className="explorer-header">{text('automation.workspaceFlows')}</div>
      </div>
      <div className="automation-left-panel explorer-content">
        <section
          aria-label={text('automation.taskStack')}
          className="automation-task-stack"
          data-component-id={COMPONENT_IDS.automation.taskStack}
        >
          <p className="automation-kicker">{text('automation.taskStack')}</p>
          {taskStackRows.map((row) => {
            const selected = (filters.bucket ?? 'ready') === row.bucket

            return (
              <button
                aria-pressed={selected}
                className={`automation-task-stack-row${
                  selected ? ' automation-task-stack-row--selected' : ''
                }`}
                data-component-id={COMPONENT_IDS.automation.bucketFilterButton}
                key={row.label}
                onClick={() => {
                  onUpdateFilters?.({
                    ...filters,
                    bucket: row.bucket
                  })
                }}
                type="button"
              >
                <h3>
                  {row.label}
                  <span>{row.count}</span>
                </h3>
                <p>{row.description}</p>
              </button>
            )
          })}
        </section>
        <section
          aria-label={text('automation.workspaceFilterPanel')}
          className="automation-workspace-filter-panel"
          data-component-id={COMPONENT_IDS.automation.workspaceFilterPanel}
        >
          <p className="automation-workspace-filter-title">
            {text('automation.workspaceFilterPanel')}
          </p>
          <div
            className="automation-scope-tools"
            aria-label={text('automation.flowToolbar')}
            data-component-id={COMPONENT_IDS.automation.flowToolbar}
          >
            <span>{text('automation.activeFlows')}</span>
            <button
              aria-label={text('automation.showArchivedFlows')}
              aria-pressed={showArchivedFlows}
              className="automation-archived-pill"
              data-component-id={COMPONENT_IDS.automation.archivedToggle}
              onClick={() => {
                const nextVisible = !showArchivedFlows

                setArchivedOverride({
                  filters,
                  visible: nextVisible
                })
                onUpdateFilters?.({
                  ...filters,
                  archivedVisible: nextVisible
                })
              }}
              type="button"
            >
              <span>{text('automation.archivedFilter')}</span>
            </button>
          </div>
          <div className="automation-workspace-tree">
            <details
              className="automation-flow-filter-section"
              data-component-id={COMPONENT_IDS.automation.globalFlowSection}
              open
            >
              <summary>
                <span className="automation-details-chevron" aria-hidden="true">
                  <ChevronRight focusable="false" size={13} />
                </span>
                <span className="automation-flow-filter-section-title">
                  {text('automation.globalSection')}
                </span>
                <span className="automation-workspace-actions">
                  <span className="automation-workspace-pill">
                    {formatCount(
                      sumTaskCount(globalFlowGroup.flows),
                      text('automation.tasksCountLabel')
                    )}
                  </span>
                  {renderScopeManagementButton(globalFlowGroup)}
                </span>
              </summary>
              <div className="automation-global-flow-scope">
                {renderScopeFilterButton(globalFlowGroup)}
                {renderFlowList(globalFlowGroup)}
              </div>
            </details>
            <details
              className="automation-flow-filter-section"
              data-component-id={COMPONENT_IDS.automation.flowEnabledSection}
              open
            >
              <summary>
                <span className="automation-details-chevron" aria-hidden="true">
                  <ChevronRight focusable="false" size={13} />
                </span>
                <span className="automation-flow-filter-section-title">
                  {text('automation.automationFlowEnabledSection')}
                </span>
                <span className="automation-flow-filter-section-count">
                  {enabledWorkspaceGroups.length}
                </span>
              </summary>
              <div className="automation-workspace-tree automation-workspace-tree--nested">
                {enabledWorkspaceGroups.map(renderWorkspaceGroup)}
              </div>
            </details>
            <details
              className="automation-flow-filter-section"
              data-component-id={COMPONENT_IDS.automation.flowNotEnabledSection}
              open
            >
              <summary>
                <span className="automation-details-chevron" aria-hidden="true">
                  <ChevronRight focusable="false" size={13} />
                </span>
                <span className="automation-flow-filter-section-title">
                  {text('automation.automationFlowNotEnabledSection')}
                </span>
                <span className="automation-flow-filter-section-count">
                  {notEnabledWorkspaceGroups.length}
                </span>
              </summary>
              <div className="automation-workspace-tree automation-workspace-tree--nested">
                {notEnabledWorkspaceGroups.map(renderWorkspaceGroup)}
              </div>
            </details>
          </div>
        </section>
        <AutomationRunHistory
          onOpenNativeSession={onOpenNativeSession}
          runs={runs}
          text={text}
        />
      </div>
    </section>
  )
}
