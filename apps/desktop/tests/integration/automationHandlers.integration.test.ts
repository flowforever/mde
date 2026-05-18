import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
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
import {
  createAppliedGlobalFlowOwnerKey,
  createGlobalFlowOwnerKey,
  createWorkspaceFlowOwnerKey
} from '../../src/main/services/automation/automationFlowOwnerIdentity'

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
    readonly repoRoot?: string
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
  const repoRoot = options.repoRoot ?? (await createTempRoot('mde-repo-'))
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
    repoRoot,
    runtime,
    store
  })

  return { appDataPath, handlers, homePath, repoRoot, store, workspaceRoot }
}

const createWorkspaceExecutorDraft = async (
  handlers: Map<string, (...args: unknown[]) => unknown>,
  flowId: string
): Promise<void> => {
  await handlers.get(AUTOMATION_CHANNELS.createExecutorDraft)?.(
    {},
    {
      displayName: 'Implementation',
      executorId: 'implementation',
      flowId
    }
  )
}

const createUserExecutorDraft = async (
  homePath: string,
  flowId: string
): Promise<void> => {
  const executorRoot = join(homePath, '.mde', 'automation-flows', flowId)

  await mkdir(executorRoot, { recursive: true })
  await writeFile(
    join(executorRoot, 'implementation.md'),
    '# Implementation\n\nRun selected task data and report verification.\n'
  )
}

const createSkillBackedFlow = async ({
  flowId,
  skillRef,
  workspaceRoot
}: {
  readonly flowId: string
  readonly skillRef: string
  readonly workspaceRoot: string
}): Promise<void> => {
  const flowRoot = join(workspaceRoot, '.mde', 'automation-flows')

  await mkdir(flowRoot, { recursive: true })
  await writeFile(
    join(flowRoot, `${flowId}.md`),
    `---
id: ${flowId}
name: Skill Flow
status: formal
scope: workspace
sourceTypes:
  - workspace-markdown
loopPolicy:
  mode: manual
allowedEngines:
  - codex
defaultEngine: codex
reportPattern: report
executors:
  - id: execute-picked-task
    type: skill
    ref: ${skillRef}
    enabled: true
---

# Skill Flow

## Pick Rules

Pick ready local Markdown task files.

## Execution Standard

Follow the selected skill.

## Acceptance Standard

The task is complete.

## Verification Expectations

Run focused tests.

## Report Pattern

Report changed files and verification.
`,
    'utf8'
  )
}

