import { describe, expect, it } from 'vitest'

import { createAutomationCenterViewModel } from '../../src/renderer/src/automation/automationViewModel'
import type { AutomationProjection } from '../../src/shared/automation'

const createProjection = (): AutomationProjection => ({
  buckets: {
    done: [],
    needsMe: [],
    ready: [
      {
        automationFlowId: 'flow-a',
        bucket: 'ready',
        engine: 'codex',
        relativePath: '.mde/docs/tasks/ready.md',
        sourceItemId: 'source-a',
        sourceType: 'workspace-markdown',
        taskId: 'ready-task',
        title: 'READY Implement projection'
      }
    ],
    running: []
  },
  decisions: [],
  diagnostics: [],
  filters: {},
  flows: [
    {
      automationFlowId: 'flow-a',
      lifecycle: 'enabled',
      name: 'Projection Flow',
      scope: 'workspace',
      sourceTypes: ['workspace-markdown'],
      status: 'formal',
      taskCount: 1
    }
  ],
  generatedAt: '2026-05-14T08:00:00.000Z',
  reports: [],
  runs: [],
  tasks: [
    {
      automationFlowId: 'flow-a',
      bucket: 'ready',
      engine: 'codex',
      relativePath: '.mde/docs/tasks/ready.md',
      sourceItemId: 'source-a',
      sourceType: 'workspace-markdown',
      taskId: 'ready-task',
      title: 'READY Implement projection'
    }
  ]
})

describe('createAutomationCenterViewModel', () => {
  it('creates prototype-style Flowline phases for the selected task', () => {
    const viewModel = createAutomationCenterViewModel(createProjection(), 'ready-task')

    expect(viewModel.selectedTask?.taskId).toBe('ready-task')
    expect(viewModel.phases).toEqual([
      expect.objectContaining({
        descriptionKey: 'automation.readyPhaseReviewWorkspaceSourceDescription',
        phaseId: 'ready-task:review-source',
        status: 'done',
        titleKey: 'automation.readyPhaseReviewWorkspaceSource'
      }),
      expect.objectContaining({
        descriptionKey: 'automation.readyPhaseRunFlowDescription',
        phaseId: 'ready-task:run-flow',
        status: 'ready',
        titleKey: 'automation.readyPhaseRunFlow'
      }),
      expect.objectContaining({
        descriptionKey: 'automation.readyPhaseVerifyEngineResultDescription',
        phaseId: 'ready-task:verify-result',
        status: 'pending',
        titleKey: 'automation.readyPhaseVerifyEngineResult'
      })
    ])
  })

  it('supports an explicit no-selection Flowline state', () => {
    const viewModel = createAutomationCenterViewModel(createProjection(), null)

    expect(viewModel.selectedTask).toBeUndefined()
    expect(viewModel.readyPreview).toBeUndefined()
    expect(viewModel.phases).toEqual([])
  })

  it('uses the active bucket as the visible Signal Stack task source', () => {
    const projection = {
      ...createProjection(),
      filters: { bucket: 'ready' },
      tasks: []
    } satisfies AutomationProjection
    const viewModel = createAutomationCenterViewModel(projection)

    expect(viewModel.visibleTasks).toHaveLength(1)
    expect(viewModel.selectedTask?.taskId).toBe('ready-task')
  })

  it('selects and scopes runs by taskKey when logical task ids collide', () => {
    const webTask = {
      automationFlowId: 'flow-a',
      bucket: 'ready' as const,
      executionRoot: '/repos/web',
      sourceItemId: 'source-a',
      taskId: 'same-task',
      taskKey: 'same-task:web',
      title: 'READY Web'
    }
    const apiTask = {
      automationFlowId: 'flow-a',
      bucket: 'ready' as const,
      executionRoot: '/repos/api',
      sourceItemId: 'source-a',
      taskId: 'same-task',
      taskKey: 'same-task:api',
      title: 'READY API'
    }
    const projection = {
      ...createProjection(),
      buckets: {
        done: [],
        needsMe: [],
        ready: [webTask, apiTask],
        running: []
      },
      runs: [
        {
          automationFlowId: 'flow-a',
          engine: 'codex' as const,
          executionRoot: '/repos/web',
          runId: 'run-web',
          runKind: 'task' as const,
          startedAt: '2026-05-14T08:00:00.000Z',
          state: 'done' as const,
          taskId: 'same-task',
          taskKey: 'same-task:web',
          updatedAt: '2026-05-14T08:01:00.000Z'
        },
        {
          automationFlowId: 'flow-a',
          engine: 'codex' as const,
          executionRoot: '/repos/api',
          runId: 'run-api',
          runKind: 'task' as const,
          startedAt: '2026-05-14T08:00:00.000Z',
          state: 'done' as const,
          taskId: 'same-task',
          taskKey: 'same-task:api',
          updatedAt: '2026-05-14T08:01:00.000Z'
        }
      ],
      tasks: [webTask, apiTask]
    } satisfies AutomationProjection
    const viewModel = createAutomationCenterViewModel(projection, 'same-task:api')

    expect(viewModel.selectedTask?.executionRoot).toBe('/repos/api')
    expect(viewModel.selectedTaskRuns?.map((run) => run.runId)).toEqual([
      'run-api'
    ])
  })
})
