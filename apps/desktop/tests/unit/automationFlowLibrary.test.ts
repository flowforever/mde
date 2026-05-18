import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { describe, expect, it } from 'vitest'

import { renderAutomationFlowTemplate, getBuiltInAutomationFlowTemplate } from '@mde/automation-flow'

import { loadAutomationFlowLibrary } from '../../src/main/services/automation/automationFlowLibrary'

const createTempRoot = (prefix: string): Promise<string> =>
  mkdtemp(join(tmpdir(), prefix))

const renderFlow = (flowId: string, scope: 'user' | 'workspace'): string =>
  renderAutomationFlowTemplate(
    getBuiltInAutomationFlowTemplate(
      scope === 'workspace' ? 'local-dev-task' : 'research-and-notes'
    ),
    {
      defaultEngine: 'codex',
      flowId,
      scope
    }
  )

describe('automationFlowLibrary', () => {
  it('loads user-global and workspace-local automation-flow Markdown files', async () => {
    const homePath = await createTempRoot('mde-home-')
    const workspaceRoot = await createTempRoot('mde-workspace-')

    await mkdir(join(homePath, '.mde', 'automation-flows'), { recursive: true })
    await mkdir(join(workspaceRoot, '.mde', 'automation-flows'), {
      recursive: true
    })
    await writeFile(
      join(homePath, '.mde', 'automation-flows', 'research.md'),
      renderFlow('research-flow', 'user')
    )
    await writeFile(
      join(workspaceRoot, '.mde', 'automation-flows', 'tasks.md'),
      renderFlow('workspace-flow', 'workspace')
    )

    const library = await loadAutomationFlowLibrary({ homePath, workspaceRoot })

    expect(library.automationFlows.map((flow) => flow.id).sort()).toEqual([
      'research-flow',
      'workspace-flow'
    ])
    expect(library.diagnostics).toEqual([])
  })

  it('loads only direct child Markdown files as flow specs', async () => {
    const homePath = await createTempRoot('mde-home-')
    const workspaceRoot = await createTempRoot('mde-workspace-')

    await mkdir(join(workspaceRoot, '.mde', 'automation-flows', 'flow-a'), {
      recursive: true
    })
    await writeFile(
      join(workspaceRoot, '.mde', 'automation-flows', 'flow-a.md'),
      renderFlow('flow-a', 'workspace')
    )
    await writeFile(
      join(
        workspaceRoot,
        '.mde',
        'automation-flows',
        'flow-a',
        'implementation.md'
      ),
      '# Executor'
    )

    const library = await loadAutomationFlowLibrary({ homePath, workspaceRoot })

    expect(library.automationFlows.map((flow) => flow.id)).toEqual(['flow-a'])
    expect(library.diagnostics).toEqual([])
  })

  it('ignores archived definitions and returns diagnostics for invalid formal flows', async () => {
    const homePath = await createTempRoot('mde-home-')
    const workspaceRoot = await createTempRoot('mde-workspace-')

    await mkdir(join(workspaceRoot, '.mde', 'automation-flows', 'archived'), {
      recursive: true
    })
    await writeFile(
      join(workspaceRoot, '.mde', 'automation-flows', 'archived', 'old.md'),
      renderFlow('old-flow', 'workspace')
    )
    await writeFile(
      join(workspaceRoot, '.mde', 'automation-flows', 'broken.md'),
      renderFlow('broken-flow', 'workspace').replace('defaultEngine: "codex"', '')
    )

    const library = await loadAutomationFlowLibrary({ homePath, workspaceRoot })

    expect(library.automationFlows).toEqual([])
    expect(library.diagnostics).toMatchObject([
      {
        code: 'automationFlow.missingRequiredField',
        severity: 'error'
      }
    ])
    expect(library.diagnostics[0]?.sourceFile).toContain('broken.md')
  })
})
