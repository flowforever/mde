import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
    const clearSelection = vi.fn()
    const viewModel: AutomationCenterViewModel = {
      diagnostics: [],
      doneTasks: [],
      needsMeTasks: [],
      phases: [
        {
          descriptionKey: 'automation.readyPhaseReviewWorkspaceSourceDescription',
          phaseId: 'review-source',
          status: 'done',
          titleKey: 'automation.readyPhaseReviewWorkspaceSource'
        },
        {
          descriptionKey: 'automation.readyPhaseRunFlowDescription',
          phaseId: 'run-flow',
          status: 'ready',
          titleKey: 'automation.readyPhaseRunFlow'
        },
        {
          descriptionKey: 'automation.readyPhaseVerifyEngineResultDescription',
          phaseId: 'verify-result',
          status: 'pending',
          titleKey: 'automation.readyPhaseVerifyEngineResult'
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
        eligibleExecutors: [
          {
            displayName: 'Implementation',
            executorId: 'implementation',
            executorSnapshotId: 'executor-snapshot-implementation',
            type: 'markdown'
          }
        ],
        primaryExecutor: {
          displayName: 'Implementation',
          executorId: 'implementation',
          executorSnapshotId: 'executor-snapshot-implementation',
          type: 'markdown'
        },
        relativePath: '.mde/docs/tasks/ready.md',
        sourceItemId: 'source-a',
        sourceType: 'workspace-markdown',
        taskId: 'task-a',
        title: 'READY Implement projection'
      },
      tasks: []
    }

    render(
      <QuietFlowline
        onClearSelection={clearSelection}
        text={text}
        viewModel={viewModel}
      />
    )

    expect(screen.getByRole('region', { name: 'Flowline' })).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.flowline
    )
    expect(screen.getByLabelText('Close Flowline detail')).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.flowlineCloseButton
    )
    screen.getByLabelText('Close Flowline detail').click()
    expect(clearSelection).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Start with selected executor')).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.automation.selectedExecutorStartButton
    )
    expect(screen.getByText('.mde/docs/tasks/ready.md')).toBeInTheDocument()
    expect(screen.getByText('Projection Flow')).toBeInTheDocument()
    expect(screen.getByText('codex')).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Phase plan preview' })
    ).toBeInTheDocument()
    const phasePlan = screen.getByRole('region', { name: 'Phase plan preview' })

    expect(
      within(phasePlan)
        .getAllByText(/^(Done|Ready|Pending)$/u)
        .map((element) => element.textContent)
    ).toEqual(['Done', 'Ready', 'Pending'])
    expect(
      within(phasePlan)
        .getAllByText(/Review workspace source|Run the owning automation-flow|Verify the engine result/u)
        .map((element) => element.closest('[data-component-id]'))
    ).toHaveLength(3)
    expect(
      within(phasePlan)
        .getAllByText(/Review workspace source|Run the owning automation-flow|Verify the engine result/u)
        .map((element) => element.closest('[data-component-id]')?.getAttribute('data-component-id'))
    ).toEqual([
      COMPONENT_IDS.automation.flowlinePhase,
      COMPONENT_IDS.automation.flowlinePhase,
      COMPONENT_IDS.automation.flowlinePhase
    ])
    expect(screen.getByText('Review workspace source')).toBeInTheDocument()
    expect(screen.getByText('Run the owning automation-flow')).toBeInTheDocument()
    expect(screen.getByText('Verify the engine result')).toBeInTheDocument()
  })

  it('keeps the Ready start CTA visually primary through shared theme tokens', () => {
    const css = readFileSync(
      join(process.cwd(), 'apps/desktop/src/renderer/src/automation/styles.css'),
      'utf8'
    )
    const startButtonRule = /\.automation-flowline-start\s*\{[^}]+\}/u.exec(
      css
    )?.[0]

    expect(startButtonRule).toContain('color: var(--primary-action-text);')
    expect(startButtonRule).toContain('background: var(--primary-action);')
    expect(startButtonRule).toContain('border: 1px solid var(--primary-action);')
    expect(startButtonRule).not.toContain('#155eef')
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
