import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  getBuiltInAutomationFlowTemplate,
  normalizeAutomationDiscoveredTaskSources,
  renderAutomationFlowTemplate
} from '@mde/automation-flow'
import { describe, expect, it } from 'vitest'

import { buildAutomationIndex } from '../../src/main/services/automation/automationIndexService'
import { loadAutomationFlowLibrary } from '../../src/main/services/automation/automationFlowLibrary'
import { scanWorkspaceMarkdownSources } from '../../src/main/services/automation/automationSourceScanner'

const createTempRoot = (prefix: string): Promise<string> =>
  mkdtemp(join(tmpdir(), prefix))

const renderWorkspaceFlow = (flowId: string, priority: number): string =>
  renderAutomationFlowTemplate(
    getBuiltInAutomationFlowTemplate('local-dev-task'),
    {
      defaultEngine: 'codex',
      flowId,
      scope: 'workspace'
    }
  ).replace('priority: 40', `priority: ${priority}`)

describe('automation index service', () => {
  it('builds candidates only from discovery results while scanners stay helper-only', async () => {
    const homePath = await createTempRoot('mde-home-')
    const workspaceRoot = await createTempRoot('mde-workspace-')

    await mkdir(join(workspaceRoot, '.mde', 'automation-flows'), {
      recursive: true
    })
    await mkdir(join(workspaceRoot, '.mde', 'docs', 'tasks'), {
      recursive: true
    })
    await writeFile(
      join(workspaceRoot, '.mde', 'automation-flows', 'left.md'),
      renderWorkspaceFlow('left-flow', 40)
    )
    await writeFile(
      join(workspaceRoot, '.mde', 'automation-flows', 'right.md'),
      renderWorkspaceFlow('right-flow', 40)
    )
    await writeFile(
      join(workspaceRoot, '.mde', 'docs', 'tasks', 'ready.md'),
      `---
automation:
  status: ready
---
# READY Shared task
`
    )

    const library = await loadAutomationFlowLibrary({ homePath, workspaceRoot })
    const sources = await scanWorkspaceMarkdownSources({ workspaceRoot })
    const leftFlow = library.automationFlows.find((flow) => flow.id === 'left-flow')

    expect(leftFlow).toBeDefined()
    expect(sources.sourceItems).toHaveLength(1)

    const index = buildAutomationIndex({
      automationFlows: library.automationFlows,
      discoveredSources: normalizeAutomationDiscoveredTaskSources({
        automationFlow: leftFlow!,
        discoveredAt: '2026-05-10T08:00:00.000Z',
        sources: sources.sourceItems.map((source) => ({
          contentSnapshot: '# READY Shared task\n',
          relativePath: source.relativePath,
          sourceItemId: source.sourceItemId,
          sourcePath: source.sourcePath,
          sourceType: 'local-file',
          title: source.title,
          workspaceId: source.workspaceId
        }))
      })
    })

    expect(index.candidates).toMatchObject([
      {
        automationFlowId: 'left-flow',
        sourceType: 'local-file',
        title: 'READY Shared task'
      }
    ])
    expect(index.diagnostics).toEqual([])
    expect(index.projection.tasks).toMatchObject([
      {
        bucket: 'ready',
        title: 'READY Shared task'
      }
    ])
  })
})
