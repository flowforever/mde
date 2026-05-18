import { lstat, mkdir, readlink, realpath, rm, symlink } from 'node:fs/promises'
import { dirname, isAbsolute, join, parse, resolve } from 'node:path'

const BUILT_IN_AUTOMATION_TOOL_SKILLS = Object.freeze([
  'automation-flow-helper'
] as const)

export type AutomationToolSkillLinkStatus =
  | 'conflict'
  | 'linked'
  | 'source-missing'
  | 'unchanged'

export interface AutomationToolSkillLinkResult {
  readonly skillId: string
  readonly sourcePath?: string
  readonly status: AutomationToolSkillLinkStatus
  readonly targetPath: string
  readonly targetRoot: string
}

export interface LinkBuiltInAutomationToolSkillsInput {
  readonly homePath: string
  readonly platform?: NodeJS.Platform
  readonly repoRoot: string
  readonly resourcesPath?: string
  readonly skillIds?: readonly string[]
  readonly targetRoots?: readonly string[]
}

const defaultTargetRoots = (homePath: string): readonly string[] =>
  Object.freeze([
    join(homePath, '.codex', 'skills'),
    join(homePath, '.agents', 'skills')
  ])

const isNotFoundError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { readonly code?: unknown }).code === 'ENOENT'

const uniqueStrings = (values: readonly (string | undefined)[]): readonly string[] =>
  Object.freeze(
    Array.from(
      new Set(
        values
          .filter((value): value is string => value !== undefined)
          .map((value) => resolve(value))
      )
    )
  )

const getAncestorSkillCandidates = ({
  root,
  skillId
}: {
  readonly root: string
  readonly skillId: string
}): readonly string[] => {
  const filesystemRoot = parse(root).root
  let current = resolve(root)
  const candidates: string[] = []

  for (;;) {
    candidates.push(join(current, 'skills', skillId))
    if (current === filesystemRoot) {
      break
    }

    current = dirname(current)
  }

  return Object.freeze(candidates)
}

const hasSkillMarkdown = async (skillRoot: string): Promise<boolean> => {
  try {
    const skillMarkdown = await lstat(join(skillRoot, 'SKILL.md'))

    return skillMarkdown.isFile()
  } catch (error) {
    if (isNotFoundError(error)) {
      return false
    }

    throw error
  }
}

const findSkillSourceRoot = async ({
  repoRoot,
  resourcesPath,
  skillId
}: {
  readonly repoRoot: string
  readonly resourcesPath?: string
  readonly skillId: string
}): Promise<string | undefined> => {
  const candidates = uniqueStrings([
    ...getAncestorSkillCandidates({ root: repoRoot, skillId }),
    resourcesPath === undefined
      ? undefined
      : join(resourcesPath, 'skills', skillId)
  ])

  for (const candidate of candidates) {
    if (await hasSkillMarkdown(candidate)) {
      return realpath(candidate)
    }
  }

  return undefined
}

const resolveSymlinkTarget = ({
  linkPath,
  target
}: {
  readonly linkPath: string
  readonly target: string
}): string => (isAbsolute(target) ? target : resolve(dirname(linkPath), target))

const linkSkillToTargetRoot = async ({
  platform,
  skillId,
  sourcePath,
  targetRoot
}: {
  readonly platform: NodeJS.Platform
  readonly skillId: string
  readonly sourcePath: string
  readonly targetRoot: string
}): Promise<AutomationToolSkillLinkResult> => {
  const targetPath = join(targetRoot, skillId)

  await mkdir(targetRoot, { recursive: true })

  try {
    const existingTarget = await lstat(targetPath)

    if (!existingTarget.isSymbolicLink()) {
      return Object.freeze({
        skillId,
        sourcePath,
        status: 'conflict' as const,
        targetPath,
        targetRoot
      })
    }

    const existingTargetPath = resolveSymlinkTarget({
      linkPath: targetPath,
      target: await readlink(targetPath)
    })
    const existingSourcePath = await realpath(existingTargetPath).catch(
      () => undefined
    )

    if (existingSourcePath === sourcePath) {
      return Object.freeze({
        skillId,
        sourcePath,
        status: 'unchanged' as const,
        targetPath,
        targetRoot
      })
    }

    await rm(targetPath, { force: true, recursive: true })
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error
    }
  }

  await symlink(sourcePath, targetPath, platform === 'win32' ? 'junction' : 'dir')

  return Object.freeze({
    skillId,
    sourcePath,
    status: 'linked' as const,
    targetPath,
    targetRoot
  })
}

export const linkBuiltInAutomationToolSkills = async ({
  homePath,
  platform = process.platform,
  repoRoot,
  resourcesPath,
  skillIds = BUILT_IN_AUTOMATION_TOOL_SKILLS,
  targetRoots = defaultTargetRoots(homePath)
}: LinkBuiltInAutomationToolSkillsInput): Promise<
  readonly AutomationToolSkillLinkResult[]
> => {
  const results: AutomationToolSkillLinkResult[] = []

  for (const skillId of skillIds) {
    const sourcePath = await findSkillSourceRoot({
      repoRoot,
      resourcesPath,
      skillId
    })

    if (sourcePath === undefined) {
      for (const targetRoot of targetRoots) {
        results.push(
          Object.freeze({
            skillId,
            status: 'source-missing' as const,
            targetPath: join(targetRoot, skillId),
            targetRoot
          })
        )
      }
      continue
    }

    for (const targetRoot of targetRoots) {
      results.push(
        await linkSkillToTargetRoot({
          platform,
          skillId,
          sourcePath,
          targetRoot
        })
      )
    }
  }

  return Object.freeze(results)
}
