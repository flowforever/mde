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

const openDetailsByText = (label: string): HTMLDetailsElement => {
  const details = screen.getByText(label).closest('details')

  if (!(details instanceof HTMLDetailsElement)) {
    throw new Error(`Expected details element for ${label}`)
  }

  const summary = details.querySelector('summary')

  if (summary === null) {
    throw new Error(`Expected summary element for ${label}`)
  }

  fireEvent.click(summary)

  return details
}

const getFlowFilterButtonByName = (label: string): HTMLElement => {
  const row = Array.from(
    document.querySelectorAll(
      `[data-component-id="${COMPONENT_IDS.automation.flowRow}"]`
    )
  ).find((candidate) => candidate.textContent?.includes(label))
  const button = row?.querySelector(
    `[data-component-id="${COMPONENT_IDS.automation.flowFilterToggle}"]`
  )

  if (!(button instanceof HTMLElement)) {
    throw new Error(`Expected flow filter button for ${label}`)
  }

  return button
}

describe('WorkspaceFlowFilters', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders workspace controls, archived toggle button, and new automation-flow icon button', () => {
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
    expect(screen.getByRole('button', { name: 'Show archived flows' }))
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
    expect(
      screen.getByRole('button', {
        name: 'Manage flows for Fixture Workspace'
      })
    ).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.scopeFilterManagementButton
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Manage flows for Fixture Workspace'
      })
    )
    expect(onCreateFlow).not.toHaveBeenCalled()
  })

  it('calls management for workspace and global scope groups', () => {
    const onManageScope = vi.fn()

    render(
      <WorkspaceFlowFilters
        flows={[createFlow()]}
        onManageScope={onManageScope}
        text={text}
        workspaceName="Fixture Workspace"
      />
    )

    fireEvent.click(screen.getByRole('button', {
      name: 'Manage flows for Fixture Workspace'
    }))
    expect(onManageScope).toHaveBeenCalledWith({
      scopeId: 'workspace:/workspace',
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
          flowOwnerKeys: [],
          scopeIds: []
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

  it('renders global scope management for user flows', () => {
    const onManageScope = vi.fn()

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
        onManageScope={onManageScope}
        text={text}
        workspaceName="Fixture Workspace"
      />
    )

    fireEvent.click(screen.getByRole('button', {
      name: 'Manage flows for Global automation flows'
    }))

    expect(onManageScope).toHaveBeenCalledWith({
      scopeId: 'global'
    })
  })

  it('renders an empty global scope group without template management copy', () => {
    render(
      <WorkspaceFlowFilters
        flows={[createFlow()]}
        text={text}
        workspaceName="Fixture Workspace"
      />
    )

    const globalGroup = screen.getByText('Global automation flows').closest('details')

    expect(globalGroup).not.toBeNull()
    expect(globalGroup).toHaveTextContent('global automation-flows')
    expect(globalGroup).toHaveTextContent('No active flows')
    expect(screen.queryByText('Choose a template to start automation for this workspace.'))
      .not.toBeInTheDocument()
  })

  it('groups global, enabled, and disabled workspace flow filters with collapsed workspace items', () => {
    render(
      <WorkspaceFlowFilters
        flows={[
          createFlow({
            automationFlowId: 'global-flow',
            automationFlowOwnerKey: 'global:flow:global-flow',
            name: 'Global Flow',
            scope: 'user',
            sourceTypes: ['user-prompt'],
            taskCount: 1,
            workspaceId: 'mde:no-workspace'
          }),
          createFlow({
            automationFlowId: 'other-flow',
            automationFlowOwnerKey: 'workspace:%2Fother:flow:other-flow',
            name: 'Other Workspace Flow',
            taskCount: 2,
            workspaceId: '/other'
          }),
          createFlow({
            automationFlowId: 'flow-a',
            automationFlowOwnerKey: 'workspace:%2Fworkspace:flow:flow-a',
            name: 'Dev Task Flow',
            taskCount: 6
          }),
          createFlow({
            automationFlowId: 'flow-b',
            automationFlowOwnerKey: 'workspace:%2Fworkspace:flow:flow-b',
            name: 'Bug Fix Flow',
            taskCount: 0
          }),
          createFlow({
            automationFlowId: 'flow-c',
            automationFlowOwnerKey: 'workspace:%2Fworkspace:flow:flow-c',
            name: 'Requirement Flow',
            taskCount: 0
          })
        ]}
        filters={{
          bucket: 'ready',
          flowOwnerKeys: [],
          scopeIds: ['workspace:/workspace']
        }}
        taskStackCounts={{
          done: 12,
          needsMe: 1,
          ready: 5,
          running: 2
        }}
        text={text}
        workspaces={[
          { name: 'Fixture Workspace', rootPath: '/workspace' },
          { name: 'Other Workspace', rootPath: '/other' },
          { name: 'Empty Workspace', rootPath: '/empty' }
        ]}
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
    const globalSection = workspaceFilter.querySelector(
      `[data-component-id="${COMPONENT_IDS.automation.globalFlowSection}"]`
    )
    const enabledSection = workspaceFilter.querySelector(
      `[data-component-id="${COMPONENT_IDS.automation.flowEnabledSection}"]`
    )
    const notEnabledSection = workspaceFilter.querySelector(
      `[data-component-id="${COMPONENT_IDS.automation.flowNotEnabledSection}"]`
    )

    if (
      !(globalSection instanceof HTMLElement) ||
      !(enabledSection instanceof HTMLElement) ||
      !(notEnabledSection instanceof HTMLElement)
    ) {
      throw new Error('Expected global, enabled, and not enabled sections')
    }

    expect(globalSection.compareDocumentPosition(enabledSection))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(enabledSection.compareDocumentPosition(notEnabledSection))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(globalSection).toHaveTextContent('Global')
    expect(globalSection).toHaveTextContent('Global Flow')
    expect(enabledSection).toHaveTextContent('Automation-flow enabled')
    expect(enabledSection).toHaveTextContent('Fixture Workspace')
    expect(enabledSection).toHaveTextContent('Other Workspace')
    expect(notEnabledSection).toHaveTextContent('Automation-flow not enabled')
    expect(notEnabledSection).toHaveTextContent('Empty Workspace')

    const workspaceCards = Array.from(
      workspaceFilter.querySelectorAll(
        `[data-component-id="${COMPONENT_IDS.automation.workspaceFilterCard}"]`
      )
    )
    const currentWorkspaceCard = workspaceCards.find((card) =>
      card.textContent?.includes('Fixture Workspace')
    )
    const otherWorkspaceCard = workspaceCards.find((card) =>
      card.textContent?.includes('Other Workspace')
    )
    const emptyWorkspaceCard = workspaceCards.find((card) =>
      card.textContent?.includes('Empty Workspace')
    )

    if (
      !(currentWorkspaceCard instanceof HTMLDetailsElement) ||
      !(otherWorkspaceCard instanceof HTMLDetailsElement) ||
      !(emptyWorkspaceCard instanceof HTMLDetailsElement)
    ) {
      throw new Error('Expected workspace cards for enabled and not enabled workspaces')
    }

    expect(currentWorkspaceCard.open).toBe(false)
    expect(otherWorkspaceCard.open).toBe(false)
    expect(emptyWorkspaceCard.open).toBe(false)

    openDetailsByText('Fixture Workspace')
    openDetailsByText('Other Workspace')
    openDetailsByText('Empty Workspace')

    expect(currentWorkspaceCard.open).toBe(true)
    expect(within(workspaceFilter).getByText('3 automation-flows'))
      .toBeInTheDocument()
    expect(within(workspaceFilter).getByText('6 tasks')).toBeInTheDocument()
    expect(within(workspaceFilter).getByText('Dev Task Flow')).toBeInTheDocument()
    expect(within(workspaceFilter).getAllByText('Task docs')).toHaveLength(2)
    expect(within(workspaceFilter).getByText('Requirement Flow')).toBeInTheDocument()
    expect(within(workspaceFilter).getByText('Requirements')).toBeInTheDocument()
    expect(within(workspaceFilter).getByText('Bug Fix Flow')).toBeInTheDocument()
    expect(within(workspaceFilter).getByText('Bug reports')).toBeInTheDocument()
    expect(within(emptyWorkspaceCard).getByText('No active flows')).toBeInTheDocument()

    const scopeButtons = Array.from(
      workspaceFilter.querySelectorAll(
        `[data-component-id="${COMPONENT_IDS.automation.scopeFilterToggle}"]`
      )
    )
    const globalButton = scopeButtons.find((button) =>
      button.textContent?.includes('Global automation flows')
    )
    const currentWorkspaceButton = scopeButtons.find((button) =>
      button.textContent?.includes('Fixture Workspace')
    )
    const otherWorkspaceButton = scopeButtons.find((button) =>
      button.textContent?.includes('Other Workspace')
    )

    if (!globalButton || !currentWorkspaceButton || !otherWorkspaceButton) {
      throw new Error('Expected global, current, and other workspace scope buttons')
    }
    expect(globalButton.compareDocumentPosition(currentWorkspaceButton))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(currentWorkspaceButton.compareDocumentPosition(otherWorkspaceButton))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(globalButton).toHaveAttribute('aria-pressed', 'false')
    expect(currentWorkspaceButton).toHaveAttribute('aria-pressed', 'true')
    expect(otherWorkspaceButton).toHaveAttribute('aria-pressed', 'false')
    expect(within(workspaceFilter).queryByRole('checkbox')).not.toBeInTheDocument()
    expect(
      within(workspaceFilter).queryByRole('button', { name: 'Flow actions' })
    ).not.toBeInTheDocument()

    const flowNames = Array.from(
      workspaceFilter.querySelectorAll(
        `[data-component-id="${COMPONENT_IDS.automation.flowRow}"]`
      )
    ).map((row) =>
      row
        .querySelector(
          `[data-component-id="${COMPONENT_IDS.automation.flowFilterToggle}"]`
        )
        ?.textContent
        ?.replace(/\s+/gu, ' ')
        .trim()
    )

    expect(flowNames).toEqual([
      'Global FlowPersonal prompts',
      'Dev Task FlowTask docs',
      'Requirement FlowRequirements',
      'Bug Fix FlowBug reports',
      'Other Workspace FlowTask docs'
    ])
    expect(getFlowFilterButtonByName('Dev Task Flow'))
      .toHaveAttribute('aria-pressed', 'true')
    expect(getFlowFilterButtonByName('Global Flow'))
      .toHaveAttribute('aria-pressed', 'false')
  })

  it('switches Task Stack buckets with prototype selected state', () => {
    const onUpdateFilters = vi.fn()

    render(
      <WorkspaceFlowFilters
        filters={{ bucket: 'ready', scopeIds: ['workspace:/workspace'] }}
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
        scopeIds: ['workspace:/workspace']
      })
    )
  })

  it('uses pressed flow filters and status lights without visible lifecycle tags or action menus', () => {
    const onUpdateFilters = vi.fn()

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
        filters={{
          flowOwnerKeys: ['flow-a'],
          scopeIds: ['workspace:/workspace']
        }}
        onUpdateFilters={onUpdateFilters}
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
    openDetailsByText('Fixture Workspace')
    const workspaceFlowButton = getFlowFilterButtonByName('Workspace Flow')

    expect(workspaceFlowButton).toHaveAttribute('aria-pressed', 'true')
    expect(workspaceFlowButton)
      .toHaveAttribute('data-component-id', COMPONENT_IDS.automation.flowFilterToggle)
    fireEvent.click(workspaceFlowButton)
    expect(onUpdateFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        flowOwnerKeys: [],
        scopeIds: []
      })
    )
    expect(screen.queryByRole('button', { name: 'Flow actions' })).not.toBeInTheDocument()
  })

  it('renders per-flow lifecycle actions without restoring the context menu', () => {
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
        filters={{ archivedVisible: true, scopeIds: ['workspace:/workspace'] }}
        onSetFlowLifecycle={onSetFlowLifecycle}
        text={text}
        workspaceName="Fixture Workspace"
      />
    )

    openDetailsByText('Fixture Workspace')
    const disableButton = screen.getByRole('button', {
      name: 'Disable automation-flow Enabled Flow'
    })
    const enableButton = screen.getByRole('button', {
      name: 'Enable automation-flow Disabled Flow'
    })

    expect(disableButton).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.flowLifecycleButton
    )
    expect(enableButton).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.flowLifecycleButton
    )
    expect(
      screen.queryByRole('button', {
        name: 'Enable automation-flow Archived Flow'
      })
    ).not.toBeInTheDocument()
    fireEvent.click(disableButton)
    fireEvent.click(enableButton)
    expect(onSetFlowLifecycle).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: 'Enabled Flow' }),
      'disabled'
    )
    expect(onSetFlowLifecycle).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: 'Disabled Flow' }),
      'enabled'
    )
    expect(screen.queryByText('Archive automation-flow')).not.toBeInTheDocument()
    expect(screen.queryByText('Restore automation-flow')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Flow actions' })).not.toBeInTheDocument()
  })

  it('toggles scope and flow pressed states without checkboxes', () => {
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
          flowOwnerKeys: []
        }}
        onUpdateFilters={onUpdateFilters}
        text={text}
        workspaceName="Fixture Workspace"
      />
    )

    openDetailsByText('Fixture Workspace')
    const globalScopeButton = document.querySelector(
      `[data-component-id="${COMPONENT_IDS.automation.scopeFilterToggle}"]`
    )
    const workspaceFlowButton = getFlowFilterButtonByName('Workspace Flow')

    if (globalScopeButton === null) {
      throw new Error('Expected global scope button')
    }
    expect(globalScopeButton).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(globalScopeButton)
    expect(onUpdateFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeIds: ['workspace:/workspace', 'global']
      })
    )

    expect(workspaceFlowButton).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(workspaceFlowButton)
    expect(onUpdateFilters).toHaveBeenLastCalledWith(
      expect.objectContaining({
        flowOwnerKeys: [],
        scopeIds: []
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

    fireEvent.click(screen.getByRole('button', { name: 'Show archived flows' }))

    openDetailsByText('Fixture Workspace')
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

    openDetailsByText('Fixture Workspace')
    expect(screen.getByText('Archived Flow')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show archived flows' }))
      .toHaveAttribute('aria-pressed', 'true')
  })
})
