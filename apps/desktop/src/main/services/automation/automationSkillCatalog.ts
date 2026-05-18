import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export type AutomationSkillSourceClass =
  | 'agent-global'
  | 'repo-local'
  | 'unresolved'
  | 'user-global'
  | 'workspace-local'

export interface AutomationSkillCatalogEntry {
  readonly content?: string
  readonly fingerprint?: string
  readonly ref: string
  readonly sourceClass: AutomationSkillSourceClass
  readonly sourcePath?: string
}

export interface AutomationSkillCatalog {
  readonly entries: readonly AutomationSkillCatalogEntry[]
}

export interface AutomationSkillCatalogProvider {
  readonly listSkillRoots: () => Promise<readonly string[]>
  readonly refresh: (
    reason: 'agent-settings' | 'app-start' | 'manual' | 'workspace-change'
  ) => Promise<AutomationSkillCatalog>
  readonly resolveSkillRef: (
    ref: string
  ) => Promise<AutomationSkillCatalogEntry>
}

interface CreateAutomationSkillCatalogProviderInput {
  readonly homePath: string
  readonly listRuntimeSkillRoots?: () => Promise<readonly string[]>
  readonly repoRoot?: string
  readonly workspaceRoot?: string
}

interface SkillRoot {
  readonly path: string
  readonly sourceClass: AutomationSkillSourceClass
}

const normalizeSkillRef = (ref: string): string =>
  ref.startsWith('skill:') ? ref : `skill:${ref}`

const skillIdFromRef = (ref: string): string =>
  normalizeSkillRef(ref).replace(/^skill:/u, '')

const fingerprintSkill = (markdown: string): string =>
  createHash('sha256').update(markdown).digest('hex')

const listSkillEntriesFromRoot = async (
  root: SkillRoot
): Promise<readonly AutomationSkillCatalogEntry[]> => {
  try {
    const entries = await readdir(root.path, { withFileTypes: true })
    const skillDirectories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()

    const skills = await Promise.all(
      skillDirectories.map(async (skillId) => {
        const sourcePath = join(root.path, skillId, 'SKILL.md')
        const markdown = await readFile(sourcePath, 'utf8')

        return Object.freeze({
          content: markdown,
          fingerprint: fingerprintSkill(markdown),
          ref: normalizeSkillRef(skillId),
          sourceClass: root.sourceClass,
          sourcePath
        })
      })
    )

    return Object.freeze(skills)
  } catch {
    return Object.freeze([])
  }
}

const uniqueRoots = (roots: readonly SkillRoot[]): readonly SkillRoot[] => {
  const seen = new Set<string>()

  return Object.freeze(
    roots.filter((root) => {
      if (seen.has(root.path)) {
        return false
      }

      seen.add(root.path)
      return true
    })
  )
}

export const createAutomationSkillCatalogProvider = ({
  homePath,
  listRuntimeSkillRoots = () => Promise.resolve([]),
  repoRoot,
  workspaceRoot
}: CreateAutomationSkillCatalogProviderInput): AutomationSkillCatalogProvider => {
  let catalog: AutomationSkillCatalog = Object.freeze({
    entries: Object.freeze([])
  })

  const listSkillRoots = async (): Promise<readonly string[]> => {
    const runtimeRoots = await listRuntimeSkillRoots()
    const roots = [
      ...(workspaceRoot === undefined
        ? []
        : [join(workspaceRoot, '.codex', 'skills')]),
      ...(repoRoot === undefined ? [] : [join(repoRoot, '.codex', 'skills')]),
      join(homePath, '.codex', 'skills'),
      join(homePath, '.agents', 'skills'),
      ...runtimeRoots
    ]

    return Object.freeze([...new Set(roots)])
  }

  const listTypedRoots = async (): Promise<readonly SkillRoot[]> =>
    uniqueRoots([
      ...(workspaceRoot === undefined
        ? []
        : [
            {
              path: join(workspaceRoot, '.codex', 'skills'),
              sourceClass: 'workspace-local' as const
            }
          ]),
      ...(repoRoot === undefined
        ? []
        : [
            {
              path: join(repoRoot, '.codex', 'skills'),
              sourceClass: 'repo-local' as const
            }
          ]),
      {
        path: join(homePath, '.codex', 'skills'),
        sourceClass: 'user-global'
      },
      {
        path: join(homePath, '.agents', 'skills'),
        sourceClass: 'agent-global'
      },
      ...(await listRuntimeSkillRoots()).map((root) => ({
        path: root,
        sourceClass: 'repo-local' as const
      }))
    ])

  const refresh: AutomationSkillCatalogProvider['refresh'] = async () => {
    const roots = await listTypedRoots()
    const entries = (await Promise.all(roots.map(listSkillEntriesFromRoot)))
      .flat()
      .reduce<AutomationSkillCatalogEntry[]>((accumulator, entry) => {
        if (
          accumulator.some(
            (existingEntry) => existingEntry.ref === entry.ref
          )
        ) {
          return accumulator
        }

        accumulator.push(entry)
        return accumulator
      }, [])

    catalog = Object.freeze({
      entries: Object.freeze(entries)
    })

    return catalog
  }

  const resolveSkillRef: AutomationSkillCatalogProvider['resolveSkillRef'] =
    (ref) => {
      const normalizedRef = normalizeSkillRef(skillIdFromRef(ref))
      const entry = catalog.entries.find(
        (catalogEntry) => catalogEntry.ref === normalizedRef
      )

      return Promise.resolve(
        entry ??
          Object.freeze({
            ref: normalizedRef,
            sourceClass: 'unresolved' as const
          })
      )
    }

  return Object.freeze({
    listSkillRoots,
    refresh,
    resolveSkillRef
  })
}
