import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { AUTOMATION_CHANNELS } from '../../src/main/ipc/channels'
import { registerAutomationHandlers } from '../../src/main/ipc/registerAutomationHandlers'
import { createFakeAgentCliAdapter } from '../../src/main/services/automation/agentCliAdapters'
import { createAutomationAdapterRegistry } from '../../src/main/services/automation/automationAdapterRegistry'
import { createAutomationRuntime } from '../../src/main/services/automation/automationRuntime'
import { createAutomationStore } from '../../src/main/services/automation/automationStore'
import { createMdeRuntimeBridge } from '../../src/main/services/automation/mdeRuntimeBridge'

const createTempRoot = (prefix: string): Promise<string> =>
  mkdtemp(join(tmpdir(), prefix))

const createHandlers = async () => {
  const appDataPath = await createTempRoot('mde-app-data-')
  const homePath = await createTempRoot('mde-home-')
  const workspaceRoot = await createTempRoot('mde-workspace-')
  const store = createAutomationStore({ appDataPath })
  const adapterRegistry = createAutomationAdapterRegistry([
    createFakeAgentCliAdapter({
      commandPath: '/fake/bin/codex',
      engine: 'codex'
    })
  ])
  const runtime = createAutomationRuntime({
    adapterRegistry,
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

  return { handlers, workspaceRoot }
}

describe('automationFlowEditor integration', () => {
  it('loads and saves automation-flow definitions through safe IPC handlers', async () => {
    const { handlers, workspaceRoot } = await createHandlers()
    const created = (await handlers
      .get(AUTOMATION_CHANNELS.createFlowFromTemplate)
      ?.(
        {},
        {
          defaultEngine: 'codex',
          flowId: 'editable-flow',
          scope: 'workspace',
          templateId: 'local-dev-task'
        }
      )) as { markdown: string; path: string; valid: boolean }

    const loaded = (await handlers
      .get(AUTOMATION_CHANNELS.loadFlowDefinition)
      ?.({}, { filePath: created.path })) as {
      markdown: string
      path: string
      valid: boolean
    }
    const savedMarkdown = loaded.markdown.replace(
      'name: "Local Dev Task Automation Flow"',
      'name: "Updated local dev task"'
    )
    const saved = (await handlers
      .get(AUTOMATION_CHANNELS.saveFlowDefinition)
      ?.({}, { filePath: loaded.path, markdown: savedMarkdown })) as {
      markdown: string
      path: string
      valid: boolean
    }
    const projection = (await handlers
      .get(AUTOMATION_CHANNELS.getProjection)
      ?.({}, { workspaceRoot })) as {
      projection: {
        readonly flows: readonly {
          readonly definitionPath?: string
          readonly name: string
        }[]
      }
    }

    expect(created.valid).toBe(true)
    expect(loaded.markdown).toContain('id: "editable-flow"')
    expect(saved.path).toBe(created.path)
    expect(saved.markdown).toContain('Updated local dev task')
    expect(saved.valid).toBe(true)
    expect(projection.projection.flows[0]).toMatchObject({
      definitionPath: created.path,
      name: 'Updated local dev task'
    })
  })

  it('rejects unsafe automation-flow editor load and save paths', async () => {
    const { handlers } = await createHandlers()

    await expect(
      handlers
        .get(AUTOMATION_CHANNELS.loadFlowDefinition)
        ?.({}, { filePath: '/tmp/outside.md' })
    ).rejects.toThrow(/outside allowed definition roots/i)
    await expect(
      handlers
        .get(AUTOMATION_CHANNELS.saveFlowDefinition)
        ?.({}, { filePath: '/tmp/outside.md', markdown: '# Unsafe' })
    ).rejects.toThrow(/outside allowed definition roots/i)
  })
})
