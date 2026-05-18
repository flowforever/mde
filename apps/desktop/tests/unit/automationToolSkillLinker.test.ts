import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  realpath,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { linkBuiltInAutomationToolSkills } from '../../src/main/services/automation/automationToolSkillLinker'

const tempRoots: string[] = []

const createTempRoot = async (prefix: string): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), prefix))

  tempRoots.push(root)

  return root
}

const createSkill = async ({
  content = '# Automation Flow Helper',
  repoRoot,
  skillId = 'automation-flow-helper'
}: {
  readonly content?: string
  readonly repoRoot: string
  readonly skillId?: string
}): Promise<string> => {
  const skillRoot = join(repoRoot, 'skills', skillId)

  await mkdir(skillRoot, { recursive: true })
  await writeFile(join(skillRoot, 'SKILL.md'), content, 'utf8')

  return skillRoot
}

const resolveLink = async (linkPath: string): Promise<string> => {
  const target = await readlink(linkPath)

  return resolve(dirname(linkPath), target)
}

describe('automationToolSkillLinker', () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map((root) => rm(root, { force: true, recursive: true }))
    )
    tempRoots.length = 0
  })

  it('links built-in automation-flow helper into Codex and agent skill roots', async () => {
    const homePath = await createTempRoot('mde-home-')
    const repoRoot = await createTempRoot('mde-repo-')
    const sourceRoot = await createSkill({
      content: '---\nname: automation-flow-helper\n---',
      repoRoot
    })
    const realSourceRoot = await realpath(sourceRoot)

    const results = await linkBuiltInAutomationToolSkills({
      homePath,
      platform: 'darwin',
      repoRoot
    })

    expect(results.map((result) => result.status)).toEqual(['linked', 'linked'])
    for (const targetRoot of [
      join(homePath, '.codex', 'skills'),
      join(homePath, '.agents', 'skills')
    ]) {
      const linkPath = join(targetRoot, 'automation-flow-helper')

      expect((await lstat(linkPath)).isSymbolicLink()).toBe(true)
      expect(await resolveLink(linkPath)).toBe(realSourceRoot)
      await expect(readFile(join(linkPath, 'SKILL.md'), 'utf8')).resolves.toContain(
        'name: automation-flow-helper'
      )
    }
  })

  it('repairs stale symlinks but preserves non-symlink user skill directories', async () => {
    const homePath = await createTempRoot('mde-home-')
    const repoRoot = await createTempRoot('mde-repo-')
    const oldRoot = await createTempRoot('mde-old-skill-')
    const sourceRoot = await createSkill({ repoRoot })
    const realSourceRoot = await realpath(sourceRoot)
    const codexTarget = join(homePath, '.codex', 'skills', 'automation-flow-helper')
    const agentTarget = join(homePath, '.agents', 'skills', 'automation-flow-helper')

    await mkdir(dirname(codexTarget), { recursive: true })
    await mkdir(agentTarget, { recursive: true })
    await symlink(oldRoot, codexTarget, 'dir')
    await writeFile(join(agentTarget, 'SKILL.md'), '# User Custom Helper', 'utf8')

    const results = await linkBuiltInAutomationToolSkills({
      homePath,
      platform: 'darwin',
      repoRoot
    })

    expect(results).toEqual([
      expect.objectContaining({
        status: 'linked',
        targetPath: codexTarget
      }),
      expect.objectContaining({
        status: 'conflict',
        targetPath: agentTarget
      })
    ])
    expect(await resolveLink(codexTarget)).toBe(realSourceRoot)
    await expect(readFile(join(agentTarget, 'SKILL.md'), 'utf8')).resolves.toBe(
      '# User Custom Helper'
    )
  })

  it('falls back to packaged resources when repo skills are not present', async () => {
    const homePath = await createTempRoot('mde-home-')
    const repoRoot = await createTempRoot('mde-repo-')
    const resourcesPath = await createTempRoot('mde-resources-')
    const sourceRoot = join(resourcesPath, 'skills', 'automation-flow-helper')

    await mkdir(sourceRoot, { recursive: true })
    await writeFile(join(sourceRoot, 'SKILL.md'), '# Packaged Helper', 'utf8')
    const realSourceRoot = await realpath(sourceRoot)

    const [result] = await linkBuiltInAutomationToolSkills({
      homePath,
      platform: 'darwin',
      repoRoot,
      resourcesPath,
      targetRoots: [join(homePath, '.codex', 'skills')]
    })

    expect(result).toMatchObject({
      sourcePath: realSourceRoot,
      status: 'linked'
    })
    await expect(
      readFile(
        join(homePath, '.codex', 'skills', 'automation-flow-helper', 'SKILL.md'),
        'utf8'
      )
    ).resolves.toBe('# Packaged Helper')
  })
})
