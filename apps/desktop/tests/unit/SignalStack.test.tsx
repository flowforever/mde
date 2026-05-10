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
      title: 'READY visible task'
    }
  ],
  runningTasks: [
    {
      automationFlowId: 'flow-a',
      bucket: 'running',
      sourceItemId: 'source-running',
      taskId: 'running-task',
      title: 'RUNNING task'
    }
  ],
  tasks: []
})

describe('SignalStack', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders four task buckets and keeps diagnostics out of task cards', () => {
    render(<SignalStack text={text} viewModel={createViewModel()} />)

    for (const bucketName of ['Needs me', 'Running', 'Ready', 'Done']) {
      expect(screen.getByRole('region', { name: bucketName })).toHaveAttribute(
        'data-component-id',
        COMPONENT_IDS.automation.bucket
      )
    }

    expect(screen.getByText('READY needs input').closest('article')).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.taskCard
    )
    expect(screen.getByText('READY visible task').closest('article')).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.taskCard
    )
    expect(screen.getByText('RUNNING task').closest('article')).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.taskCard
    )
    expect(screen.getByText('DONE archived task').closest('article')).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.taskCard
    )
    expect(screen.queryByText('.mde/docs/tasks/ready.md')).not.toBeInTheDocument()

    const diagnosticList = screen.getByRole('region', {
      name: 'Setup diagnostics'
    })
    expect(within(diagnosticList).getByText('Adapter setup is incomplete.'))
      .toBeInTheDocument()
    expect(within(diagnosticList).queryByText('READY visible task'))
      .not.toBeInTheDocument()
  })

  it('renders bucket-level empty states', () => {
    render(
      <SignalStack
        text={text}
        viewModel={{
          ...createViewModel(),
          diagnostics: [],
          doneTasks: [],
          needsMeTasks: [],
          readyTasks: [],
          runningTasks: []
        }}
      />
    )

    expect(screen.getAllByText('No tasks in this bucket.')).toHaveLength(4)
  })
})
