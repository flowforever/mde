import type { Workspace } from '../../../shared/workspace'

export type RecentWorkspace =
  | {
      readonly name: string
      readonly rootPath: string
      readonly type: 'workspace'
    }
  | {
      readonly filePath: string
      readonly name: string
      readonly openedFilePath: string
      readonly rootPath: string
      readonly type: 'file'
    }

interface LegacyRecentWorkspace {
  readonly name: string
  readonly rootPath: string
}

export const RECENT_WORKSPACES_STORAGE_KEY = 'mdv.recentWorkspaces'

const MAX_RECENT_WORKSPACES = 24

const isRecentWorkspace = (value: unknown): value is RecentWorkspace => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>

  const hasBaseShape =
    typeof candidate.name === 'string' &&
    candidate.name.trim().length > 0 &&
    typeof candidate.rootPath === 'string' &&
    candidate.rootPath.trim().length > 0

  if (!hasBaseShape) {
    return false
  }

  if (candidate.type === 'file') {
    return (
      typeof candidate.filePath === 'string' &&
      candidate.filePath.trim().length > 0 &&
      typeof candidate.openedFilePath === 'string' &&
      candidate.openedFilePath.trim().length > 0
    )
  }

  return candidate.type === 'workspace' || candidate.type === undefined
}

const normalizeRecentWorkspace = (
  workspace: RecentWorkspace | LegacyRecentWorkspace
): RecentWorkspace =>
  'type' in workspace && workspace.type === 'file'
    ? workspace
    : {
        name: workspace.name,
        rootPath: workspace.rootPath,
        type: 'workspace'
      }

const getRecentWorkspaceKey = (workspace: RecentWorkspace): string =>
  workspace.type === 'file'
    ? `file:${workspace.filePath}`
    : `workspace:${workspace.rootPath}`

export const readRecentWorkspaces = (
  storage: Pick<Storage, 'getItem'> = globalThis.localStorage
): readonly RecentWorkspace[] => {
  try {
    const storedValue = storage.getItem(RECENT_WORKSPACES_STORAGE_KEY)

    if (!storedValue) {
      return []
    }

    const parsedValue = JSON.parse(storedValue) as unknown

    if (!Array.isArray(parsedValue)) {
      return []
    }

    const seenKeys = new Set<string>()

    return parsedValue.flatMap((value): RecentWorkspace[] => {
      if (!isRecentWorkspace(value)) {
        return []
      }

      const normalizedWorkspace = normalizeRecentWorkspace(value)
      const key = getRecentWorkspaceKey(normalizedWorkspace)

      if (seenKeys.has(key)) {
        return []
      }

      seenKeys.add(key)
      return [normalizedWorkspace]
    })
  } catch {
    return []
  }
}

export const rememberWorkspace = (
  currentWorkspaces: readonly RecentWorkspace[],
  workspace: Pick<
    Workspace,
    'filePath' | 'name' | 'openedFilePath' | 'rootPath' | 'type'
  >
): readonly RecentWorkspace[] => {
  const recentWorkspace: RecentWorkspace =
    workspace.type === 'file' && workspace.filePath && workspace.openedFilePath
      ? {
          filePath: workspace.filePath,
          name: workspace.name,
          openedFilePath: workspace.openedFilePath,
          rootPath: workspace.rootPath,
          type: 'file'
        }
      : {
          name: workspace.name,
          rootPath: workspace.rootPath,
          type: 'workspace'
        }
  const recentWorkspaceKey = getRecentWorkspaceKey(recentWorkspace)

  return [
    recentWorkspace,
    ...currentWorkspaces.filter(
      (currentWorkspace) =>
        getRecentWorkspaceKey(currentWorkspace) !== recentWorkspaceKey
    )
  ].slice(0, MAX_RECENT_WORKSPACES)
}

export const forgetRecentWorkspace = (
  currentWorkspaces: readonly RecentWorkspace[],
  workspace: RecentWorkspace
): readonly RecentWorkspace[] => {
  const removedWorkspaceKey = getRecentWorkspaceKey(workspace)

  return currentWorkspaces.filter(
    (currentWorkspace) => getRecentWorkspaceKey(currentWorkspace) !== removedWorkspaceKey
  )
}

export const writeRecentWorkspaces = (
  storage: Pick<Storage, 'setItem'> = globalThis.localStorage,
  workspaces: readonly RecentWorkspace[]
): void => {
  try {
    storage.setItem(RECENT_WORKSPACES_STORAGE_KEY, JSON.stringify(workspaces))
  } catch {
    // Storage may be unavailable in restricted renderer contexts.
  }
}
