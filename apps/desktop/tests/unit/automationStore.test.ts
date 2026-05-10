import { mkdtemp, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { describe, expect, it } from 'vitest'

import {
  createAutomationStore,
  getAutomationStorePaths
} from '../../src/main/services/automation/automationStore'

const createTempRoot = (prefix: string): Promise<string> =>
  mkdtemp(join(tmpdir(), prefix))

describe('automationStore', () => {
  it('creates the v1 automation storage directories', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const store = createAutomationStore({ appDataPath })

    await store.initialize()

    await expect(
      readFile(join(appDataPath, 'automation', '.initialized'), 'utf8')
    ).resolves.toBe('v1\n')
    expect(getAutomationStorePaths(appDataPath)).toMatchObject({
      automationRoot: join(appDataPath, 'automation'),
      discoveredSourcesRoot: join(appDataPath, 'automation', 'discovered-sources'),
      reportsRoot: join(appDataPath, 'automation', 'reports'),
      runsRoot: join(appDataPath, 'automation', 'runs'),
      runtimeRoot: join(appDataPath, 'automation', 'automation-flow-runtime'),
      userTaskPromptsRoot: join(appDataPath, 'automation', 'user-task-prompts'),
      workspacesRoot: join(appDataPath, 'automation', 'workspaces')
    })
  })

  it('persists runs, events, decisions, reports, and filter state', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const store = createAutomationStore({
      appDataPath,
      now: () => '2026-05-10T07:31:00.000Z'
    })

    await store.initialize()
    await store.createRun({
      adapterSessionId: 'codex-session-1',
      automationFlowId: 'workspace-flow',
      engine: 'codex',
      runId: 'run-1',
      runKind: 'task',
      state: 'running',
      taskId: 'task-1',
      workspaceRoot
    })
    await store.appendEvent('run-1', {
      eventId: 'event-1',
      summary: 'Started with token=abc123',
      type: 'adapter-event'
    })
    await store.markNeedsMe('run-1', {
      decisionId: 'decision-1',
      prompt: 'Approve file write?',
      taskId: 'task-1',
      type: 'approval'
    })
    await store.createReport({
      outcome: 'succeeded',
      reportId: 'report-1',
      runId: 'run-1',
      summary: 'Done with Authorization: Bearer secret-value',
      taskId: 'task-1',
      title: 'READY Ship automation work'
    })
    await store.saveFilterState({
      archivedVisible: true,
      bucket: 'done',
      flowId: 'workspace-flow'
    })

    const runs = await store.listRuns()
    const reports = await store.listReports()

    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({
      adapterSessionId: 'codex-session-1',
      recoverable: false,
      runId: 'run-1',
      state: 'done',
      taskId: 'task-1'
    })
    expect(reports[0]).toMatchObject({
      outcome: 'succeeded',
      reportId: 'report-1',
      runId: 'run-1',
      taskId: 'task-1'
    })
    await expect(store.loadFilterState()).resolves.toMatchObject({
      archivedVisible: true,
      bucket: 'done',
      flowId: 'workspace-flow'
    })
  })

  it('does not persist prompt bundles, tokens, credentials, or raw stdout logs', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const store = createAutomationStore({ appDataPath })

    await store.initialize()
    await store.createRun({
      automationFlowId: 'workspace-flow',
      engine: 'codex',
      runId: 'run-secret',
      runKind: 'task',
      state: 'running',
      taskId: 'task-secret'
    })
    const sensitivePassword = ['fixture', 'password', 'value'].join('-')
    await store.appendEvent('run-secret', {
      credentials: { password: sensitivePassword },
      eventId: 'event-secret',
      promptBundle: 'private prompt bundle',
      rawStdout: 'raw adapter stdout',
      runtimeToken: 'runtime-token',
      summary: `password=${sensitivePassword} api_key=secret-key`,
      type: 'adapter-event'
    } as never)

    const runFile = await readFile(
      join(appDataPath, 'automation', 'runs', 'run-secret.json'),
      'utf8'
    )

    expect(runFile).not.toContain('private prompt bundle')
    expect(runFile).not.toContain('runtime-token')
    expect(runFile).not.toContain(sensitivePassword)
    expect(runFile).not.toContain('secret-key')
    expect(runFile).not.toContain('raw adapter stdout')
    expect(runFile).toContain('[redacted]')
  })

  it('marks in-flight adapter runs as recoverable after relaunch', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const firstStore = createAutomationStore({ appDataPath })

    await firstStore.initialize()
    await firstStore.createRun({
      automationFlowId: 'workspace-flow',
      engine: 'codex',
      runId: 'run-live',
      runKind: 'task',
      state: 'running',
      taskId: 'task-live'
    })

    const secondStore = createAutomationStore({
      appDataPath,
      now: () => '2026-05-10T07:32:00.000Z'
    })

    await secondStore.initialize()
    await secondStore.recoverInterruptedRuns()

    await expect(secondStore.listRuns()).resolves.toMatchObject([
      {
        interruptedAt: '2026-05-10T07:32:00.000Z',
        recoverable: true,
        runId: 'run-live',
        state: 'failed'
      }
    ])
  })

  it('keeps active runs when only Automation Center window state changes', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const store = createAutomationStore({ appDataPath })

    await store.initialize()
    await store.createRun({
      automationFlowId: 'workspace-flow',
      engine: 'codex',
      runId: 'run-window',
      runKind: 'task',
      state: 'running',
      taskId: 'task-window'
    })
    await store.saveFilterState({ archivedVisible: false })

    await expect(store.listRuns()).resolves.toMatchObject([
      {
        recoverable: false,
        runId: 'run-window',
        state: 'running'
      }
    ])
  })
})
