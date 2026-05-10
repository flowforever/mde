import { planAutomationFlowLoop } from '@mde/automation-flow'
import type {
  AutomationFlow,
  AutomationFlowLoopPlan,
  AutomationFlowTaskCandidate,
  AutomationRunOverlay
} from '@mde/automation-flow'

interface AutomationSchedulerOptions {
  readonly now?: () => Date
}

interface PlanNextInput {
  readonly activeRuns: readonly AutomationRunOverlay[]
  readonly automationFlow: AutomationFlow
  readonly candidates: readonly AutomationFlowTaskCandidate[]
}

export interface AutomationScheduler {
  readonly planNext: (input: PlanNextInput) => AutomationFlowLoopPlan
}

export const createAutomationScheduler = ({
  now = () => new Date()
}: AutomationSchedulerOptions = {}): AutomationScheduler => {
  const scheduler: AutomationScheduler = {
    planNext({ activeRuns, automationFlow, candidates }) {
      return planAutomationFlowLoop({
        activeRuns: activeRuns.filter(
          (run) => run.automationFlowId === automationFlow.id
        ),
        automationFlow,
        now: now(),
        readyCandidates: candidates.filter(
          (candidate) => candidate.automationFlowId === automationFlow.id
        )
      })
    }
  }

  return Object.freeze(scheduler)
}
