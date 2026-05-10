import { describe, expect, it } from 'vitest'

import { createAutomationScheduler } from '../../src/main/services/automation/automationScheduler'
import type { AutomationFlow, AutomationFlowTaskCandidate } from '@mde/automation-flow'

const createFlow = (
  overrides: Partial<AutomationFlow> = {}
): AutomationFlow => ({
  allowedEngines: ['codex'],
  confirmationPolicy: {
    fileWrites: 'automation-flow-controlled',
    highRisk: 'require-user',
    unclearScope: 'require-user'
  },
  defaultEngine: 'codex',
  id: 'flow-a',
  lifecycle: 'enabled',
  loopPolicy: {
    intervalMinutes: 15,
    maxActiveRuns: 1,
    mode: 'continuous',
    onBlocked: 'skip-and-continue',
    onEmpty: 'wait'
  },
  match: {},
  name: 'Flow A',
  pickOrder: [],
  priority: 10,
  reportPattern: 'summary',
  scope: 'workspace',
  sections: {
    acceptanceStandard: 'Accept.',
    executionStandard: 'Execute.',
    pickRules: 'Pick.',
    reportPattern: 'Report.',
    verificationExpectations: 'Verify.'
  },
  sourceTypes: ['workspace-markdown'],
  status: 'formal',
  ...overrides
})

const candidate = (
  automationFlowId: string,
  taskId: string
): AutomationFlowTaskCandidate => ({
  automationFlowId,
  engine: 'codex',
  sourceItemId: taskId,
  sourceType: 'workspace-markdown',
  taskId,
  title: `READY ${taskId}`
})

describe('automationScheduler', () => {
  it('starts only the next candidate owned by the automation-flow', () => {
    const scheduler = createAutomationScheduler({
      now: () => new Date('2026-05-10T08:00:00.000Z')
    })

    expect(
      scheduler.planNext({
        activeRuns: [],
        automationFlow: createFlow(),
        candidates: [candidate('other-flow', 'other-task'), candidate('flow-a', 'task-a')]
      })
    ).toMatchObject({
      action: 'start-run',
      taskId: 'task-a'
    })
  })

  it('starts the next ready task after terminal completion and ignores stopped flows', () => {
    const scheduler = createAutomationScheduler({
      now: () => new Date('2026-05-10T08:00:00.000Z')
    })

    expect(
      scheduler.planNext({
        activeRuns: [
          {
            automationFlowId: 'flow-a',
            runId: 'done-run',
            sourceItemId: 'source-done',
            state: 'done',
            taskId: 'done-task'
          }
        ],
        automationFlow: createFlow(),
        candidates: [candidate('flow-a', 'next-task')]
      })
    ).toMatchObject({
      action: 'start-run',
      taskId: 'next-task'
    })
    expect(
      scheduler.planNext({
        activeRuns: [],
        automationFlow: createFlow({ lifecycle: 'disabled' }),
        candidates: [candidate('flow-a', 'next-task')]
      })
    ).toMatchObject({
      action: 'idle'
    })
  })

  it('waits on empty queues and pauses or skips blocked runs according to flow policy', () => {
    const scheduler = createAutomationScheduler({
      now: () => new Date('2026-05-10T08:00:00.000Z')
    })
    const blockedRun = {
      automationFlowId: 'flow-a',
      runId: 'blocked-run',
      sourceItemId: 'source-blocked',
      state: 'needs-me' as const,
      taskId: 'blocked-task'
    }

    expect(
      scheduler.planNext({
        activeRuns: [],
        automationFlow: createFlow(),
        candidates: []
      })
    ).toMatchObject({
      action: 'wait',
      nextScanAt: '2026-05-10T08:15:00.000Z'
    })
    expect(
      scheduler.planNext({
        activeRuns: [blockedRun],
        automationFlow: createFlow(),
        candidates: [candidate('flow-a', 'next-task')]
      })
    ).toMatchObject({
      action: 'start-run',
      taskId: 'next-task'
    })
    expect(
      scheduler.planNext({
        activeRuns: [blockedRun],
        automationFlow: createFlow({
          loopPolicy: {
            intervalMinutes: 15,
            maxActiveRuns: 1,
            mode: 'continuous',
            onBlocked: 'pause-automation-flow',
            onEmpty: 'wait'
          }
        }),
        candidates: [candidate('flow-a', 'next-task')]
      })
    ).toMatchObject({
      action: 'pause-automation-flow',
      blockedRunId: 'blocked-run'
    })
  })

  it('keeps scheduling stateless across Automation Center window reopen', () => {
    const input = {
      activeRuns: [],
      automationFlow: createFlow(),
      candidates: [] as readonly AutomationFlowTaskCandidate[]
    }
    const firstScheduler = createAutomationScheduler({
      now: () => new Date('2026-05-10T08:00:00.000Z')
    })
    const reopenedScheduler = createAutomationScheduler({
      now: () => new Date('2026-05-10T08:00:00.000Z')
    })

    expect(firstScheduler.planNext(input)).toEqual(
      reopenedScheduler.planNext(input)
    )
  })
})
