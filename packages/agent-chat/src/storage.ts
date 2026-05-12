import type {
  AgentChatCapabilityReport,
  AgentChatSessionBinding
} from './types'

export interface AgentChatCapabilityCacheEntry {
  readonly cacheKey: string
  readonly report: AgentChatCapabilityReport
  readonly updatedAt: string
  readonly workspaceRoot: string
}

export interface AgentChatMetadataStorage {
  readonly bindNativeSession: (binding: AgentChatSessionBinding) => Promise<void>
  readonly readCapabilityReport?: (input: {
    readonly cacheKey: string
    readonly workspaceRoot: string
  }) => Promise<AgentChatCapabilityReport | undefined>
  readonly listBindings: (
    workspaceRoot: string
  ) => Promise<readonly AgentChatSessionBinding[]>
  readonly writeCapabilityReport?: (
    entry: AgentChatCapabilityCacheEntry
  ) => Promise<void>
}

export const createMemoryAgentChatMetadataStorage = (): AgentChatMetadataStorage => {
  let bindings: readonly AgentChatSessionBinding[] = []
  let capabilityReports: readonly AgentChatCapabilityCacheEntry[] = []

  return {
    bindNativeSession: (binding) => {
      bindings = Object.freeze([
        ...bindings.filter((item) => item.sessionId !== binding.sessionId),
        Object.freeze({ ...binding })
      ])
      return Promise.resolve()
    },
    listBindings: (workspaceRoot) =>
      Promise.resolve(
        bindings.filter((binding) => binding.workspaceRoot === workspaceRoot)
      ),
    readCapabilityReport: ({ cacheKey, workspaceRoot }) =>
      Promise.resolve(
        capabilityReports.find(
          (entry) =>
            entry.cacheKey === cacheKey && entry.workspaceRoot === workspaceRoot
        )?.report
      ),
    writeCapabilityReport: (entry) => {
      capabilityReports = Object.freeze([
        ...capabilityReports.filter(
          (item) =>
            item.workspaceRoot !== entry.workspaceRoot ||
            item.cacheKey !== entry.cacheKey
        ),
        Object.freeze({
          ...entry,
          report: Object.freeze({ ...entry.report })
        })
      ])
      return Promise.resolve()
    }
  }
}