describe('automationHandlers integration', () => {
  it('creates, renames, and deletes global automation-flow executors from the global root', async () => {
    const { handlers, homePath } = await createHandlers()

    const createdFlow = (await handlers
      .get(AUTOMATION_CHANNELS.createFlowDraft)
      ?.({}, {
        displayName: 'Global Review',
        flowId: 'global-review',
        scope: 'user'
      })) as { readonly path: string }
    const createdExecutor = (await handlers
      .get(AUTOMATION_CHANNELS.createExecutorDraft)
      ?.({}, {
        displayName: 'Global Implementation',
        executorId: 'implementation',
        flowId: 'global-review',
        scope: 'user'
      })) as { readonly path: string }

    expect(createdFlow.path).toBe(
      join(homePath, '.mde', 'automation-flows', 'global-review.md')
    )
    expect(createdExecutor.path).toBe(
      join(
        homePath,
        '.mde',
        'automation-flows',
        'global-review',
        'implementation.md'
      )
    )

    await handlers.get(AUTOMATION_CHANNELS.renameFlow)?.(
      {},
      {
        filePath: createdFlow.path,
        name: 'Renamed Global Review'
      }
    )

    await expect(readFile(createdFlow.path, 'utf8')).resolves.toContain(
      'name: Renamed Global Review'
    )

    await handlers.get(AUTOMATION_CHANNELS.deleteFlow)?.(
      {},
      { filePath: createdFlow.path }
    )

    await expect(access(createdFlow.path)).rejects.toThrow()
    await expect(access(createdExecutor.path)).rejects.toThrow()
  })

  it('keeps Explorer automation projection refresh read-only', async () => {
    const startRunImplementation = vi.fn()
    const { handlers, workspaceRoot } = await createHandlers({
      startRunImplementation
    })

    await handlers.get(AUTOMATION_CHANNELS.createFlowFromTemplate)?.(
      {},
      {
        defaultEngine: 'codex',
        flowId: 'explorer-flow',
        scope: 'workspace',
        templateId: 'local-dev-task'
      }
    )

    const projection = (await handlers
      .get(AUTOMATION_CHANNELS.getExplorerAutomationProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly flows: readonly { readonly id: string }[]
      }
    }

    expect(projection.projection.flows).toContainEqual(
      expect.objectContaining({ id: 'explorer-flow' })
    )
    expect(startRunImplementation).not.toHaveBeenCalled()
  })

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
    await createWorkspaceExecutorDraft(handlers, 'ipc-flow')
    const projection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly runs: readonly {
          readonly discoveryResult?: {
            readonly sourceCount: number
            readonly sources: readonly {
              readonly relativePath?: string
              readonly title: string
            }[]
          }
          readonly processSteps?: readonly {
            readonly sourceCount?: number
            readonly type: string
          }[]
          readonly runKind: string
          readonly title?: string
        }[]
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
    const runProjection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly runs: readonly {
          readonly automationFlowOwnerKey?: string
          readonly availableActions?: readonly string[]
          readonly discoveryResult?: {
            readonly sourceCount: number
            readonly sources: readonly {
              readonly relativePath?: string
              readonly title: string
            }[]
          }
          readonly processSteps?: readonly {
            readonly sourceCount?: number
            readonly type: string
          }[]
          readonly runId: string
          readonly runKind: string
          readonly title?: string
          readonly workspaceId?: string
        }[]
      }
    }

    expect(templates.templates.map((template) => template.templateId)).toContain(
      'local-dev-task'
    )
    expect(created.path).toContain('ipc-flow.md')
    expect(projection.projection.tasks).toHaveLength(1)
    const discoveryRun = projection.projection.runs.find(
      (run) => run.runKind === 'discovery'
    )

    expect(discoveryRun).toMatchObject({
      discoveryResult: {
        sourceCount: 1,
      sources: [
        {
          relativePath: '.mde/docs/tasks/ready.md',
          title: 'READY Implement IPC'
        }
      ]
    },
      title: 'Local Dev Task Automation Flow discovery'
    })
    expect(discoveryRun?.processSteps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'started' }),
        expect.objectContaining({
          sourceCount: 1,
          type: 'discovered-task-sources'
        }),
        expect.objectContaining({ type: 'state-updated' })
      ])
    )
    expect(capabilityReports.reports).toMatchObject([{ engine: 'codex' }])
    expect(startResult).toMatchObject({
      accepted: true,
      runId: 'run-ipc'
    })
    const runSummary = runProjection.projection.runs.find(
      (run) => run.runId === 'run-ipc'
    )

    expect(runSummary).toMatchObject({
      automationFlowOwnerKey: createWorkspaceFlowOwnerKey({
        flowId: 'ipc-flow',
        workspaceId: workspaceRoot
      }),
      runId: 'run-ipc',
      title: 'READY Implement IPC',
      workspaceId: workspaceRoot
    })
    expect(runSummary?.availableActions).toContain('open-native-session')
    expect(openNativeSession).toEqual({ accepted: true, runId: 'run-ipc' })
  })

  it('omits native-session run action when the adapter cannot open one', async () => {
    const { handlers, workspaceRoot } = await createHandlers({
      capabilities: {
        openNativeSession: false
      }
    })

    await mkdir(join(workspaceRoot, '.mde', 'docs', 'tasks'), {
      recursive: true
    })
    await writeFile(
      join(workspaceRoot, '.mde', 'docs', 'tasks', 'ready.md'),
      '# READY Implement unsupported native session\n'
    )
    await handlers.get(AUTOMATION_CHANNELS.createFlowFromTemplate)?.(
      {},
      {
        defaultEngine: 'codex',
        flowId: 'no-native-session-flow',
        scope: 'workspace',
        templateId: 'local-dev-task'
      }
    )
    await createWorkspaceExecutorDraft(handlers, 'no-native-session-flow')
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
      accepted: boolean
      runId?: string
    }
    const runProjection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly runs: readonly {
          readonly availableActions?: readonly string[]
          readonly runId: string
        }[]
      }
    }
    const openNativeSession = (await handlers
      .get(AUTOMATION_CHANNELS.openNativeSession)
      ?.({}, { runId: startResult.runId })) as {
      accepted: boolean
      diagnostic?: { readonly code: string }
      runId?: string
    }

    expect(startResult).toMatchObject({
      accepted: true,
      runId: 'run-ipc'
    })
    expect(runProjection.projection.runs).toContainEqual(
      expect.objectContaining({
        availableActions: [],
        runId: 'run-ipc'
      })
    )
    expect(openNativeSession).toMatchObject({
      accepted: false,
      diagnostic: { code: 'automationRun.nativeSessionUnavailable' },
      runId: 'run-ipc'
    })
  })

  it('loads Markdown executor source content into runtime prompts', async () => {
    let latestPrompt = ''
    const { handlers, store, workspaceRoot } = await createHandlers({
      startRunImplementation(input) {
        latestPrompt = input.promptBundle

        return Promise.resolve(Object.freeze({
          adapterSessionId: input.preferredAdapterSessionId,
          events: Object.freeze([
            Object.freeze({
              adapterSessionId: input.preferredAdapterSessionId,
              type: 'session-started'
            } satisfies AgentCliNormalizedEvent)
          ])
        }))
      }
    })

    await handlers.get(AUTOMATION_CHANNELS.createFlowFromTemplate)?.(
      {},
      {
        defaultEngine: 'codex',
        flowId: 'markdown-flow',
        scope: 'workspace',
        templateId: 'local-dev-task'
      }
    )
    await createWorkspaceExecutorDraft(handlers, 'markdown-flow')
    await writeFile(
      join(
        workspaceRoot,
        '.mde',
        'automation-flows',
        'markdown-flow',
        'implementation.md'
      ),
      '# Implementation\n\nUse Markdown executor runtime steps.'
    )

    const ownerKey = createWorkspaceFlowOwnerKey({
      flowId: 'markdown-flow',
      workspaceId: workspaceRoot
    })
    await store.replaceDiscoveredTaskSources(
      'markdown-flow',
      [
        {
          automationFlowId: 'markdown-flow',
          automationFlowOwnerKey: ownerKey,
          discoveredAt: '2026-05-10T08:00:00.000Z',
          sourceItemId: 'markdown-source',
          sourceSnapshotHash: 'markdown-source-hash',
          sourceType: 'workspace-markdown',
          title: 'READY Markdown-backed task',
          workspaceId: workspaceRoot
        }
      ],
      ownerKey
    )

    const projection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly tasks: readonly {
          readonly primaryExecutor?: {
            readonly executorId: string
            readonly executorSnapshotId?: string
          }
          readonly taskId: string
        }[]
      }
    }

    await expect(
      handlers.get(AUTOMATION_CHANNELS.startRun)?.(
        {},
        {
          executorId:
            projection.projection.tasks[0]?.primaryExecutor?.executorId,
          executorSnapshotId:
            projection.projection.tasks[0]?.primaryExecutor?.executorSnapshotId,
          taskId: projection.projection.tasks[0]?.taskId
        }
      )
    ).resolves.toMatchObject({ accepted: true })

    expect(latestPrompt).toContain('Use Markdown executor runtime steps.')
  })

  it('starts safely owned legacy owner-less task sources with current owner executors', async () => {
    const workspaceRoot = await createTempRoot('mde-workspace-')
    let latestPrompt = ''
    const { handlers, store } = await createHandlers({
      startRunImplementation(input) {
        latestPrompt = input.promptBundle

        return Promise.resolve(Object.freeze({
          adapterSessionId: input.preferredAdapterSessionId,
          events: Object.freeze([
            Object.freeze({
              adapterSessionId: input.preferredAdapterSessionId,
              type: 'session-started'
            } satisfies AgentCliNormalizedEvent)
          ])
        }))
      },
      workspaceRoot
    })

    await handlers.get(AUTOMATION_CHANNELS.createFlowFromTemplate)?.(
      {},
      {
        defaultEngine: 'codex',
        flowId: 'legacy-flow',
        scope: 'workspace',
        templateId: 'local-dev-task'
      }
    )
    await createWorkspaceExecutorDraft(handlers, 'legacy-flow')
    await store.replaceDiscoveredTaskSources('legacy-flow', [
      {
        automationFlowId: 'legacy-flow',
        discoveredAt: '2026-05-10T08:00:00.000Z',
        sourceItemId: 'legacy-source',
        sourceSnapshotHash: 'legacy-source-hash',
        sourceType: 'adapter-discovered',
        title: 'READY Legacy ownerless task',
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

    await expect(
      handlers.get(AUTOMATION_CHANNELS.startRun)?.(
        {},
        { taskId: projection.projection.tasks[0]?.taskId }
      )
    ).resolves.toMatchObject({ accepted: true })

    expect(latestPrompt).toContain('READY Legacy ownerless task')
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
    await createWorkspaceExecutorDraft(handlers, 'ipc-flow')
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

    const sidecarWorkspaceRoot = await createTempRoot('mde-sidecar-lifecycle-')

    await createSkillBackedFlow({
      flowId: 'sidecar-lifecycle-flow',
      skillRef: 'skill:execute-picked-task',
      workspaceRoot: sidecarWorkspaceRoot
    })

    const sidecarLifecycleResult = (await handlers
      .get(AUTOMATION_CHANNELS.setFlowLifecycle)
      ?.(
        {},
        {
          filePath: join(
            sidecarWorkspaceRoot,
            '.mde',
            'automation-flows',
            'sidecar-lifecycle-flow.md'
          ),
          lifecycle: 'disabled',
          workspaceRoot: sidecarWorkspaceRoot
        }
      )) as { readonly markdown: string }

    expect(sidecarLifecycleResult.markdown).toContain('lifecycle: disabled')
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
      ?.({}, { filters: { flowOwnerKeys: ['missing-flow'] } })

    const filteredProjection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly filters: { readonly flowOwnerKeys?: readonly string[] }
        readonly flows: readonly {
          readonly automationFlowId: string
          readonly automationFlowOwnerKey?: string
        }[]
        readonly tasks: readonly { readonly taskId: string }[]
      }
    }

    expect(filteredProjection.projection.filters.flowOwnerKeys).toEqual([])
    await expect(store.loadFilterState()).resolves.toMatchObject({
      flowOwnerKeys: []
    })
    expect(filteredProjection.projection.tasks).toHaveLength(1)
    expect(filteredProjection.projection.flows).toEqual([
      expect.objectContaining({ automationFlowId: 'ipc-flow' })
    ])

    const flowOwnerKey = filteredProjection.projection.flows[0]?.automationFlowOwnerKey
    expect(flowOwnerKey).toBeTypeOf('string')
    if (flowOwnerKey === undefined) {
      throw new Error('Expected projected flow owner key.')
    }

    await handlers
      .get(AUTOMATION_CHANNELS.updateFilters)
      ?.({}, { filters: { flowOwnerKeys: [flowOwnerKey] } })

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

  it('projects recent workspace automation flows as sidecar filter rows', async () => {
    const { handlers, workspaceRoot } = await createHandlers()
    const sidecarWorkspaceRoot = await createTempRoot('mde-sidecar-workspace-')

    await createSkillBackedFlow({
      flowId: 'sidecar-flow',
      skillRef: 'skill:execute-picked-task',
      workspaceRoot: sidecarWorkspaceRoot
    })

    const projection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.(
        {},
        {
          workspaceRoot,
          workspaceRoots: [workspaceRoot, sidecarWorkspaceRoot]
        }
      )) as {
      projection: {
        readonly filters: { readonly scopeIds?: readonly string[] }
        readonly flows: readonly {
          readonly automationFlowId: string
          readonly taskCount: number
          readonly workspaceId?: string
        }[]
      }
    }

    expect(projection.projection.filters.scopeIds).toEqual([
      `workspace:${workspaceRoot}`
    ])
    expect(projection.projection.flows).toContainEqual(
      expect.objectContaining({
        automationFlowId: 'sidecar-flow',
        taskCount: 0,
        workspaceId: sidecarWorkspaceRoot
      })
    )
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
      ?.({}, { filters: { scopeIds: ['workspace:/stale-workspace'] } })

    const projection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly filters: { readonly scopeIds?: readonly string[] }
        readonly tasks: readonly { readonly title: string }[]
      }
    }

    expect(projection.projection.filters.scopeIds).toEqual([])
    expect(projection.projection.tasks).toEqual([])
    await expect(store.loadFilterState()).resolves.toMatchObject({
      scopeIds: []
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

  it('projects applied global flows through workspace owner keys separately from global source rows', async () => {
    const { handlers, homePath, store, workspaceRoot } = await createHandlers()

    await handlers.get(AUTOMATION_CHANNELS.createFlowFromTemplate)?.(
      {},
      {
        defaultEngine: 'codex',
        flowId: 'global-review-flow',
        scope: 'user',
        templateId: 'research-and-notes'
      }
    )
    await createUserExecutorDraft(homePath, 'global-review-flow')
    await handlers.get(AUTOMATION_CHANNELS.applyGlobalFlowToWorkspace)?.(
      {},
      {
        flowId: 'global-review-flow',
        workspaceRoot
      }
    )

    const appliedOwnerKey = createAppliedGlobalFlowOwnerKey({
      flowId: 'global-review-flow',
      workspaceId: workspaceRoot
    })
    await store.replaceDiscoveredTaskSources(
      'global-review-flow',
      [
        {
          automationFlowId: 'global-review-flow',
          automationFlowOwnerKey: appliedOwnerKey,
          discoveredAt: '2026-05-10T08:00:00.000Z',
          relativePath: '.mde/docs/tasks/ready.md',
          sourceItemId: 'workspace-ready.md',
          sourceSnapshotHash: 'workspace-ready-hash',
          sourceType: 'workspace-markdown',
          title: 'READY Applied global task',
          workspaceId: workspaceRoot
        }
      ],
      appliedOwnerKey
    )

    const projection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly flows: readonly {
          readonly automationFlowOwnerKey?: string
          readonly scope: string
          readonly workspaceId?: string
        }[]
        readonly tasks: readonly {
          readonly automationFlowOwnerKey?: string
          readonly taskId: string
          readonly title: string
          readonly workspaceId?: string
        }[]
      }
    }

    expect(projection.projection.flows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          automationFlowOwnerKey: createGlobalFlowOwnerKey({
            flowId: 'global-review-flow'
          }),
          scope: 'user',
          workspaceId: AUTOMATION_NO_WORKSPACE_ID
        }),
        expect.objectContaining({
          automationFlowOwnerKey: appliedOwnerKey,
          scope: 'user',
          workspaceId: workspaceRoot
        })
      ])
    )
    expect(projection.projection.tasks).toEqual([
      expect.objectContaining({
        automationFlowOwnerKey: appliedOwnerKey,
        title: 'READY Applied global task',
        workspaceId: workspaceRoot
      })
    ])
    expect(projection.projection.tasks[0]?.taskId).toContain(
      encodeURIComponent(appliedOwnerKey)
    )
  })

  it('resolves skill executor source content for runtime prompts and snapshot identity', async () => {
    let latestPrompt = ''
    const { handlers, store, workspaceRoot } = await createHandlers({
      startRunImplementation(input) {
        latestPrompt = input.promptBundle

        return Promise.resolve(Object.freeze({
          adapterSessionId: input.preferredAdapterSessionId,
          events: Object.freeze([
            Object.freeze({
              adapterSessionId: input.preferredAdapterSessionId,
              type: 'session-started'
            } satisfies AgentCliNormalizedEvent)
          ])
        }))
      }
    })
    const skillRoot = join(
      workspaceRoot,
      '.codex',
      'skills',
      'execute-picked-task'
    )
    const skillPath = join(skillRoot, 'SKILL.md')

    await mkdir(skillRoot, { recursive: true })
    await writeFile(skillPath, '# Execute Picked Task\n\nUse these executor steps.')
    await createSkillBackedFlow({
      flowId: 'skill-flow',
      skillRef: 'skill:execute-picked-task',
      workspaceRoot
    })
    const ownerKey = createWorkspaceFlowOwnerKey({
      flowId: 'skill-flow',
      workspaceId: workspaceRoot
    })
    await store.replaceDiscoveredTaskSources(
      'skill-flow',
      [
        {
          automationFlowId: 'skill-flow',
          automationFlowOwnerKey: ownerKey,
          discoveredAt: '2026-05-10T08:00:00.000Z',
          sourceItemId: 'skill-source',
          sourceSnapshotHash: 'skill-source-hash',
          sourceType: 'workspace-markdown',
          title: 'READY Skill-backed task',
          workspaceId: workspaceRoot
        }
      ],
      ownerKey
    )

    const firstProjection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly tasks: readonly {
          readonly primaryExecutor?: {
            readonly executorId: string
            readonly executorSnapshotId?: string
          }
          readonly taskId: string
        }[]
      }
    }
    const firstSnapshotId =
      firstProjection.projection.tasks[0]?.primaryExecutor?.executorSnapshotId

    await expect(
      handlers.get(AUTOMATION_CHANNELS.startRun)?.(
        {},
        {
          executorId:
            firstProjection.projection.tasks[0]?.primaryExecutor?.executorId,
          executorSnapshotId: firstSnapshotId,
          taskId: firstProjection.projection.tasks[0]?.taskId
        }
      )
    ).resolves.toMatchObject({ accepted: true })
    expect(latestPrompt).toContain('Use these executor steps.')

    await writeFile(
      skillPath,
      '# Execute Picked Task\n\nUpdated executor instructions.'
    )
    const secondProjection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as typeof firstProjection

    expect(
      secondProjection.projection.tasks[0]?.primaryExecutor?.executorSnapshotId
    ).not.toBe(firstSnapshotId)
  })

  it('resolves repo-local skill executor source content for runtime prompts', async () => {
    let latestPrompt = ''
    const repoRoot = await createTempRoot('mde-repo-')
    const { handlers, store, workspaceRoot } = await createHandlers({
      repoRoot,
      startRunImplementation(input) {
        latestPrompt = input.promptBundle

        return Promise.resolve(Object.freeze({
          adapterSessionId: input.preferredAdapterSessionId,
          events: Object.freeze([
            Object.freeze({
              adapterSessionId: input.preferredAdapterSessionId,
              type: 'session-started'
            } satisfies AgentCliNormalizedEvent)
          ])
        }))
      }
    })
    const skillRoot = join(
      repoRoot,
      '.codex',
      'skills',
      'execute-picked-task'
    )

    await mkdir(skillRoot, { recursive: true })
    await writeFile(
      join(skillRoot, 'SKILL.md'),
      '# Execute Picked Task\n\nUse repo-local executor steps.'
    )
    await createSkillBackedFlow({
      flowId: 'repo-skill-flow',
      skillRef: 'skill:execute-picked-task',
      workspaceRoot
    })

    const ownerKey = createWorkspaceFlowOwnerKey({
      flowId: 'repo-skill-flow',
      workspaceId: workspaceRoot
    })
    await store.replaceDiscoveredTaskSources(
      'repo-skill-flow',
      [
        {
          automationFlowId: 'repo-skill-flow',
          automationFlowOwnerKey: ownerKey,
          discoveredAt: '2026-05-10T08:00:00.000Z',
          sourceItemId: 'repo-skill-source',
          sourceSnapshotHash: 'repo-skill-source-hash',
          sourceType: 'workspace-markdown',
          title: 'READY Repo skill-backed task',
          workspaceId: workspaceRoot
        }
      ],
      ownerKey
    )

    const projection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly tasks: readonly {
          readonly primaryExecutor?: {
            readonly executorId: string
            readonly executorSnapshotId?: string
          }
          readonly taskId: string
        }[]
      }
    }

    await expect(
      handlers.get(AUTOMATION_CHANNELS.startRun)?.(
        {},
        {
          executorId:
            projection.projection.tasks[0]?.primaryExecutor?.executorId,
          executorSnapshotId:
            projection.projection.tasks[0]?.primaryExecutor?.executorSnapshotId,
          taskId: projection.projection.tasks[0]?.taskId
        }
      )
    ).resolves.toMatchObject({ accepted: true })
    expect(latestPrompt).toContain('Use repo-local executor steps.')
  })

  it('persists discovered task-data snapshots for reconciliation evidence', async () => {
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const { handlers, store } = await createHandlers({
      discoverySources: [
        {
          automationFlowId: 'snapshot-flow',
          discoveredAt: '2026-05-10T08:00:00.000Z',
          sourceItemId: 'snapshot-source',
          sourceSnapshotHash: 'snapshot-source-hash',
          sourceType: 'workspace-markdown',
          title: 'READY Snapshot task',
          workspaceId: workspaceRoot
        }
      ],
      workspaceRoot
    })

    await handlers.get(AUTOMATION_CHANNELS.createFlowFromTemplate)?.(
      {},
      {
        defaultEngine: 'codex',
        flowId: 'snapshot-flow',
        scope: 'workspace',
        templateId: 'local-dev-task'
      }
    )

    await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })

    const snapshots = await store.listTaskDataSnapshots()

    expect(snapshots).toHaveLength(1)
    const snapshot = snapshots[0]

    expect(snapshot).toBeDefined()
    if (snapshot === undefined) {
      throw new Error('Expected a persisted task-data snapshot.')
    }
    expect(snapshot).toMatchObject({
      automationFlowOwnerKey: createWorkspaceFlowOwnerKey({
        flowId: 'snapshot-flow',
        workspaceId: workspaceRoot
      }),
      lastSeenDiscoveryRunId: 'run-ipc',
      sourceItemId: 'snapshot-source'
    })
    expect(snapshot.taskDataSnapshotId).toContain('automation-task-data-snapshot')
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
    await createWorkspaceExecutorDraft(handlers, 'auth-flow')
    const authOwnerKey = createWorkspaceFlowOwnerKey({
      flowId: 'auth-flow',
      workspaceId: workspaceRoot
    })

    await store.replaceDiscoveredTaskSources('auth-flow', [
      {
        automationFlowId: 'auth-flow',
        automationFlowOwnerKey: authOwnerKey,
        discoveredAt: '2026-05-10T08:00:00.000Z',
        sourceItemId: 'auth-source',
        sourceSnapshotHash: 'auth-hash',
        sourceType: 'adapter-discovered',
        title: 'READY Auth gated task',
        workspaceId: workspaceRoot
      }
    ], authOwnerKey)

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
    await createWorkspaceExecutorDraft(handlers, 'protocol-flow')
    const protocolOwnerKey = createWorkspaceFlowOwnerKey({
      flowId: 'protocol-flow',
      workspaceId: workspaceRoot
    })

    await store.replaceDiscoveredTaskSources('protocol-flow', [
      {
        automationFlowId: 'protocol-flow',
        automationFlowOwnerKey: protocolOwnerKey,
        discoveredAt: '2026-05-10T08:00:00.000Z',
        sourceItemId: 'protocol-source',
        sourceSnapshotHash: 'protocol-hash',
        sourceType: 'adapter-discovered',
        title: 'READY Protocol gated task',
        workspaceId: workspaceRoot
      }
    ], protocolOwnerKey)

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
    const { handlers, homePath, store, workspaceRoot } = await createHandlers({
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
    await createUserExecutorDraft(homePath, 'research-flow')
    const researchOwnerKey = createGlobalFlowOwnerKey({
      flowId: 'research-flow'
    })

    await store.replaceDiscoveredTaskSources('research-flow', [
      {
        automationFlowId: 'research-flow',
        automationFlowOwnerKey: researchOwnerKey,
        discoveredAt: '2026-05-10T08:00:00.000Z',
        relativePath: 'research.md',
        sourceItemId: 'user-prompt:research.md',
        sourceSnapshotHash: 'user-prompt-hash',
        sourceType: 'user-prompt',
        tags: ['research'],
        title: 'READY Complete global prompt'
      }
    ], researchOwnerKey)

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
        readonly tasks: readonly {
          readonly primaryExecutor?: { readonly executorId: string }
          readonly taskId: string
        }[]
      }
    }

    expect(readyProjection.projection.tasks[0]?.primaryExecutor).toBeDefined()
    const globalStartResult = (await handlers
      .get(AUTOMATION_CHANNELS.startRun)
      ?.({}, { taskId: readyProjection.projection.tasks[0]?.taskId })) as {
      readonly accepted: boolean
      readonly diagnostic?: { readonly code: string }
    }

    expect(globalStartResult.diagnostic).toBeUndefined()
    expect(globalStartResult).toMatchObject({ accepted: true })

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

  it('keeps Task Stack bucket counts available while the selected task bucket is filtered', async () => {
    let idCounter = 0
    const { handlers, workspaceRoot } = await createHandlers({
      createId: (prefix) => {
        idCounter += 1

        return `${prefix}-bucket-${idCounter}`
      },
      taskRunEvents: [
        {
          outcome: 'succeeded',
          summary: 'Bucket one completed',
          title: 'READY Bucket one',
          type: 'final-report'
        }
      ]
    })

    await mkdir(join(workspaceRoot, '.mde', 'docs', 'tasks'), {
      recursive: true
    })
    await writeFile(
      join(workspaceRoot, '.mde', 'docs', 'tasks', 'bucket-one.md'),
      '# READY Bucket one\n'
    )
    await writeFile(
      join(workspaceRoot, '.mde', 'docs', 'tasks', 'bucket-two.md'),
      '# READY Bucket two\n'
    )
    await handlers.get(AUTOMATION_CHANNELS.createFlowFromTemplate)?.(
      {},
      {
        defaultEngine: 'codex',
        flowId: 'bucket-flow',
        scope: 'workspace',
        templateId: 'local-dev-task'
      }
    )
    await createWorkspaceExecutorDraft(handlers, 'bucket-flow')

    const initialProjection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly tasks: readonly {
          readonly taskId: string
          readonly title: string
        }[]
      }
    }
    const completedTask = initialProjection.projection.tasks.find(
      (task) => task.title === 'READY Bucket one'
    )

    if (completedTask === undefined) {
      throw new Error('Expected READY Bucket one to be projected')
    }

    await expect(
      handlers
        .get(AUTOMATION_CHANNELS.startRun)
        ?.({}, { taskId: completedTask.taskId })
    ).resolves.toMatchObject({
      accepted: true
    })

    const readyProjection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { filters: { bucket: 'ready' }, workspaceRoot })) as {
      projection: {
        readonly buckets: {
          readonly done: readonly { readonly bucket: string; readonly title: string }[]
          readonly ready: readonly { readonly bucket: string; readonly title: string }[]
        }
        readonly tasks: readonly {
          readonly bucket: string
          readonly title: string
        }[]
      }
    }

    expect(readyProjection.projection.tasks).toEqual([
      expect.objectContaining({
        bucket: 'ready',
        title: 'READY Bucket two'
      })
    ])
    expect(readyProjection.projection.buckets.done).toEqual([
      expect.objectContaining({
        bucket: 'done',
        title: 'READY Bucket one'
      })
    ])
    expect(readyProjection.projection.buckets.ready).toEqual([
      expect.objectContaining({
        bucket: 'ready',
        title: 'READY Bucket two'
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
    await createWorkspaceExecutorDraft(handlers, 'approval-flow')
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
    await createWorkspaceExecutorDraft(handlers, 'approval-flow')
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
    await createWorkspaceExecutorDraft(handlers, 'approval-flow')
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
    await createWorkspaceExecutorDraft(handlers, 'approval-flow')
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
