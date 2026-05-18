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
import { createFakeAgentCliAdapter } from '../../src/main/services/automation/agentCliAdapters'
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
    acceptanceStandard: 'Accept.',
    executionStandard: '- Start\n- Verify',
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
  title: 'READY Coordinate run',
  ...overrides
})

const createExecutor = (
  overrides: Partial<AutomationFlowExecutorRef> = {}
): AutomationFlowExecutorRef => ({
  autoDiscovered: false,
  diagnostics: [],
  displayName: 'Executor A',
  enabled: true,
  executorId: 'executor-a',
  executorSnapshotId: 'executor-snapshot-a',
  handles: {
    sourceTypes: ['workspace-markdown']
  },
  order: 0,
  tags: [],
  type: 'skill',
  ...overrides
})

describe('automation runtime coordination integration', () => {
  it('returns one active run for duplicate starts and releases after terminal completion', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const store = createAutomationStore({ appDataPath })
    let idCounter = 0
    const runtime = createAutomationRuntime({
      adapterRegistry: createAutomationAdapterRegistry([
        createFakeAgentCliAdapter({
          commandPath: '/fake/bin/codex',
          engine: 'codex'
        })
      ]),
      createId: (prefix) => `${prefix}-${(idCounter += 1)}`,
      profileId: appDataPath,
      runtimeBridge: createMdeRuntimeBridge({ appDataPath }),
      store
    })

    await store.initialize()

    const duplicateStarts = await Promise.all([
      runtime.startRun({
        automationFlow: createFlow(),
        candidate: createCandidate(workspaceRoot),
        executorSnapshot: createExecutor(),
        workspaceRoot
      }),
      runtime.startRun({
        automationFlow: createFlow(),
        candidate: createCandidate(workspaceRoot),
        executorSnapshot: createExecutor(),
        workspaceRoot
      })
    ])

    expect(duplicateStarts[0]?.runId).toBe(duplicateStarts[1]?.runId)
    await expect(store.listRuns()).resolves.toHaveLength(1)

    await runtime.completeRun({
      outcome: 'succeeded',
      runId: duplicateStarts[0].runId,
      title: 'READY Coordinate run'
    })

    const nextRun = await runtime.startRun({
      automationFlow: createFlow(),
      candidate: createCandidate(workspaceRoot),
      executorSnapshot: createExecutor(),
      workspaceRoot
    })

    expect(nextRun.runId).not.toBe(duplicateStarts[0].runId)
    await expect(store.listRuns()).resolves.toHaveLength(2)
  })

  it('keeps recoverable and Needs me runs locked across runtime instances', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const store = createAutomationStore({ appDataPath })
    const registry = createAutomationAdapterRegistry([
      createFakeAgentCliAdapter({
        capabilities: { autonomyGate: false },
        commandPath: '/fake/bin/codex',
        engine: 'codex'
      })
    ])
    const firstRuntime = createAutomationRuntime({
      adapterRegistry: registry,
      createId: (prefix) => `${prefix}-first`,
      profileId: appDataPath,
      runtimeBridge: createMdeRuntimeBridge({ appDataPath }),
      store
    })
    const secondRuntime = createAutomationRuntime({
      adapterRegistry: registry,
      createId: (prefix) => `${prefix}-second`,
      profileId: appDataPath,
      runtimeBridge: createMdeRuntimeBridge({ appDataPath }),
      store
    })

    await store.initialize()

    const needsMe = await firstRuntime.startRun({
      automationFlow: createFlow(),
      candidate: createCandidate(workspaceRoot),
      executorSnapshot: createExecutor(),
      workspaceRoot
    })
    const duplicateNeedsMe = await secondRuntime.startRun({
      automationFlow: createFlow(),
      candidate: createCandidate(workspaceRoot),
      executorSnapshot: createExecutor(),
      workspaceRoot
    })

    expect(duplicateNeedsMe.runId).toBe(needsMe.runId)
    await store.updateRunState(needsMe.runId, {
      recoverable: true,
      state: 'failed'
    })

    const recoverableDuplicate = await secondRuntime.startRun({
      automationFlow: createFlow(),
      candidate: createCandidate(workspaceRoot),
      executorSnapshot: createExecutor(),
      workspaceRoot
    })

    expect(recoverableDuplicate.runId).toBe(needsMe.runId)
    await expect(store.listRuns()).resolves.toHaveLength(1)
  })

  it('does not reuse active runs for different executor or task-data snapshots', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const store = createAutomationStore({ appDataPath })
    let idCounter = 0
    const runtime = createAutomationRuntime({
      adapterRegistry: createAutomationAdapterRegistry([
        createFakeAgentCliAdapter({
          commandPath: '/fake/bin/codex',
          engine: 'codex'
        })
      ]),
      createId: (prefix) => `${prefix}-${(idCounter += 1)}`,
      profileId: appDataPath,
      runtimeBridge: createMdeRuntimeBridge({ appDataPath }),
      store
    })

    await store.initialize()

    const firstRun = await runtime.startRun({
      automationFlow: createFlow(),
      candidate: createCandidate(workspaceRoot, {
        taskDataId: 'task-data-a',
        taskDataSnapshotId: 'task-data-snapshot-a'
      }),
      executorSnapshot: createExecutor({
        executorId: 'executor-a',
        executorSnapshotId: 'executor-snapshot-a'
      }),
      workspaceRoot
    })
    const differentExecutorRun = await runtime.startRun({
      automationFlow: createFlow(),
      candidate: createCandidate(workspaceRoot, {
        taskDataId: 'task-data-a',
        taskDataSnapshotId: 'task-data-snapshot-a'
      }),
      executorSnapshot: createExecutor({
        executorId: 'executor-b',
        executorSnapshotId: 'executor-snapshot-b'
      }),
      workspaceRoot
    })
    const newerTaskDataRun = await runtime.startRun({
      automationFlow: createFlow(),
      candidate: createCandidate(workspaceRoot, {
        taskDataId: 'task-data-a',
        taskDataSnapshotId: 'task-data-snapshot-b'
      }),
      executorSnapshot: createExecutor({
        executorId: 'executor-a',
        executorSnapshotId: 'executor-snapshot-a'
      }),
      workspaceRoot
    })

    expect(differentExecutorRun.runId).not.toBe(firstRun.runId)
    expect(newerTaskDataRun.runId).not.toBe(firstRun.runId)
    await expect(store.listRuns()).resolves.toHaveLength(3)
  })
})
