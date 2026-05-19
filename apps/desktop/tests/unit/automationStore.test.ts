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
      taskDataSnapshotsRoot: join(
        appDataPath,
        'automation',
        'task-data-snapshots'
      ),
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

  it('preserves Windows root execution roots while trimming non-root trailing separators before persistence', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const store = createAutomationStore({ appDataPath })

    await store.initialize()
    await store.replaceDiscoveredTaskSources('workspace-flow', [
      {
        automationFlowId: 'workspace-flow',
        discoveredAt: '2026-05-10T08:00:00.000Z',
        executionRoot: 'C:\\',
        sourceItemId: 'drive-root-backslash',
        sourceSnapshotHash: 'drive-root-backslash-hash',
        sourceType: 'remote-mr',
        title: 'READY Drive root backslash'
      },
      {
        automationFlowId: 'workspace-flow',
        discoveredAt: '2026-05-10T08:00:00.000Z',
        executionRoot: 'D:/',
        sourceItemId: 'drive-root-forward-slash',
        sourceSnapshotHash: 'drive-root-forward-slash-hash',
        sourceType: 'remote-mr',
        title: 'READY Drive root forward slash'
      },
      {
        automationFlowId: 'workspace-flow',
        discoveredAt: '2026-05-10T08:00:00.000Z',
        executionRoot: '\\\\server\\share\\',
        sourceItemId: 'unc-share-root',
        sourceSnapshotHash: 'unc-share-root-hash',
        sourceType: 'remote-mr',
        title: 'READY UNC share root'
      },
      {
        automationFlowId: 'workspace-flow',
        discoveredAt: '2026-05-10T08:00:00.000Z',
        executionRoot: 'C:\\repo\\',
        sourceItemId: 'windows-repo',
        sourceSnapshotHash: 'windows-repo-hash',
        sourceType: 'remote-mr',
        title: 'READY Windows repo'
      }
    ])

    await expect(store.listDiscoveredTaskSources()).resolves.toEqual([
      expect.objectContaining({
        executionRoot: 'C:\\',
        sourceItemId: 'drive-root-backslash'
      }),
      expect.objectContaining({
        executionRoot: 'D:\\',
        sourceItemId: 'drive-root-forward-slash'
      }),
      expect.objectContaining({
        executionRoot: '\\\\server\\share\\',
        sourceItemId: 'unc-share-root'
      }),
      expect.objectContaining({
        executionRoot: 'C:\\repo',
        sourceItemId: 'windows-repo'
      })
    ])
  })

  it('self-heals legacy persisted discovered task source Windows drive designator roots on read', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const store = createAutomationStore({ appDataPath })
    const paths = getAutomationStorePaths(appDataPath)

    await store.initialize()
    await writeFile(
      join(paths.discoveredSourcesRoot, 'legacy-flow.json'),
      `${JSON.stringify(
        [
          {
            automationFlowId: 'legacy-flow',
            discoveredAt: '2026-05-10T08:00:00.000Z',
            executionRoot: 'C:',
            sourceItemId: 'legacy-drive-root',
            sourceSnapshotHash: 'legacy-drive-root-hash',
            sourceType: 'remote-mr',
            title: 'READY Legacy drive root'
          }
        ],
        null,
        2
      )}\n`,
      'utf8'
    )

    await expect(store.listDiscoveredTaskSources()).resolves.toEqual([
      expect.objectContaining({
        executionRoot: 'C:\\',
        sourceItemId: 'legacy-drive-root'
      })
    ])
  })

  it('self-heals legacy persisted task data snapshot Windows drive designator roots on read', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const store = createAutomationStore({ appDataPath })
    const paths = getAutomationStorePaths(appDataPath)

    await store.initialize()
    await writeFile(
      join(paths.taskDataSnapshotsRoot, 'legacy-snapshots.json'),
      `${JSON.stringify(
        [
          {
            automationFlowId: 'legacy-flow',
            discoveredAt: '2026-05-10T08:00:00.000Z',
            lastSeenDiscoveryRunId: 'discovery-1',
            sourceItemId: 'legacy-drive-root',
            sourceSnapshotHash: 'legacy-drive-root-hash',
            sourceType: 'remote-mr',
            taskDataId: 'task-data-legacy-drive-root',
            taskDataSnapshotId: 'task-data-snapshot-legacy-drive-root',
            taskSourceSnapshot: {
              automationFlowId: 'legacy-flow',
              discoveredAt: '2026-05-10T08:00:00.000Z',
              executionRoot: 'C:',
              sourceItemId: 'legacy-drive-root',
              sourceSnapshotHash: 'legacy-drive-root-hash',
              sourceType: 'remote-mr',
              title: 'READY Legacy drive root'
            }
          }
        ],
        null,
        2
      )}\n`,
      'utf8'
    )

    const snapshots = await store.listTaskDataSnapshots()

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]?.taskDataSnapshotId).toBe(
      'task-data-snapshot-legacy-drive-root'
    )
    expect(snapshots[0]?.taskSourceSnapshot).toMatchObject({
      executionRoot: 'C:\\',
      sourceItemId: 'legacy-drive-root'
    })
  })

  it('self-heals legacy persisted run Windows drive designator roots on read and recovery', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const store = createAutomationStore({
      appDataPath,
      now: () => '2026-05-10T08:15:00.000Z'
    })
    const paths = getAutomationStorePaths(appDataPath)

    await store.initialize()
    await writeFile(
      join(paths.runsRoot, 'run-legacy-drive-root.json'),
      `${JSON.stringify(
        {
          decisions: [],
          events: [],
          run: {
            automationFlowId: 'legacy-flow',
            engine: 'codex',
            executionRoot: 'C:',
            promptBundleMetadata: {
              automationFlowSnapshotId: 'flow-snapshot-1',
              bundleId: 'bundle-1',
              createdAt: '2026-05-10T08:00:00.000Z',
              executionRoot: 'C:',
              runKind: 'task'
            },
            recoverable: false,
            runId: 'run-legacy-drive-root',
            runKind: 'task',
            startedAt: '2026-05-10T08:00:00.000Z',
            state: 'running',
            taskId: 'task-legacy-drive-root',
            taskSourceSnapshot: {
              automationFlowId: 'legacy-flow',
              discoveredAt: '2026-05-10T08:00:00.000Z',
              executionRoot: 'C:',
              sourceItemId: 'legacy-drive-root',
              sourceSnapshotHash: 'legacy-drive-root-hash',
              sourceType: 'remote-mr',
              title: 'READY Legacy drive root'
            },
            updatedAt: '2026-05-10T08:00:00.000Z',
            workspaceRoot: 'C:'
          }
        },
        null,
        2
      )}\n`,
      'utf8'
    )

    const run = await store.getRun('run-legacy-drive-root')

    expect(run).toMatchObject({
      executionRoot: 'C:\\',
      workspaceRoot: 'C:\\'
    })
    expect(run?.promptBundleMetadata).toMatchObject({
      executionRoot: 'C:\\'
    })
    expect(run?.taskSourceSnapshot).toMatchObject({
      executionRoot: 'C:\\'
    })

    const runsBeforeRecovery = await store.listRuns()

    expect(runsBeforeRecovery).toHaveLength(1)
    expect(runsBeforeRecovery[0]).toMatchObject({
      executionRoot: 'C:\\',
      runId: 'run-legacy-drive-root',
      workspaceRoot: 'C:\\'
    })
    expect(runsBeforeRecovery[0]?.promptBundleMetadata).toMatchObject({
      executionRoot: 'C:\\'
    })
    expect(runsBeforeRecovery[0]?.taskSourceSnapshot).toMatchObject({
      executionRoot: 'C:\\'
    })

    await store.recoverInterruptedRuns()

    const runsAfterRecovery = await store.listRuns()

    expect(runsAfterRecovery).toHaveLength(1)
    expect(runsAfterRecovery[0]).toMatchObject({
      executionRoot: 'C:\\',
      interruptedAt: '2026-05-10T08:15:00.000Z',
      recoverable: true,
      runId: 'run-legacy-drive-root',
      state: 'failed',
      workspaceRoot: 'C:\\'
    })
    expect(runsAfterRecovery[0]?.promptBundleMetadata).toMatchObject({
      executionRoot: 'C:\\'
    })
    expect(runsAfterRecovery[0]?.taskSourceSnapshot).toMatchObject({
      executionRoot: 'C:\\'
    })
  })

  it('keeps already normalized persisted execution roots unchanged on read', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const store = createAutomationStore({ appDataPath })
    const paths = getAutomationStorePaths(appDataPath)

    await store.initialize()
    await writeFile(
      join(paths.discoveredSourcesRoot, 'normalized-flow.json'),
      `${JSON.stringify(
        [
          {
            automationFlowId: 'normalized-flow',
            discoveredAt: '2026-05-10T08:00:00.000Z',
            executionRoot: '/Users/test/repo',
            sourceItemId: 'posix-repo',
            sourceSnapshotHash: 'posix-repo-hash',
            sourceType: 'remote-mr',
            title: 'READY POSIX repo'
          },
          {
            automationFlowId: 'normalized-flow',
            discoveredAt: '2026-05-10T08:01:00.000Z',
            executionRoot: 'D:\\',
            sourceItemId: 'windows-drive-root',
            sourceSnapshotHash: 'windows-drive-root-hash',
            sourceType: 'remote-mr',
            title: 'READY Windows drive root'
          },
          {
            automationFlowId: 'normalized-flow',
            discoveredAt: '2026-05-10T08:02:00.000Z',
            executionRoot: '\\\\server\\share\\',
            sourceItemId: 'unc-share-root',
            sourceSnapshotHash: 'unc-share-root-hash',
            sourceType: 'remote-mr',
            title: 'READY UNC share root'
          }
        ],
        null,
        2
      )}\n`,
      'utf8'
    )
    await writeFile(
      join(paths.taskDataSnapshotsRoot, 'normalized-snapshots.json'),
      `${JSON.stringify(
        [
          {
            automationFlowId: 'normalized-flow',
            discoveredAt: '2026-05-10T08:00:00.000Z',
            lastSeenDiscoveryRunId: 'discovery-1',
            sourceItemId: 'windows-repo',
            sourceSnapshotHash: 'windows-repo-hash',
            sourceType: 'remote-mr',
            taskDataId: 'task-data-windows-repo',
            taskDataSnapshotId: 'task-data-snapshot-windows-repo',
            taskSourceSnapshot: {
              automationFlowId: 'normalized-flow',
              discoveredAt: '2026-05-10T08:00:00.000Z',
              executionRoot: 'C:\\repo',
              sourceItemId: 'windows-repo',
              sourceSnapshotHash: 'windows-repo-hash',
              sourceType: 'remote-mr',
              title: 'READY Windows repo'
            }
          }
        ],
        null,
        2
      )}\n`,
      'utf8'
    )

    await expect(store.listDiscoveredTaskSources()).resolves.toEqual([
      expect.objectContaining({
        executionRoot: '/Users/test/repo',
        sourceItemId: 'posix-repo'
      }),
      expect.objectContaining({
        executionRoot: 'D:\\',
        sourceItemId: 'windows-drive-root'
      }),
      expect.objectContaining({
        executionRoot: '\\\\server\\share\\',
        sourceItemId: 'unc-share-root'
      })
    ])
    const snapshots = await store.listTaskDataSnapshots()

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]?.taskDataSnapshotId).toBe(
      'task-data-snapshot-windows-repo'
    )
    expect(snapshots[0]?.taskSourceSnapshot).toMatchObject({
      executionRoot: 'C:\\repo',
      sourceItemId: 'windows-repo'
    })
  })

  it('keeps already normalized persisted run roots unchanged on read', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const store = createAutomationStore({ appDataPath })
    const paths = getAutomationStorePaths(appDataPath)

    await store.initialize()
    await writeFile(
      join(paths.runsRoot, 'run-normalized-roots.json'),
      `${JSON.stringify(
        {
          decisions: [],
          events: [],
          run: {
            automationFlowId: 'normalized-flow',
            engine: 'codex',
            executionRoot: '/Users/test/repo',
            promptBundleMetadata: {
              automationFlowSnapshotId: 'flow-snapshot-1',
              bundleId: 'bundle-1',
              createdAt: '2026-05-10T08:00:00.000Z',
              executionRoot: '\\\\server\\share\\',
              runKind: 'task'
            },
            recoverable: false,
            runId: 'run-normalized-roots',
            runKind: 'task',
            startedAt: '2026-05-10T08:00:00.000Z',
            state: 'done',
            taskId: 'task-normalized-roots',
            taskSourceSnapshot: {
              automationFlowId: 'normalized-flow',
              discoveredAt: '2026-05-10T08:00:00.000Z',
              executionRoot: 'C:\\repo',
              sourceItemId: 'windows-repo',
              sourceSnapshotHash: 'windows-repo-hash',
              sourceType: 'remote-mr',
              title: 'READY Windows repo'
            },
            updatedAt: '2026-05-10T08:00:00.000Z',
            workspaceRoot: 'D:\\'
          }
        },
        null,
        2
      )}\n`,
      'utf8'
    )

    const run = await store.getRun('run-normalized-roots')

    expect(run).toMatchObject({
      executionRoot: '/Users/test/repo',
      workspaceRoot: 'D:\\'
    })
    expect(run?.promptBundleMetadata).toMatchObject({
      executionRoot: '\\\\server\\share\\'
    })
    expect(run?.taskSourceSnapshot).toMatchObject({
      executionRoot: 'C:\\repo'
    })
  })

  it('persists task data snapshots and marks missing rediscovery snapshots removed', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const store = createAutomationStore({
      appDataPath,
      now: () => '2026-05-10T08:30:00.000Z'
    })
    const source = {
      automationFlowId: 'workspace-flow',
      automationFlowOwnerKey: 'workspace:%2Frepo:flow:workspace-flow',
      discoveredAt: '2026-05-10T08:00:00.000Z',
      sourceItemId: 'source-a',
      sourceSnapshotHash: 'hash-a',
      sourceType: 'workspace-markdown' as const,
      taskDataId:
        'automation-task-data:workspace:%2Frepo:flow:workspace-flow:source-a',
      taskDataSnapshotId: 'automation-task-data-snapshot:snapshot-a',
      title: 'READY Snapshot source'
    }

    await store.initialize()
    await store.replaceTaskDataSnapshots(
      'workspace:%2Frepo:flow:workspace-flow',
      [source],
      'discovery-1'
    )
    await store.replaceTaskDataSnapshots(
      'workspace:%2Frepo:flow:workspace-flow',
      [{ ...source, discoveredAt: '2026-05-10T08:05:00.000Z' }],
      'discovery-2'
    )

    const currentSnapshots = await store.listTaskDataSnapshots()

    expect(currentSnapshots).toEqual([
      expect.objectContaining({
        lastSeenDiscoveryRunId: 'discovery-2',
        taskDataSnapshotId: 'automation-task-data-snapshot:snapshot-a'
      })
    ])
    expect(currentSnapshots[0]).not.toHaveProperty('removedAt')

    await store.replaceTaskDataSnapshots(
      'workspace:%2Frepo:flow:workspace-flow',
      [],
      'discovery-3'
    )

    await expect(store.listTaskDataSnapshots()).resolves.toEqual([
      expect.objectContaining({
        lastSeenDiscoveryRunId: 'discovery-2',
        removedAt: '2026-05-10T08:30:00.000Z',
        taskDataSnapshotId: 'automation-task-data-snapshot:snapshot-a'
      })
    ])
  })

  it('preserves task and executor snapshot ids on run records', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const store = createAutomationStore({ appDataPath })

    await store.initialize()
    await store.createRun({
      automationFlowId: 'workspace-flow',
      engine: 'codex',
      executorId: 'implementation',
      executorSnapshotId: 'executor-snapshot-1',
      runId: 'run-snapshot',
      runKind: 'task',
      state: 'running',
      taskDataId: 'task-data-1',
      taskDataSnapshotId: 'task-data-snapshot-1',
      taskId: 'task-1'
    })

    await expect(store.listRuns()).resolves.toEqual([
      expect.objectContaining({
        executorId: 'implementation',
        executorSnapshotId: 'executor-snapshot-1',
        taskDataId: 'task-data-1',
        taskDataSnapshotId: 'task-data-snapshot-1'
      })
    ])
  })
})
