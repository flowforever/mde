import { describe, expect, test } from 'vitest'

import { planAutomationFlowLoop } from './loopPlanner'
import type { AutomationFlow } from './types'

const makeFlow = (
  onBlocked: AutomationFlow['loopPolicy']['onBlocked'],
  overrides: Partial<AutomationFlow> = {}
): AutomationFlow => ({
  allowedEngines: ['codex'],
  confirmationPolicy: {
    fileWrites: 'automation-flow-controlled',
    highRisk: 'require-user',
    unclearScope: 'require-user'
  },
  defaultEngine: 'codex',
  id: 'flow',
  lifecycle: 'enabled',
  loopPolicy: {
    intervalMinutes: 15,
    maxActiveRuns: 1,
    mode: 'continuous',
    onBlocked,
    onEmpty: 'wait'
  },
  match: {},
  name: 'Flow',
  pickOrder: [],
  priority: 10,
  reportPattern: 'completion-summary',
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

const readyCandidate = {
  automationFlowId: 'flow',
  engine: 'codex',
  sourceItemId: 'workspace:.mde/docs/tasks/ready.md',
  sourceType: 'workspace-markdown' as const,
  taskId: 'flow:workspace:.mde/docs/tasks/ready.md',
  title: 'READY Implement queue'
}

const blockedRun = {
  automationFlowId: 'flow',
  runId: 'blocked-run',
  sourceItemId: 'workspace:.mde/docs/tasks/blocked.md',
  state: 'needs-me' as const,
  taskId: 'flow:workspace:.mde/docs/tasks/blocked.md'
}

describe('planAutomationFlowLoop', () => {
  test('onBlocked skip-and-continue ignores blocked runs when counting executing capacity', () => {
    const result = planAutomationFlowLoop({
      activeRuns: [blockedRun],
      automationFlow: makeFlow('skip-and-continue'),
      readyCandidates: [readyCandidate]
    })

    expect(result).toMatchObject({
      action: 'start-run',
      taskId: readyCandidate.taskId
    })
  })

  test('onBlocked pause-automation-flow pauses scheduling', () => {
    const result = planAutomationFlowLoop({
      activeRuns: [blockedRun],
      automationFlow: makeFlow('pause-automation-flow'),
      readyCandidates: [readyCandidate]
    })

    expect(result).toMatchObject({
      action: 'pause-automation-flow',
      blockedRunId: 'blocked-run'
    })
  })

  test('manual or disabled flows do not schedule loop work', () => {
    expect(
      planAutomationFlowLoop({
        activeRuns: [],
        automationFlow: makeFlow('skip-and-continue', {
          loopPolicy: {
            intervalMinutes: 15,
            maxActiveRuns: 1,
            mode: 'manual',
            onBlocked: 'skip-and-continue',
            onEmpty: 'wait'
          }
        }),
        readyCandidates: [readyCandidate]
      })
    ).toMatchObject({ action: 'idle' })
    expect(
      planAutomationFlowLoop({
        activeRuns: [],
        automationFlow: makeFlow('skip-and-continue', {
          lifecycle: 'disabled'
        }),
        readyCandidates: [readyCandidate]
      })
    ).toMatchObject({ action: 'idle' })
  })

  test('running active runs consume capacity', () => {
    const result = planAutomationFlowLoop({
      activeRuns: [
        {
          automationFlowId: 'flow',
          runId: 'running-run',
          sourceItemId: 'workspace:.mde/docs/tasks/running.md',
          state: 'running',
          taskId: 'flow:workspace:.mde/docs/tasks/running.md'
        }
      ],
      automationFlow: makeFlow('skip-and-continue'),
      readyCandidates: [readyCandidate]
    })

    expect(result).toMatchObject({ action: 'at-capacity' })
  })

  test('empty continuous queues wait or stop according to onEmpty policy', () => {
    const now = new Date('2026-05-10T06:00:00.000Z')

    expect(
      planAutomationFlowLoop({
        activeRuns: [],
        automationFlow: makeFlow('skip-and-continue'),
        now,
        readyCandidates: []
      })
    ).toMatchObject({
      action: 'wait',
      nextScanAt: '2026-05-10T06:15:00.000Z'
    })
    expect(
      planAutomationFlowLoop({
        activeRuns: [],
        automationFlow: makeFlow('skip-and-continue', {
          loopPolicy: {
            intervalMinutes: 15,
            maxActiveRuns: 1,
            mode: 'continuous',
            onBlocked: 'skip-and-continue',
            onEmpty: 'stop'
          }
        }),
        readyCandidates: []
      })
    ).toMatchObject({ action: 'stop' })
  })
})
