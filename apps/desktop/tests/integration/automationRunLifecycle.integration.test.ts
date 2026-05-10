import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { AutomationFlow, AutomationFlowTaskCandidate } from '@mde/automation-flow'
import { describe, expect, it } from 'vitest'

import { createAutomationAdapterRegistry } from '../../src/main/services/automation/automationAdapterRegistry'
import { createFakeAgentCliAdapter } from '../../src/main/services/automation/agentCliAdapters'
import { createAutomationRuntime } from '../../src/main/services/automation/automationRuntime'
import { createAutomationStore } from '../../src/main/services/automation/automationStore'
import { createMdeRuntimeBridge } from '../../src/main/services/automation/mdeRuntimeBridge'

const createTempRoot = (prefix: string): Promise<string> =>
  mkdtemp(join(tmpdir(), prefix))

const createFlow = (): AutomationFlow => ({
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
    executionStandard: '- Start\n- Verify',
    pickRules: 'Pick.',
    reportPattern: 'Report.',
    verificationExpectations: 'Verify.'
  },
  sourceTypes: ['workspace-markdown'],
  status: 'formal'
})

const createCandidate = (workspaceRoot: string): AutomationFlowTaskCandidate => ({
  automationFlowId: 'flow-a',
  engine: 'codex',
  sourceItemId: 'source-a',
  sourcePath: join(workspaceRoot, '.mde', 'docs', 'tasks', 'ready.md'),
  sourceType: 'workspace-markdown',
  taskId: 'task-a',
  title: 'READY Persist run'
})

describe('automation run lifecycle integration', () => {
  it('starts, resumes, and completes a run through persisted store state', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const store = createAutomationStore({ appDataPath })
    const runtime = createAutomationRuntime({
      adapterRegistry: createAutomationAdapterRegistry([
        createFakeAgentCliAdapter({
          commandPath: '/fake/bin/codex',
          engine: 'codex'
        })
      ]),
      createId: (prefix) => `${prefix}-lifecycle`,
      runtimeBridge: createMdeRuntimeBridge({ appDataPath }),
      store
    })

    await store.initialize()

    const started = await runtime.startRun({
      automationFlow: createFlow(),
      candidate: createCandidate(workspaceRoot),
      workspaceRoot
    })
    const resumed = await runtime.resumeRun({
      adapterSessionId: 'adapter-session-lifecycle-2',
      runId: started.runId
    })
    const report = await runtime.completeRun({
      outcome: 'succeeded',
      runId: started.runId,
      summary: 'Verified',
      title: 'READY Persist run'
    })

    expect(resumed.adapterSessionLineage).toEqual([
      'adapter-session-lifecycle',
      'adapter-session-lifecycle-2'
    ])
    expect(report).toMatchObject({
      outcome: 'succeeded',
      runId: 'run-lifecycle',
      taskId: 'task-a'
    })
    await expect(store.listRuns()).resolves.toMatchObject([
      {
        adapterSessionId: 'adapter-session-lifecycle-2',
        adapterSessionLineage: [
          'adapter-session-lifecycle',
          'adapter-session-lifecycle-2'
        ],
        automationFlowSnapshotId: 'snapshot-lifecycle',
        runId: 'run-lifecycle',
        state: 'done'
      }
    ])
    await expect(store.listReports()).resolves.toMatchObject([
      {
        outcome: 'succeeded',
        reportId: 'report-lifecycle',
        runId: 'run-lifecycle',
        taskId: 'task-a'
      }
    ])
  })
})
