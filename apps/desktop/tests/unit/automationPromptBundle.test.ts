import { describe, expect, it } from 'vitest'
import type { AutomationFlow } from '@mde/automation-flow'

import { createAutomationPromptBundle } from '../../src/main/services/automation/automationPromptBundle'

const automationFlow = Object.freeze({
  allowedEngines: Object.freeze(['codex']),
  confirmationPolicy: Object.freeze({
    fileWrites: 'automation-flow-controlled',
    highRisk: 'require-user',
    unclearScope: 'require-user'
  }),
  defaultEngine: 'codex',
  id: 'local-dev-task',
  lifecycle: 'enabled',
  loopPolicy: Object.freeze({
    intervalMinutes: 15,
    maxActiveRuns: 1,
    mode: 'manual',
    onBlocked: 'pause-automation-flow',
    onEmpty: 'wait'
  }),
  match: Object.freeze({
    taskPathGlobs: Object.freeze(['.mde/docs/tasks/**/*.md'])
  }),
  name: 'Local Dev Task',
  pickOrder: Object.freeze(['.mde/docs/tasks/**/*.md']),
  priority: 40,
  reportPattern: 'local-dev-task-summary',
  scope: 'workspace',
  sections: Object.freeze({
    acceptanceStandard: 'Complete the requested task.',
    executionStandard: 'Keep changes scoped.',
    pickRules: 'Pick READY Markdown task files.',
    reportPattern: 'List changed files and verification.',
    verificationExpectations: 'Run relevant checks.'
  }),
  sourceTypes: Object.freeze(['workspace-markdown']),
  status: 'formal'
} satisfies AutomationFlow)

describe('automationPromptBundle', () => {
  it('tells real Codex discovery runs to return discovered task sources as JSON', () => {
    const bundle = createAutomationPromptBundle({
      automationFlow,
      automationFlowSnapshotId: 'snapshot-1',
      runId: 'run-1',
      runKind: 'discovery',
      workspaceRoot: '/workspace'
    })

    expect(bundle.prompt).toMatch(/^# Parse automation-flow: Local Dev Task/u)
    expect(bundle.prompt).not.toMatch(/^# MDE Automation Runtime Contract/u)
    expect(bundle.prompt).toContain('## Required Structured Output')
    expect(bundle.prompt).toContain('## MDE Automation Runtime Contract')
    expect(bundle.prompt).toContain('"discoveredTaskSources"')
    expect(bundle.prompt).toContain('"sourceType": "workspace-markdown"')
    expect(bundle.prompt).toContain(
      'Return an empty discoveredTaskSources array when there is no ready work.'
    )
  })

  it('tells real Codex task runs to return final reports or decision prompts as JSON', () => {
    const bundle = createAutomationPromptBundle({
      automationFlow,
      automationFlowSnapshotId: 'snapshot-1',
      executorSnapshot: {
        autoDiscovered: false,
        diagnostics: [],
        displayName: 'Implementation',
        enabled: true,
        executorId: 'implementation',
        executorSnapshotId: 'executor-snapshot-implementation',
        handles: {},
        order: 0,
        resolvedSource: 'Run the selected task data.',
        tags: [],
        type: 'markdown'
      },
      runId: 'run-1',
      runKind: 'task',
      taskSource: {
        automationFlowId: 'local-dev-task',
        contentSnapshot: '# READY Example task\n',
        discoveredAt: '2026-05-14T00:00:00.000Z',
        relativePath: '.mde/docs/tasks/ready.md',
        sourceItemId: 'workspace:.mde/docs/tasks/ready.md',
        sourceSnapshotHash: 'hash-1',
        sourceType: 'workspace-markdown',
        title: 'READY Example task',
        workspaceId: '/workspace'
      },
      workspaceRoot: '/workspace'
    })

    expect(bundle.prompt).toMatch(/^# Run automation task: READY Example task/u)
    expect(bundle.prompt).not.toMatch(/^# MDE Automation Runtime Contract/u)
    expect(bundle.prompt).toContain('"finalReport"')
    expect(bundle.prompt).toContain('"decisionPrompt"')
    expect(bundle.prompt).toContain('## Task Data')
    expect(bundle.prompt).toContain('## Executor')
    expect(bundle.prompt).toContain('Executor id: implementation')
    expect(bundle.prompt).toContain('Executor instructions:')
    expect(bundle.prompt).toContain('Run the selected task data.')
    expect(bundle.prompt).toContain(
      'finalReport.outcome must be one of succeeded, failed, blocked, or cancelled.'
    )
  })
})
