import { describe, expect, test } from 'vitest'

import { projectAutomationFlowSignalStack } from './projection'
import type { AutomationFlowExecutorRef } from './types'

const candidate = {
  automationFlowId: 'flow',
  engine: 'codex',
  sourceItemId: 'workspace:.mde/docs/tasks/ready.md',
  sourceType: 'workspace-markdown' as const,
  taskId: 'flow:workspace:.mde/docs/tasks/ready.md',
  title: 'READY Implement queue'
}

const implementationExecutor: AutomationFlowExecutorRef = Object.freeze({
  autoDiscovered: false,
  diagnostics: Object.freeze([]),
  displayName: 'Implementation',
  enabled: true,
  executorId: 'implementation',
  executorSnapshotId: 'executor-snapshot-implementation',
  handles: Object.freeze({
    sourceTypes: Object.freeze(['workspace-markdown'] as const),
    taskTypes: Object.freeze(['requirement'] as const)
  }),
  order: 0,
  sourcePath: '/workspace/.mde/automation-flows/flow/implementation.md',
  tags: Object.freeze([]),
  type: 'markdown'
})

const reviewExecutor: AutomationFlowExecutorRef = Object.freeze({
  autoDiscovered: false,
  diagnostics: Object.freeze([]),
  displayName: 'Review',
  enabled: true,
  executorId: 'review',
  executorSnapshotId: 'executor-snapshot-review',
  handles: Object.freeze({
    sourceTypes: Object.freeze(['remote-issue'] as const)
  }),
  order: 1,
  sourcePath: '/workspace/.mde/automation-flows/flow/review.md',
  tags: Object.freeze([]),
  type: 'markdown'
})

