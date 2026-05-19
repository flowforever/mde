import { describe, expect, it } from 'vitest'

import {
  createAutomationTaskId,
  createAutomationTaskCandidateFromDiscoveredSource,
  normalizeAutomationDiscoveredTaskSources
} from './index'
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
          executionRoot: '/workspace/repos/issue-123',
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
        executionRoot: '/workspace/repos/issue-123',
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
      taskId: createAutomationTaskId({
        automationFlowId: 'flow-a',
        sourceItemId: 'local-a'
      })
    })
    expect(
      createAutomationTaskCandidateFromDiscoveredSource(
        { ...flow, id: 'other-flow' },
        source
      )
    ).toBeNull()
  })

  it('preserves task-level execution roots through discovered source candidates', () => {
    const [source] = normalizeAutomationDiscoveredTaskSources({
      automationFlow: flow,
      discoveredAt: '2026-05-10T08:00:00.000Z',
      sources: [
        {
          executionRoot: '/Users/example/work/web',
          requiredExecutorRef: 'skill:code-review',
          sourceItemId: 'web/web!40106@abc1234',
          sourceSnapshotHash: 'abc1234',
          sourceType: 'remote-mr',
          sourceUri: 'https://git.ringcentral.com/web/web/-/merge_requests/40106',
          taskType: 'code-review',
          title: 'Review web/web!40106'
        }
      ]
    })

    const candidate = createAutomationTaskCandidateFromDiscoveredSource(
      flow,
      source
    )

    expect(source).toMatchObject({
      executionRoot: '/Users/example/work/web',
      sourceItemId: 'web/web!40106@abc1234'
    })
    expect(candidate).toMatchObject({
      executionRoot: '/Users/example/work/web',
      requiredExecutorRef: 'skill:code-review',
      taskType: 'code-review'
    })
  })

  it('normalizes task-level execution roots before snapshot and candidate creation', () => {
    const [source] = normalizeAutomationDiscoveredTaskSources({
      automationFlow: flow,
      discoveredAt: '2026-05-10T08:00:00.000Z',
      sources: [
        {
          executionRoot: '/Users/example/work/web/',
          sourceItemId: 'web/web!40106@abc1234',
          sourceSnapshotHash: 'abc1234',
          sourceType: 'remote-mr',
          title: 'Review web/web!40106'
        }
      ]
    })

    const candidate = createAutomationTaskCandidateFromDiscoveredSource(
      flow,
      source
    )

    expect(source?.executionRoot).toBe('/Users/example/work/web')
    expect(candidate?.executionRoot).toBe('/Users/example/work/web')
  })

  it('preserves Windows root execution roots while trimming non-root trailing separators', () => {
    const sources = normalizeAutomationDiscoveredTaskSources({
      automationFlow: flow,
      discoveredAt: '2026-05-10T08:00:00.000Z',
      sources: [
        {
          executionRoot: 'C:\\',
          sourceItemId: 'drive-root-backslash',
          sourceType: 'remote-mr',
          title: 'READY Drive root backslash'
        },
        {
          executionRoot: 'D:/',
          sourceItemId: 'drive-root-forward-slash',
          sourceType: 'remote-mr',
          title: 'READY Drive root forward slash'
        },
        {
          executionRoot: '\\\\server\\share\\',
          sourceItemId: 'unc-share-root',
          sourceType: 'remote-mr',
          title: 'READY UNC share root'
        },
        {
          executionRoot: 'C:\\repo\\',
          sourceItemId: 'windows-repo',
          sourceType: 'remote-mr',
          title: 'READY Windows repo'
        },
        {
          executionRoot: '/Users/example/work/web/',
          sourceItemId: 'posix-repo',
          sourceType: 'remote-mr',
          title: 'READY POSIX repo'
        }
      ]
    })

    expect(sources.map((source) => source.executionRoot)).toEqual([
      'C:\\',
      'D:\\',
      '\\\\server\\share\\',
      'C:\\repo',
      '/Users/example/work/web'
    ])
  })

  it('rejects unsafe discovery source metadata before normalization', () => {
    const sources = normalizeAutomationDiscoveredTaskSources({
      automationFlow: flow,
      discoveredAt: '2026-05-10T08:00:00.000Z',
      sources: [
        {
          relativePath: '.mde/docs/tasks/safe.md',
          sourceItemId: 'safe-source',
          sourcePath: '/workspace/.mde/docs/tasks/safe.md',
          sourceType: 'local-file',
          sourceUri: 'file:///workspace/.mde/docs/tasks/safe.md',
          title: 'READY Safe source'
        },
        {
          relativePath: '../secrets.md',
          sourceItemId: 'traversal-relative',
          sourceType: 'local-file',
          title: 'READY Traversal relative path'
        },
        {
          sourceItemId: 'control\u0000source',
          sourceType: 'remote-issue',
          sourceUri: 'https://github.com/flowforever/mde/issues/1',
          title: 'READY Control char'
        },
        {
          sourceItemId: 'unsafe-uri',
          sourceType: 'remote-doc',
          sourceUri: 'javascript:alert(1)',
          title: 'READY Unsafe URI'
        },
        {
          sourceItemId: 'unsafe-source-path',
          sourcePath: 'https://example.com/raw-path',
          sourceType: 'local-file',
          title: 'READY Unsafe source path'
        },
        {
          executionRoot: 'relative/repo',
          sourceItemId: 'relative-execution-root',
          sourceType: 'remote-mr',
          title: 'READY Relative execution root'
        },
        {
          executionRoot: 'file:///workspace/repo',
          sourceItemId: 'uri-execution-root',
          sourceType: 'remote-mr',
          title: 'READY URI execution root'
        },
        {
          sourceItemId: 'unknown-source-type',
          sourceType: 'unknown-source' as never,
          title: 'READY Unknown source type'
        }
      ]
    })

    expect(sources).toHaveLength(1)
    expect(sources[0]).toMatchObject({
      sourceItemId: 'safe-source',
      sourceType: 'local-file',
      title: 'READY Safe source'
    })
  })
})
