import { describe, expect, test } from 'vitest'

import { automationFlowSchema, isAutomationFlow } from './schema'

const validAutomationFlow = {
  allowedEngines: ['codex', 'claude-code'],
  defaultEngine: 'codex',
  id: 'local-dev-task',
  loopPolicy: {
    mode: 'manual'
  },
  name: 'Local Dev Task',
  reportPattern: 'Concise Markdown summary with verification evidence.',
  scope: 'workspace',
  sections: {
    acceptanceStandard: 'The requested behavior is implemented.',
    executionStandard: 'Keep changes scoped.',
    pickRules: 'Pick READY Markdown task files.',
    reportPattern: 'List changed files and verification outcomes.',
    verificationExpectations: 'Run package tests.'
  },
  sourceTypes: ['workspace-markdown'],
  status: 'formal'
}

describe('automationFlowSchema', () => {
  test('applies defaults for optional automation-flow fields', () => {
    const result = automationFlowSchema.safeParse(validAutomationFlow)

    expect(result.success).toBe(true)

    if (!result.success) {
      return
    }

    expect(result.data).toMatchObject({
      confirmationPolicy: {
        fileWrites: 'automation-flow-controlled',
        highRisk: 'require-user',
        unclearScope: 'require-user'
      },
      lifecycle: 'enabled',
      loopPolicy: {
        intervalMinutes: 15,
        maxActiveRuns: 1,
        mode: 'manual',
        onBlocked: 'skip-and-continue',
        onEmpty: 'wait'
      },
      match: {},
      pickOrder: [],
      priority: 0
    })
  })

  test('requires defaultEngine in formal automation-flow data', () => {
    const missingDefaultEngine: Record<string, unknown> = {
      ...validAutomationFlow
    }
    delete missingDefaultEngine.defaultEngine

    const result = automationFlowSchema.safeParse(missingDefaultEngine)

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]).toMatchObject({
      path: ['defaultEngine']
    })
  })

  test('rejects defaultEngine values that are not allowed engines', () => {
    const result = automationFlowSchema.safeParse({
      ...validAutomationFlow,
      defaultEngine: 'unknown-engine'
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]).toMatchObject({
      code: 'custom',
      path: ['defaultEngine']
    })
  })

  test('recognizes valid automation-flow values with a type guard', () => {
    expect(isAutomationFlow(validAutomationFlow)).toBe(true)
    expect(
      isAutomationFlow({
        ...validAutomationFlow,
        defaultEngine: ''
      })
    ).toBe(false)
  })
})
