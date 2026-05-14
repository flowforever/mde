import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
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
      flowIds: ['workspace-flow']
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
      flowIds: ['workspace-flow']
    })
    await expect(
      readdir(join(appDataPath, 'automation', 'runs'))
    ).resolves.not.toEqual(expect.arrayContaining([expect.stringContaining('.tmp')]))
  })

  it('retries a transient partial JSON read during relaunch', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const store = createAutomationStore({ appDataPath })

    await store.initialize()
    await store.createRun({
      automationFlowId: 'workspace-flow',
      engine: 'codex',
      runId: 'run-race',
      runKind: 'task',
      state: 'running',
      taskId: 'task-race'
    })

    const runFilePath = join(
      appDataPath,
      'automation',
      'runs',
      'run-race.json'
    )
    const completeRunFile = await readFile(runFilePath, 'utf8')

    await writeFile(runFilePath, completeRunFile.slice(0, 12), 'utf8')
    setTimeout(() => {
      void writeFile(runFilePath, completeRunFile, 'utf8')
    }, 20)

    await expect(store.listRuns()).resolves.toMatchObject([
      {
        runId: 'run-race',
        state: 'running'
      }
    ])
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

  it('recovers persisted resuming decisions as retryable after relaunch', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const firstStore = createAutomationStore({ appDataPath })

    await firstStore.initialize()
    await firstStore.createRun({
      automationFlowId: 'workspace-flow',
      engine: 'codex',
      runId: 'run-orphaned-decision',
      runKind: 'task',
      state: 'running',
      taskId: 'task-orphaned-decision'
    })
    await firstStore.markNeedsMe('run-orphaned-decision', {
      decisionId: 'decision-orphaned-resume',
      prompt: 'Approve resume after restart?',
      taskId: 'task-orphaned-decision',
      type: 'approval'
    })
    await firstStore.claimDecisionForResume('decision-orphaned-resume')

    const secondStore = createAutomationStore({
      appDataPath,
      now: () => '2026-05-10T07:32:30.000Z'
    })

    await secondStore.initialize()
    await secondStore.recoverInterruptedRuns()

    await expect(secondStore.listDecisions()).resolves.toMatchObject([
      {
        decisionId: 'decision-orphaned-resume',
        status: 'pending'
      }
    ])
    await expect(secondStore.listRuns()).resolves.toMatchObject([
      {
        recoverable: false,
        runId: 'run-orphaned-decision',
        state: 'needs-me'
      }
    ])
    await expect(
      secondStore.claimDecisionForResume('decision-orphaned-resume')
    ).resolves.toMatchObject({
      decisionId: 'decision-orphaned-resume',
      status: 'resuming'
    })
  })

  it('recovers resuming decisions for blocked reports as retryable after relaunch', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const firstStore = createAutomationStore({ appDataPath })

    await firstStore.initialize()
    await firstStore.createRun({
      automationFlowId: 'workspace-flow',
      engine: 'codex',
      runId: 'run-blocked-decision',
      runKind: 'task',
      state: 'needs-me',
      taskId: 'task-blocked-decision'
    })
    await firstStore.markNeedsMe('run-blocked-decision', {
      decisionId: 'decision-blocked-resume',
      prompt: 'Approve blocked resume?',
      taskId: 'task-blocked-decision',
      type: 'approval'
    })
    await firstStore.claimDecisionForResume('decision-blocked-resume')
    await firstStore.createReport({
      outcome: 'blocked',
      reportId: 'report-blocked-decision',
      runId: 'run-blocked-decision',
      taskId: 'task-blocked-decision',
      title: 'READY Blocked decision'
    })

    const secondStore = createAutomationStore({ appDataPath })

    await secondStore.initialize()
    await secondStore.recoverInterruptedRuns()

    await expect(secondStore.listDecisions()).resolves.toMatchObject([
      {
        decisionId: 'decision-blocked-resume',
        status: 'pending'
      }
    ])
    await expect(secondStore.listRuns()).resolves.toMatchObject([
      {
        recoverable: false,
        runId: 'run-blocked-decision',
        state: 'needs-me'
      }
    ])
    await expect(
      secondStore.claimDecisionForResume('decision-blocked-resume')
    ).resolves.toMatchObject({
      decisionId: 'decision-blocked-resume',
      status: 'resuming'
    })
  })

  it.each([
    { outcome: 'succeeded' as const, state: 'done' as const },
    { outcome: 'failed' as const, state: 'failed' as const },
    { outcome: 'cancelled' as const, state: 'cancelled' as const }
  ])(
    'does not reopen resuming decisions for $outcome reports after relaunch',
    async ({ outcome, state }) => {
      const appDataPath = await createTempRoot('mde-app-data-')
      const firstStore = createAutomationStore({ appDataPath })
      const suffix = outcome

      await firstStore.initialize()
      await firstStore.createRun({
        automationFlowId: 'workspace-flow',
        engine: 'codex',
        runId: `run-${suffix}-decision`,
        runKind: 'task',
        state: 'needs-me',
        taskId: `task-${suffix}-decision`
      })
      await firstStore.markNeedsMe(`run-${suffix}-decision`, {
        decisionId: `decision-${suffix}-resume`,
        prompt: 'Approve completion?',
        taskId: `task-${suffix}-decision`,
        type: 'approval'
      })
      await firstStore.claimDecisionForResume(`decision-${suffix}-resume`)
      await firstStore.createReport({
        outcome,
        reportId: `report-${suffix}-decision`,
        runId: `run-${suffix}-decision`,
        taskId: `task-${suffix}-decision`,
        title: 'READY Completed decision'
      })

      const secondStore = createAutomationStore({ appDataPath })

      await secondStore.initialize()
      await secondStore.recoverInterruptedRuns()

      await expect(secondStore.listDecisions()).resolves.toMatchObject([
        {
          decisionId: `decision-${suffix}-resume`,
          status: 'resuming'
        }
      ])
      await expect(secondStore.listRuns()).resolves.toMatchObject([
        {
          recoverable: false,
          runId: `run-${suffix}-decision`,
          state
        }
      ])
    }
  )

  it('resolves decisions without overwriting the runtime-produced run state', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const store = createAutomationStore({
      appDataPath,
      now: () => '2026-05-10T07:33:00.000Z'
    })

    await store.initialize()
    await store.createRun({
      automationFlowId: 'workspace-flow',
      engine: 'codex',
      runId: 'run-decision',
      runKind: 'task',
      state: 'running',
      taskId: 'task-decision'
    })
    await store.markNeedsMe('run-decision', {
      decisionId: 'decision-done',
      prompt: 'Approve completion?',
      taskId: 'task-decision',
      type: 'approval'
    })
    await store.createReport({
      outcome: 'succeeded',
      reportId: 'report-decision',
      runId: 'run-decision',
      taskId: 'task-decision',
      title: 'READY Decision completed'
    })
    await store.claimDecisionForResume('decision-done')

    await expect(
      store.resolveDecision('decision-done', 'approved')
    ).resolves.toMatchObject({
      decisionId: 'decision-done',
      response: 'approved',
      status: 'approved'
    })
    await expect(store.listRuns()).resolves.toMatchObject([
      {
        runId: 'run-decision',
        state: 'done'
      }
    ])
  })

  it('claims a pending decision for resume and rolls it back for retry', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const store = createAutomationStore({
      appDataPath,
      now: () => '2026-05-10T07:34:00.000Z'
    })

    await store.initialize()
    await store.createRun({
      automationFlowId: 'workspace-flow',
      engine: 'codex',
      runId: 'run-claim',
      runKind: 'task',
      state: 'running',
      taskId: 'task-claim'
    })
    await store.markNeedsMe('run-claim', {
      decisionId: 'decision-claim',
      prompt: 'Approve resume?',
      taskId: 'task-claim',
      type: 'approval'
    })

    await expect(
      store.claimDecisionForResume('decision-claim')
    ).resolves.toMatchObject({
      decisionId: 'decision-claim',
      status: 'resuming'
    })
    await expect(store.claimDecisionForResume('decision-claim')).rejects.toThrow(
      /pending|resumed/i
    )

    await expect(
      store.rollbackDecisionResumeClaim('decision-claim')
    ).resolves.toMatchObject({
      decisionId: 'decision-claim',
      status: 'pending'
    })
    await expect(
      store.claimDecisionForResume('decision-claim')
    ).resolves.toMatchObject({
      decisionId: 'decision-claim',
      status: 'resuming'
    })
  })

  it('does not resolve an unclaimed pending decision', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const store = createAutomationStore({ appDataPath })

    await store.initialize()
    await store.createRun({
      automationFlowId: 'workspace-flow',
      engine: 'codex',
      runId: 'run-unclaimed',
      runKind: 'task',
      state: 'running',
      taskId: 'task-unclaimed'
    })
    await store.markNeedsMe('run-unclaimed', {
      decisionId: 'decision-unclaimed',
      prompt: 'Approve direct resolve?',
      taskId: 'task-unclaimed',
      type: 'approval'
    })

    await expect(
      store.resolveDecision('decision-unclaimed', 'approved')
    ).rejects.toThrow(/claimed for resume/i)
    await expect(store.listDecisions()).resolves.toMatchObject([
      {
        decisionId: 'decision-unclaimed',
        status: 'pending'
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

  it('drops unsafe discovered source metadata before persistence', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const store = createAutomationStore({ appDataPath })

    await store.initialize()
    await store.replaceDiscoveredTaskSources('workspace-flow', [
      {
        automationFlowId: 'workspace-flow',
        discoveredAt: '2026-05-10T08:00:00.000Z',
        relativePath: '.mde/docs/tasks/ready.md',
        sourceItemId: 'safe-source',
        sourceSnapshotHash: 'safe-hash',
        sourceType: 'workspace-markdown',
        title: 'READY Safe source'
      },
      {
        automationFlowId: 'workspace-flow',
        discoveredAt: '2026-05-10T08:00:00.000Z',
        relativePath: '../private.md',
        sourceItemId: 'unsafe-source',
        sourceSnapshotHash: 'unsafe-hash',
        sourceType: 'workspace-markdown',
        sourceUri: 'javascript:alert(1)',
        title: 'READY Unsafe source'
      }
    ])

    await expect(store.listDiscoveredTaskSources()).resolves.toEqual([
      expect.objectContaining({
        sourceItemId: 'safe-source',
        title: 'READY Safe source'
      })
    ])
  })
})
