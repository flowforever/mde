import { describe, expect, test } from 'vitest'

import { projectAutomationFlowSignalStack } from './projection'

const candidate = {
  automationFlowId: 'flow',
  engine: 'codex',
  sourceItemId: 'workspace:.mde/docs/tasks/ready.md',
  sourceType: 'workspace-markdown' as const,
  taskId: 'flow:workspace:.mde/docs/tasks/ready.md',
  title: 'READY Implement queue'
}

describe('projectAutomationFlowSignalStack', () => {
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
