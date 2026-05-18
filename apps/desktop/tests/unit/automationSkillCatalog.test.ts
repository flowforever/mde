import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createAutomationSkillCatalogProvider } from '../../src/main/services/automation/automationSkillCatalog'

const createTempRoot = (prefix: string): Promise<string> =>
  mkdtemp(join(tmpdir(), prefix))

describe('automationSkillCatalog', () => {
  it('discovers workspace, user, agent, and runtime skill roots', async () => {
    const homePath = await createTempRoot('mde-home-')
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const runtimeRoot = await createTempRoot('mde-runtime-skills-')

    await mkdir(join(workspaceRoot, '.codex', 'skills', 'flow-helper'), {
      recursive: true
    })
    await mkdir(join(homePath, '.codex', 'skills', 'global-helper'), {
      recursive: true
    })
    await mkdir(join(homePath, '.agents', 'skills', 'agent-helper'), {
      recursive: true
    })
    await mkdir(join(runtimeRoot, 'runtime-helper'), { recursive: true })
    await writeFile(
      join(workspaceRoot, '.codex', 'skills', 'flow-helper', 'SKILL.md'),
      '# Flow Helper'
    )
    await writeFile(
      join(homePath, '.codex', 'skills', 'global-helper', 'SKILL.md'),
      '# Global Helper'
    )
    await writeFile(
      join(homePath, '.agents', 'skills', 'agent-helper', 'SKILL.md'),
      '# Agent Helper'
    )
    await writeFile(
      join(runtimeRoot, 'runtime-helper', 'SKILL.md'),
      '# Runtime Helper'
    )

    const provider = createAutomationSkillCatalogProvider({
      homePath,
      listRuntimeSkillRoots: () => Promise.resolve([runtimeRoot]),
      workspaceRoot
    })
    await provider.refresh('app-start')

    await expect(provider.resolveSkillRef('skill:flow-helper')).resolves.toMatchObject({
      content: '# Flow Helper',
      ref: 'skill:flow-helper',
      sourceClass: 'workspace-local'
    })
    await expect(provider.resolveSkillRef('skill:global-helper')).resolves.toMatchObject({
      ref: 'skill:global-helper',
      sourceClass: 'user-global'
    })
    await expect(provider.resolveSkillRef('skill:agent-helper')).resolves.toMatchObject({
      ref: 'skill:agent-helper',
      sourceClass: 'agent-global'
    })
    await expect(provider.resolveSkillRef('skill:runtime-helper')).resolves.toMatchObject({
      ref: 'skill:runtime-helper',
      sourceClass: 'repo-local'
    })
  })

  it('manual refresh re-reads changed fingerprints and keeps unresolved refs visible', async () => {
    const homePath = await createTempRoot('mde-home-')
    const workspaceRoot = await createTempRoot('mde-workspace-')
    const skillPath = join(
      workspaceRoot,
      '.codex',
      'skills',
      'flow-helper',
      'SKILL.md'
    )
    const provider = createAutomationSkillCatalogProvider({
      homePath,
      workspaceRoot
    })

    await mkdir(join(workspaceRoot, '.codex', 'skills', 'flow-helper'), {
      recursive: true
    })
    await writeFile(skillPath, '# Flow Helper')
    await provider.refresh('app-start')

    const before = await provider.resolveSkillRef('skill:flow-helper')
    await writeFile(skillPath, '# Flow Helper\n\nUpdated')
    await provider.refresh('manual')
    const after = await provider.resolveSkillRef('skill:flow-helper')

    expect(before.fingerprint).not.toBe(after.fingerprint)
    await expect(provider.resolveSkillRef('skill:missing')).resolves.toEqual({
      ref: 'skill:missing',
      sourceClass: 'unresolved'
    })
  })
})
