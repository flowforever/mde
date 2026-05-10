import {
  createAutomationTaskCandidateFromDiscoveredSource,
  projectAutomationFlowSignalStack,
  type AutomationFlow,
  type AutomationDiscoveredTaskSource,
  type AutomationFlowDiagnostic,
  type AutomationFlowTaskCandidate,
  type AutomationReportOverlay,
  type AutomationRunOverlay,
  type AutomationSignalStackProjection
} from '@mde/automation-flow'

interface BuildAutomationIndexInput {
  readonly automationFlows: readonly AutomationFlow[]
  readonly discoveredSources: readonly AutomationDiscoveredTaskSource[]
  readonly reports?: readonly AutomationReportOverlay[]
  readonly runs?: readonly AutomationRunOverlay[]
}

export interface AutomationIndexResult {
  readonly candidates: readonly AutomationFlowTaskCandidate[]
  readonly diagnostics: readonly AutomationFlowDiagnostic[]
  readonly projection: AutomationSignalStackProjection
}

export const buildAutomationIndex = ({
  automationFlows,
  discoveredSources,
  reports = [],
  runs = []
}: BuildAutomationIndexInput): AutomationIndexResult => {
  const flowById = new Map(automationFlows.map((flow) => [flow.id, flow]))
  const candidates = discoveredSources.flatMap((source) => {
    const automationFlow = flowById.get(source.automationFlowId)

    if (automationFlow === undefined) {
      return []
    }

    const candidate = createAutomationTaskCandidateFromDiscoveredSource(
      automationFlow,
      source
    )

    return candidate === null ? [] : [candidate]
  })
  const projection = projectAutomationFlowSignalStack({
    candidates,
    reports,
    runs
  })

  return Object.freeze({
    candidates: Object.freeze(candidates),
    diagnostics: Object.freeze([] satisfies AutomationFlowDiagnostic[]),
    projection
  })
}
