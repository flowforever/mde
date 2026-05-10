import { orderAutomationFlowTaskCandidates } from './matching'
import type {
  AutomationFlow,
  AutomationFlowLoopPlan,
  AutomationFlowTaskCandidate,
  AutomationRunOverlay
} from './types'

const isBlockedRun = (run: AutomationRunOverlay): boolean =>
  run.state === 'needs-me'

const isExecutingRun = (run: AutomationRunOverlay): boolean =>
  run.state === 'running'

const addMinutes = (date: Date, minutes: number): Date =>
  new Date(date.getTime() + minutes * 60_000)

export const planAutomationFlowLoop = ({
  activeRuns,
  automationFlow,
  now,
  readyCandidates
}: {
  readonly activeRuns: readonly AutomationRunOverlay[]
  readonly automationFlow: AutomationFlow
  readonly now?: Date
  readonly readyCandidates: readonly AutomationFlowTaskCandidate[]
}): AutomationFlowLoopPlan => {
  if (automationFlow.lifecycle !== 'enabled') {
    return Object.freeze({
      action: 'idle',
      reason: 'automation-flow is not enabled'
    })
  }

  if (automationFlow.loopPolicy.mode === 'manual') {
    return Object.freeze({
      action: 'idle',
      reason: 'automation-flow uses manual loop mode'
    })
  }

  const blockedRun = activeRuns.find(isBlockedRun)

  if (
    blockedRun !== undefined &&
    automationFlow.loopPolicy.onBlocked === 'pause-automation-flow'
  ) {
    return Object.freeze({
      action: 'pause-automation-flow',
      blockedRunId: blockedRun.runId,
      reason: 'blocked run requires a user decision'
    })
  }

  const executingRunCount = activeRuns.filter(isExecutingRun).length

  if (executingRunCount >= automationFlow.loopPolicy.maxActiveRuns) {
    return Object.freeze({
      action: 'at-capacity',
      reason: 'maximum active run capacity reached'
    })
  }

  const nextCandidate = orderAutomationFlowTaskCandidates(
    automationFlow,
    readyCandidates
  )[0]

  if (nextCandidate !== undefined) {
    return Object.freeze({
      action: 'start-run',
      taskId: nextCandidate.taskId
    })
  }

  if (automationFlow.loopPolicy.onEmpty === 'stop') {
    return Object.freeze({
      action: 'stop',
      reason: 'empty queue should stop the automation-flow'
    })
  }

  return Object.freeze({
    action: 'wait',
    nextScanAt:
      now === undefined
        ? undefined
        : addMinutes(now, automationFlow.loopPolicy.intervalMinutes).toISOString(),
    reason: 'no ready candidates'
  })
}
