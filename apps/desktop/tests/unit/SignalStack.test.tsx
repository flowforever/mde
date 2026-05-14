import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SignalStack } from '../../src/renderer/src/automation/SignalStack'
import { createAppText, BUILT_IN_APP_LANGUAGE_PACKS } from '../../src/renderer/src/i18n/appLanguage'
import { COMPONENT_IDS } from '../../src/renderer/src/componentIds'
import type { AutomationCenterViewModel } from '../../src/renderer/src/automation/automationViewModel'

const text = createAppText(BUILT_IN_APP_LANGUAGE_PACKS.en)

const createViewModel = (): AutomationCenterViewModel => ({
  diagnostics: [
    {
      code: 'setup',
      diagnosticId: 'diagnostic-1',
      message: 'Adapter setup is incomplete.',
      severity: 'error'
    }
  ],
  doneTasks: [
    {
      automationFlowId: 'flow-a',
      bucket: 'done',
      sourceItemId: 'source-done',
      taskId: 'done-task',
      title: 'DONE archived task'
    },
    {
      automationFlowId: 'flow-a',
      bucket: 'ready',
      sourceItemId: 'raw-secret-source-id',
      taskId: 'unsafe-source-task',
      title: 'READY unknown source task'
    }
  ],
  needsMeTasks: [
    {
      automationFlowId: 'flow-a',
      bucket: 'needs-me',
      sourceItemId: 'source-needs-me',
      taskId: 'needs-me-task',
      title: 'READY needs input'
    }
  ],
  phases: [],
  readyTasks: [
    {
      automationFlowId: 'flow-a',
      bucket: 'ready',
      relativePath: '.mde/docs/tasks/ready.md',
      sourceItemId: 'source-ready',
      taskId: 'ready-task',
      title: 'READY visible task',
      workspaceId: '/workspace'
    },
    {
      automationFlowId: 'flow-a',
      bucket: 'ready',
      sourceItemId: 'source-user',
      sourcePath: '/Users/private/.mde/prompts/personal.md',
      sourceType: 'user-prompt',
      taskId: 'user-task',
      title: 'READY personal task',
      workspaceId: 'mde:no-workspace'
    }
  ],
  runningTasks: [
    {
      automationFlowId: 'flow-a',
      bucket: 'running',
      sourceItemId: 'source-running',
      taskId: 'running-task',
      title: 'RUNNING task',
      workspaceId: '/workspaces/project-b'
    }
  ],
  tasks: [
    {
      automationFlowId: 'flow-a',
      bucket: 'needs-me',
      sourceItemId: 'source-needs-me',
      taskId: 'needs-me-task',
      title: 'READY needs input'
    },
    {
      automationFlowId: 'flow-a',
      bucket: 'running',
      sourceItemId: 'source-running',
      taskId: 'running-task',
      title: 'RUNNING task'
    },
    {
      automationFlowId: 'flow-a',
      bucket: 'ready',
      relativePath: '.mde/docs/tasks/ready.md',
      sourceItemId: 'source-ready',
      taskId: 'ready-task',
      title: 'READY visible task',
      workspaceId: '/workspaces/project-a'
    },
    {
      automationFlowId: 'flow-a',
      bucket: 'ready',
      sourceItemId: 'source-user',
      sourcePath: '/Users/private/.mde/prompts/personal.md',
      sourceType: 'user-prompt',
      taskId: 'user-task',
      title: 'READY personal task',
      workspaceId: 'mde:no-workspace'
    },
    {
      automationFlowId: 'flow-a',
      bucket: 'done',
      sourceItemId: 'source-done',
      taskId: 'done-task',
      title: 'DONE archived task'
    },
    {
      automationFlowId: 'flow-a',
      bucket: 'ready',
      sourceItemId: 'raw-secret-source-id',
      taskId: 'unsafe-source-task',
      title: 'READY unknown source task'
    }
  ],
  visibleTasks: [
    {
      automationFlowId: 'flow-a',
      bucket: 'needs-me',
      sourceItemId: 'source-needs-me',
      taskId: 'needs-me-task',
      title: 'READY needs input'
    },
    {
      automationFlowId: 'flow-a',
      bucket: 'running',
      sourceItemId: 'source-running',
      taskId: 'running-task',
      title: 'RUNNING task',
      workspaceId: '/workspaces/project-b'
    },
    {
      automationFlowId: 'flow-a',
      bucket: 'ready',
      relativePath: '.mde/docs/tasks/ready.md',
      sourceItemId: 'source-ready',
      taskId: 'ready-task',
      title: 'READY visible task',
      workspaceId: '/workspaces/project-a'
    },
    {
      automationFlowId: 'flow-a',
      bucket: 'ready',
      sourceItemId: 'source-user',
      sourcePath: '/Users/private/.mde/prompts/personal.md',
      sourceType: 'user-prompt',
      taskId: 'user-task',
      title: 'READY personal task',
      workspaceId: 'mde:no-workspace'
    },
    {
      automationFlowId: 'flow-a',
      bucket: 'done',
      sourceItemId: 'source-done',
      taskId: 'done-task',
      title: 'DONE archived task'
    },
    {
      automationFlowId: 'flow-a',
      bucket: 'ready',
      sourceItemId: 'raw-secret-source-id',
      taskId: 'unsafe-source-task',
      title: 'READY unknown source task'
    }
  ]
})

