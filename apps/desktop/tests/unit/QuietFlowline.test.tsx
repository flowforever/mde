import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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

  it('renders a Ready start preview from the selected task', () => {
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
      readyPreview: {
        engine: 'codex',
        flowName: 'Projection Flow',
        phases: [
          'automation.readyPhaseReviewWorkspaceSource',
          'automation.readyPhaseRunFlow',
          'automation.readyPhaseVerifyEngineResult'
        ],
        sourceSummary: '.mde/docs/tasks/ready.md'
      },
      runningTasks: [],
      selectedTask: {
        automationFlowId: 'flow-a',
        bucket: 'ready',
        engine: 'codex',
        relativePath: '.mde/docs/tasks/ready.md',
        sourceItemId: 'source-a',
        sourceType: 'workspace-markdown',
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
    expect(screen.getByText('Start automation task')).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.flowlineStartButton
    )
    expect(screen.getByText('.mde/docs/tasks/ready.md')).toBeInTheDocument()
    expect(screen.getByText('Projection Flow')).toBeInTheDocument()
    expect(screen.getByText('codex')).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Phase plan preview' })
    ).toHaveAttribute('data-component-id', COMPONENT_IDS.automation.flowlinePhase)
    expect(screen.getByText('Review workspace source')).toBeInTheDocument()
    expect(screen.getByText('Run the owning automation-flow')).toBeInTheDocument()
    expect(screen.getByText('Verify the engine result')).toBeInTheDocument()
  })

  it('keeps the Ready start CTA visually primary without depending on app accent variables', () => {
    const css = readFileSync(
      join(process.cwd(), 'apps/desktop/src/renderer/src/automation/styles.css'),
      'utf8'
    )
    const startButtonRule =
      /\.automation-flowline-start,\n\.automation-agent-chat-button\s*\{[^}]+\}/u.exec(
        css
      )?.[0]

    expect(startButtonRule).toContain('background: #155eef;')
    expect(startButtonRule).toContain('border: 1px solid #155eef;')
    expect(startButtonRule).not.toContain('background: var(--accent)')
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
