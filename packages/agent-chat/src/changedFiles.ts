import { createAgentChatDiagnostic } from './diagnostics'
import type { AgentChatWorkspaceSnapshotProvider } from './host'
import type {
  AgentChatChangedFile,
  AgentChatChangedFilesSummary,
  AgentChatWorkspaceFileSnapshot
} from './types'

export interface SummarizeChangedFilesInput {
  readonly after?: readonly AgentChatWorkspaceFileSnapshot[]
  readonly afterError?: unknown
  readonly before?: readonly AgentChatWorkspaceFileSnapshot[]
  readonly beforeError?: unknown
}

export interface CaptureChangedFilesAroundTurnInput<T> {
  readonly operation: () => Promise<T>
  readonly snapshotProvider: AgentChatWorkspaceSnapshotProvider
  readonly workspaceRoot: string
}

export interface CaptureChangedFilesAroundTurnResult<T> {
  readonly result: T
  readonly summary: AgentChatChangedFilesSummary
}

const describeError = (error: unknown): string | undefined =>
  error instanceof Error ? error.message : undefined

export const summarizeChangedFiles = (
  input: SummarizeChangedFilesInput
): AgentChatChangedFilesSummary => {
  const captureError = input.beforeError ?? input.afterError
  if (captureError) {
    return Object.freeze({
      available: false,
      diagnostic: createAgentChatDiagnostic({
        code: 'changed-files-unavailable',
        details: describeError(captureError),
        recoverable: true
      }),
      files: Object.freeze([])
    })
  }

  const before = new Map(
    (input.before ?? []).map((snapshot) => [snapshot.path, snapshot.hash] as const)
  )
  const after = new Map(
    (input.after ?? []).map((snapshot) => [snapshot.path, snapshot.hash] as const)
  )
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort()
  const files: readonly AgentChatChangedFile[] = Object.freeze(
    paths.flatMap<AgentChatChangedFile>((path) => {
      const beforeHash = before.get(path)
      const afterHash = after.get(path)
      if (beforeHash === undefined && afterHash !== undefined) {
        return [{ changeType: 'added', path }]
      }
      if (beforeHash !== undefined && afterHash === undefined) {
        return [{ changeType: 'deleted', path }]
      }
      if (beforeHash !== afterHash) {
        return [{ changeType: 'modified', path }]
      }
      return []
    })
  )

  return Object.freeze({
    available: true,
    files
  })
}

export const captureChangedFilesAroundTurn = async <T>(
  input: CaptureChangedFilesAroundTurnInput<T>
): Promise<CaptureChangedFilesAroundTurnResult<T>> => {
  let before: readonly AgentChatWorkspaceFileSnapshot[] | undefined
  let beforeError: unknown
  try {
    before = await input.snapshotProvider.captureSnapshot(input.workspaceRoot)
  } catch (error) {
    beforeError = error
  }

  const result = await input.operation()

  let after: readonly AgentChatWorkspaceFileSnapshot[] | undefined
  let afterError: unknown
  try {
    after = await input.snapshotProvider.captureSnapshot(input.workspaceRoot)
  } catch (error) {
    afterError = error
  }

  return Object.freeze({
    result,
    summary: summarizeChangedFiles({ after, afterError, before, beforeError })
  })
}
