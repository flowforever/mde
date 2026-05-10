import { ArrowLeft, MoreHorizontal, Plus } from 'lucide-react'
import { useState } from 'react'
import type { JSX } from 'react'

import { COMPONENT_IDS } from '../componentIds'
import type { AppText } from '../i18n/appLanguage'
import type { AutomationFlowRow } from '../../../shared/automation'

interface WorkspaceFlowFiltersProps {
  readonly flows: readonly AutomationFlowRow[]
  readonly onCreateFlow?: () => void
  readonly onEditFlow?: (flow: AutomationFlowRow) => void
  readonly onReturnToWorkspace?: () => void
  readonly onSelectFlow?: (flowId: string | undefined) => void
  readonly selectedFlowId?: string
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
  readonly subtitle: string
  readonly title: string
}

type FlowSourceKind = 'bug' | 'personal' | 'requirement' | 'task'

const EMPTY_TASK_STACK_COUNTS: AutomationTaskStackCounts = Object.freeze({
  done: 0,
  needsMe: 0,
  ready: 0,
  running: 0
})

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

export const WorkspaceFlowFilters = ({
  flows,
  onCreateFlow,
  onEditFlow,
  onReturnToWorkspace,
  onSelectFlow,
  selectedFlowId,
  taskStackCounts = EMPTY_TASK_STACK_COUNTS,
  text,
  workspaceName = text('automation.workspaceUnknown')
}: WorkspaceFlowFiltersProps): JSX.Element => {
  const [showArchivedFlows, setShowArchivedFlows] = useState(false)
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
      subtitle: formatCount(
        workspaceFlows.length,
        text('automation.automationFlowsLabel')
      ),
      title: workspaceName
    },
    ...(userFlows.length === 0
      ? []
      : [
          {
            flows: userFlows,
            subtitle: text('automation.personalAutomationFlows'),
            title: text('automation.noWorkspace')
          }
        ])
  ]
  const taskStackRows = [
    {
      count: taskStackCounts.needsMe,
      description: text('automation.needsMeDescription'),
      label: text('automation.needsMe')
    },
    {
      count: taskStackCounts.running,
      description: text('automation.runningDescription'),
      label: text('automation.running')
    },
    {
      count: taskStackCounts.ready,
      description: text('automation.readyDescription'),
      label: text('automation.ready')
    },
    {
      count: taskStackCounts.done,
      description: text('automation.doneDescription'),
      label: text('automation.done')
    }
  ] as const

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
          onClick={onCreateFlow}
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
            <article
              className="automation-task-stack-row"
              data-component-id={COMPONENT_IDS.automation.taskStackStatusRow}
              key={row.label}
            >
              <h3>
                {row.label}
                <span>{row.count}</span>
              </h3>
              <p>{row.description}</p>
            </article>
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
                  setShowArchivedFlows(event.currentTarget.checked)
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
                    checked
                    className="automation-workspace-check"
                    onClick={(event) => {
                      event.preventDefault()
                    }}
                    readOnly
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
                      onClick={(event) => {
                        event.stopPropagation()
                        onCreateFlow?.()
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
                        onClick={() => {
                          onCreateFlow?.()
                        }}
                        type="button"
                      >
                        {text('automation.newAutomationFlow')}
                      </button>
                    </div>
                  ) : null}
                  {group.flows.map((flow) => {
                    const statusLight = getStatusLight(flow)
                    const selected = selectedFlowId === flow.automationFlowId

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
                        <button
                          aria-label={flow.name}
                          aria-pressed={selected}
                          className="automation-flow-row__name"
                          data-component-id={
                            COMPONENT_IDS.automation.flowFilterButton
                          }
                          onClick={() => {
                            onSelectFlow?.(
                              selected ? undefined : flow.automationFlowId
                            )
                          }}
                          type="button"
                        >
                          <span>{flow.name}</span>
                          <small>{getFlowSourceLabel(flow, text)}</small>
                        </button>
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
