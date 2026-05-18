import { describe, expect, it } from 'vitest'

import {
  createAutomationRunLockKey,
  validateAutomationRunLockIdentity
} from '../../src/main/services/automation/automationRunLocks'

describe('automationRunLocks', () => {
  it('creates stable owner-scoped run lock keys', () => {
    expect(
      createAutomationRunLockKey({
        automationFlowId: 'flow-1',
        profileId: 'dev-profile',
        sourceItemId: 'task.md',
        taskId: 'ready-task',
        workspaceScope: 'workspace:/repo'
      })
    ).toBe(
      'dev-profile::workspace:/repo::flow-1::task.md::ready-task::no-owner::no-executor-snapshot::no-task-data-snapshot'
    )
  })

  it('separates the same task under different flows or workspaces', () => {
    const baseIdentity = {
      automationFlowId: 'flow-1',
      profileId: 'dev-profile',
      sourceItemId: 'task.md',
      taskId: 'ready-task',
      workspaceScope: 'workspace:/repo'
    }

    expect(
      createAutomationRunLockKey({
        ...baseIdentity,
        automationFlowId: 'flow-2'
      })
    ).not.toBe(createAutomationRunLockKey(baseIdentity))
    expect(
      createAutomationRunLockKey({
        ...baseIdentity,
        workspaceScope: 'workspace:/other-repo'
      })
    ).not.toBe(createAutomationRunLockKey(baseIdentity))
    expect(
      createAutomationRunLockKey({
        ...baseIdentity,
        executorSnapshotId: 'executor-snapshot-2'
      })
    ).not.toBe(createAutomationRunLockKey(baseIdentity))
    expect(
      createAutomationRunLockKey({
        ...baseIdentity,
        taskDataSnapshotId: 'task-data-snapshot-2'
      })
    ).not.toBe(createAutomationRunLockKey(baseIdentity))
  })

  it('returns structured validation failures for unsafe identities', () => {
    expect(
      validateAutomationRunLockIdentity({
        automationFlowId: 'flow-1',
        profileId: '',
        sourceItemId: 'task.md',
        taskId: 'ready-task',
        workspaceScope: 'workspace:/repo'
      })
    ).toEqual({
      ok: false,
      reason: 'profileId is required'
    })
    expect(
      validateAutomationRunLockIdentity({
        automationFlowId: 'flow-1',
        profileId: 'dev::profile',
        sourceItemId: 'task.md',
        taskId: 'ready-task',
        workspaceScope: 'workspace:/repo'
      })
    ).toEqual({
      ok: false,
      reason: 'profileId contains unsafe characters'
    })
  })
})
