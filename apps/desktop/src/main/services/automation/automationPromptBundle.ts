import type {
  AutomationDiscoveredTaskSource,
  AutomationFlow,
  AutomationRunKind
} from '@mde/automation-flow'

export interface AutomationPromptBundleInput {
  readonly automationFlow: AutomationFlow
  readonly automationFlowSnapshotId: string
  readonly runId: string
  readonly runKind: AutomationRunKind
  readonly taskSource?: AutomationDiscoveredTaskSource
  readonly workspaceRoot?: string
}

export interface AutomationPromptBundle {
  readonly metadata: {
    readonly automationFlowId: string
    readonly automationFlowSnapshotId: string
    readonly bundleId: string
    readonly createdAt: string
    readonly runId: string
    readonly runKind: AutomationRunKind
    readonly sourceSnapshotHash?: string
    readonly workspaceRoot?: string
  }
  readonly prompt: string
}

const toJsonBlock = (value: unknown): string => JSON.stringify(value, null, 2)

export const createAutomationPromptBundle = ({
  automationFlow,
  automationFlowSnapshotId,
  runId,
  runKind,
  taskSource,
  workspaceRoot
}: AutomationPromptBundleInput): AutomationPromptBundle => {
  const createdAt = new Date().toISOString()
  const metadata = Object.freeze({
    automationFlowId: automationFlow.id,
    automationFlowSnapshotId,
    bundleId: `${runId}:prompt-bundle`,
    createdAt,
    runId,
    runKind,
    ...(taskSource !== undefined
      ? { sourceSnapshotHash: taskSource.sourceSnapshotHash }
      : {}),
    ...(workspaceRoot !== undefined ? { workspaceRoot } : {})
  })
  const runtimeContract =
    runKind === 'discovery'
      ? 'Return normalized discovered task sources. Do not execute any task.'
      : 'Execute exactly one task source. Emit structured events and a final report.'
  const prompt = [
    '# MDE Automation Runtime Contract',
    '',
    runtimeContract,
    '',
    '## Run Metadata',
    '',
    '```json',
    toJsonBlock(metadata),
    '```',
    '',
    '## Automation Flow Snapshot',
    '',
    '```json',
    toJsonBlock(automationFlow),
    '```',
    ...(taskSource === undefined
      ? []
      : [
          '',
          '## Task Source Snapshot',
          '',
          '```json',
          toJsonBlock(taskSource),
          '```',
          '',
          '## Task Source Content',
          '',
          taskSource.contentSnapshot ?? ''
        ])
  ].join('\n')

  return Object.freeze({
    metadata,
    prompt
  })
}
