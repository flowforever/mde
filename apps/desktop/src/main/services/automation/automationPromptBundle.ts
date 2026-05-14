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

const createStructuredOutputContract = (
  runKind: AutomationRunKind
): readonly string[] =>
  runKind === 'discovery'
    ? [
        '## Required Structured Output',
        '',
        'Return a JSON object, either directly or in a fenced json block. Do not return a prose-only answer.',
        '',
        '```json',
        toJsonBlock({
          automation: {
            discoveredTaskSources: [
              {
                contentSnapshot: 'Optional exact source content.',
                relativePath: '.mde/docs/tasks/ready.md',
                sourceItemId: 'workspace:.mde/docs/tasks/ready.md',
                sourceSnapshotHash: 'Optional stable hash or version.',
                sourceType: 'workspace-markdown',
                sourceUri: 'Optional file:// or remote URI.',
                tags: ['optional-tag'],
                title: 'READY Example task',
                workspaceId: 'Optional workspace id.'
              }
            ]
          }
        }),
        '```',
        '',
        'Use only sourceType values allowed by the Automation Flow Snapshot. Return an empty discoveredTaskSources array when there is no ready work.'
      ]
    : [
        '## Required Structured Output',
        '',
        'Return a JSON object, either directly or in a fenced json block. Do not return a prose-only answer.',
        '',
        'For completed, failed, blocked, or cancelled work:',
        '',
        '```json',
        toJsonBlock({
          automation: {
            finalReport: {
              outcome: 'succeeded',
              summary: 'What changed and what verification ran.',
              title: 'READY Example task'
            }
          }
        }),
        '```',
        '',
        'For work that needs a human decision before continuing:',
        '',
        '```json',
        toJsonBlock({
          automation: {
            decisionPrompt: 'The specific question or approval request.'
          }
        }),
        '```',
        '',
        'finalReport.outcome must be one of succeeded, failed, blocked, or cancelled.'
      ]

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
    ...createStructuredOutputContract(runKind),
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
