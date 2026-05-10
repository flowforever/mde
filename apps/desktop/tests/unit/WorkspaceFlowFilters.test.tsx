import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { WorkspaceFlowFilters } from '../../src/renderer/src/automation/WorkspaceFlowFilters'
import { createAppText, BUILT_IN_APP_LANGUAGE_PACKS } from '../../src/renderer/src/i18n/appLanguage'
import { COMPONENT_IDS } from '../../src/renderer/src/componentIds'
import type { AutomationFlowRow } from '../../src/shared/automation'

const text = createAppText(BUILT_IN_APP_LANGUAGE_PACKS.en)

const createFlow = (overrides: Partial<AutomationFlowRow> = {}): AutomationFlowRow => ({
  automationFlowId: 'flow-a',
  lifecycle: 'enabled',
  name: 'Workspace Flow',
  scope: 'workspace',
  sourceTypes: ['workspace-markdown'],
  status: 'formal',
  taskCount: 2,
  ...overrides
})

describe('WorkspaceFlowFilters', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders workspace controls, archived toggle, and new automation-flow icon button', () => {
    const onReturnToWorkspace = vi.fn()

    render(
      <WorkspaceFlowFilters
        flows={[createFlow()]}
        onReturnToWorkspace={onReturnToWorkspace}
        text={text}
        workspaceName="Fixture Workspace"
      />
    )

    expect(screen.getByRole('region', { name: 'Workspace flows' })).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.workspaceFilters
    )
    expect(screen.getByText('Fixture Workspace')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Show archived flows' }))
      .toHaveAttribute('data-component-id', COMPONENT_IDS.automation.archivedToggle)
    expect(screen.getByLabelText('Automation-flow toolbar')).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.flowToolbar
    )
    const returnButton = screen.getByRole('button', { name: 'Return to workspace' })

    expect(returnButton).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.returnWorkspaceButton
    )
    fireEvent.click(returnButton)
    expect(onReturnToWorkspace).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'New automation-flow' }))
      .toHaveAttribute('data-component-id', COMPONENT_IDS.automation.newFlowButton)
  })

  it('matches the prototype left panel content structure', () => {
    render(
      <WorkspaceFlowFilters
        flows={[
          createFlow({
            automationFlowId: 'flow-a',
            name: 'Dev Task Flow',
            taskCount: 6
          }),
          createFlow({
            automationFlowId: 'flow-b',
            name: 'Bug Fix Flow',
            taskCount: 0
          }),
          createFlow({
            automationFlowId: 'flow-c',
            name: 'Requirement Flow',
            taskCount: 0
          })
        ]}
        taskStackCounts={{
          done: 12,
          needsMe: 1,
          ready: 5,
          running: 2
        }}
        text={text}
        workspaceName="Fixture Workspace"
      />
    )

    const taskStack = screen.getByRole('region', { name: 'Task stack' })

    expect(taskStack).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.taskStack
    )
    expect(within(taskStack).getByText('Needs me')).toBeInTheDocument()
    expect(within(taskStack).getByText('Only active runs paused for human input.'))
      .toBeInTheDocument()
    expect(within(taskStack).getByText('1')).toBeInTheDocument()
    expect(within(taskStack).getByText('Running')).toBeInTheDocument()
    expect(within(taskStack).getByText('2')).toBeInTheDocument()
    expect(within(taskStack).getByText('Ready')).toBeInTheDocument()
    expect(within(taskStack).getByText('5')).toBeInTheDocument()
    expect(within(taskStack).getByText('Done')).toBeInTheDocument()
    expect(within(taskStack).getByText('12')).toBeInTheDocument()

    const workspaceFilter = screen.getByRole('region', {
      name: 'Workspaces · flow filters'
    })

    expect(workspaceFilter).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.workspaceFilterPanel
    )
    expect(within(workspaceFilter).getByText('Active flows')).toBeInTheDocument()
    expect(within(workspaceFilter).getByText('Archived')).toBeInTheDocument()
    expect(within(workspaceFilter).getByText('Fixture Workspace')).toBeInTheDocument()
    expect(within(workspaceFilter).getByText('3 automation-flows'))
      .toBeInTheDocument()
    expect(within(workspaceFilter).getByText('6 tasks')).toBeInTheDocument()
    expect(within(workspaceFilter).getByText('Dev Task Flow')).toBeInTheDocument()
    expect(within(workspaceFilter).getByText('Task docs')).toBeInTheDocument()
    expect(within(workspaceFilter).getByText('Requirement Flow')).toBeInTheDocument()
    expect(within(workspaceFilter).getByText('Requirements')).toBeInTheDocument()
    expect(within(workspaceFilter).getByText('Bug Fix Flow')).toBeInTheDocument()
    expect(within(workspaceFilter).getByText('Bug reports')).toBeInTheDocument()

    const flowNames = Array.from(
      workspaceFilter.querySelectorAll(
        `[data-component-id="${COMPONENT_IDS.automation.flowRow}"]`
      )
    ).map((row) =>
      row
        .querySelector(
          `[data-component-id="${COMPONENT_IDS.automation.flowFilterButton}"]`
        )
        ?.getAttribute('aria-label')
    )

    expect(flowNames).toEqual([
      'Dev Task Flow',
      'Requirement Flow',
      'Bug Fix Flow'
    ])
  })

  it('uses status lights and action menu instead of visible lifecycle tags', () => {
    const onSelectFlow = vi.fn()

    render(
      <WorkspaceFlowFilters
        flows={[
          createFlow(),
          createFlow({
            automationFlowId: 'flow-disabled',
            lifecycle: 'disabled',
            name: 'Disabled Flow'
          }),
          createFlow({
            automationFlowId: 'flow-draft',
            name: 'Draft Flow',
            status: 'draft'
          })
        ]}
        onSelectFlow={onSelectFlow}
        selectedFlowId="flow-a"
        text={text}
        workspaceName="Fixture Workspace"
      />
    )

    expect(screen.getByLabelText('Flow is enabled')).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.statusLight
    )
    expect(screen.getByLabelText('Flow is disabled')).toHaveClass(
      'automation-status-light--disabled'
    )
    expect(screen.getByLabelText('Flow needs setup')).toHaveClass(
      'automation-status-light--setup'
    )
    expect(screen.queryByText('ENABLED')).not.toBeInTheDocument()
    expect(screen.queryByText('SETUP')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Workspace Flow' }))
      .toHaveAttribute('data-component-id', COMPONENT_IDS.automation.flowFilterButton)
    expect(screen.getByRole('button', { name: 'Workspace Flow' }))
      .toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Workspace Flow' }))
    expect(onSelectFlow).toHaveBeenCalledWith(undefined)
    const flowActions = screen.getAllByRole('button', { name: 'Flow actions' })[0]

    expect(flowActions).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.flowContextMenu
    )
    fireEvent.click(flowActions)
    expect(screen.getAllByText('Stop automation-flow')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Enable automation-flow')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Disable automation-flow')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Archive automation-flow')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Restore automation-flow')[0]).toBeInTheDocument()
  })

  it('shows archived flows only after the archived toggle is enabled', () => {
    render(
      <WorkspaceFlowFilters
        flows={[
          createFlow(),
          createFlow({
            automationFlowId: 'flow-archived',
            lifecycle: 'archived',
            name: 'Archived Flow'
          })
        ]}
        text={text}
        workspaceName="Fixture Workspace"
      />
    )

    expect(screen.queryByText('Archived Flow')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Show archived flows' }))

    expect(screen.getByText('Archived Flow')).toBeInTheDocument()
    expect(screen.getByLabelText('Flow is archived')).toHaveClass(
      'automation-status-light--archived'
    )
  })
})
