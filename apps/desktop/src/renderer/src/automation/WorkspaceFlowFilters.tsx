import { ArrowLeft, MoreHorizontal, Plus } from 'lucide-react'
import { useState } from 'react'
import type { JSX } from 'react'

import { COMPONENT_IDS } from '../componentIds'
import type { AppText } from '../i18n/appLanguage'
import type {
  AutomationFlowRow,
  AutomationProjectionBucketFilter,
  AutomationProjectionFilters
} from '../../../shared/automation'

type AutomationFlowScope = AutomationFlowRow['scope']

export interface AutomationFlowCreateTarget {
  readonly scope: AutomationFlowScope
  readonly workspaceId?: string
}

interface WorkspaceFlowFiltersProps {
  readonly flows: readonly AutomationFlowRow[]
  readonly onCreateFlow?: (target?: AutomationFlowCreateTarget) => void
  readonly onEditFlow?: (flow: AutomationFlowRow) => void
  readonly onArchiveFlow?: (flow: AutomationFlowRow) => void
  readonly onReturnToWorkspace?: () => void
  readonly onRestoreFlow?: (flow: AutomationFlowRow) => void
  readonly onSetFlowLifecycle?: (
    flow: AutomationFlowRow,
    lifecycle: Extract<AutomationFlowRow['lifecycle'], 'disabled' | 'enabled'>
  ) => void
  readonly onUpdateFilters?: (filters: AutomationProjectionFilters) => void
  readonly filters?: AutomationProjectionFilters
  readonly taskStackCounts?: AutomationTaskStackCounts
  readonly text: AppText
  readonly workspaceName?: string
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
  readonly subtitle: string
  readonly title: string
  readonly workspaceId?: string
}

