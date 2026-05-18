import type {
  AutomationDiscoveredTaskSource,
  AutomationFlow,
  AutomationFlowExecutorRef,
  AutomationRunKind
} from '@mde/automation-flow'

export interface AutomationPromptBundleInput {
  readonly automationFlow: AutomationFlow
  readonly automationFlowSnapshotId: string
  readonly executorSnapshot?: AutomationFlowExecutorRef
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

const createPromptTitle = ({
  automationFlow,
  runKind,
  taskSource
}: {
  readonly automationFlow: AutomationFlow
  readonly runKind: AutomationRunKind
  readonly taskSource?: AutomationDiscoveredTaskSource
}): string =>
  runKind === 'discovery'
    ? `Parse automation-flow: ${automationFlow.name}`
    : `Run automation task: ${taskSource?.title ?? automationFlow.name}`

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
  executorSnapshot,
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
    `# ${createPromptTitle({ automationFlow, runKind, taskSource })}`,
    '',
    '## MDE Automation Runtime Contract',
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
          '## Task Data',
          '',
          '```json',
          toJsonBlock(taskSource),
          '```',
          '',
          '## Task Data Content',
          '',
          taskSource.contentSnapshot ?? ''
        ]),
    ...(executorSnapshot === undefined
      ? []
      : [
          '',
          '## Executor',
          '',
          `Executor id: ${executorSnapshot.executorId}`,
          `Executor type: ${executorSnapshot.type}`,
          '',
          'Executor instructions:',
          '',
          executorSnapshot.resolvedSource ?? ''
        ])
  ].join('\n')

  return Object.freeze({
    metadata,
    prompt
  })
}
