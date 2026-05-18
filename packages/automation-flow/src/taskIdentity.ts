import { posix } from 'node:path'

export interface AutomationTaskIdentityInput {
  readonly automationFlowId: string
  readonly sourceItemId: string
}

const normalizeIdentityPart = (value: string): string =>
  encodeURIComponent(value.trim()).replace(/%2F/giu, '/')

const stableJoin = (...parts: readonly string[]): string =>
  parts.map(normalizeIdentityPart).join(':')

const normalizeRelativePath = (relativePath: string): string =>
  posix
    .normalize(relativePath.trim().replace(/\\/gu, '/'))
    .replace(/^\/+/u, '')
    .replace(/^\.\//u, '')

export const createAutomationTaskId = ({
  automationFlowId,
  sourceItemId
}: AutomationTaskIdentityInput): string =>
  stableJoin('automation-task', automationFlowId, sourceItemId)

export const createAutomationTaskDataId = (input: {
  readonly ownerKey: string
  readonly sourceItemId: string
}): string =>
  stableJoin('automation-task-data', input.ownerKey, input.sourceItemId)

export const createAutomationTaskDataSnapshotId = (input: {
  readonly normalizedTaskPayloadHash: string
  readonly sourceSnapshotHash: string
  readonly taskDataId: string
}): string =>
  stableJoin(
    'automation-task-data-snapshot',
    input.taskDataId,
    input.sourceSnapshotHash,
    input.normalizedTaskPayloadHash
  )

export const createAutomationExecutorSnapshotId = (input: {
  readonly executorDefinitionFingerprint: string
  readonly executorId: string
  readonly ownerKey: string
}): string =>
  stableJoin(
    'automation-executor-snapshot',
    input.ownerKey,
    input.executorId,
    input.executorDefinitionFingerprint
  )

export const createWorkspaceMarkdownSourceItemId = ({
  relativePath,
  workspaceId
}: {
  readonly relativePath: string
  readonly workspaceId: string
}): string =>
  stableJoin(
    'workspace-markdown',
    workspaceId,
    normalizeRelativePath(relativePath)
  )

export const createUserPromptSourceItemId = ({
  relativePath,
  userPromptRoot
}: {
  readonly relativePath: string
  readonly userPromptRoot?: string
}): string =>
  userPromptRoot === undefined
    ? stableJoin('user-prompt', normalizeRelativePath(relativePath))
    : stableJoin(
        'user-prompt',
        userPromptRoot,
        normalizeRelativePath(relativePath)
      )
