import type { AgentEngineId } from '@mde/automation-flow'

import type { AutomationDiagnostic } from '../../../shared/automation'
import type {
  AgentCliAdapter,
  AgentCliCommandResult,
  AgentCliCancelInput,
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

export type AutomationAdapterCapabilityFailureReason =
  | 'authentication-required'
  | 'capability-unavailable'
  | 'missing-required-capability'

export class AutomationAdapterCapabilityError extends Error {
  readonly diagnostics: readonly AutomationDiagnostic[]
  readonly engine: AgentEngineId
  readonly missingRequiredCapabilities: readonly (keyof AgentCliCapabilitySet)[]
  readonly reason: AutomationAdapterCapabilityFailureReason
  readonly report: AgentCliCapabilityProbeReport

  constructor({
    engine,
    missingRequiredCapabilities,
    reason,
    report
  }: {
    readonly engine: AgentEngineId
    readonly missingRequiredCapabilities: readonly (keyof AgentCliCapabilitySet)[]
    readonly reason: AutomationAdapterCapabilityFailureReason
    readonly report: AgentCliCapabilityProbeReport
  }) {
    super(
      reason === 'authentication-required'
        ? 'Adapter authentication is required.'
        : 'Required adapter capabilities are unavailable.'
    )
    this.name = 'AutomationAdapterCapabilityError'
    this.diagnostics = report.diagnostics
    this.engine = engine
    this.missingRequiredCapabilities = missingRequiredCapabilities
    this.reason = reason
    this.report = report
  }
}

const getMissingRequiredCapabilities = (
  capabilities: AgentCliCapabilitySet
): readonly (keyof AgentCliCapabilitySet)[] =>
  Object.freeze(
    REQUIRED_RUN_CAPABILITIES.filter((capability) => !capabilities[capability])
  )

const getCapabilityFailureReason = ({
  missingRequiredCapabilities,
  report
}: {
  readonly missingRequiredCapabilities: readonly (keyof AgentCliCapabilitySet)[]
  readonly report: AgentCliCapabilityProbeReport
}): AutomationAdapterCapabilityFailureReason => {
  if (!report.authenticated) {
    return 'authentication-required'
  }

  if (missingRequiredCapabilities.length > 0) {
    return 'missing-required-capability'
  }

  return 'capability-unavailable'
}

export interface AutomationAdapterRegistry {
  readonly assertCanStartRun: (
    engine: AgentEngineId,
    input: AgentCliCapabilityProbeInput
  ) => Promise<AgentCliCapabilityProbeReport>
  readonly cancelRun: (
    engine: AgentEngineId,
    input: AgentCliCancelInput
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
      const missingRequiredCapabilities = getMissingRequiredCapabilities(
        report.capabilities
      )

      if (
        !report.authenticated ||
        report.verdict !== 'full' ||
        missingRequiredCapabilities.length > 0
      ) {
        throw new AutomationAdapterCapabilityError({
          engine,
          missingRequiredCapabilities,
          reason: getCapabilityFailureReason({
            missingRequiredCapabilities,
            report
          }),
          report
        })
      }

      return report
    },
    async cancelRun(engine, input) {
      const adapter = adapterByEngine.get(engine)

      if (adapter === undefined) {
        throw new Error(`No adapter registered for ${engine}.`)
      }

      return adapter.cancelRun(input)
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
