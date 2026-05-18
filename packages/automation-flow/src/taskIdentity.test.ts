import { describe, expect, it } from 'vitest'

import {
  createAutomationExecutorSnapshotId,
  createAutomationTaskDataId,
  createAutomationTaskDataSnapshotId,
  createAutomationTaskId,
  createUserPromptSourceItemId,
  createWorkspaceMarkdownSourceItemId
} from './taskIdentity'

describe('automation task identity', () => {
  it('creates owner-scoped task ids for the same discovered source', () => {
    const sourceItemId = 'workspace:/repo:.mde/docs/tasks/ready.md'

    expect(
      createAutomationTaskId({
        automationFlowId: 'flow-a',
        sourceItemId
      })
    ).not.toBe(
      createAutomationTaskId({
        automationFlowId: 'flow-b',
        sourceItemId
      })
    )
  })

  it('normalizes workspace markdown source identity paths', () => {
    expect(
      createWorkspaceMarkdownSourceItemId({
        relativePath: '.mde/docs/tasks/../tasks/ready.md',
        workspaceId: '/workspace'
      })
    ).toBe(
      createWorkspaceMarkdownSourceItemId({
        relativePath: '.mde/docs/tasks/ready.md',
        workspaceId: '/workspace'
      })
    )
  })

  it('normalizes semantic user prompt source identity paths', () => {
    expect(
      createUserPromptSourceItemId({
        relativePath: './weekly/../daily/ready.md'
      })
    ).toBe(
      createUserPromptSourceItemId({
        relativePath: 'daily/ready.md'
      })
    )
  })

  it('can scope user prompt source identity to its root owner', () => {
    const relativePath = 'daily/ready.md'

    expect(
      createUserPromptSourceItemId({
        relativePath,
        userPromptRoot: '/prompt/root-a'
      })
    ).not.toBe(
      createUserPromptSourceItemId({
        relativePath,
        userPromptRoot: '/prompt/root-b'
      })
    )
  })

  it('creates owner-scoped task data ids', () => {
    expect(
      createAutomationTaskDataId({
        ownerKey: 'workspace:/repo:flow:flow-a',
        sourceItemId: 'source-a'
      })
    ).not.toBe(
      createAutomationTaskDataId({
        ownerKey: 'workspace:/repo:flow:flow-b',
        sourceItemId: 'source-a'
      })
    )
  })

  it('creates stable task data snapshot ids from source and payload hashes', () => {
    expect(
      createAutomationTaskDataSnapshotId({
        normalizedTaskPayloadHash: 'payload-a',
        sourceSnapshotHash: 'source-a',
        taskDataId: 'task-data-a'
      })
    ).toBe(
      createAutomationTaskDataSnapshotId({
        normalizedTaskPayloadHash: 'payload-a',
        sourceSnapshotHash: 'source-a',
        taskDataId: 'task-data-a'
      })
    )
    expect(
      createAutomationTaskDataSnapshotId({
        normalizedTaskPayloadHash: 'payload-b',
        sourceSnapshotHash: 'source-a',
        taskDataId: 'task-data-a'
      })
    ).not.toBe(
      createAutomationTaskDataSnapshotId({
        normalizedTaskPayloadHash: 'payload-a',
        sourceSnapshotHash: 'source-a',
        taskDataId: 'task-data-a'
      })
    )
  })

  it('creates executor snapshot ids from owner, executor, and definition fingerprint', () => {
    expect(
      createAutomationExecutorSnapshotId({
        executorDefinitionFingerprint: 'fingerprint-a',
        executorId: 'implementation',
        ownerKey: 'workspace:/repo:flow:flow-a'
      })
    ).not.toBe(
      createAutomationExecutorSnapshotId({
        executorDefinitionFingerprint: 'fingerprint-b',
        executorId: 'implementation',
        ownerKey: 'workspace:/repo:flow:flow-a'
      })
    )
  })
})
