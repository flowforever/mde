import type { AgentChatWorkspaceFileSnapshot } from './types'

export interface AgentChatProcessRunner {
  readonly execFile: (
    command: string,
    args: readonly string[],
    options?: { readonly cwd?: string; readonly timeoutMs?: number }
  ) => Promise<{ readonly stdout: string; readonly stderr: string }>
  readonly spawn: (
    command: string,
    args: readonly string[],
    options?: { readonly cwd?: string; readonly env?: NodeJS.ProcessEnv }
  ) => AgentChatChildProcess
}

export interface AgentChatChildProcess {
  readonly kill: () => void
  readonly stderr: AsyncIterable<string>
  readonly stdin: {
    readonly end: () => void
    readonly write: (chunk: string) => void
  }
  readonly stdout: AsyncIterable<string>
}

export interface AgentChatFileStore {
  readonly mkdir: (path: string) => Promise<void>
  readonly realpath: (path: string) => Promise<string>
  readonly writeFile: (path: string, bytes: Uint8Array) => Promise<void>
}

export interface AgentChatWorkspaceSnapshotProvider {
  readonly captureSnapshot: (
    workspaceRoot: string
  ) => Promise<readonly AgentChatWorkspaceFileSnapshot[]>
  readonly readDiff?: (
    workspaceRoot: string,
    path: string
  ) => Promise<string | undefined>
}