describe('projectAutomationFlowSignalStack', () => {
  test('projects task data snapshot identity and selected executors', () => {
    const result = projectAutomationFlowSignalStack({
      candidates: [
        {
          ...candidate,
          automationFlowOwnerKey: 'workspace:%2Frepo:flow:flow',
          taskDataId: 'automation-task-data:workspace:%2Frepo:flow:flow:source',
          taskDataSnapshotId: 'automation-task-data-snapshot:snapshot',
          taskType: 'requirement'
        }
      ],
      executorsByOwnerKey: new Map([
        ['workspace:%2Frepo:flow:flow', [implementationExecutor, reviewExecutor]]
      ]),
      reports: [],
      runs: []
    })

    expect(result.tasks[0]).toMatchObject({
      bucket: 'ready',
      executorSnapshotId: 'executor-snapshot-implementation',
      taskDataId: 'automation-task-data:workspace:%2Frepo:flow:flow:source',
      taskDataSnapshotId: 'automation-task-data-snapshot:snapshot'
    })
    expect(result.tasks[0]?.eligibleExecutors?.map((executor) => executor.executorId))
      .toEqual(['implementation', 'review'])
    expect(result.tasks[0]?.primaryExecutor?.executorId).toBe('implementation')
  })

  test('required executor id and ref override handle matching and disabled required executors block start', () => {
    const skillExecutor = Object.freeze({
      ...reviewExecutor,
      executorId: 'execute-picked-task',
      handles: Object.freeze({
        sourceTypes: Object.freeze(['remote-issue'] as const)
      }),
      order: 2,
      skillRef: 'skill:execute-picked-task',
      type: 'skill' as const
    })
    const disabledRequired = Object.freeze({
      ...implementationExecutor,
      enabled: false
    })
    const byId = projectAutomationFlowSignalStack({
      candidates: [
        {
          ...candidate,
          automationFlowOwnerKey: 'owner',
          requiredExecutorId: 'implementation',
          sourceType: 'remote-issue' as const
        }
      ],
      executorsByOwnerKey: new Map([['owner', [implementationExecutor, reviewExecutor]]]),
      reports: [],
      runs: []
    })
    const byRef = projectAutomationFlowSignalStack({
      candidates: [
        {
          ...candidate,
          automationFlowOwnerKey: 'owner',
          requiredExecutorRef: 'skill:execute-picked-task'
        }
      ],
      executorsByOwnerKey: new Map([['owner', [implementationExecutor, skillExecutor]]]),
      reports: [],
      runs: []
    })
    const blocked = projectAutomationFlowSignalStack({
      candidates: [
        {
          ...candidate,
          automationFlowOwnerKey: 'owner',
          requiredExecutorId: 'implementation'
        }
      ],
      executorsByOwnerKey: new Map([['owner', [disabledRequired, reviewExecutor]]]),
      reports: [],
      runs: []
    })

    expect(byId.tasks[0]?.primaryExecutor).toMatchObject({
      executorId: 'implementation'
    })
    expect(byRef.tasks[0]?.primaryExecutor).toMatchObject({
      executorId: 'execute-picked-task'
    })
    expect(blocked.tasks[0]).toMatchObject({
      blockingDiagnostics: [
        expect.objectContaining({
          code: 'automationFlow.requiredExecutorDisabled'
        })
      ]
    })
    expect(blocked.tasks[0]?.primaryExecutor).toBeUndefined()
  })

  test('missing enabled executors create a blocking diagnostic', () => {
    const result = projectAutomationFlowSignalStack({
      candidates: [
        {
          ...candidate,
          automationFlowOwnerKey: 'owner'
        }
      ],
      executorsByOwnerKey: new Map([['owner', []]]),
      reports: [],
      runs: []
    })

    expect(result.tasks[0]).toMatchObject({
      blockingDiagnostics: [
        expect.objectContaining({ code: 'automationFlow.missingExecutor' })
      ]
    })
    expect(result.tasks[0]?.primaryExecutor).toBeUndefined()
  })

  test('Needs me takes precedence over Running', () => {
    const result = projectAutomationFlowSignalStack({
      candidates: [candidate],
      reports: [],
      runs: [
        {
          automationFlowId: 'flow',
          runId: 'run-running',
          sourceItemId: candidate.sourceItemId,
          state: 'running',
          taskId: candidate.taskId
        },
        {
          automationFlowId: 'flow',
          runId: 'run-needs-me',
          sourceItemId: candidate.sourceItemId,
          state: 'needs-me',
          taskId: candidate.taskId
        }
      ]
    })

    expect(result.buckets.needsMe).toHaveLength(1)
    expect(result.buckets.running).toEqual([])
    expect(result.buckets.needsMe[0]).toMatchObject({
      activeRunId: 'run-needs-me',
      bucket: 'needs-me'
    })
  })

  test('Running takes precedence over Ready', () => {
    const result = projectAutomationFlowSignalStack({
      candidates: [candidate],
      reports: [],
      runs: [
        {
          automationFlowId: 'flow',
          runId: 'run-running',
          sourceItemId: candidate.sourceItemId,
          state: 'running',
          taskId: candidate.taskId
        }
      ]
    })

    expect(result.buckets.ready).toEqual([])
    expect(result.buckets.running).toHaveLength(1)
  })

  test('Starting projects as Running while adapter work is in flight', () => {
    const result = projectAutomationFlowSignalStack({
      candidates: [candidate],
      reports: [],
      runs: [
        {
          automationFlowId: 'flow',
          runId: 'run-starting',
          sourceItemId: candidate.sourceItemId,
          state: 'starting',
          taskId: candidate.taskId
        }
      ]
    })

    expect(result.buckets.ready).toEqual([])
    expect(result.buckets.running).toEqual([
      expect.objectContaining({
        activeRunId: 'run-starting',
        bucket: 'running'
      })
    ])
  })

  test('terminal report takes precedence over rediscovered source', () => {
    const result = projectAutomationFlowSignalStack({
      candidates: [
        {
          ...candidate,
          relativePath: '.mde/docs/tasks/ready.md',
          sourcePath: '/workspace/.mde/docs/tasks/ready.md',
          sourceUri: 'file:///workspace/.mde/docs/tasks/ready.md',
          workspaceId: '/workspace'
        }
      ],
      reports: [
        {
          automationFlowId: 'flow',
          completedAt: '2026-05-10T08:00:00.000Z',
          reportId: 'report-1',
          sourceItemId: candidate.sourceItemId,
          taskId: candidate.taskId,
          title: 'Previous report'
        }
      ],
      runs: []
    })

    expect(result.buckets.ready).toEqual([])
    expect(result.buckets.done).toEqual([
      expect.objectContaining({
        bucket: 'done',
        latestReportId: 'report-1',
        relativePath: '.mde/docs/tasks/ready.md',
        sourcePath: '/workspace/.mde/docs/tasks/ready.md',
        sourceUri: 'file:///workspace/.mde/docs/tasks/ready.md',
        workspaceId: '/workspace'
      })
    ])
  })

  test('Done uses persisted source snapshot metadata when no candidate exists', () => {
    const result = projectAutomationFlowSignalStack({
      candidates: [],
      reports: [
        {
          automationFlowId: 'flow',
          completedAt: '2026-05-10T08:00:00.000Z',
          reportId: 'report-1',
          relativePath: '.mde/docs/tasks/ready.md',
          sourceItemId: candidate.sourceItemId,
          sourcePath: '/workspace/.mde/docs/tasks/ready.md',
          sourceType: 'workspace-markdown',
          sourceUri: 'file:///workspace/.mde/docs/tasks/ready.md',
          taskId: candidate.taskId,
          title: 'Previous report',
          workspaceId: '/workspace'
        }
      ],
      runs: []
    })

    expect(result.buckets.done).toEqual([
      expect.objectContaining({
        bucket: 'done',
        relativePath: '.mde/docs/tasks/ready.md',
        sourcePath: '/workspace/.mde/docs/tasks/ready.md',
        sourceType: 'workspace-markdown',
        sourceUri: 'file:///workspace/.mde/docs/tasks/ready.md',
        workspaceId: '/workspace'
      })
    ])
  })

  test('does not attach one flow owner report to another flow owner for the same source', () => {
    const nextOwnerCandidate = {
      ...candidate,
      automationFlowId: 'flow-b',
      taskId: 'flow-b:workspace:.mde/docs/tasks/ready.md'
    }

    const result = projectAutomationFlowSignalStack({
      candidates: [nextOwnerCandidate],
      reports: [
        {
          automationFlowId: 'flow',
          completedAt: '2026-05-10T08:00:00.000Z',
          reportId: 'report-1',
          sourceItemId: candidate.sourceItemId,
          taskId: candidate.taskId,
          title: 'Previous owner report'
        }
      ],
      runs: []
    })

    expect(result.buckets.ready).toEqual([
      expect.objectContaining({
        automationFlowId: 'flow-b',
        bucket: 'ready',
        taskId: nextOwnerCandidate.taskId
      })
    ])
    expect(result.buckets.done).toEqual([
      expect.objectContaining({
        automationFlowId: 'flow',
        bucket: 'done',
        latestReportId: 'report-1',
        taskId: candidate.taskId
      })
    ])
  })

  test('Done comes from historical report when no active source exists', () => {
    const result = projectAutomationFlowSignalStack({
      candidates: [],
      reports: [
        {
          automationFlowId: 'flow',
          completedAt: '2026-05-10T08:00:00.000Z',
          reportId: 'report-1',
          sourceItemId: candidate.sourceItemId,
          taskId: candidate.taskId,
          title: 'Previous report'
        }
      ],
      runs: []
    })

    expect(result.buckets.done).toEqual([
      expect.objectContaining({
        bucket: 'done',
        latestReportId: 'report-1',
        taskId: candidate.taskId
      })
    ])
  })

  test('preserves upstream candidate order inside Signal Stack buckets', () => {
    const secondCandidate = {
      automationFlowId: 'flow',
      engine: 'codex',
      priority: 100,
      sourceItemId: 'workspace:.mde/docs/tasks/a.md',
      sourceType: 'workspace-markdown' as const,
      taskId: 'flow:workspace:.mde/docs/tasks/a.md',
      title: 'READY A'
    }

    const result = projectAutomationFlowSignalStack({
      candidates: [candidate, secondCandidate],
      reports: [],
      runs: [
        {
          automationFlowId: 'flow',
          runId: 'run-a',
          sourceItemId: secondCandidate.sourceItemId,
          state: 'running',
          taskId: secondCandidate.taskId
        },
        {
          automationFlowId: 'flow',
          runId: 'run-ready',
          sourceItemId: candidate.sourceItemId,
          state: 'running',
          taskId: candidate.taskId
        }
      ]
    })

    expect(result.buckets.running.map((task) => task.taskId)).toEqual([
      candidate.taskId,
      secondCandidate.taskId
    ])
  })
})
