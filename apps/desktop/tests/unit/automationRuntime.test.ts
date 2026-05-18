import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type {
  AutomationFlow,
  AutomationFlowExecutorRef,
  AutomationFlowTaskCandidate
} from '@mde/automation-flow'
import { describe, expect, it } from 'vitest'

import { createAutomationAdapterRegistry } from '../../src/main/services/automation/automationAdapterRegistry'
import {
  createFakeAgentCliAdapter,
  type AgentCliAdapter
} from '../../src/main/services/automation/agentCliAdapters'
import { createAutomationRuntime } from '../../src/main/services/automation/automationRuntime'
import { createAutomationStore } from '../../src/main/services/automation/automationStore'
import { createMdeRuntimeBridge } from '../../src/main/services/automation/mdeRuntimeBridge'

const createTempRoot = (prefix: string): Promise<string> =>
  mkdtemp(join(tmpdir(), prefix))

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
    acceptanceStandard: 'Acceptance.',
    executionStandard: '- Inspect the task\n- Implement the change\n- Verify the result',
    pickRules: 'Pick.',
    reportPattern: 'Report.',
    verificationExpectations: 'Verify.'
  },
  sourceTypes: ['workspace-markdown'],
  status: 'formal',
  ...overrides
})

const createCandidate = (
  workspaceRoot: string,
  overrides: Partial<AutomationFlowTaskCandidate> = {}
): AutomationFlowTaskCandidate => ({
  automationFlowId: 'flow-a',
  engine: 'codex',
  sourceItemId: 'source-a',
  sourcePath: join(workspaceRoot, '.mde', 'docs', 'tasks', 'ready.md'),
  sourceType: 'workspace-markdown',
  taskId: 'task-a',
  taskDataId: 'task-data-a',
  taskDataSnapshotId: 'task-data-snapshot-a',
  title: 'READY Ship task',
  ...overrides
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

describe('automationRuntime', () => {
  it('creates runs with automation-flow snapshots and registers runtime authorization without persisting tokens', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const store = createAutomationStore({
      appDataPath,
      now: () => '2026-05-10T08:00:00.000Z'
    })
    const bridge = createMdeRuntimeBridge({ appDataPath, now: () => 1_000 })
    const runtimeToken = ['runtime', 'fixture', 'value'].join('-')
    const runtime = createAutomationRuntime({
      adapterRegistry: createAutomationAdapterRegistry([
        createFakeAgentCliAdapter({
          commandPath: '/fake/bin/codex',
          engine: 'codex',
          version: '1.0.0'
        })
      ]),
      createId: (prefix) => `${prefix}-1`,
      createRuntimeToken: () => runtimeToken,
      runtimeBridge: bridge,
      store
    })

    await store.initialize()

    const result = await runtime.startRun({
      automationFlow: createFlow(),
      executorSnapshot,
      candidate: createCandidate(workspaceRoot),
      workspaceRoot
    })

    expect(result).toMatchObject({
      automationFlowSnapshotId: 'snapshot-1',
      runId: 'run-1',
      state: 'running'
    })
    await expect(store.listRuns()).resolves.toMatchObject([
      {
        adapterSessionId: 'adapter-session-1',
        adapterSessionLineage: ['adapter-session-1'],
        automationFlowSnapshotId: 'snapshot-1',
        executorId: 'implementation',
        executorSnapshotId: 'executor-snapshot-implementation',
        runId: 'run-1',
        state: 'running',
        taskDataId: 'task-data-a',
        taskDataSnapshotId: 'task-data-snapshot-a'
      }
    ])
    await expect(
      bridge.handleRuntimeToolCall({
        automationFlowSnapshotId: 'snapshot-1',
        runId: 'run-1',
        sourceItemId: 'source-a',
        taskId: 'task-a',
        token: runtimeToken,
        toolName: 'update_task_status'
      })
    ).resolves.toMatchObject({ accepted: true })
    expect(JSON.stringify(await store.listRuns())).not.toContain(
      runtimeToken
    )
  })

  it('turns failed autonomy gates into Needs me decisions and keeps resume under the same MDE run id', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const store = createAutomationStore({ appDataPath })
    const runtime = createAutomationRuntime({
      adapterRegistry: createAutomationAdapterRegistry([
        createFakeAgentCliAdapter({
          capabilities: { autonomyGate: false },
          commandPath: '/fake/bin/codex',
          engine: 'codex'
        })
      ]),
      createId: (prefix) => `${prefix}-gate`,
      runtimeBridge: createMdeRuntimeBridge({ appDataPath }),
      store
    })

    await store.initialize()

    const blocked = await runtime.startRun({
      automationFlow: createFlow(),
      executorSnapshot,
      candidate: createCandidate(workspaceRoot),
      workspaceRoot
    })
    const resumed = await runtime.resumeRun({
      adapterSessionId: 'adapter-session-resumed',
      runId: blocked.runId
    })

    expect(blocked).toMatchObject({
      decision: {
        status: 'pending',
        taskId: 'task-a'
      },
      runId: 'run-gate',
      state: 'needs-me'
    })
    expect(resumed).toMatchObject({
      adapterSessionLineage: ['adapter-session-gate', 'adapter-session-resumed'],
      runId: 'run-gate'
    })
  })

  it('persists final reports emitted by a resumed adapter turn', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const store = createAutomationStore({ appDataPath })
    const runtime = createAutomationRuntime({
      adapterRegistry: createAutomationAdapterRegistry([
        createFakeAgentCliAdapter({
          commandPath: '/fake/bin/codex',
          engine: 'codex',
          resumeRunEvents: [
            {
              outcome: 'succeeded',
              summary: 'Finished after approval',
              title: 'READY Ship task',
              type: 'final-report'
            }
          ],
          taskRunEvents: [
            {
              prompt: 'Approve before applying changes.',
              type: 'decision-required'
            }
          ]
        })
      ]),
      createId: (prefix) => `${prefix}-resume`,
      runtimeBridge: createMdeRuntimeBridge({ appDataPath }),
      store
    })

    await store.initialize()

    const blocked = await runtime.startRun({
      automationFlow: createFlow(),
      executorSnapshot,
      candidate: createCandidate(workspaceRoot),
      workspaceRoot
    })
    const resumed = await runtime.resumeRun({
      response: 'approved',
      runId: blocked.runId
    })

    expect(blocked).toMatchObject({
      decision: {
        prompt: 'Approve before applying changes.',
        status: 'pending'
      },
      state: 'needs-me'
    })
    expect(resumed).toMatchObject({
      adapterSessionLineage: ['adapter-session-resume'],
      runId: 'run-resume'
    })
    await expect(store.listReports()).resolves.toMatchObject([
      {
        outcome: 'succeeded',
        reportId: 'report-resume',
        runId: 'run-resume',
        summary: 'Finished after approval',
        taskId: 'task-a',
        title: 'READY Ship task'
      }
    ])
    await expect(store.listRuns()).resolves.toMatchObject([
      {
        runId: 'run-resume',
        state: 'done'
      }
    ])
  })

  it('creates terminal reports and deterministic phase progress from the flow and events', async () => {
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
      createId: (prefix) => `${prefix}-done`,
      runtimeBridge: createMdeRuntimeBridge({ appDataPath }),
      store
    })

    await store.initialize()
    const started = await runtime.startRun({
      automationFlow: createFlow(),
      executorSnapshot,
      candidate: createCandidate(workspaceRoot),
      workspaceRoot
    })

    expect(
      runtime.derivePhaseProgress({
        automationFlow: createFlow(),
        phaseEvents: [
          {
            phaseTitle: 'Inspect the task',
            status: 'done'
          }
        ],
        taskTitle: 'READY Ship task'
      })
    ).toEqual([
      {
        status: 'done',
        title: 'Inspect the task'
      },
      {
        status: 'pending',
        title: 'Implement the change'
      },
      {
        status: 'pending',
        title: 'Verify the result'
      }
    ])

    const report = await runtime.completeRun({
      outcome: 'succeeded',
      runId: started.runId,
      summary: 'Completed without token=secret',
      title: 'READY Ship task'
    })

    expect(report).toMatchObject({
      outcome: 'succeeded',
      runId: started.runId,
      taskId: 'task-a'
    })
    await expect(store.listRuns()).resolves.toMatchObject([
      {
        state: 'done'
      }
    ])
  })

  it('exposes safe actions for native sessions and recoverable failures', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const store = createAutomationStore({ appDataPath })
    const runtime = createAutomationRuntime({
      adapterRegistry: createAutomationAdapterRegistry([
        createFakeAgentCliAdapter({
          commandPath: '/fake/bin/codex',
          engine: 'codex'
        })
      ]),
      runtimeBridge: createMdeRuntimeBridge({ appDataPath }),
      store
    })

    await store.initialize()
    await store.createRun({
      adapterSessionId: 'adapter-session-1',
      adapterSessionLineage: ['adapter-session-1'],
      automationFlowId: 'flow-a',
      automationFlowSnapshotId: 'snapshot-1',
      engine: 'codex',
      runId: 'run-recoverable',
      runKind: 'task',
      state: 'failed',
      taskId: 'task-a'
    })

    await expect(
      runtime.getRunActions({ engine: 'codex', runId: 'run-recoverable' })
    ).resolves.toEqual([
      'resume',
      'retry',
      'view-evidence',
      'abandon',
      'open-native-session'
    ])
  })

  it('does not mark a run cancelled when the adapter rejects cancellation', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const store = createAutomationStore({ appDataPath })
    const fakeAdapter = createFakeAgentCliAdapter({
      commandPath: '/fake/bin/codex',
      engine: 'codex'
    })
    const adapter: AgentCliAdapter = Object.freeze({
      ...fakeAdapter,
      cancelRun: () =>
        Promise.resolve(
          Object.freeze({
            accepted: false,
            diagnostic: {
              code: 'automationRun.cancelFailed',
              diagnosticId: 'adapter:cancel-rejected',
              message: 'Cancel rejected',
              messageKey: 'automation.diagnostics.automationRun.cancelFailed',
              severity: 'error' as const,
              technicalMessage: 'Cancel rejected'
            }
          })
        )
    })
    const runtime = createAutomationRuntime({
      adapterRegistry: createAutomationAdapterRegistry([adapter]),
      runtimeBridge: createMdeRuntimeBridge({ appDataPath }),
      store
    })

    await store.initialize()
    await store.createRun({
      adapterSessionId: 'adapter-session-1',
      automationFlowId: 'flow-a',
      engine: 'codex',
      runId: 'run-cancel-rejected',
      runKind: 'task',
      state: 'running',
      taskId: 'task-a',
      workspaceRoot
    })

    await expect(runtime.cancelRun('run-cancel-rejected')).rejects.toMatchObject({
      diagnostic: {
        code: 'automationRun.cancelFailed'
      },
      runId: 'run-cancel-rejected'
    })
    await expect(store.getRun('run-cancel-rejected')).resolves.toMatchObject({
      state: 'running'
    })
  })
})
