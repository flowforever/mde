import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { AUTOMATION_CHANNELS } from '../../src/main/ipc/channels'
import { registerAutomationHandlers } from '../../src/main/ipc/registerAutomationHandlers'
import { createAutomationAdapterRegistry } from '../../src/main/services/automation/automationAdapterRegistry'
import { createFakeAgentCliAdapter } from '../../src/main/services/automation/agentCliAdapters'
import { createAutomationRuntime } from '../../src/main/services/automation/automationRuntime'
import { createAutomationStore } from '../../src/main/services/automation/automationStore'
import { createMdeRuntimeBridge } from '../../src/main/services/automation/mdeRuntimeBridge'

const createTempRoot = (prefix: string): Promise<string> =>
  mkdtemp(join(tmpdir(), prefix))

const createHandlers = async (
  options: {
    readonly appDataPath?: string
    readonly capabilities?: Parameters<typeof createFakeAgentCliAdapter>[0]['capabilities']
    readonly homePath?: string
    readonly workspaceRoot?: string
  } = {}
) => {
  const appDataPath = options.appDataPath ?? (await createTempRoot('mde-app-data-'))
  const homePath = options.homePath ?? (await createTempRoot('mde-home-'))
  const workspaceRoot =
    options.workspaceRoot ?? (await createTempRoot('mde-workspace-'))
  const store = createAutomationStore({ appDataPath })
  const adapterRegistry = createAutomationAdapterRegistry([
    createFakeAgentCliAdapter({
      capabilities: options.capabilities,
      commandPath: '/fake/bin/codex',
      engine: 'codex'
    })
  ])
  const runtime = createAutomationRuntime({
    adapterRegistry,
    createId: (prefix) => `${prefix}-ipc`,
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

  it('persists projection flow filters without changing flow rows', async () => {
    const { handlers, workspaceRoot } = await createHandlers()

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
      ?.({}, { filters: { flowId: 'missing-flow' } })

    const filteredProjection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly filters: { readonly flowId?: string }
        readonly flows: readonly { readonly automationFlowId: string }[]
        readonly tasks: readonly { readonly taskId: string }[]
      }
    }

    expect(filteredProjection.projection.filters.flowId).toBe('missing-flow')
    expect(filteredProjection.projection.tasks).toHaveLength(0)
    expect(filteredProjection.projection.flows).toEqual([
      expect.objectContaining({ automationFlowId: 'ipc-flow' })
    ])

    await handlers
      .get(AUTOMATION_CHANNELS.updateFilters)
      ?.({}, { filters: { flowId: 'ipc-flow' } })

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
})