interface ArchivedVisibilityOverride {
  readonly filters: AutomationProjectionFilters
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
const EMPTY_FILTERS: AutomationProjectionFilters = Object.freeze({})

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

export const WorkspaceFlowFilters = ({
  flows,
  onArchiveFlow,
  onCreateFlow,
  onEditFlow,
  onReturnToWorkspace,
  onRestoreFlow,
  onSetFlowLifecycle,
  onUpdateFilters,
  filters = EMPTY_FILTERS,
  taskStackCounts = EMPTY_TASK_STACK_COUNTS,
  text,
  workspaceName = text('automation.workspaceUnknown')
}: WorkspaceFlowFiltersProps): JSX.Element => {
  const archivedVisible = filters.archivedVisible ?? false
  const [archivedOverride, setArchivedOverride] =
    useState<ArchivedVisibilityOverride | null>(null)
  const showArchivedFlows =
    archivedOverride?.filters === filters
      ? archivedOverride.visible
      : archivedVisible
  const selectedFlowIds = filters.flowIds ?? []
  const selectedWorkspaceIds = filters.workspaceIds ?? []
  const visibleFlows = flows.filter(
    (flow) => showArchivedFlows || flow.lifecycle !== 'archived'
  )
  const workspaceFlows = sortFlowsForWorkspaceTree(
    visibleFlows.filter((flow) => flow.scope === 'workspace')
  )
  const userFlows = sortFlowsForWorkspaceTree(
    visibleFlows.filter((flow) => flow.scope === 'user')
  )
  const workspaceGroups: readonly WorkspaceFlowGroup[] = [
    {
      flows: workspaceFlows,
      scope: 'workspace',
      subtitle: formatCount(
        workspaceFlows.length,
        text('automation.automationFlowsLabel')
      ),
      title: getWorkspaceDisplayTitle(workspaceName, text),
      workspaceId: workspaceFlows[0]?.workspaceId
    },
    {
      flows: userFlows,
      scope: 'user',
      subtitle: text('automation.personalAutomationFlows'),
      title: text('automation.noWorkspace'),
      workspaceId: AUTOMATION_NO_WORKSPACE_ID
    }
  ]
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
  const allVisibleFlowIds = visibleFlows.map((flow) => flow.automationFlowId)
  const normalizeSelectedFlowIds = (
    nextFlowIds: readonly string[]
  ): readonly string[] =>
    nextFlowIds.length === allVisibleFlowIds.length && allVisibleFlowIds.length > 1
      ? []
      : nextFlowIds
  const isFlowSelected = (flowId: string): boolean =>
    selectedFlowIds.length === 0 || selectedFlowIds.includes(flowId)
  const toggleFlow = (flowId: string): void => {
    const nextFlowIds =
      selectedFlowIds.length === 0
        ? allVisibleFlowIds.length <= 1
          ? [flowId]
          : allVisibleFlowIds.filter((item) => item !== flowId)
        : selectedFlowIds.includes(flowId)
          ? selectedFlowIds.filter((item) => item !== flowId)
          : [...selectedFlowIds, flowId]

    onUpdateFilters?.({
      ...filters,
      flowIds: normalizeSelectedFlowIds(nextFlowIds)
    })
  }
  const toggleWorkspace = (workspaceId: string): void => {
    const nextWorkspaceIds = selectedWorkspaceIds.includes(workspaceId)
      ? selectedWorkspaceIds.filter((item) => item !== workspaceId)
      : [...selectedWorkspaceIds, workspaceId]

    onUpdateFilters?.({
      ...filters,
      workspaceIds: nextWorkspaceIds
    })
  }

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
        <button
          aria-label={text('automation.newAutomationFlow')}
          className="explorer-icon-button"
          data-component-id={COMPONENT_IDS.automation.newFlowButton}
          onClick={() => {
            onCreateFlow?.({
              scope: 'workspace',
              ...(workspaceFlows[0]?.workspaceId !== undefined
                ? { workspaceId: workspaceFlows[0].workspaceId }
                : {})
            })
          }}
          title={text('automation.newAutomationFlow')}
          type="button"
        >
          <Plus aria-hidden="true" size={16} />
        </button>
      </div>
      <div className="automation-left-panel explorer-content">
        <section
          aria-label={text('automation.taskStack')}
          className="automation-task-stack"
          data-component-id={COMPONENT_IDS.automation.taskStack}
        >
          <p className="automation-kicker">{text('automation.taskStack')}</p>
          {taskStackRows.map((row) => (
            <button
              aria-pressed={(filters.bucket ?? 'ready') === row.bucket}
              className="automation-task-stack-row"
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
          ))}
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
            <label className="automation-archived-pill">
              <input
                aria-label={text('automation.showArchivedFlows')}
                checked={showArchivedFlows}
                data-component-id={COMPONENT_IDS.automation.archivedToggle}
                onChange={(event) => {
                  const checked = event.currentTarget.checked

                  setArchivedOverride({
                    filters,
                    visible: checked
                  })
                  onUpdateFilters?.({
                    ...filters,
                    archivedVisible: checked
                  })
                }}
                type="checkbox"
              />
              <span>{text('automation.archivedFilter')}</span>
            </label>
          </div>
          <div className="automation-workspace-tree">
            {workspaceGroups.map((group) => (
              <details
                className="automation-workspace-card"
                data-component-id={COMPONENT_IDS.automation.workspaceFilterCard}
                key={group.title}
                open
              >
                <summary>
                  <input
                    aria-label={group.title}
                    checked={
                      group.workspaceId !== undefined &&
                      selectedWorkspaceIds.includes(group.workspaceId)
                    }
                    className="automation-workspace-check"
                    data-component-id={COMPONENT_IDS.automation.workspaceFilterToggle}
                    onClick={(event) => {
                      event.stopPropagation()
                    }}
                    onChange={() => {
                      const workspaceId = group.workspaceId

                      if (workspaceId !== undefined) {
                        toggleWorkspace(workspaceId)
                      }
                    }}
                    type="checkbox"
                  />
                  <div>
                    <div className="automation-workspace-title">{group.title}</div>
                    <div className="automation-workspace-subtitle">
                      {group.subtitle}
                    </div>
                  </div>
                  <span className="automation-workspace-actions">
                    <span className="automation-workspace-pill">
                      {formatCount(
                        sumTaskCount(group.flows),
                        text('automation.tasksCountLabel')
                      )}
                    </span>
                    <button
                      aria-label={text('automation.addFlowForWorkspace', {
                        workspace: group.title
                      })}
                      className="automation-icon-action"
                      data-component-id={
                        COMPONENT_IDS.automation.workspaceAddFlowButton
                      }
                      onClick={(event) => {
                        event.stopPropagation()
                        onCreateFlow?.({
                          scope: group.scope,
                          ...(group.scope === 'workspace' &&
                          group.workspaceId !== undefined
                            ? { workspaceId: group.workspaceId }
                            : {})
                        })
                      }}
                      title={text('automation.newAutomationFlow')}
                      type="button"
                    >
                      <Plus aria-hidden="true" size={14} />
                    </button>
                  </span>
                </summary>
                <div className="automation-flow-list">
                  {group.flows.length === 0 ? (
                    <div className="automation-flow-empty">
                      <span>{text('automation.chooseTemplateForWorkspace')}</span>
                      <button
                        aria-label={text('automation.addFlowForWorkspace', {
                          workspace: group.title
                        })}
                        className="automation-mini-action"
                        data-component-id={
                          COMPONENT_IDS.automation.workspaceAddFlowButton
                        }
                        onClick={() => {
                          onCreateFlow?.({
                            scope: group.scope,
                            ...(group.scope === 'workspace' &&
                            group.workspaceId !== undefined
                              ? { workspaceId: group.workspaceId }
                              : {})
                          })
                        }}
                        type="button"
                      >
                        {text('automation.newAutomationFlow')}
                      </button>
                    </div>
                  ) : null}
                  {group.flows.map((flow) => {
                    const statusLight = getStatusLight(flow)
                    const selected = isFlowSelected(flow.automationFlowId)
                    const hasDefinition = flow.definitionPath !== undefined
                    const canEnable =
                      hasDefinition && flow.lifecycle === 'disabled'
                    const canDisable =
                      hasDefinition && flow.lifecycle === 'enabled'
                    const canArchive =
                      hasDefinition && flow.lifecycle !== 'archived'
                    const canRestore =
                      hasDefinition && flow.lifecycle === 'archived'

                    return (
                      <article
                        className={`automation-flow-row${
                          selected ? ' automation-flow-row--selected' : ''
                        }`}
                        data-component-id={COMPONENT_IDS.automation.flowRow}
                        key={flow.automationFlowId}
                      >
                        <span
                          aria-label={text(statusLight.labelKey)}
                          className={`automation-status-light ${statusLight.className}`}
                          data-component-id={COMPONENT_IDS.automation.statusLight}
                          role="img"
                        />
                        <label
                          className="automation-flow-row__name"
                          data-component-id={
                            COMPONENT_IDS.automation.flowFilterToggle
                          }
                        >
                          <input
                            aria-label={flow.name}
                            checked={selected}
                            onChange={() => {
                              toggleFlow(flow.automationFlowId)
                            }}
                            type="checkbox"
                          />
                          <span>{flow.name}</span>
                          <small>{getFlowSourceLabel(flow, text)}</small>
                        </label>
                        <details className="automation-flow-menu">
                          <summary
                            aria-label={text('automation.flowActions')}
                            data-component-id={
                              COMPONENT_IDS.automation.flowContextMenu
                            }
                            role="button"
                          >
                            <MoreHorizontal aria-hidden="true" size={16} />
                          </summary>
                          <menu>
                            <li>
                              <button
                                data-component-id={
                                  COMPONENT_IDS.automation.flowMenuItem
                                }
                                disabled={flow.definitionPath === undefined}
                                onClick={() => {
                                  if (flow.definitionPath !== undefined) {
                                    onEditFlow?.(flow)
                                  }
                                }}
                                type="button"
                              >
                                {text('automation.editFlow')}
                              </button>
                            </li>
                            <li>
                              <button
                                data-component-id={
                                  COMPONENT_IDS.automation.flowMenuItem
                                }
                                disabled
                                title={text('automation.stopFlowDeferred')}
                                type="button"
                              >
                                {text('automation.stopFlow')}
                              </button>
                            </li>
                            <li>
                              <button
                                data-component-id={
                                  COMPONENT_IDS.automation.flowMenuItem
                                }
                                disabled={!canEnable}
                                onClick={() => {
                                  if (canEnable) {
                                    onSetFlowLifecycle?.(flow, 'enabled')
                                  }
                                }}
                                type="button"
                              >
                                {text('automation.enableFlow')}
                              </button>
                            </li>
                            <li>
                              <button
                                data-component-id={
                                  COMPONENT_IDS.automation.flowMenuItem
                                }
                                disabled={!canDisable}
                                onClick={() => {
                                  if (canDisable) {
                                    onSetFlowLifecycle?.(flow, 'disabled')
                                  }
                                }}
                                type="button"
                              >
                                {text('automation.disableFlow')}
                              </button>
                            </li>
                            <li>
                              <button
                                data-component-id={
                                  COMPONENT_IDS.automation.flowMenuItem
                                }
                                disabled={!canArchive}
                                onClick={() => {
                                  if (canArchive) {
                                    onArchiveFlow?.(flow)
                                  }
                                }}
                                type="button"
                              >
                                {text('automation.archiveFlow')}
                              </button>
                            </li>
                            <li>
                              <button
                                data-component-id={
                                  COMPONENT_IDS.automation.flowMenuItem
                                }
                                disabled={!canRestore}
                                onClick={() => {
                                  if (canRestore) {
                                    onRestoreFlow?.(flow)
                                  }
                                }}
                                type="button"
                              >
                                {text('automation.restoreFlow')}
                              </button>
                            </li>
                          </menu>
                        </details>
                      </article>
                    )
                  })}
                </div>
              </details>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}
