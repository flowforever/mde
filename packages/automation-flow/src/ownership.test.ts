import { describe, expect, test } from 'vitest'

import { resolveAutomationFlowOwnership } from './ownership'
import { createAutomationTaskId } from './taskIdentity'
import type { AutomationFlow } from './types'

const makeFlow = (
  id: string,
  overrides: Partial<AutomationFlow> = {}
): AutomationFlow => ({
  allowedEngines: ['codex'],
  confirmationPolicy: {
    fileWrites: 'automation-flow-controlled',
    highRisk: 'require-user',
    unclearScope: 'require-user'
  },
  defaultEngine: 'codex',
  id,
  lifecycle: 'enabled',
  loopPolicy: {
    intervalMinutes: 15,
    maxActiveRuns: 1,
    mode: 'continuous',
    onBlocked: 'skip-and-continue',
    onEmpty: 'wait'
  },
  match: {},
  name: id,
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

const sourceItem = {
  automationStatus: 'ready' as const,
  relativePath: '.mde/docs/tasks/ready.md',
  sourceItemId: 'workspace:.mde/docs/tasks/ready.md',
  sourceType: 'workspace-markdown' as const,
  title: 'READY Implement queue'
}

describe('resolveAutomationFlowOwnership', () => {
  test('workspace-local formal beats user-global formal at equal priority', () => {
    const result = resolveAutomationFlowOwnership([
      {
        automationFlow: makeFlow('user-formal', { scope: 'user' }),
        sourceItem
      },
      {
        automationFlow: makeFlow('workspace-formal', { scope: 'workspace' }),
        sourceItem
      }
    ])

    expect(result.diagnostics).toEqual([])
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0]).toMatchObject({
      automationFlowId: 'workspace-formal',
      taskId: createAutomationTaskId({
        automationFlowId: 'workspace-formal',
        sourceItemId: sourceItem.sourceItemId
      })
    })
  })

  test('formal beats draft at equal priority', () => {
    const result = resolveAutomationFlowOwnership([
      {
        automationFlow: makeFlow('draft-flow', { status: 'draft' }),
        sourceItem
      },
      {
        automationFlow: makeFlow('formal-flow', { status: 'formal' }),
        sourceItem
      }
    ])

    expect(result.diagnostics).toEqual([])
    expect(result.candidates[0]?.automationFlowId).toBe('formal-flow')
  })

  test('equal priority ties become diagnostics instead of task cards', () => {
    const result = resolveAutomationFlowOwnership([
      {
        automationFlow: makeFlow('first-flow'),
        sourceItem
      },
      {
        automationFlow: makeFlow('second-flow'),
        sourceItem
      }
    ])

    expect(result.candidates).toEqual([])
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'automationFlow.ownershipTie',
        severity: 'warning',
        sourceFile: '.mde/docs/tasks/ready.md'
      })
    ])
  })
})
