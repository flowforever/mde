import type { AgentEngineId } from '@mde/automation-flow'

import type {
  AgentCliAdapter,
  AgentCliCommandResult,
  AgentCliOpenNativeSessionInput,
  AgentCliCapabilityProbeInput,
  AgentCliCapabilityProbeReport,
  AgentCliResumeInput,
  AgentCliRunInput,
  AgentCliRunResult,
  AgentCliCapabilitySet
} from './agentCliAdapters'

export const REQUIRED_RUN_CAPABILITIES = Object.freeze([
  'mdeRuntimeTools',
  'nonInteractiveRun',
  'runScopedRuntimeAuthorization',
  'structuredEventStream',
  'workingDirectory'
] as const satisfies readonly (keyof AgentCliCapabilitySet)[])

export interface AutomationAdapterRegistry {
  readonly assertCanStartRun: (
    engine: AgentEngineId,
    input: AgentCliCapabilityProbeInput
  ) => Promise<AgentCliCapabilityProbeReport>
  readonly cancelRun: (
    engine: AgentEngineId,
    runId: string
  ) => Promise<AgentCliCommandResult>
  readonly openNativeSession: (
    engine: AgentEngineId,
    input: AgentCliOpenNativeSessionInput
  ) => Promise<AgentCliCommandResult>
  readonly probe: (
    engine: AgentEngineId,
    input: AgentCliCapabilityProbeInput
  ) => Promise<AgentCliCapabilityProbeReport>
  readonly probeAll: (
    input: AgentCliCapabilityProbeInput
  ) => Promise<readonly AgentCliCapabilityProbeReport[]>
  readonly resumeRun: (
    engine: AgentEngineId,
    input: AgentCliResumeInput
  ) => Promise<AgentCliRunResult>
  readonly startRun: (
    engine: AgentEngineId,
    input: AgentCliRunInput
  ) => Promise<AgentCliRunResult>
}

export const createAutomationAdapterRegistry = (
  adapters: readonly AgentCliAdapter[]
): AutomationAdapterRegistry => {
  const adapterByEngine = new Map(adapters.map((adapter) => [adapter.engine, adapter]))

  const probe = async (
    engine: AgentEngineId,
    input: AgentCliCapabilityProbeInput
  ): Promise<AgentCliCapabilityProbeReport> => {
    const adapter = adapterByEngine.get(engine)

    if (adapter === undefined) {
      throw new Error(`No adapter registered for ${engine}.`)
    }

    return adapter.probe(input)
  }

  const registry: AutomationAdapterRegistry = {
    async assertCanStartRun(
      engine: AgentEngineId,
      input: AgentCliCapabilityProbeInput
    ) {
      const report = await probe(engine, input)

      if (
        report.verdict !== 'full' ||
        !REQUIRED_RUN_CAPABILITIES.every(
          (capability) => report.capabilities[capability]
        )
      ) {
        throw new Error('Required adapter capabilities are unavailable.')
      }

      return report
    },
    async cancelRun(engine, runId) {
      const adapter = adapterByEngine.get(engine)

      if (adapter === undefined) {
        throw new Error(`No adapter registered for ${engine}.`)
      }

      return adapter.cancelRun(runId)
    },
    async openNativeSession(engine, input) {
      const adapter = adapterByEngine.get(engine)

      if (adapter === undefined) {
        throw new Error(`No adapter registered for ${engine}.`)
      }

      return adapter.openNativeSession(input)
    },
    probe,
    async probeAll(input: AgentCliCapabilityProbeInput) {
      return Object.freeze(
        await Promise.all(adapters.map((adapter) => adapter.probe(input)))
      )
    },
    async resumeRun(engine, input) {
      const adapter = adapterByEngine.get(engine)

      if (adapter === undefined) {
        throw new Error(`No adapter registered for ${engine}.`)
      }

      return adapter.resumeRun(input)
    },
    async startRun(engine, input) {
      const adapter = adapterByEngine.get(engine)

      if (adapter === undefined) {
        throw new Error(`No adapter registered for ${engine}.`)
      }

      return adapter.startRun(input)
    }
  }

  return Object.freeze(registry)
}
