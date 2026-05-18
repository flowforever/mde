import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { listMarkdownExecutorFiles } from '../../src/main/services/automation/automationExecutorLibrary'

const createTempRoot = (prefix: string): Promise<string> =>
  mkdtemp(join(tmpdir(), prefix))

describe('automationExecutorLibrary', () => {
  it('finds direct Markdown executors for a flow definition', async () => {
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const flowRoot = join(workspaceRoot, '.mde', 'automation-flows')
    const flowDefinitionPath = join(flowRoot, 'flow-a.md')

    await mkdir(join(flowRoot, 'flow-a', 'nested'), { recursive: true })
    await mkdir(join(flowRoot, 'flow-a', 'archived'), { recursive: true })
    await writeFile(flowDefinitionPath, '# Flow')
    await writeFile(join(flowRoot, 'flow-a', 'implementation.md'), '# Execute')
    await writeFile(join(flowRoot, 'flow-a', 'nested', 'ignored.md'), '# Nested')
    await writeFile(join(flowRoot, 'flow-a', 'archived', 'old.md'), '# Archived')

    const executors = await listMarkdownExecutorFiles({
      flowDefinitionPath,
      flowId: 'flow-a'
    })

    expect(executors).toHaveLength(1)
    expect(executors[0]).toMatchObject({
      content: '# Execute',
      executorId: 'implementation',
      path: join(flowRoot, 'flow-a', 'implementation.md')
    })
    expect(executors[0]?.fingerprint).toMatch(/^[a-f0-9]{64}$/u)
  })

  it('returns a changed fingerprint when Markdown content changes', async () => {
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const flowRoot = join(workspaceRoot, '.mde', 'automation-flows')
    const flowDefinitionPath = join(flowRoot, 'flow-a.md')
    const executorPath = join(flowRoot, 'flow-a', 'implementation.md')

    await mkdir(join(flowRoot, 'flow-a'), { recursive: true })
    await writeFile(flowDefinitionPath, '# Flow')
    await writeFile(executorPath, '# Execute')

    const [before] = await listMarkdownExecutorFiles({
      flowDefinitionPath,
      flowId: 'flow-a'
    })

    await writeFile(executorPath, '# Execute\n\nUpdated')

    const [after] = await listMarkdownExecutorFiles({
      flowDefinitionPath,
      flowId: 'flow-a'
    })

    expect(before?.fingerprint).not.toBe(after?.fingerprint)
  })
})
