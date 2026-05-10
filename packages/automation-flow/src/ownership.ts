import { createAutomationFlowOwnershipTieDiagnostic } from './diagnostics'
import { createAutomationFlowTaskCandidate } from './matching'
import type {
  AutomationFlow,
  AutomationFlowOwnershipResult,
  AutomationFlowSourceItem,
  AutomationFlowSourceMatch,
  AutomationFlowTaskCandidate
} from './types'

interface OwnershipScore {
  readonly priority: number
  readonly scope: number
  readonly status: number
}

const scoreAutomationFlow = (
  automationFlow: AutomationFlow
): OwnershipScore => ({
  priority: automationFlow.priority,
  scope: automationFlow.scope === 'workspace' ? 1 : 0,
  status: automationFlow.status === 'formal' ? 1 : 0
})

const compareOwnershipScore = (
  left: OwnershipScore,
  right: OwnershipScore
): number => {
  const priorityDelta = right.priority - left.priority

  if (priorityDelta !== 0) {
    return priorityDelta
  }

  const statusDelta = right.status - left.status

  if (statusDelta !== 0) {
    return statusDelta
  }

  return right.scope - left.scope
}

const hasEqualOwnershipScore = (
  left: OwnershipScore,
  right: OwnershipScore
): boolean =>
  left.priority === right.priority &&
  left.scope === right.scope &&
  left.status === right.status

const getDiagnosticSourceFile = (
  sourceItem: AutomationFlowSourceItem
): string | undefined => sourceItem.relativePath ?? sourceItem.sourcePath

export const resolveAutomationFlowOwnership = (
  matches: readonly AutomationFlowSourceMatch[]
): AutomationFlowOwnershipResult => {
  const matchesBySourceItemId = new Map<string, AutomationFlowSourceMatch[]>()

  for (const match of matches) {
    const existingMatches =
      matchesBySourceItemId.get(match.sourceItem.sourceItemId) ?? []

    matchesBySourceItemId.set(match.sourceItem.sourceItemId, [
      ...existingMatches,
      match
    ])
  }

  const candidates: AutomationFlowTaskCandidate[] = []
  const diagnostics = []

  for (const sourceMatches of matchesBySourceItemId.values()) {
    const sortedMatches = [...sourceMatches].sort((left, right) =>
      compareOwnershipScore(
        scoreAutomationFlow(left.automationFlow),
        scoreAutomationFlow(right.automationFlow)
      )
    )
    const winningMatch = sortedMatches[0]

    if (winningMatch === undefined) {
      continue
    }

    const winningScore = scoreAutomationFlow(winningMatch.automationFlow)
    const tiedMatches = sortedMatches.filter((match) =>
      hasEqualOwnershipScore(
        scoreAutomationFlow(match.automationFlow),
        winningScore
      )
    )

    if (tiedMatches.length > 1) {
      diagnostics.push(
        createAutomationFlowOwnershipTieDiagnostic(
          getDiagnosticSourceFile(winningMatch.sourceItem),
          tiedMatches.map((match) => match.automationFlow.id).sort()
        )
      )
      continue
    }

    const candidate = createAutomationFlowTaskCandidate(
      winningMatch.automationFlow,
      winningMatch.sourceItem
    )

    if (candidate !== null) {
      candidates.push(candidate)
    }
  }

  return Object.freeze({
    candidates: Object.freeze(candidates),
    diagnostics: Object.freeze(diagnostics)
  })
}
