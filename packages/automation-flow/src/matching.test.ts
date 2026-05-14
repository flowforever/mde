import { describe, expect, test } from 'vitest'

import { createAutomationTaskCandidateFromDiscoveredSource } from './discovery'
import {
  createAutomationFlowTaskCandidate,
  matchesAutomationFlowSourceItem,
  orderAutomationFlowTaskCandidates
} from './matching'
import { createAutomationTaskId } from './taskIdentity'
import type { AutomationFlow } from './types'

const makeWorkspaceFlow = (
  taskPathGlobs: readonly string[],
  overrides: Partial<AutomationFlow> = {}
): AutomationFlow => ({
  allowedEngines: ['codex'],
  confirmationPolicy: {
    fileWrites: 'automation-flow-controlled',
    highRisk: 'require-user',
    unclearScope: 'require-user'
  },
  defaultEngine: 'codex',
  id: 'workspace-flow',
  lifecycle: 'enabled',
  loopPolicy: {
    intervalMinutes: 15,
    maxActiveRuns: 1,
    mode: 'continuous',
    onBlocked: 'skip-and-continue',
    onEmpty: 'wait'
  },
  match: {
    taskPathGlobs,
    titleIncludes: ['READY']
  },
  name: 'Workspace Flow',
  pickOrder: [],
  priority: 10,
  reportPattern: 'completion-summary',
  scope: 'workspace',
  sections: {
    acceptanceStandard: 'Accept.',
    executionStandard: 'Execute.',
    pickRules: 'Pick.',
    reportPattern: 'Report.',
    verificationExpectations: 'Verify.'
  },
  sourceTypes: ['workspace-markdown'],
  status: 'formal',
  ...overrides
})

