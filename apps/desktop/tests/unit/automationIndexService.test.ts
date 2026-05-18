import { describe, expect, it } from 'vitest'

import type { AutomationFlow, AutomationFlowExecutorRef } from '@mde/automation-flow'

import { buildAutomationIndex } from '../../src/main/services/automation/automationIndexService'

const flow: AutomationFlow = {
  allowedEngines: ['codex'],
  confirmationPolicy: {
    fileWrites: 'automation-flow-controlled',
    highRisk: 'require-user',
    unclearScope: 'require-user'
  },
  defaultEngine: 'codex',
  executors: [
    {
      handles: {
        sourceTypes: ['workspace-markdown'],
        taskTypes: ['requirement']
      },
      id: 'implementation',
      type: 'markdown'
    }
  ],
  id: 'flow-a',
  lifecycle: 'enabled',
  loopPolicy: {
    intervalMinutes: 15,
    maxActiveRuns: 1,
    mode: 'continuous',
    onBlocked: 'pause-automation-flow',
    onEmpty: 'wait'
  },
  match: {},
  name: 'Flow A',
  pickOrder: [],
  priority: 0,
  reportPattern: 'report',
  scope: 'workspace',
  sections: {
    acceptanceStandard: 'accept',
    executionStandard: 'execute',
    pickRules: 'pick',
    reportPattern: 'report',
    verificationExpectations: 'verify'
  },
  sourceTypes: ['workspace-markdown'],
  status: 'formal'
}

describe('automationIndexService', () => {
  it('projects discovered task data through resolved executor snapshots', () => {
    const index = buildAutomationIndex({
      automationFlows: [flow],
      discoveredSources: [
        {
          automationFlowId: 'flow-a',
          discoveredAt: '2026-05-10T08:00:00.000Z',
          sourceItemId: 'source-a',
          sourceSnapshotHash: 'hash-a',
          sourceType: 'workspace-markdown',
          taskDataId: 'task-data-a',
          taskDataSnapshotId: 'task-data-snapshot-a',
          taskType: 'requirement',
          title: 'READY Implement index'
        }
      ]
    })

    const [task] = index.projection.tasks

    expect(task).toMatchObject({
      taskDataId: 'task-data-a',
      taskDataSnapshotId: 'task-data-snapshot-a'
    })
    expect(task?.primaryExecutor?.executorId).toBe('implementation')
    expect(task?.primaryExecutor?.executorSnapshotId).toContain(
      'automation-executor-snapshot'
    )
  })

  it('preserves executors keyed by the concrete workspace owner identity', () => {
    const ownerKey = 'workspace:%2Fworkspace%2Fone:flow:flow-a'
    const executor: AutomationFlowExecutorRef = {
      autoDiscovered: true,
      diagnostics: [],
      displayName: 'Implementation',
      enabled: true,
      executorId: 'implementation',
      handles: {},
      order: 0,
      sourcePath: '/workspace/one/.mde/automation-flows/flow-a/implementation.md',
      tags: [],
      type: 'markdown'
    }
    const index = buildAutomationIndex({
      automationFlows: [flow],
      discoveredSources: [
        {
          automationFlowId: 'flow-a',
          automationFlowOwnerKey: ownerKey,
          discoveredAt: '2026-05-10T08:00:00.000Z',
          sourceItemId: 'source-a',
          sourceSnapshotHash: 'hash-a',
          sourceType: 'workspace-markdown',
          taskDataId: 'task-data-a',
          taskDataSnapshotId: 'task-data-snapshot-a',
          title: 'READY Implement index'
        }
      ],
      executorsByOwnerKey: new Map([[ownerKey, [executor]]])
    })

    const [task] = index.projection.tasks

    expect(task?.blockingDiagnostics).toBeUndefined()
    expect(task?.primaryExecutor?.executorId).toBe('implementation')
    expect(index.executorsByOwnerKey.get(ownerKey)?.[0]?.sourcePath).toBe(
      executor.sourcePath
    )
  })

  it('keeps owner-separated task data when the same flow id is used by different owners', () => {
    const index = buildAutomationIndex({
      automationFlows: [flow],
      discoveredSources: [
        {
          automationFlowId: 'flow-a',
          automationFlowOwnerKey: 'workspace:a:applied-global:flow-a',
          discoveredAt: '2026-05-10T08:00:00.000Z',
          sourceItemId: 'same-source',
          sourceSnapshotHash: 'hash-a',
          sourceType: 'workspace-markdown',
          taskDataId: 'task-data-a',
          taskDataSnapshotId: 'task-data-snapshot-a',
          title: 'READY A'
        },
        {
          automationFlowId: 'flow-a',
          automationFlowOwnerKey: 'workspace:b:applied-global:flow-a',
          discoveredAt: '2026-05-10T08:00:00.000Z',
          sourceItemId: 'same-source',
          sourceSnapshotHash: 'hash-b',
          sourceType: 'workspace-markdown',
          taskDataId: 'task-data-b',
          taskDataSnapshotId: 'task-data-snapshot-b',
          title: 'READY B'
        }
      ]
    })

    expect(index.projection.tasks.map((task) => task.taskDataId)).toEqual([
      'task-data-a',
      'task-data-b'
    ])
  })
})
