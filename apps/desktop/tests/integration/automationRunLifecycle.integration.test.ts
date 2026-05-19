import { mkdtemp, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type {
  AutomationFlow,
  AutomationFlowExecutorRef,
  AutomationFlowTaskCandidate
} from '@mde/automation-flow'
import { describe, expect, it, vi } from 'vitest'

import { createAutomationAdapterRegistry } from '../../src/main/services/automation/automationAdapterRegistry'
import {
  createFakeAgentCliAdapter,
  type AgentCliAdapter
} from '../../src/main/services/automation/agentCliAdapters'
import { createAutomationRuntime } from '../../src/main/services/automation/automationRuntime'
import { createAutomationStore } from '../../src/main/services/automation/automationStore'
import { createMdeRuntimeBridge } from '../../src/main/services/automation/mdeRuntimeBridge'

const createTempRoot = async (prefix: string): Promise<string> =>
  realpath(await mkdtemp(join(tmpdir(), prefix)))

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
  taskDataId: 'task-data-a',
  taskDataSnapshotId: 'task-data-snapshot-a',
  title: 'READY Persist run'
})

const executorSnapshot: AutomationFlowExecutorRef = Object.freeze({
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
})

describe('automation run lifecycle integration', () => {
  it('passes a task execution root through adapter start, prompt metadata, store, and runtime bridge', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const executionRoot = await createTempRoot('mde-execution-root-')
    const store = createAutomationStore({ appDataPath })
    const fakeAdapter = createFakeAgentCliAdapter({
      commandPath: '/fake/bin/codex',
      engine: 'codex'
    })
    const startRun = vi.fn(fakeAdapter.startRun)
    const adapter: AgentCliAdapter = Object.freeze({
      ...fakeAdapter,
      startRun
    })
    const bridge = createMdeRuntimeBridge({ appDataPath, now: () => 1_000 })
    const runtimeCredential = 'runtime-credential-execution-root'
    const runtime = createAutomationRuntime({
      adapterRegistry: createAutomationAdapterRegistry([adapter]),
      createId: (prefix) => `${prefix}-execution-root`,
      createRuntimeToken: () => runtimeCredential,
      runtimeBridge: bridge,
      store
    })

    await store.initialize()

    const started = await runtime.startRun({
      automationFlow: createFlow(),
      candidate: {
        ...createCandidate(workspaceRoot),
        executionRoot
      },
      executorSnapshot,
      workspaceRoot
    })

    expect(startRun).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceRoot: executionRoot
      })
    )
    expect(startRun.mock.calls[0]?.[0].promptBundle).toContain(
      `"executionRoot": "${executionRoot}"`
    )
    await expect(store.listRuns()).resolves.toMatchObject([
      {
        executionRoot,
        promptBundleMetadata: {
          executionRoot
        },
        runId: started.runId,
        workspaceRoot: executionRoot
      }
    ])
    await expect(
      bridge.handleRuntimeToolCall({
        automationFlowSnapshotId: 'snapshot-execution-root',
        evidencePath: executionRoot,
        runId: started.runId,
        sourceItemId: 'source-a',
        taskId: 'task-a',
        token: runtimeCredential,
        toolName: 'report_phase_update'
      })
    ).resolves.toMatchObject({ accepted: true })
  })

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
      executorSnapshot,
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
        executorId: 'implementation',
        executorSnapshotId: 'executor-snapshot-implementation',
        runId: 'run-lifecycle',
        state: 'done',
        taskDataId: 'task-data-a',
        taskDataSnapshotId: 'task-data-snapshot-a'
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
