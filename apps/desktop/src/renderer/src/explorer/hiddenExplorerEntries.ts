export const HIDDEN_EXPLORER_ENTRIES_STORAGE_KEY = 'mde.hiddenExplorerEntries'
export const DEFAULT_HIDDEN_EXPLORER_WORKSPACES_STORAGE_KEY =
  'mde.defaultHiddenExplorerWorkspaces'

type HiddenEntryPathsByWorkspace = ReadonlyMap<string, ReadonlySet<string>>
type DefaultHiddenWorkspaceRoots = ReadonlySet<string>

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export const readHiddenExplorerEntries = (
  storage: Pick<Storage, 'getItem'> = globalThis.localStorage
): HiddenEntryPathsByWorkspace => {
  try {
    const storedValue = storage.getItem(HIDDEN_EXPLORER_ENTRIES_STORAGE_KEY)

    if (!storedValue) {
      return new Map()
    }

    const parsedValue = JSON.parse(storedValue) as unknown

    if (!isObjectRecord(parsedValue)) {
      return new Map()
    }

    return Object.entries(parsedValue).reduce<HiddenEntryPathsByWorkspace>(
      (entriesByWorkspace, [workspaceRoot, entryPaths]) => {
        if (workspaceRoot.trim().length === 0 || !Array.isArray(entryPaths)) {
          return entriesByWorkspace
        }

        const validEntryPaths = entryPaths.filter(
          (entryPath): entryPath is string =>
            typeof entryPath === 'string' && entryPath.trim().length > 0
        )

        if (validEntryPaths.length === 0) {
          return entriesByWorkspace
        }

        return new Map(entriesByWorkspace).set(
          workspaceRoot,
          new Set(validEntryPaths)
        )
      },
      new Map()
    )
  } catch {
    return new Map()
  }
}

export const writeHiddenExplorerEntries = (
  entriesByWorkspace: HiddenEntryPathsByWorkspace,
  storage: Pick<Storage, 'setItem'> = globalThis.localStorage
): void => {
  try {
    const serializableEntries = Object.fromEntries(
      [...entriesByWorkspace.entries()].map(([workspaceRoot, entryPaths]) => [
        workspaceRoot,
        [...entryPaths]
      ])
    )

    storage.setItem(
      HIDDEN_EXPLORER_ENTRIES_STORAGE_KEY,
      JSON.stringify(serializableEntries)
    )
  } catch {
    // Storage may be unavailable in restricted renderer contexts.
  }
}

export const readDefaultHiddenExplorerWorkspaces = (
  storage: Pick<Storage, 'getItem'> = globalThis.localStorage
): DefaultHiddenWorkspaceRoots => {
  try {
    const storedValue = storage.getItem(
      DEFAULT_HIDDEN_EXPLORER_WORKSPACES_STORAGE_KEY
    )

    if (!storedValue) {
      return new Set()
    }

    const parsedValue = JSON.parse(storedValue) as unknown

    if (!Array.isArray(parsedValue)) {
      return new Set()
    }

    return new Set(
      parsedValue.filter(
        (workspaceRoot): workspaceRoot is string =>
          typeof workspaceRoot === 'string' && workspaceRoot.trim().length > 0
      )
    )
  } catch {
    return new Set()
  }
}

export const writeDefaultHiddenExplorerWorkspaces = (
  workspaceRoots: DefaultHiddenWorkspaceRoots,
  storage: Pick<Storage, 'setItem'> = globalThis.localStorage
): void => {
  try {
    storage.setItem(
      DEFAULT_HIDDEN_EXPLORER_WORKSPACES_STORAGE_KEY,
      JSON.stringify([...workspaceRoots])
    )
  } catch {
    // Storage may be unavailable in restricted renderer contexts.
  }
}
