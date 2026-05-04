export interface WorkspaceFileHistoryEntry {
  readonly lastOpenedFilePath: string | null
  readonly recentFilePaths: readonly string[]
}

export type WorkspaceFileHistory = ReadonlyMap<
  string,
  WorkspaceFileHistoryEntry
>

interface StoredWorkspaceFileHistoryEntry {
  readonly lastOpenedFilePath: string | null
  readonly recentFilePaths: readonly string[]
  readonly workspaceRoot: string
}

export const WORKSPACE_FILE_HISTORY_STORAGE_KEY = 'mde.workspaceFileHistory'

const MAX_RECENT_FILES = 20
const STABLE_RECENT_FILE_ORDER_LIMIT = 7

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isPathAtOrInside = (entryPath: string, targetPath: string): boolean =>
  targetPath === entryPath || targetPath.startsWith(`${entryPath}/`)

const replacePathPrefix = (
  targetPath: string,
  oldPath: string,
  newPath: string
): string =>
  targetPath === oldPath
    ? newPath
    : `${newPath}/${targetPath.slice(oldPath.length + 1)}`

const normalizeRecentFilePaths = (value: unknown): readonly string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const seenFilePaths = new Set<string>()

  return value.flatMap((filePath): string[] => {
    if (!isNonEmptyString(filePath) || seenFilePaths.has(filePath)) {
      return []
    }

    seenFilePaths.add(filePath)
    return [filePath]
  }).slice(0, MAX_RECENT_FILES)
}

const isStoredWorkspaceFileHistoryEntry = (
  value: unknown
): value is StoredWorkspaceFileHistoryEntry => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    isNonEmptyString(candidate.workspaceRoot) &&
    (candidate.lastOpenedFilePath === null ||
      isNonEmptyString(candidate.lastOpenedFilePath)) &&
    Array.isArray(candidate.recentFilePaths)
  )
}

export const readWorkspaceFileHistory = (
  storage: Pick<Storage, 'getItem'> = globalThis.localStorage
): WorkspaceFileHistory => {
  try {
    const storedValue = storage.getItem(WORKSPACE_FILE_HISTORY_STORAGE_KEY)

    if (!storedValue) {
      return new Map()
    }

    const parsedValue = JSON.parse(storedValue) as unknown

    if (!Array.isArray(parsedValue)) {
      return new Map()
    }

    return parsedValue.reduce<Map<string, WorkspaceFileHistoryEntry>>(
      (history, value) => {
        if (!isStoredWorkspaceFileHistoryEntry(value)) {
          return history
        }

        if (history.has(value.workspaceRoot)) {
          return history
        }

        history.set(value.workspaceRoot, {
          lastOpenedFilePath: value.lastOpenedFilePath,
          recentFilePaths: normalizeRecentFilePaths(value.recentFilePaths)
        })

        return history
      },
      new Map()
    )
  } catch {
    return new Map()
  }
}

export const writeWorkspaceFileHistory = (
  history: WorkspaceFileHistory,
  storage: Pick<Storage, 'setItem'> = globalThis.localStorage
): void => {
  try {
    storage.setItem(
      WORKSPACE_FILE_HISTORY_STORAGE_KEY,
      JSON.stringify(
        Array.from(history.entries()).map(([workspaceRoot, entry]) => ({
          lastOpenedFilePath: entry.lastOpenedFilePath,
          recentFilePaths: entry.recentFilePaths,
          workspaceRoot
        }))
      )
    )
  } catch {
    // Storage may be unavailable in restricted renderer contexts.
  }
}

export const rememberWorkspaceFile = (
  history: WorkspaceFileHistory,
  workspaceRoot: string,
  filePath: string
): WorkspaceFileHistory => {
  if (!isNonEmptyString(workspaceRoot) || !isNonEmptyString(filePath)) {
    return history
  }

  const currentEntry = history.get(workspaceRoot)
  const currentRecentFilePaths = currentEntry?.recentFilePaths ?? []
  const currentIndex = currentRecentFilePaths.indexOf(filePath)
  const shouldKeepCurrentOrder =
    currentIndex >= 0 && currentIndex < STABLE_RECENT_FILE_ORDER_LIMIT
  const recentFilePaths = shouldKeepCurrentOrder
    ? currentRecentFilePaths.slice(0, MAX_RECENT_FILES)
    : [
        filePath,
        ...currentRecentFilePaths.filter(
          (currentFilePath) => currentFilePath !== filePath
        )
      ].slice(0, MAX_RECENT_FILES)
  const nextHistory = new Map(history)

  nextHistory.set(workspaceRoot, {
    lastOpenedFilePath: filePath,
    recentFilePaths
  })

  return nextHistory
}

export const renameWorkspaceFileHistoryEntry = (
  history: WorkspaceFileHistory,
  workspaceRoot: string,
  oldPath: string,
  newPath: string
): WorkspaceFileHistory => {
  const currentEntry = history.get(workspaceRoot)

  if (
    !currentEntry ||
    !isNonEmptyString(oldPath) ||
    !isNonEmptyString(newPath)
  ) {
    return history
  }

  const seenFilePaths = new Set<string>()
  const renameFilePath = (filePath: string): string =>
    isPathAtOrInside(oldPath, filePath)
      ? replacePathPrefix(filePath, oldPath, newPath)
      : filePath
  const recentFilePaths = currentEntry.recentFilePaths.flatMap((filePath) => {
    const nextFilePath = renameFilePath(filePath)

    if (seenFilePaths.has(nextFilePath)) {
      return []
    }

    seenFilePaths.add(nextFilePath)
    return [nextFilePath]
  })
  const nextHistory = new Map(history)

  nextHistory.set(workspaceRoot, {
    lastOpenedFilePath: currentEntry.lastOpenedFilePath
      ? renameFilePath(currentEntry.lastOpenedFilePath)
      : null,
    recentFilePaths
  })

  return nextHistory
}

export const removeWorkspaceFileHistoryEntry = (
  history: WorkspaceFileHistory,
  workspaceRoot: string,
  entryPath: string
): WorkspaceFileHistory => {
  const currentEntry = history.get(workspaceRoot)

  if (!currentEntry || !isNonEmptyString(entryPath)) {
    return history
  }

  const recentFilePaths = currentEntry.recentFilePaths.filter(
    (filePath) => !isPathAtOrInside(entryPath, filePath)
  )
  const nextHistory = new Map(history)

  nextHistory.set(workspaceRoot, {
    lastOpenedFilePath:
      currentEntry.lastOpenedFilePath &&
      isPathAtOrInside(entryPath, currentEntry.lastOpenedFilePath)
        ? null
        : currentEntry.lastOpenedFilePath,
    recentFilePaths
  })

  return nextHistory
}

export const getWorkspaceLastOpenedFile = (
  history: WorkspaceFileHistory,
  workspaceRoot: string
): string | null => history.get(workspaceRoot)?.lastOpenedFilePath ?? null

export const getWorkspaceRecentFiles = (
  history: WorkspaceFileHistory,
  workspaceRoot: string
): readonly string[] => history.get(workspaceRoot)?.recentFilePaths ?? []
