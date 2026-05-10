import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { QuietFlowline } from '../../src/renderer/src/automation/QuietFlowline'
import { createAppText, BUILT_IN_APP_LANGUAGE_PACKS } from '../../src/renderer/src/i18n/appLanguage'
import { COMPONENT_IDS } from '../../src/renderer/src/componentIds'
import type { AutomationCenterViewModel } from '../../src/renderer/src/automation/automationViewModel'

const text = createAppText(BUILT_IN_APP_LANGUAGE_PACKS.en)

describe('QuietFlowline', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders task-specific phases from view-model data', () => {
    const viewModel: AutomationCenterViewModel = {
      diagnostics: [],
      doneTasks: [],
      needsMeTasks: [],
      phases: [
        {
          phaseId: 'task-title',
          status: 'ready',
          title: 'READY Implement projection'
        }
      ],
      readyTasks: [],
      runningTasks: [],
      selectedTask: {
        automationFlowId: 'flow-a',
        bucket: 'ready',
        sourceItemId: 'source-a',
        taskId: 'task-a',
        title: 'READY Implement projection'
      },
      tasks: []
    }

    render(<QuietFlowline text={text} viewModel={viewModel} />)

    expect(screen.getByRole('region', { name: 'Flowline' })).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.flowline
    )
    expect(screen.getByText('READY Implement projection')).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.flowlinePhase
    )
    expect(screen.queryByText('Inspect')).not.toBeInTheDocument()
    expect(screen.queryByText('Implement')).not.toBeInTheDocument()
    expect(screen.queryByText('Verify')).not.toBeInTheDocument()
  })

  it('renders the no-selection empty state', () => {
    render(
      <QuietFlowline
        text={text}
        viewModel={{
          diagnostics: [],
          doneTasks: [],
          needsMeTasks: [],
          phases: [],
          readyTasks: [],
          runningTasks: [],
          tasks: []
        }}
      />
    )

    expect(screen.getByText('Select a task to inspect its Flowline.'))
      .toBeInTheDocument()
  })
})