describe('SignalStack', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders a card-based task queue and keeps diagnostics out of task cards', () => {
    render(
      <SignalStack
        selectedTaskId="needs-me-task"
        text={text}
        viewModel={createViewModel()}
      />
    )

    expect(screen.getAllByRole('button')).toHaveLength(6)
    expect(screen.getByText('READY needs input').closest('button')).toHaveClass(
      'automation-task-card',
      'automation-task-card--selected'
    )
    expect(screen.getByText('READY needs input').closest('button')).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.signalTaskRow
    )
    expect(screen.getByText('READY visible task').closest('button')).toHaveClass(
      'automation-task-card'
    )
    expect(screen.getByText('READY visible task').closest('button')).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.signalTaskRow
    )
    expect(screen.getByText('RUNNING task').closest('button')).toHaveClass(
      'automation-task-card',
      'automation-task-card--running'
    )
    expect(screen.getByText('RUNNING task').closest('button')).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.signalTaskRow
    )
    expect(screen.getByText('DONE archived task').closest('button')).toHaveClass(
      'automation-task-card',
      'automation-task-card--done'
    )
    expect(screen.getByText('DONE archived task').closest('button')).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.signalTaskRow
    )
    expect(screen.getAllByText('Inspect Flowline')).toHaveLength(6)
    expect(screen.getByText('Selected automation-flow sources')).toBeInTheDocument()
    expect(screen.getByText('project-a')).toBeInTheDocument()
    expect(screen.getByText('project-b')).toBeInTheDocument()
    expect(screen.queryByText('Workspace')).not.toBeInTheDocument()
    expect(screen.getAllByText('No workspace').length).toBeGreaterThan(0)
    expect(screen.getByText('Source: .mde/docs/tasks/ready.md')).toBeInTheDocument()
    expect(screen.getByText('Source: Personal prompts')).toBeInTheDocument()
    expect(screen.queryByText('/Users/private/.mde/prompts/personal.md'))
      .not.toBeInTheDocument()
    expect(screen.getAllByText('Source: Unknown source').length)
      .toBeGreaterThan(0)
    expect(screen.queryByText('raw-secret-source-id')).not.toBeInTheDocument()

    const diagnosticList = screen.getByRole('region', {
      name: 'Setup diagnostics'
    })
    expect(
      within(diagnosticList).getByText('1 setup item outside the task queue')
    ).toBeInTheDocument()
    expect(within(diagnosticList).getByText('Error')).toBeInTheDocument()
    expect(
      within(diagnosticList).getByText(
        'Automation setup needs attention. Check the automation-flow configuration.'
      )
    ).toBeInTheDocument()
    expect(within(diagnosticList).queryByText('Adapter setup is incomplete.'))
      .not.toBeInTheDocument()
    expect(within(diagnosticList).queryByText('READY visible task'))
      .not.toBeInTheDocument()
  })

  it('renders a flat queue empty state', () => {
    render(
      <SignalStack
        text={text}
        viewModel={{
          ...createViewModel(),
          diagnostics: [],
          doneTasks: [],
          needsMeTasks: [],
          readyTasks: [],
          runningTasks: [],
          tasks: [],
          visibleTasks: []
        }}
      />
    )

    expect(screen.getByText('No automation tasks yet.')).toBeInTheDocument()
  })
})
