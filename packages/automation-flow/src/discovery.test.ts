import { describe, expect, it } from 'vitest'

import {
  createAutomationTaskCandidateFromDiscoveredSource,
  normalizeAutomationDiscoveredTaskSources
} from './discovery'
import type { AutomationFlow } from './types'

const flow: AutomationFlow = {
  allowedEngines: ['codex'],
  confirmationPolicy: {
    fileWrites: 'automation-flow-controlled',
    highRisk: 'require-user',
    unclearScope: 'require-user'
  },
  defaultEngine: 'codex',
  id: 'flow-a',
  lifecycle: 'enabled',
  loopPolicy: {
    intervalMinutes: 15,
    maxActiveRuns: 1,
    mode: 'continuous',
    onBlocked: 'pause-automation-flow',
    onEmpty: 'wait'
  },
  match: {},
  name: 'Flow A',
  pickOrder: [],
  priority: 0,
  reportPattern: 'report',
  scope: 'workspace',
  sections: {
    acceptanceStandard: 'accept',
    executionStandard: 'execute',
    pickRules: 'discover',
    reportPattern: 'report',
    verificationExpectations: 'verify'
  },
  sourceTypes: ['local-file', 'remote-issue'],
  status: 'formal'
}

describe('automation-flow discovery', () => {
  it('normalizes local and remote discovery results into stable task sources', () => {
    const sources = normalizeAutomationDiscoveredTaskSources({
      automationFlow: flow,
      discoveredAt: '2026-05-10T08:00:00.000Z',
      sources: [
        {
          contentSnapshot: '# READY Local task\n',
          relativePath: '.mde/docs/tasks/ready.md',
          sourceItemId: 'local-a',
          sourcePath: '/workspace/.mde/docs/tasks/ready.md',
          sourceType: 'local-file',
          title: 'READY Local task',
          workspaceId: '/workspace'
        },
        {
          externalId: '123',
          provider: 'github',
          sourceItemId: 'issue-123',
          sourceType: 'remote-issue',
          sourceUri: 'https://github.com/flowforever/mde/issues/123',
          title: 'READY Remote task'
        }
      ]
    })

    expect(sources[0]?.sourceSnapshotHash).toMatch(/^fnv1a:/)
    expect(sources).toMatchObject([
      {
        automationFlowId: 'flow-a',
        sourceType: 'local-file'
      },
      {
        externalId: '123',
        provider: 'github',
        sourceType: 'remote-issue'
      }
    ])
  })

  it('creates task candidates only from sources emitted by the owning flow', () => {
    const [source] = normalizeAutomationDiscoveredTaskSources({
      automationFlow: flow,
      discoveredAt: '2026-05-10T08:00:00.000Z',
      sources: [
        {
          sourceItemId: 'local-a',
          sourceType: 'local-file',
          title: 'READY Local task'
        }
      ]
    })

    const candidate = createAutomationTaskCandidateFromDiscoveredSource(
      flow,
      source
    )

    expect(candidate?.sourceSnapshotHash).toMatch(/^fnv1a:/)
    expect(candidate).toMatchObject({
      automationFlowId: 'flow-a',
      sourceItemId: 'local-a',
      sourceType: 'local-file',
      taskId: 'flow-a:local-a'
    })
    expect(
      createAutomationTaskCandidateFromDiscoveredSource(
        { ...flow, id: 'other-flow' },
        source
      )
    ).toBeNull()
  })
})
