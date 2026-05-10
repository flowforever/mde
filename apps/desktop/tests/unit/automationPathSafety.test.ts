import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

import { describe, expect, it } from 'vitest'

import {
  assertAutomationEvidencePath,
  assertUserAutomationFlowPath,
  assertWorkspaceAutomationFlowPath,
  assertWorkspaceTaskDocumentPath,
  getUserAutomationFlowRoot,
  getWorkspaceAutomationFlowRoot,
  getWorkspaceTaskRoot
} from '../../src/main/services/automation/automationPathSafety'

const createTempRoot = (prefix: string): Promise<string> =>
  mkdtemp(join(tmpdir(), prefix))

describe('automationPathSafety', () => {
  it('resolves user-global and workspace-local automation-flow roots', () => {
    const homePath = resolve('/tmp/mde-home')
    const workspaceRoot = resolve('/tmp/mde-workspace')

    expect(getUserAutomationFlowRoot(homePath)).toBe(
      join(homePath, '.mde', 'automation-flows')
    )
    expect(getWorkspaceAutomationFlowRoot(workspaceRoot)).toBe(
      join(workspaceRoot, '.mde', 'automation-flows')
    )
  })

  it('accepts automation-flow Markdown files under user and workspace roots', async () => {
    const homePath = await createTempRoot('mde-home-')
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const userFlowPath = join(homePath, '.mde', 'automation-flows', 'flow.md')
    const workspaceFlowPath = join(
      workspaceRoot,
      '.mde',
      'automation-flows',
      'flow.md'
    )

    await mkdir(join(homePath, '.mde', 'automation-flows'), { recursive: true })
    await mkdir(join(workspaceRoot, '.mde', 'automation-flows'), {
      recursive: true
    })

    await expect(assertUserAutomationFlowPath(homePath, userFlowPath)).resolves.toBe(
      userFlowPath
    )
    await expect(
      assertWorkspaceAutomationFlowPath(workspaceRoot, workspaceFlowPath)
    ).resolves.toBe(workspaceFlowPath)
  })

  it('accepts only workspace task Markdown docs under default automation queues', async () => {
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const taskPath = join(
      getWorkspaceTaskRoot(workspaceRoot, 'requirements'),
      'ready.md'
    )

    await mkdir(getWorkspaceTaskRoot(workspaceRoot, 'requirements'), {
      recursive: true
    })

    await expect(
      assertWorkspaceTaskDocumentPath(workspaceRoot, taskPath)
    ).resolves.toBe(taskPath)
    await expect(
      assertWorkspaceTaskDocumentPath(
        workspaceRoot,
        join(workspaceRoot, '.mde', 'docs', 'notes', 'ready.md')
      )
    ).rejects.toThrow(/automation task document/i)
    await expect(
      assertWorkspaceTaskDocumentPath(
        workspaceRoot,
        join(workspaceRoot, '.mde', 'docs', 'tasks', 'ready.txt')
      )
    ).rejects.toThrow(/markdown/i)
  })

  it('rejects traversal escapes and symlinked path components', async () => {
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const outsideRoot = await createTempRoot('mde-outside-')

    await expect(
      assertWorkspaceAutomationFlowPath(
        workspaceRoot,
        join(workspaceRoot, '..', 'outside.md')
      )
    ).rejects.toThrow(/outside/i)

    await mkdir(join(workspaceRoot, '.mde'), { recursive: true })
    await symlink(outsideRoot, join(workspaceRoot, '.mde', 'automation-flows'))

    await expect(
      assertWorkspaceAutomationFlowPath(
        workspaceRoot,
        join(workspaceRoot, '.mde', 'automation-flows', 'flow.md')
      )
    ).rejects.toThrow(/symlink/i)
  })

  it('accepts evidence under automation storage or the run workspace only', async () => {
    const appDataPath = await createTempRoot('mde-app-data-')
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const outsideRoot = await createTempRoot('mde-outside-')
    const automationEvidencePath = join(
      appDataPath,
      'automation',
      'reports',
      'report-1.json'
    )
    const workspaceEvidencePath = join(workspaceRoot, '.mde', 'docs', 'tasks', 'r.md')
    const outsideEvidencePath = join(outsideRoot, 'secret.txt')

    await mkdir(join(appDataPath, 'automation', 'reports'), { recursive: true })
    await mkdir(join(workspaceRoot, '.mde', 'docs', 'tasks'), { recursive: true })
    await writeFile(workspaceEvidencePath, '# Ready')

    await expect(
      assertAutomationEvidencePath({
        appDataPath,
        targetPath: automationEvidencePath,
        workspaceRoot
      })
    ).resolves.toBe(automationEvidencePath)
    await expect(
      assertAutomationEvidencePath({
        appDataPath,
        targetPath: workspaceEvidencePath,
        workspaceRoot
      })
    ).resolves.toBe(workspaceEvidencePath)
    await expect(
      assertAutomationEvidencePath({
        appDataPath,
        targetPath: outsideEvidencePath,
        workspaceRoot
      })
    ).rejects.toThrow(/evidence path/i)
  })
})
