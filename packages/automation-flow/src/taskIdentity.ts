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