describe('matchesAutomationFlowSourceItem', () => {
  test.each([
    ['.mde/docs/tasks/**/*.md', '.mde/docs/tasks/ship-feature.md'],
    [
      '.mde/docs/requirements/**/*.md',
      '.mde/docs/requirements/automation-center.md'
    ],
    ['.mde/docs/bugs/**/*.md', '.mde/docs/bugs/fix-crash.md']
  ])('matches workspace Markdown glob %s', (glob, relativePath) => {
    expect(
      matchesAutomationFlowSourceItem(makeWorkspaceFlow([glob]), {
        automationStatus: 'ready',
        relativePath,
        sourceItemId: `workspace:${relativePath}`,
        sourceType: 'workspace-markdown',
        title: 'READY Ship automation work'
      })
    ).toBe(true)
  })

  test('matches READY titles and rejects non-ready titles without explicit ready status', () => {
    const flow = makeWorkspaceFlow(['.mde/docs/tasks/**/*.md'])

    expect(
      matchesAutomationFlowSourceItem(flow, {
        automationStatus: 'ready',
        relativePath: '.mde/docs/tasks/ready.md',
        sourceItemId: 'workspace:.mde/docs/tasks/ready.md',
        sourceType: 'workspace-markdown',
        title: 'READY Add automation templates'
      })
    ).toBe(true)
    expect(
      matchesAutomationFlowSourceItem(flow, {
        relativePath: '.mde/docs/tasks/draft.md',
        sourceItemId: 'workspace:.mde/docs/tasks/draft.md',
        sourceType: 'workspace-markdown',
        title: 'Draft automation templates'
      })
    ).toBe(false)
  })

  test('matches explicit ready workspace documents with normal titles', () => {
    expect(
      matchesAutomationFlowSourceItem(
        makeWorkspaceFlow(['.mde/docs/tasks/**/*.md']),
        {
          automationStatus: 'ready',
          relativePath: '.mde/docs/tasks/frontmatter-ready.md',
          sourceItemId: 'workspace:.mde/docs/tasks/frontmatter-ready.md',
          sourceType: 'workspace-markdown',
          title: 'Implement automation templates'
        }
      )
    ).toBe(true)
  })

  test.each([
    ['.mde/docs/tasks/done/ready.md', 'ready' as const],
    ['.mde/docs/tasks/archived/ready.md', 'ready' as const],
    ['.mde/docs/tasks/ready.txt', 'ready' as const],
    ['.mde/docs/tasks/disabled.md', 'disabled' as const],
    ['.mde/docs/tasks/draft.md', 'draft' as const]
  ])('rejects inactive workspace source %s', (relativePath, automationStatus) => {
    expect(
      matchesAutomationFlowSourceItem(
        makeWorkspaceFlow(['.mde/docs/tasks/**/*.md']),
        {
          automationStatus,
          relativePath,
          sourceItemId: `workspace:${relativePath}`,
          sourceType: 'workspace-markdown',
          title: 'READY Skip inactive source'
        }
      )
    ).toBe(false)
  })

  test('matches user prompts by tag and title', () => {
    const userPromptFlow = makeWorkspaceFlow([], {
      match: {
        promptTags: ['research'],
        titleIncludes: ['READY']
      },
      scope: 'user',
      sourceTypes: ['user-prompt']
    })

    expect(
      matchesAutomationFlowSourceItem(userPromptFlow, {
        automationStatus: 'ready',
        sourceItemId: 'user-prompt:research-note',
        sourceType: 'user-prompt',
        tags: ['Research'],
        title: 'READY Build research note'
      })
    ).toBe(true)
    expect(
      matchesAutomationFlowSourceItem(userPromptFlow, {
        automationStatus: 'ready',
        sourceItemId: 'user-prompt:other-note',
        sourceType: 'user-prompt',
        tags: ['personal'],
        title: 'READY Build research note'
      })
    ).toBe(false)
  })

  test('rejects user prompts without explicit ready status', () => {
    expect(
      matchesAutomationFlowSourceItem(
        makeWorkspaceFlow([], {
          match: {
            promptTags: ['research'],
            titleIncludes: ['READY']
          },
          scope: 'user',
          sourceTypes: ['user-prompt']
        }),
        {
          sourceItemId: 'user-prompt:draft-note',
          sourceType: 'user-prompt',
          tags: ['research'],
          title: 'READY Draft note'
        }
      )
    ).toBe(false)
  })

  test('creates candidates with allowed source engine and default fallback engine', () => {
    const flow = makeWorkspaceFlow(['.mde/docs/tasks/**/*.md'], {
      allowedEngines: ['codex'],
      defaultEngine: 'codex'
    })
    const allowedCandidate = createAutomationFlowTaskCandidate(flow, {
      automationStatus: 'ready',
      engine: 'codex',
      relativePath: '.mde/docs/tasks/ready.md',
      sourceItemId: 'workspace:.mde/docs/tasks/ready.md',
      sourceType: 'workspace-markdown',
      title: 'READY Use allowed engine'
    })
    const fallbackCandidate = createAutomationFlowTaskCandidate(flow, {
      automationStatus: 'ready',
      engine: 'claude-code',
      relativePath: '.mde/docs/tasks/fallback.md',
      sourceItemId: 'workspace:.mde/docs/tasks/fallback.md',
      sourceType: 'workspace-markdown',
      title: 'READY Use fallback engine'
    })

    expect(allowedCandidate).toMatchObject({
      engine: 'codex',
      taskId: createAutomationTaskId({
        automationFlowId: flow.id,
        sourceItemId: 'workspace:.mde/docs/tasks/ready.md'
      })
    })
    expect(fallbackCandidate).toMatchObject({
      engine: 'codex',
      taskId: createAutomationTaskId({
        automationFlowId: flow.id,
        sourceItemId: 'workspace:.mde/docs/tasks/fallback.md'
      })
    })
  })

  test('uses the shared task id strategy for scanned and discovered candidates', () => {
    const flow = makeWorkspaceFlow(['.mde/docs/tasks/**/*.md'])
    const sourceItemId =
      'workspace-markdown:/workspace-a:.mde/docs/tasks/ready.md'
    const scannedCandidate = createAutomationFlowTaskCandidate(flow, {
      automationStatus: 'ready',
      relativePath: '.mde/docs/tasks/ready.md',
      sourceItemId,
      sourceType: 'workspace-markdown',
      title: 'READY Use shared identity'
    })
    const discoveredCandidate = createAutomationTaskCandidateFromDiscoveredSource(
      flow,
      {
        automationFlowId: flow.id,
        discoveredAt: '2026-05-10T08:00:00.000Z',
        relativePath: '.mde/docs/tasks/ready.md',
        sourceItemId,
        sourceSnapshotHash: 'snapshot-a',
        sourceType: 'workspace-markdown',
        title: 'READY Use shared identity',
        workspaceId: '/workspace-a'
      }
    )

    expect(scannedCandidate?.taskId).toBe(discoveredCandidate?.taskId)
    expect(scannedCandidate?.taskId).toBe(
      createAutomationTaskId({
        automationFlowId: flow.id,
        sourceItemId
      })
    )
  })

  test('orders candidates by pick order, source priority, then source item id', () => {
    const flow = makeWorkspaceFlow(['.mde/docs/**/*.md'], {
      pickOrder: ['.mde/docs/bugs/**/*.md']
    })
    const ordered = orderAutomationFlowTaskCandidates(flow, [
      {
        automationFlowId: 'workspace-flow',
        engine: 'codex',
        priority: 100,
        relativePath: '.mde/docs/tasks/z.md',
        sourceItemId: 'workspace:.mde/docs/tasks/z.md',
        sourceType: 'workspace-markdown',
        taskId: 'workspace-flow:workspace:.mde/docs/tasks/z.md',
        title: 'READY Z'
      },
      {
        automationFlowId: 'workspace-flow',
        engine: 'codex',
        priority: 1,
        relativePath: '.mde/docs/bugs/a.md',
        sourceItemId: 'workspace:.mde/docs/bugs/a.md',
        sourceType: 'workspace-markdown',
        taskId: 'workspace-flow:workspace:.mde/docs/bugs/a.md',
        title: 'READY A'
      },
      {
        automationFlowId: 'workspace-flow',
        engine: 'codex',
        priority: 10,
        relativePath: '.mde/docs/tasks/a.md',
        sourceItemId: 'workspace:.mde/docs/tasks/a.md',
        sourceType: 'workspace-markdown',
        taskId: 'workspace-flow:workspace:.mde/docs/tasks/a.md',
        title: 'READY A'
      }
    ])

    expect(ordered.map((candidate) => candidate.sourceItemId)).toEqual([
      'workspace:.mde/docs/bugs/a.md',
      'workspace:.mde/docs/tasks/z.md',
      'workspace:.mde/docs/tasks/a.md'
    ])
  })
})
