import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { describe, expect, it } from 'vitest'

import { createMdeRuntimeBridge } from '../../src/main/services/automation/mdeRuntimeBridge'

const createTempRoot = (prefix: string): Promise<string> =>
  mkdtemp(join(tmpdir(), prefix))

describe('mdeRuntimeBridge', () => {
  it('rejects wrong run tokens, stale snapshots, source mismatches, and expired tokens', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const bridge = createMdeRuntimeBridge({
      appDataPath,
      now: () => 1_000,
      tokenTtlMs: 100
    })
    const validToken = ['valid', 'runtime', 'value'].join('-')
    const invalidToken = ['invalid', 'runtime', 'value'].join('-')
    const expiredToken = ['expired', 'runtime', 'value'].join('-')

    bridge.registerRun({
      automationFlowSnapshotId: 'snapshot-1',
      runId: 'run-1',
      sourceItemId: 'source-1',
      sourcePath: join(workspaceRoot, '.mde', 'docs', 'tasks', 'ready.md'),
      taskId: 'task-1',
      token: validToken,
      workspaceRoot
    })

    expect(
      await bridge.handleRuntimeToolCall({
        automationFlowSnapshotId: 'snapshot-1',
        runId: 'run-2',
        sourceItemId: 'source-1',
        taskId: 'task-1',
        token: validToken,
        toolName: 'update_task_status'
      })
    ).toMatchObject({ accepted: false, reason: 'unknown-run' })
    expect(
      await bridge.handleRuntimeToolCall({
        automationFlowSnapshotId: 'snapshot-1',
        runId: 'run-1',
        sourceItemId: 'source-1',
        taskId: 'task-1',
        token: invalidToken,
        toolName: 'update_task_status'
      })
    ).toMatchObject({ accepted: false, reason: 'invalid-token' })
    expect(
      await bridge.handleRuntimeToolCall({
        automationFlowSnapshotId: 'snapshot-2',
        runId: 'run-1',
        sourceItemId: 'source-1',
        taskId: 'task-1',
        token: validToken,
        toolName: 'update_task_status'
      })
    ).toMatchObject({ accepted: false, reason: 'snapshot-mismatch' })

    const expiredBridge = createMdeRuntimeBridge({
      appDataPath,
      now: () => 2_000,
      tokenTtlMs: 100
    })
    expiredBridge.registerRun({
      automationFlowSnapshotId: 'snapshot-1',
      registeredAt: 1_000,
      runId: 'run-1',
      sourceItemId: 'source-1',
      sourcePath: join(workspaceRoot, '.mde', 'docs', 'tasks', 'ready.md'),
      taskId: 'task-1',
      token: expiredToken,
      workspaceRoot
    })

    expect(
      await expiredBridge.handleRuntimeToolCall({
        automationFlowSnapshotId: 'snapshot-1',
        runId: 'run-1',
        sourceItemId: 'source-1',
        taskId: 'task-1',
        token: expiredToken,
        toolName: 'update_task_status'
      })
    ).toMatchObject({ accepted: false, reason: 'expired-token' })
  })

  it('rejects unsafe source, evidence, and report paths without exposing secrets', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const outsideRoot = await createTempRoot('mde-outside-')
    const sourcePath = join(workspaceRoot, '.mde', 'docs', 'tasks', 'ready.md')
    const bridge = createMdeRuntimeBridge({ appDataPath })
    const pathSafetyToken = ['path', 'runtime', 'value'].join('-')
    const sensitiveFixtureValue = ['sensitive', 'fixture', 'value'].join('-')

    await mkdir(join(workspaceRoot, '.mde', 'docs', 'tasks'), { recursive: true })
    await writeFile(sourcePath, '# READY Task')
    bridge.registerRun({
      automationFlowSnapshotId: 'snapshot-1',
      runId: 'run-1',
      sourceItemId: 'source-1',
      sourcePath,
      taskId: 'task-1',
      token: pathSafetyToken,
      workspaceRoot
    })

    expect(
      await bridge.handleRuntimeToolCall({
        automationFlowSnapshotId: 'snapshot-1',
        patch: `password=${sensitiveFixtureValue}`,
        runId: 'run-1',
        sourceItemId: 'source-1',
        targetPath: join(outsideRoot, 'ready.md'),
        taskId: 'task-1',
        token: pathSafetyToken,
        toolName: 'apply_source_patch'
      })
    ).toMatchObject({ accepted: false, reason: 'source-path-mismatch' })
    expect(
      await bridge.handleRuntimeToolCall({
        automationFlowSnapshotId: 'snapshot-1',
        evidencePath: join(outsideRoot, 'evidence.json'),
        message: `token=${sensitiveFixtureValue}`,
        runId: 'run-1',
        sourceItemId: 'source-1',
        taskId: 'task-1',
        token: pathSafetyToken,
        toolName: 'report_phase_update'
      })
    ).toMatchObject({ accepted: false, reason: 'unsafe-evidence-path' })
    expect(JSON.stringify(bridge.listEvents())).not.toContain(sensitiveFixtureValue)
  })

  it('accepts valid report phase updates as normalized events', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const evidencePath = join(appDataPath, 'automation', 'reports', 'phase.json')
    const bridge = createMdeRuntimeBridge({ appDataPath, now: () => 1_000 })
    const reportToken = ['report', 'runtime', 'value'].join('-')

    await mkdir(join(appDataPath, 'automation', 'reports'), { recursive: true })
    bridge.registerRun({
      automationFlowSnapshotId: 'snapshot-1',
      runId: 'run-1',
      sourceItemId: 'source-1',
      sourcePath: join(workspaceRoot, '.mde', 'docs', 'tasks', 'ready.md'),
      taskId: 'task-1',
      token: reportToken,
      workspaceRoot
    })

    await expect(
      bridge.handleRuntimeToolCall({
        automationFlowSnapshotId: 'snapshot-1',
        evidencePath,
        message: 'Phase complete',
        runId: 'run-1',
        sourceItemId: 'source-1',
        taskId: 'task-1',
        token: reportToken,
        toolName: 'report_phase_update'
      })
    ).resolves.toMatchObject({ accepted: true })
    expect(bridge.listEvents()).toMatchObject([
      {
        evidencePath,
        message: 'Phase complete',
        runId: 'run-1',
        toolName: 'report_phase_update'
      }
    ])
  })
})
