import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  loadAppliedGlobalFlowRefs,
  saveAppliedGlobalFlowRefs
} from '../../src/main/services/automation/automationAppliedGlobalFlows'

const createTempRoot = (prefix: string): Promise<string> =>
  mkdtemp(join(tmpdir(), prefix))

describe('automationAppliedGlobalFlows', () => {
  it('loads missing refs as an empty list', async () => {
    const workspaceRoot = await createTempRoot('mde-workspace-')

    await expect(loadAppliedGlobalFlowRefs(workspaceRoot)).resolves.toEqual({
      diagnostics: [],
      flowIds: []
    })
  })

  it('saves unique sorted global flow refs', async () => {
    const workspaceRoot = await createTempRoot('mde-workspace-')

    await saveAppliedGlobalFlowRefs(workspaceRoot, ['release', 'research', 'release'])

    const raw = await readFile(
      join(
        workspaceRoot,
        '.mde',
        'automation-flows',
        '.applied-global-flows.json'
      ),
      'utf8'
    )

    expect(JSON.parse(raw)).toEqual({
      flowIds: ['release', 'research'],
      version: 1
    })
  })

  it('returns diagnostics for invalid JSON', async () => {
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const refsPath = join(
      workspaceRoot,
      '.mde',
      'automation-flows',
      '.applied-global-flows.json'
    )

    await mkdir(join(workspaceRoot, '.mde', 'automation-flows'), {
      recursive: true
    })
    await writeFile(refsPath, '{')

    const result = await loadAppliedGlobalFlowRefs(workspaceRoot)

    expect(result.flowIds).toEqual([])
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'automationFlow.invalidAppliedGlobalRefs',
        severity: 'warning'
      })
    ])
  })
})
