import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { AUTOMATION_CHANNELS } from '../../src/main/ipc/channels'
import { registerAutomationHandlers } from '../../src/main/ipc/registerAutomationHandlers'
import { createAutomationAdapterRegistry } from '../../src/main/services/automation/automationAdapterRegistry'
import {
  createFakeAgentCliAdapter,
  type AgentCliAdapter,
  type AgentCliNormalizedEvent
} from '../../src/main/services/automation/agentCliAdapters'
import { createAutomationRuntime } from '../../src/main/services/automation/automationRuntime'
import { createAutomationStore } from '../../src/main/services/automation/automationStore'
import { createMdeRuntimeBridge } from '../../src/main/services/automation/mdeRuntimeBridge'
import { AUTOMATION_NO_WORKSPACE_ID } from '../../src/main/services/automation/automationProjectionFilters'

const createTempRoot = (prefix: string): Promise<string> =>
  mkdtemp(join(tmpdir(), prefix))

const createHandlers = async (
  options: {
    readonly appDataPath?: string
    readonly authenticated?: boolean
    readonly capabilities?: Parameters<typeof createFakeAgentCliAdapter>[0]['capabilities']
    readonly createId?: (prefix: string) => string
    readonly discoverySources?: Parameters<typeof createFakeAgentCliAdapter>[0]['discoverySources']
    readonly homePath?: string
    readonly resumeRunFailureMessage?: string
    readonly resumeRunImplementation?: AgentCliAdapter['resumeRun']
    readonly resumeRunEvents?: readonly AgentCliNormalizedEvent[]
    readonly startRunImplementation?: AgentCliAdapter['startRun']
    readonly taskRunEvents?: readonly AgentCliNormalizedEvent[]
    readonly workspaceRoot?: string
  } = {}
) => {
  const appDataPath = options.appDataPath ?? (await createTempRoot('mde-app-data-'))
  const homePath = options.homePath ?? (await createTempRoot('mde-home-'))
  const workspaceRoot =
    options.workspaceRoot ?? (await createTempRoot('mde-workspace-'))
  const store = createAutomationStore({ appDataPath })
  const fakeAdapter = createFakeAgentCliAdapter({
    authenticated: options.authenticated,
    capabilities: options.capabilities,
    commandPath: '/fake/bin/codex',
    discoverySources: options.discoverySources,
    engine: 'codex',
    resumeRunEvents: options.resumeRunEvents,
    taskRunEvents: options.taskRunEvents
  })
  const resumeRunFailureMessage = options.resumeRunFailureMessage
  const adapterWithResume: AgentCliAdapter =
    options.resumeRunImplementation !== undefined
      ? Object.freeze({
          ...fakeAdapter,
          resumeRun: options.resumeRunImplementation
        })
      : resumeRunFailureMessage === undefined
        ? fakeAdapter
        : Object.freeze({
            ...fakeAdapter,
            resumeRun() {
              return Promise.reject(new Error(resumeRunFailureMessage))
            }
          })
  const adapter: AgentCliAdapter =
    options.startRunImplementation === undefined
      ? adapterWithResume
      : Object.freeze({
          ...adapterWithResume,
          startRun: options.startRunImplementation
        })
  const adapterRegistry = createAutomationAdapterRegistry([
    adapter
  ])
  const runtime = createAutomationRuntime({
    adapterRegistry,
    createId: options.createId ?? ((prefix) => `${prefix}-ipc`),
    runtimeBridge: createMdeRuntimeBridge({ appDataPath }),
    store
  })
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  const ipcMain = {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    })
  }

  await store.initialize()
  registerAutomationHandlers({
    adapterRegistry,
    getActiveWorkspaceRoot: () => workspaceRoot,
    homePath,
    ipcMain,
    runtime,
    store
  })

  return { appDataPath, handlers, homePath, store, workspaceRoot }
}

