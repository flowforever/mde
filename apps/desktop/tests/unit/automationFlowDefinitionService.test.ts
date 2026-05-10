import { mkdtemp, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { tmpdir } from 'node:os'

import { describe, expect, it, vi } from 'vitest'

import { createAutomationFlowDefinitionService } from '../../src/main/services/automation/automationFlowDefinitionService'

const createTempRoot = (prefix: string): Promise<string> =>
  mkdtemp(join(tmpdir(), prefix))

describe('automationFlowDefinitionService', () => {
  it('creates user and workspace automation-flow definitions from templates', async () => {
    const homePath = await createTempRoot('mde-home-')
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const service = createAutomationFlowDefinitionService({
      homePath,
      workspaceRoot
    })

    const workspaceDefinition = await service.createFromTemplate({
      defaultEngine: 'codex',
      flowId: 'workspace-task-flow',
      scope: 'workspace',
      templateId: 'local-dev-task'
    })
    const userDefinition = await service.createFromTemplate({
      defaultEngine: 'codex',
      flowId: 'research-flow',
      scope: 'user',
      templateId: 'research-and-notes'
    })

    expect(workspaceDefinition.path).toBe(
      join(
        workspaceRoot,
        '.mde',
        'automation-flows',
        'workspace-task-flow.md'
      )
    )
    expect(userDefinition.path).toBe(
      join(homePath, '.mde', 'automation-flows', 'research-flow.md')
    )
    await expect(readFile(workspaceDefinition.path, 'utf8')).resolves.toContain(
      'id: "workspace-task-flow"'
    )
  })

  it('loads, saves, validates, disables, archives, and restores definitions', async () => {
    const homePath = await createTempRoot('mde-home-')
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const onDidChange = vi.fn()
    const service = createAutomationFlowDefinitionService({
      homePath,
      onDidChange,
      workspaceRoot
    })
    const created = await service.createFromTemplate({
      defaultEngine: 'codex',
      flowId: 'workspace-task-flow',
      scope: 'workspace',
      templateId: 'local-dev-task'
    })
    const editable = await service.loadEditableDocument(created.path)

    expect(editable.validation.ok).toBe(true)
    const saved = await service.saveDefinition(
      created.path,
      editable.markdown.replace('name: "Local Dev Task Automation Flow"', 'name: "Edited Flow"')
    )
    const disabled = await service.setLifecycle(created.path, 'disabled')
    const archived = await service.archiveDefinition(created.path)
    const restored = await service.restoreDefinition(archived.path)

    expect(saved.validation.ok).toBe(true)
    expect(disabled.validation.ok).toBe(true)
    expect(archived.path).toContain(`${join('.mde', 'automation-flows', 'archived')}`)
    expect(restored.path).toBe(join(workspaceRoot, '.mde', 'automation-flows', basename(created.path)))
    expect(onDidChange).toHaveBeenCalledTimes(5)
  })

  it('rejects writes outside user and workspace automation-flow roots', async () => {
    const homePath = await createTempRoot('mde-home-')
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const outsideRoot = await createTempRoot('mde-outside-')
    const service = createAutomationFlowDefinitionService({
      homePath,
      workspaceRoot
    })

    await expect(
      service.saveDefinition(join(outsideRoot, 'flow.md'), '# Outside')
    ).rejects.toThrow(/outside/i)
  })
})
