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
  workspaceId: '/workspace',
  ...overrides
})

describe('WorkspaceFlowFilters', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders workspace controls, archived toggle, and new automation-flow icon button', () => {
    const onReturnToWorkspace = vi.fn()
    const onCreateFlow = vi.fn()

    render(
      <WorkspaceFlowFilters
        flows={[createFlow()]}
        onCreateFlow={onCreateFlow}
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
    expect(
      screen.getByRole('button', {
        name: 'Add flow for Fixture Workspace'
      })
    ).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.workspaceAddFlowButton
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Add flow for Fixture Workspace'
      })
    )
    expect(onCreateFlow).toHaveBeenCalledWith({
      scope: 'workspace',
      workspaceId: '/workspace'
    })
  })

  it('uses a readable workspace title instead of an absolute path', () => {
    render(
      <WorkspaceFlowFilters
        flows={[
          createFlow({
            workspaceId: '/Users/example/private-project'
          })
        ]}
        filters={{
          flowIds: [],
          workspaceIds: ['/Users/example/private-project', 'mde:no-workspace']
        }}
        onUpdateFilters={vi.fn()}
        taskStackCounts={{ done: 0, needsMe: 0, ready: 0, running: 0 }}
        text={text}
        workspaceName="/Users/example/private-project"
      />
    )

    expect(screen.getByText('private-project')).toBeInTheDocument()
    expect(
      screen.queryByText('/Users/example/private-project')
    ).not.toBeInTheDocument()
  })

  it('passes user scope when adding a flow from the No workspace group', () => {
    const onCreateFlow = vi.fn()

    render(
      <WorkspaceFlowFilters
        flows={[
          createFlow(),
          createFlow({
            automationFlowId: 'user-flow',
            name: 'Personal Flow',
            scope: 'user',
            sourceTypes: ['user-prompt'],
            taskCount: 1,
            workspaceId: undefined
          })
        ]}
        onCreateFlow={onCreateFlow}
        text={text}
        workspaceName="Fixture Workspace"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add flow for No workspace' }))

    expect(onCreateFlow).toHaveBeenCalledWith({
      scope: 'user'
    })
  })

  it('allows creating the first user-scoped flow from an empty No workspace group', () => {
    const onCreateFlow = vi.fn()

    render(
      <WorkspaceFlowFilters
        flows={[createFlow()]}
        onCreateFlow={onCreateFlow}
        text={text}
        workspaceName="Fixture Workspace"
      />
    )

    const noWorkspaceGroup = screen.getByText('No workspace').closest('details')

    expect(noWorkspaceGroup).not.toBeNull()
    expect(noWorkspaceGroup).toHaveTextContent('personal automation-flows')
    expect(noWorkspaceGroup).toHaveTextContent(
      'Choose a template to start automation for this workspace.'
    )

    const addFlowButtons = within(noWorkspaceGroup as HTMLElement).getAllByRole(
      'button',
      {
        name: 'Add flow for No workspace'
      }
    )

    expect(addFlowButtons).toHaveLength(2)
    fireEvent.click(addFlowButtons[0])

    expect(onCreateFlow).toHaveBeenCalledWith({
      scope: 'user'
    })
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
          `[data-component-id="${COMPONENT_IDS.automation.flowFilterToggle}"]`
        )
        ?.querySelector('input')
        ?.getAttribute('aria-label')
    )

    expect(flowNames).toEqual([
      'Dev Task Flow',
      'Requirement Flow',
      'Bug Fix Flow'
    ])
  })

  it('switches Task Stack buckets with prototype selected state', () => {
    const onUpdateFilters = vi.fn()

    render(
      <WorkspaceFlowFilters
        filters={{ bucket: 'ready', workspaceIds: ['/workspace'] }}
        flows={[createFlow()]}
        onUpdateFilters={onUpdateFilters}
        taskStackCounts={{
          done: 3,
          needsMe: 1,
          ready: 5,
          running: 2
        }}
        text={text}
        workspaceName="Fixture Workspace"
      />
    )

    const taskStack = screen.getByRole('region', { name: 'Task stack' })
    const readyButton = within(taskStack).getByRole('button', { name: /Ready/ })
    const doneButton = within(taskStack).getByRole('button', { name: /Done/ })

    expect(readyButton).toHaveAttribute('aria-pressed', 'true')
    expect(readyButton).toHaveClass('automation-task-stack-row--selected')
    expect(doneButton).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(doneButton)

    expect(onUpdateFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'done',
        workspaceIds: ['/workspace']
      })
    )
  })

  it('uses checkbox flow filters, status lights, and action menu instead of visible lifecycle tags', () => {
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
        filters={{ flowIds: ['flow-a'], workspaceIds: ['/workspace'] }}
        onUpdateFilters={(filters) => {
          onSelectFlow(filters.flowIds)
        }}
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
    expect(screen.getByRole('checkbox', { name: 'Workspace Flow' }))
      .toBeChecked()
    expect(screen.getByLabelText('Workspace Flow').closest('label'))
      .toHaveAttribute('data-component-id', COMPONENT_IDS.automation.flowFilterToggle)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Workspace Flow' }))
    expect(onSelectFlow).toHaveBeenCalledWith([])
    const flowActions = screen.getAllByRole('button', { name: 'Flow actions' })[0]

    expect(flowActions).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.flowContextMenu
    )
    fireEvent.click(flowActions)
    expect(screen.getAllByText('Stop automation-flow')[0]).toBeDisabled()
    expect(screen.getAllByText('Enable automation-flow')[0]).toBeDisabled()
    expect(screen.getAllByText('Disable automation-flow')[0]).toBeDisabled()
    expect(screen.getAllByText('Archive automation-flow')[0]).toBeDisabled()
    expect(screen.getAllByText('Restore automation-flow')[0]).toBeDisabled()
  })

  it('wires supported flow lifecycle actions and keeps deferred stop disabled', () => {
    const onArchiveFlow = vi.fn()
    const onRestoreFlow = vi.fn()
    const onSetFlowLifecycle = vi.fn()

    render(
      <WorkspaceFlowFilters
        flows={[
          createFlow({
            definitionPath: '/workspace/.mde/automation-flows/enabled.md',
            name: 'Enabled Flow'
          }),
          createFlow({
            automationFlowId: 'flow-disabled',
            definitionPath: '/workspace/.mde/automation-flows/disabled.md',
            lifecycle: 'disabled',
            name: 'Disabled Flow'
          }),
          createFlow({
            automationFlowId: 'flow-archived',
            definitionPath: '/workspace/.mde/automation-flows/archived.md',
            lifecycle: 'archived',
            name: 'Archived Flow'
          })
        ]}
        filters={{ archivedVisible: true, workspaceIds: ['/workspace'] }}
        onArchiveFlow={onArchiveFlow}
        onRestoreFlow={onRestoreFlow}
        onSetFlowLifecycle={onSetFlowLifecycle}
        text={text}
        workspaceName="Fixture Workspace"
      />
    )

    const getFlowRow = (name: string): HTMLElement => {
      const row = screen.getByText(name).closest('article')

      if (!(row instanceof HTMLElement)) {
        throw new Error(`Expected ${name} row to render`)
      }

      return row
    }
    const enabledRow = getFlowRow('Enabled Flow')
    const disabledRow = getFlowRow('Disabled Flow')
    const archivedRow = getFlowRow('Archived Flow')

    fireEvent.click(
      within(enabledRow).getByRole('button', {
        name: 'Flow actions'
      })
    )
    expect(
      within(enabledRow).getByText('Stop automation-flow')
    ).toBeDisabled()
    fireEvent.click(
      within(enabledRow).getByText('Disable automation-flow')
    )
    fireEvent.click(
      within(enabledRow).getByText('Archive automation-flow')
    )

    fireEvent.click(
      within(disabledRow).getByRole('button', {
        name: 'Flow actions'
      })
    )
    fireEvent.click(
      within(disabledRow).getByText('Enable automation-flow')
    )

    fireEvent.click(
      within(archivedRow).getByRole('button', {
        name: 'Flow actions'
      })
    )
    fireEvent.click(
      within(archivedRow).getByText('Restore automation-flow')
    )

    expect(onSetFlowLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ automationFlowId: 'flow-a' }),
      'disabled'
    )
    expect(onArchiveFlow).toHaveBeenCalledWith(
      expect.objectContaining({ automationFlowId: 'flow-a' })
    )
    expect(onSetFlowLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ automationFlowId: 'flow-disabled' }),
      'enabled'
    )
    expect(onRestoreFlow).toHaveBeenCalledWith(
      expect.objectContaining({ automationFlowId: 'flow-archived' })
    )
  })

  it('toggles no-workspace scope and narrows from all visible flows without inverting the clicked flow', () => {
    const onUpdateFilters = vi.fn()

    render(
      <WorkspaceFlowFilters
        flows={[
          createFlow(),
          createFlow({
            automationFlowId: 'user-flow',
            name: 'Personal Flow',
            scope: 'user',
            sourceTypes: ['user-prompt'],
            taskCount: 1,
            workspaceId: 'mde:no-workspace'
          })
        ]}
        filters={{
          bucket: 'ready',
          flowIds: [],
          workspaceIds: ['/workspace', 'mde:no-workspace']
        }}
        onUpdateFilters={onUpdateFilters}
        text={text}
        workspaceName="Fixture Workspace"
      />
    )

    expect(screen.getByRole('checkbox', { name: 'No workspace' })).toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', { name: 'No workspace' }))
    expect(onUpdateFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceIds: ['/workspace']
      })
    )

    expect(screen.getByRole('checkbox', { name: 'Workspace Flow' })).toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Workspace Flow' }))
    expect(onUpdateFilters).toHaveBeenLastCalledWith(
      expect.objectContaining({
        flowIds: ['user-flow']
      })
    )
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

  it('updates archived visibility when parent filters change after mount', () => {
    const { rerender } = render(
      <WorkspaceFlowFilters
        filters={{ archivedVisible: false }}
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

    rerender(
      <WorkspaceFlowFilters
        filters={{ archivedVisible: true }}
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

    expect(screen.getByText('Archived Flow')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Show archived flows' }))
      .toBeChecked()
  })
})