describe('automationHandlers integration', () => {
  it('creates flow definitions, lists templates, projects tasks, and starts runs', async () => {
    const { handlers, workspaceRoot } = await createHandlers()

    await mkdir(join(workspaceRoot, '.mde', 'docs', 'tasks'), {
      recursive: true
    })
    await writeFile(
      join(workspaceRoot, '.mde', 'docs', 'tasks', 'ready.md'),
      '# READY Implement IPC\n'
    )

    const templates = (await handlers.get(AUTOMATION_CHANNELS.listTemplates)?.(
      {}
    )) as { templates: readonly { readonly templateId: string }[] }
    const created = (await handlers
      .get(AUTOMATION_CHANNELS.createFlowFromTemplate)
      ?.(
        {},
        {
          defaultEngine: 'codex',
          flowId: 'ipc-flow',
          scope: 'workspace',
          templateId: 'local-dev-task'
        }
      )) as { path: string }
    const projection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly tasks: readonly { readonly taskId: string }[]
      }
    }
    const capabilityReports = (await handlers
      .get(AUTOMATION_CHANNELS.listCapabilityReports)
      ?.({}, { workspaceRoot })) as { reports: readonly { readonly engine: string }[] }
    const startResult = (await handlers
      .get(AUTOMATION_CHANNELS.startRun)
      ?.({}, { taskId: projection.projection.tasks[0]?.taskId })) as {
      accepted: boolean
      runId?: string
    }
    const openNativeSession = (await handlers
      .get(AUTOMATION_CHANNELS.openNativeSession)
      ?.({}, { runId: startResult.runId })) as { accepted: boolean }

    expect(templates.templates.map((template) => template.templateId)).toContain(
      'local-dev-task'
    )
    expect(created.path).toContain('ipc-flow.md')
    expect(projection.projection.tasks).toHaveLength(1)
    expect(capabilityReports.reports).toMatchObject([{ engine: 'codex' }])
    expect(startResult).toMatchObject({
      accepted: true,
      runId: 'run-ipc'
    })
    expect(openNativeSession).toEqual({ accepted: true, runId: 'run-ipc' })
  })

  it('returns the existing run for duplicate start commands', async () => {
    const { handlers, store, workspaceRoot } = await createHandlers()

    await mkdir(join(workspaceRoot, '.mde', 'docs', 'tasks'), {
      recursive: true
    })
    await writeFile(
      join(workspaceRoot, '.mde', 'docs', 'tasks', 'ready.md'),
      '# READY Coordinate duplicate IPC\n'
    )
    await handlers.get(AUTOMATION_CHANNELS.createFlowFromTemplate)?.(
      {},
      {
        defaultEngine: 'codex',
        flowId: 'ipc-flow',
        scope: 'workspace',
        templateId: 'local-dev-task'
      }
    )
    const projection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly tasks: readonly { readonly taskId: string }[]
      }
    }
    const duplicateStarts = await Promise.all([
      handlers
        .get(AUTOMATION_CHANNELS.startRun)
        ?.({}, { taskId: projection.projection.tasks[0]?.taskId }),
      handlers
        .get(AUTOMATION_CHANNELS.startRun)
        ?.({}, { taskId: projection.projection.tasks[0]?.taskId })
    ]) as readonly { readonly accepted: boolean; readonly runId?: string }[]

    expect(duplicateStarts[0]).toEqual(duplicateStarts[1])
    await expect(store.listRuns()).resolves.toHaveLength(1)
  })

  it('returns diagnostics for missing adapter capabilities and unsafe definition paths', async () => {
    const { handlers, workspaceRoot } = await createHandlers({
      capabilities: { mdeRuntimeTools: false }
    })

    await mkdir(join(workspaceRoot, '.mde', 'automation-flows'), {
      recursive: true
    })
    await mkdir(join(workspaceRoot, '.mde', 'docs', 'tasks'), {
      recursive: true
    })
    await handlers.get(AUTOMATION_CHANNELS.createFlowFromTemplate)?.(
      {},
      {
        defaultEngine: 'codex',
        flowId: 'ipc-flow',
        scope: 'workspace',
        templateId: 'local-dev-task'
      }
    )
    await writeFile(
      join(workspaceRoot, '.mde', 'docs', 'tasks', 'ready.md'),
      '# READY Blocked IPC\n'
    )
    const projection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly diagnostics: readonly { readonly code: string }[]
        readonly tasks: readonly { readonly taskId: string }[]
      }
    }

    expect(projection.projection.tasks).toEqual([])
    expect(projection.projection.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'automationDiscovery.runCapabilityUnavailable'
      })
    )
    await expect(
      handlers
        .get(AUTOMATION_CHANNELS.setFlowLifecycle)
        ?.({}, { filePath: '/tmp/outside.md', lifecycle: 'disabled' })
    ).rejects.toThrow(/outside allowed definition roots/i)
  })

  it('persists normalized projection flow filters without changing flow rows', async () => {
    const { handlers, store, workspaceRoot } = await createHandlers()

    await mkdir(join(workspaceRoot, '.mde', 'docs', 'tasks'), {
      recursive: true
    })
    await writeFile(
      join(workspaceRoot, '.mde', 'docs', 'tasks', 'ready.md'),
      '# READY Filtered IPC\n'
    )
    await handlers.get(AUTOMATION_CHANNELS.createFlowFromTemplate)?.(
      {},
      {
        defaultEngine: 'codex',
        flowId: 'ipc-flow',
        scope: 'workspace',
        templateId: 'local-dev-task'
      }
    )

    await handlers
      .get(AUTOMATION_CHANNELS.updateFilters)
      ?.({}, { filters: { flowIds: ['missing-flow'] } })

    const filteredProjection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly filters: { readonly flowIds?: readonly string[] }
        readonly flows: readonly { readonly automationFlowId: string }[]
        readonly tasks: readonly { readonly taskId: string }[]
      }
    }

    expect(filteredProjection.projection.filters.flowIds).toEqual([])
    await expect(store.loadFilterState()).resolves.toMatchObject({
      flowIds: []
    })
    expect(filteredProjection.projection.tasks).toHaveLength(1)
    expect(filteredProjection.projection.flows).toEqual([
      expect.objectContaining({ automationFlowId: 'ipc-flow' })
    ])

    await handlers
      .get(AUTOMATION_CHANNELS.updateFilters)
      ?.({}, { filters: { flowIds: ['ipc-flow'] } })

    const selectedProjection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly tasks: readonly { readonly title: string }[]
      }
    }

    expect(selectedProjection.projection.tasks).toEqual([
      expect.objectContaining({ title: 'READY Filtered IPC' })
    ])
  })

  it('persists normalized workspace filters after stale workspace cleanup', async () => {
    const { handlers, store, workspaceRoot } = await createHandlers()

    await mkdir(join(workspaceRoot, '.mde', 'docs', 'tasks'), {
      recursive: true
    })
    await writeFile(
      join(workspaceRoot, '.mde', 'docs', 'tasks', 'ready.md'),
      '# READY Workspace Filtered IPC\n'
    )
    await handlers.get(AUTOMATION_CHANNELS.createFlowFromTemplate)?.(
      {},
      {
        defaultEngine: 'codex',
        flowId: 'workspace-ipc-flow',
        scope: 'workspace',
        templateId: 'local-dev-task'
      }
    )

    await handlers
      .get(AUTOMATION_CHANNELS.updateFilters)
      ?.({}, { filters: { workspaceIds: ['/stale-workspace'] } })

    const projection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly filters: { readonly workspaceIds?: readonly string[] }
        readonly tasks: readonly { readonly title: string }[]
      }
    }

    expect(projection.projection.filters.workspaceIds).toEqual([
      workspaceRoot,
      AUTOMATION_NO_WORKSPACE_ID
    ])
    expect(projection.projection.tasks).toEqual([
      expect.objectContaining({ title: 'READY Workspace Filtered IPC' })
    ])
    await expect(store.loadFilterState()).resolves.toMatchObject({
      workspaceIds: [workspaceRoot, AUTOMATION_NO_WORKSPACE_ID]
    })
  })

  it('projects user-global Ready tasks when only the no-workspace filter is selected', async () => {
    const { handlers, store, workspaceRoot } = await createHandlers()

    await handlers.get(AUTOMATION_CHANNELS.createFlowFromTemplate)?.(
      {},
      {
        defaultEngine: 'codex',
        flowId: 'research-flow',
        scope: 'user',
        templateId: 'research-and-notes'
      }
    )
    await store.replaceDiscoveredTaskSources('research-flow', [
      {
        automationFlowId: 'research-flow',
        discoveredAt: '2026-05-10T08:00:00.000Z',
        relativePath: 'research.md',
        sourceItemId: 'user-prompt:research.md',
        sourceSnapshotHash: 'user-prompt-hash',
        sourceType: 'user-prompt',
        tags: ['research'],
        title: 'READY Research global prompt'
      }
    ])

    const projection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.(
        {},
        {
          filters: {
            bucket: 'ready',
            workspaceIds: [AUTOMATION_NO_WORKSPACE_ID]
          },
          workspaceRoot
        }
      )) as {
      projection: {
        readonly tasks: readonly {
          readonly title: string
          readonly workspaceId?: string
        }[]
      }
    }

    expect(projection.projection.tasks).toEqual([
      expect.objectContaining({
        title: 'READY Research global prompt',
        workspaceId: AUTOMATION_NO_WORKSPACE_ID
      })
    ])
  })

  it('keeps discovered sources isolated for same-id flows in different workspaces', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const homePath = await createTempRoot('mde-home-')
    const workspaceA = await createTempRoot('mde-workspace-a-')
    const workspaceB = await createTempRoot('mde-workspace-b-')
    const first = await createHandlers({
      appDataPath,
      discoverySources: [
        {
          automationFlowId: 'shared-flow',
          discoveredAt: '2026-05-10T08:00:00.000Z',
          sourceItemId: 'same-source',
          sourceSnapshotHash: 'hash-a',
          sourceType: 'adapter-discovered',
          title: 'READY Workspace A task'
        }
      ],
      homePath,
      workspaceRoot: workspaceA
    })
    const second = await createHandlers({
      appDataPath,
      discoverySources: [
        {
          automationFlowId: 'shared-flow',
          discoveredAt: '2026-05-10T08:00:00.000Z',
          sourceItemId: 'same-source',
          sourceSnapshotHash: 'hash-b',
          sourceType: 'adapter-discovered',
          title: 'READY Workspace B task'
        }
      ],
      homePath,
      workspaceRoot: workspaceB
    })

    await first.handlers.get(AUTOMATION_CHANNELS.createFlowFromTemplate)?.(
      {},
      {
        defaultEngine: 'codex',
        flowId: 'shared-flow',
        scope: 'workspace',
        templateId: 'local-dev-task'
      }
    )
    await second.handlers.get(AUTOMATION_CHANNELS.createFlowFromTemplate)?.(
      {},
      {
        defaultEngine: 'codex',
        flowId: 'shared-flow',
        scope: 'workspace',
        templateId: 'local-dev-task'
      }
    )

    const firstProjection = (await first.handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot: workspaceA })) as {
      projection: {
        readonly tasks: readonly {
          readonly taskId: string
          readonly title: string
        }[]
      }
    }
    const secondProjection = (await second.handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot: workspaceB })) as {
      projection: {
        readonly tasks: readonly {
          readonly taskId: string
          readonly title: string
        }[]
      }
    }

    expect(firstProjection.projection.tasks).toEqual([
      expect.objectContaining({ title: 'READY Workspace A task' })
    ])
    expect(secondProjection.projection.tasks).toEqual([
      expect.objectContaining({ title: 'READY Workspace B task' })
    ])
    expect(firstProjection.projection.tasks[0]?.taskId).not.toBe(
      secondProjection.projection.tasks[0]?.taskId
    )
    await expect(second.store.listDiscoveredTaskSources()).resolves.toHaveLength(2)
  })

  it('ignores unproven legacy owner-less discovered sources for other workspaces after upgrade', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const homePath = await createTempRoot('mde-home-')
    const workspaceA = await createTempRoot('mde-workspace-a-')
    const workspaceB = await createTempRoot('mde-workspace-b-')
    const first = await createHandlers({
      appDataPath,
      homePath,
      workspaceRoot: workspaceA
    })
    const second = await createHandlers({
      appDataPath,
      discoverySources: [
        {
          automationFlowId: 'shared-flow',
          discoveredAt: '2026-05-10T08:01:00.000Z',
          sourceItemId: 'shared-source',
          sourceSnapshotHash: 'hash-b',
          sourceType: 'adapter-discovered',
          title: 'READY Workspace B fresh task',
          workspaceId: workspaceB
        }
      ],
      homePath,
      workspaceRoot: workspaceB
    })

    await first.handlers.get(AUTOMATION_CHANNELS.createFlowFromTemplate)?.(
      {},
      {
        defaultEngine: 'codex',
        flowId: 'shared-flow',
        scope: 'workspace',
        templateId: 'local-dev-task'
      }
    )
    await second.handlers.get(AUTOMATION_CHANNELS.createFlowFromTemplate)?.(
      {},
      {
        defaultEngine: 'codex',
        flowId: 'shared-flow',
        scope: 'workspace',
        templateId: 'local-dev-task'
      }
    )
    await first.store.replaceDiscoveredTaskSources('shared-flow', [
      {
        automationFlowId: 'shared-flow',
        discoveredAt: '2026-05-10T08:00:00.000Z',
        sourceItemId: 'shared-source',
        sourceSnapshotHash: 'hash-a',
        sourceType: 'adapter-discovered',
        title: 'READY Workspace A legacy task',
        workspaceId: workspaceA
      }
    ])

    const firstProjection = (await first.handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot: workspaceA })) as {
      projection: {
        readonly tasks: readonly { readonly title: string }[]
      }
    }
    const secondProjection = (await second.handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot: workspaceB })) as {
      projection: {
        readonly tasks: readonly { readonly title: string }[]
      }
    }
    const runs = await second.store.listRuns()

    expect(firstProjection.projection.tasks).toEqual([
      expect.objectContaining({ title: 'READY Workspace A legacy task' })
    ])
    expect(secondProjection.projection.tasks).toEqual([
      expect.objectContaining({ title: 'READY Workspace B fresh task' })
    ])
    expect(runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          automationFlowId: 'shared-flow',
          runKind: 'discovery',
          workspaceRoot: workspaceB
        })
      ])
    )
  })

  it('retries owner discovery after a failed historical discovery run recovers', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const homePath = await createTempRoot('mde-home-')
    const workspaceRoot = await createTempRoot('mde-workspace-')
    let idCounter = 0
    const createId = (prefix: string): string => `${prefix}-${idCounter++}`
    const first = await createHandlers({
      appDataPath,
      createId,
      homePath,
      startRunImplementation(input) {
        return Promise.resolve(Object.freeze({
          adapterSessionId: input.preferredAdapterSessionId,
          events: Object.freeze([
            Object.freeze({
              adapterSessionId: input.preferredAdapterSessionId,
              type: 'session-started'
            } satisfies AgentCliNormalizedEvent),
            Object.freeze({
              outcome: 'failed',
              summary: 'Authentication was not ready.',
              title: 'Discovery failed',
              type: 'final-report'
            } satisfies AgentCliNormalizedEvent)
          ])
        }))
      },
      workspaceRoot
    })

    await first.handlers.get(AUTOMATION_CHANNELS.createFlowFromTemplate)?.(
      {},
      {
        defaultEngine: 'codex',
        flowId: 'auth-retry-flow',
        scope: 'workspace',
        templateId: 'local-dev-task'
      }
    )

    const failedProjection = (await first.handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly tasks: readonly { readonly title: string }[]
      }
    }
    const failedRuns = await first.store.listRuns()

    expect(failedProjection.projection.tasks).toEqual([])
    expect(failedRuns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          automationFlowId: 'auth-retry-flow',
          runKind: 'discovery',
          state: 'failed',
          workspaceRoot
        })
      ])
    )

    const second = await createHandlers({
      appDataPath,
      createId,
      discoverySources: [
        {
          automationFlowId: 'auth-retry-flow',
          discoveredAt: '2026-05-10T08:00:00.000Z',
          sourceItemId: 'auth-retry-source',
          sourceSnapshotHash: 'auth-retry-hash',
          sourceType: 'adapter-discovered',
          title: 'READY Auth recovered task',
          workspaceId: workspaceRoot
        }
      ],
      homePath,
      workspaceRoot
    })
    const recoveredProjection = (await second.handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly tasks: readonly { readonly title: string }[]
      }
    }
    const recoveredRuns = await second.store.listRuns()

    expect(recoveredProjection.projection.tasks).toEqual([
      expect.objectContaining({ title: 'READY Auth recovered task' })
    ])
    const retryDiscoveryRuns = recoveredRuns.filter(
      (run) =>
        run.automationFlowId === 'auth-retry-flow' &&
        run.runKind === 'discovery'
    )

    expect(retryDiscoveryRuns).toHaveLength(2)
    expect(retryDiscoveryRuns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ state: 'failed' }),
        expect.objectContaining({ state: 'done' })
      ])
    )
  })

  it('returns a safe authentication diagnostic when Codex cannot start runs', async () => {
    const { handlers, store, workspaceRoot } = await createHandlers({
      authenticated: false
    })

    await handlers.get(AUTOMATION_CHANNELS.createFlowFromTemplate)?.(
      {},
      {
        defaultEngine: 'codex',
        flowId: 'auth-flow',
        scope: 'workspace',
        templateId: 'local-dev-task'
      }
    )
    await store.replaceDiscoveredTaskSources('auth-flow', [
      {
        automationFlowId: 'auth-flow',
        discoveredAt: '2026-05-10T08:00:00.000Z',
        sourceItemId: 'auth-source',
        sourceSnapshotHash: 'auth-hash',
        sourceType: 'adapter-discovered',
        title: 'READY Auth gated task',
        workspaceId: workspaceRoot
      }
    ])

    const projection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly tasks: readonly { readonly taskId: string }[]
      }
    }
    const startResult = (await handlers
      .get(AUTOMATION_CHANNELS.startRun)
      ?.({}, { taskId: projection.projection.tasks[0]?.taskId })) as {
      readonly accepted: boolean
      readonly diagnostic?: {
        readonly code: string
        readonly messageKey?: string
        readonly technicalMessage?: string
      }
    }

    expect(startResult).toMatchObject({
      accepted: false,
      diagnostic: {
        code: 'automationAdapter.authenticationRequired',
        messageKey: 'automation.diagnostics.automationAdapter.authenticationRequired'
      }
    })
    expect(startResult.diagnostic?.code).not.toBe(
      'automationAdapter.runCapabilityUnavailable'
    )
    expect(startResult.diagnostic?.technicalMessage).not.toContain(
      '/fake/bin/codex'
    )
  })

  it('keeps unsupported Codex setup diagnostics separate from authentication', async () => {
    const { handlers, store, workspaceRoot } = await createHandlers({
      capabilities: {
        mdeRuntimeTools: false,
        nonInteractiveRun: false,
        runScopedRuntimeAuthorization: false,
        structuredEventStream: false,
        workingDirectory: false
      }
    })

    await handlers.get(AUTOMATION_CHANNELS.createFlowFromTemplate)?.(
      {},
      {
        defaultEngine: 'codex',
        flowId: 'protocol-flow',
        scope: 'workspace',
        templateId: 'local-dev-task'
      }
    )
    await store.replaceDiscoveredTaskSources('protocol-flow', [
      {
        automationFlowId: 'protocol-flow',
        discoveredAt: '2026-05-10T08:00:00.000Z',
        sourceItemId: 'protocol-source',
        sourceSnapshotHash: 'protocol-hash',
        sourceType: 'adapter-discovered',
        title: 'READY Protocol gated task',
        workspaceId: workspaceRoot
      }
    ])

    const projection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly tasks: readonly { readonly taskId: string }[]
      }
    }
    const startResult = (await handlers
      .get(AUTOMATION_CHANNELS.startRun)
      ?.({}, { taskId: projection.projection.tasks[0]?.taskId })) as {
      readonly accepted: boolean
      readonly diagnostic?: {
        readonly code: string
        readonly messageKey?: string
      }
    }

    expect(startResult).toMatchObject({
      accepted: false,
      diagnostic: {
        code: 'automationAdapter.runCapabilityUnavailable',
        messageKey:
          'automation.diagnostics.automationAdapter.runCapabilityUnavailable'
      }
    })
    expect(startResult.diagnostic?.code).not.toBe(
      'automationAdapter.authenticationRequired'
    )
  })

  it('keeps user-global Done tasks visible under no-workspace-only filters', async () => {
    let idCounter = 0
    const { handlers, store, workspaceRoot } = await createHandlers({
      createId: (prefix) => {
        idCounter += 1

        return `${prefix}-global-${idCounter}`
      },
      taskRunEvents: [
        {
          outcome: 'succeeded',
          summary: 'Global prompt completed',
          title: 'READY Complete global prompt',
          type: 'final-report'
        }
      ]
    })

    await handlers.get(AUTOMATION_CHANNELS.createFlowFromTemplate)?.(
      {},
      {
        defaultEngine: 'codex',
        flowId: 'research-flow',
        scope: 'user',
        templateId: 'research-and-notes'
      }
    )
    await store.replaceDiscoveredTaskSources('research-flow', [
      {
        automationFlowId: 'research-flow',
        discoveredAt: '2026-05-10T08:00:00.000Z',
        relativePath: 'research.md',
        sourceItemId: 'user-prompt:research.md',
        sourceSnapshotHash: 'user-prompt-hash',
        sourceType: 'user-prompt',
        tags: ['research'],
        title: 'READY Complete global prompt'
      }
    ])

    const readyProjection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.(
        {},
        {
          filters: {
            bucket: 'ready',
            workspaceIds: [AUTOMATION_NO_WORKSPACE_ID]
          },
          workspaceRoot
        }
      )) as {
      projection: {
        readonly tasks: readonly { readonly taskId: string }[]
      }
    }

    await handlers
      .get(AUTOMATION_CHANNELS.startRun)
      ?.({}, { taskId: readyProjection.projection.tasks[0]?.taskId })
    await store.replaceDiscoveredTaskSources('research-flow', [])

    const doneProjection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.(
        {},
        {
          filters: {
            bucket: 'done',
            workspaceIds: [AUTOMATION_NO_WORKSPACE_ID]
          },
          workspaceRoot
        }
      )) as {
      projection: {
        readonly tasks: readonly {
          readonly bucket: string
          readonly title: string
          readonly workspaceId?: string
        }[]
      }
    }

    expect(doneProjection.projection.tasks).toEqual([
      expect.objectContaining({
        bucket: 'done',
        title: 'READY Complete global prompt',
        workspaceId: AUTOMATION_NO_WORKSPACE_ID
      })
    ])
  })

  it('validates template inputs and accepts decision responses', async () => {
    const { handlers, workspaceRoot } = await createHandlers({
      capabilities: { autonomyGate: false }
    })

    await mkdir(join(workspaceRoot, '.mde', 'docs', 'tasks'), {
      recursive: true
    })
    await writeFile(
      join(workspaceRoot, '.mde', 'docs', 'tasks', 'ready.md'),
      '# READY Needs approval\n'
    )

    expect(
      handlers.get(AUTOMATION_CHANNELS.validateTemplateInput)?.(
        {},
        {
          defaultEngine: 'codex',
          flowId: '',
          scope: 'workspace',
          templateId: 'local-dev-task'
        }
      )
    ).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: 'automationFlowTemplate.invalidFlowId'
        }
      ]
    })
    await handlers.get(AUTOMATION_CHANNELS.createFlowFromTemplate)?.(
      {},
      {
        defaultEngine: 'codex',
        flowId: 'approval-flow',
        scope: 'workspace',
        templateId: 'local-dev-task'
      }
    )
    const projection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly tasks: readonly { readonly taskId: string }[]
      }
    }
    const startResult = (await handlers
      .get(AUTOMATION_CHANNELS.startRun)
      ?.({}, { taskId: projection.projection.tasks[0]?.taskId })) as {
      decisionId?: string
    }

    await expect(
      handlers.get(AUTOMATION_CHANNELS.submitDecision)?.(
        {},
        {
          decisionId: startResult.decisionId,
          response: 'approved'
        }
      )
    ).resolves.toEqual({
      accepted: true,
      decisionId: 'decision-ipc',
      runId: 'run-ipc'
    })
  })

  it('keeps a decision retryable when submit cannot start adapter resume', async () => {
    const { handlers, store, workspaceRoot } = await createHandlers({
      resumeRunFailureMessage: 'Codex resume could not start.',
      taskRunEvents: [
        {
          prompt: 'Approve before applying changes.',
          type: 'decision-required'
        }
      ]
    })

    await mkdir(join(workspaceRoot, '.mde', 'docs', 'tasks'), {
      recursive: true
    })
    await writeFile(
      join(workspaceRoot, '.mde', 'docs', 'tasks', 'ready.md'),
      '# READY Needs approval\n'
    )
    await handlers.get(AUTOMATION_CHANNELS.createFlowFromTemplate)?.(
      {},
      {
        defaultEngine: 'codex',
        flowId: 'approval-flow',
        scope: 'workspace',
        templateId: 'local-dev-task'
      }
    )
    const projection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly tasks: readonly { readonly taskId: string }[]
      }
    }
    const startResult = (await handlers
      .get(AUTOMATION_CHANNELS.startRun)
      ?.({}, { taskId: projection.projection.tasks[0]?.taskId })) as {
      decisionId?: string
      runId?: string
    }

    const submitResult = (await handlers
      .get(AUTOMATION_CHANNELS.submitDecision)
      ?.(
        {},
        {
          decisionId: startResult.decisionId,
          response: 'approved'
        }
      )) as {
      accepted: boolean
      diagnostic?: { readonly code: string; readonly technicalMessage?: string }
      runId?: string
    }

    expect(submitResult).toMatchObject({
      accepted: false,
      diagnostic: {
        code: 'automationRun.resumeFailed',
        technicalMessage: 'Codex resume could not start.'
      },
      runId: startResult.runId
    })
    const decisions = await store.listDecisions()

    expect(decisions).toMatchObject([
      {
        decisionId: startResult.decisionId,
        status: 'pending'
      }
    ])
    expect(decisions[0]?.response).toBeUndefined()
    const runs = await store.listRuns()

    expect(runs.find((run) => run.runId === startResult.runId)).toMatchObject({
      runId: startResult.runId,
      state: 'needs-me'
    })
  })

  it('returns a command diagnostic when direct resume cannot start the adapter', async () => {
    const { handlers, store, workspaceRoot } = await createHandlers({
      resumeRunFailureMessage: 'Codex direct resume could not start.'
    })

    await store.createRun({
      adapterSessionId: 'session-direct-resume',
      automationFlowId: 'resume-flow',
      engine: 'codex',
      runId: 'run-direct-resume',
      runKind: 'task',
      state: 'failed',
      taskId: 'task-direct-resume',
      workspaceRoot
    })

    await expect(
      handlers
        .get(AUTOMATION_CHANNELS.resumeRun)
        ?.({}, { runId: 'run-direct-resume' })
    ).resolves.toMatchObject({
      accepted: false,
      diagnostic: {
        code: 'automationRun.resumeFailed',
        technicalMessage: 'Codex direct resume could not start.'
      },
      runId: 'run-direct-resume'
    })
  })

  it('rejects a second decision submit while the first resume is claimed', async () => {
    let resumeStarted: (() => void) | undefined
    let releaseResume: (() => void) | undefined
    const resumeStartedPromise = new Promise<void>((resolve) => {
      resumeStarted = resolve
    })
    const releaseResumePromise = new Promise<void>((resolve) => {
      releaseResume = resolve
    })
    const resumeRun = vi.fn<AgentCliAdapter['resumeRun']>(async (input) => {
      resumeStarted?.()
      await releaseResumePromise

      return Object.freeze({
        adapterSessionId: input.adapterSessionId,
        events: Object.freeze([
          Object.freeze({
            adapterSessionId: input.adapterSessionId,
            type: 'session-started'
          })
        ])
      })
    })
    const { handlers, store, workspaceRoot } = await createHandlers({
      resumeRunImplementation: resumeRun,
      taskRunEvents: [
        {
          prompt: 'Approve before applying changes.',
          type: 'decision-required'
        }
      ]
    })

    await mkdir(join(workspaceRoot, '.mde', 'docs', 'tasks'), {
      recursive: true
    })
    await writeFile(
      join(workspaceRoot, '.mde', 'docs', 'tasks', 'ready.md'),
      '# READY Needs one resume\n'
    )
    await handlers.get(AUTOMATION_CHANNELS.createFlowFromTemplate)?.(
      {},
      {
        defaultEngine: 'codex',
        flowId: 'approval-flow',
        scope: 'workspace',
        templateId: 'local-dev-task'
      }
    )
    const projection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly tasks: readonly { readonly taskId: string }[]
      }
    }
    const startResult = (await handlers
      .get(AUTOMATION_CHANNELS.startRun)
      ?.({}, { taskId: projection.projection.tasks[0]?.taskId })) as {
      decisionId?: string
      runId?: string
    }
    const firstSubmit = handlers.get(AUTOMATION_CHANNELS.submitDecision)?.(
      {},
      {
        decisionId: startResult.decisionId,
        response: 'approved'
      }
    ) as Promise<{ readonly accepted: boolean; readonly runId?: string }>

    await resumeStartedPromise

    const secondSubmit = (await handlers
      .get(AUTOMATION_CHANNELS.submitDecision)
      ?.(
        {},
        {
          decisionId: startResult.decisionId,
          response: 'approved'
        }
      )) as {
      accepted: boolean
      diagnostic?: { readonly code: string }
      runId?: string
    }

    expect(secondSubmit).toMatchObject({
      accepted: false,
      diagnostic: { code: 'automationRun.decisionUnavailable' },
      runId: startResult.runId
    })
    releaseResume?.()
    await expect(firstSubmit).resolves.toMatchObject({
      accepted: true,
      runId: startResult.runId
    })
    expect(resumeRun).toHaveBeenCalledTimes(1)
    await expect(store.listDecisions()).resolves.toMatchObject([
      {
        decisionId: startResult.decisionId,
        response: 'approved',
        status: 'approved'
      }
    ])
  })

  it('resumes a paused run when a decision is submitted and keeps the completed task visible for the default workspace scope', async () => {
    let idCounter = 0
    const { handlers, store, workspaceRoot } = await createHandlers({
      createId: (prefix) => {
        idCounter += 1

        return `${prefix}-ipc-${idCounter}`
      },
      resumeRunEvents: [
        {
          outcome: 'succeeded',
          summary: 'Approved and completed',
          title: 'READY Needs approval',
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

    await mkdir(join(workspaceRoot, '.mde', 'docs', 'tasks'), {
      recursive: true
    })
    await writeFile(
      join(workspaceRoot, '.mde', 'docs', 'tasks', 'ready.md'),
      '# READY Needs approval\n'
    )
    await handlers.get(AUTOMATION_CHANNELS.createFlowFromTemplate)?.(
      {},
      {
        defaultEngine: 'codex',
        flowId: 'approval-flow',
        scope: 'workspace',
        templateId: 'local-dev-task'
      }
    )
    const projection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly tasks: readonly { readonly taskId: string }[]
      }
    }
    const startResult = (await handlers
      .get(AUTOMATION_CHANNELS.startRun)
      ?.({}, { taskId: projection.projection.tasks[0]?.taskId })) as {
      decisionId?: string
      runId?: string
    }

    const submitResult = (await handlers
      .get(AUTOMATION_CHANNELS.submitDecision)
      ?.(
        {},
        {
          decisionId: startResult.decisionId,
          response: 'approved'
        }
      )) as { accepted: boolean; runId?: string }

    await store.replaceDiscoveredTaskSources('approval-flow', [])

    const doneProjection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { filters: { bucket: 'done' }, workspaceRoot })) as {
      projection: {
        readonly tasks: readonly {
          readonly bucket: string
          readonly taskId: string
          readonly workspaceId?: string
        }[]
      }
    }

    expect(submitResult).toMatchObject({
      accepted: true,
      runId: startResult.runId
    })
    await expect(store.listReports()).resolves.toMatchObject([
      {
        outcome: 'succeeded',
        runId: startResult.runId,
        title: 'READY Needs approval'
      }
    ])
    await expect(store.listDecisions()).resolves.toMatchObject([
      {
        decisionId: startResult.decisionId,
        response: 'approved',
        status: 'approved'
      }
    ])
    const runs = await store.listRuns()

    expect(runs.find((run) => run.runId === startResult.runId)).toMatchObject({
      runId: startResult.runId,
      state: 'done'
    })
    expect(doneProjection.projection.tasks).toEqual([
      expect.objectContaining({
        bucket: 'done',
        taskId: projection.projection.tasks[0]?.taskId,
        workspaceId: workspaceRoot
      })
    ])
  })
})
