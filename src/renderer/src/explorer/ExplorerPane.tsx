import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  Eye,
  EyeOff,
  FileText,
  FilePlus,
  FolderOpen,
  FolderPlus,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Trash2,
  X
} from 'lucide-react'

import { ExplorerTree } from './ExplorerTree'
import {
  readDefaultHiddenExplorerWorkspaces,
  readHiddenExplorerEntries,
  writeDefaultHiddenExplorerWorkspaces,
  writeHiddenExplorerEntries
} from './hiddenExplorerEntries'
import type { AppState } from '../app/appTypes'
import type { RecentWorkspace } from '../workspaces/recentWorkspaces'
import type { TreeNode } from '../../../shared/fileTree'

interface ExplorerPaneProps {
  readonly isCollapsed?: boolean
  readonly onCreateFile: (filePath: string) => void
  readonly onCreateFolder: (folderPath: string) => void
  readonly onDeleteEntry: () => void
  readonly onForgetWorkspace?: (workspace: RecentWorkspace) => void
  readonly onOpenFile?: () => void
  readonly onOpenWorkspace: () => void
  readonly onRenameEntry: (entryName: string) => void
  readonly onSelectEntry: (entryPath: string | null) => void
  readonly onSelectFile: (filePath: string) => void
  readonly onSwitchWorkspace?: (workspace: RecentWorkspace) => void
  readonly onToggleCollapsed?: () => void
  readonly recentWorkspaces?: readonly RecentWorkspace[]
  readonly shouldAutoOpenWorkspaceDialog?: boolean
  readonly state: AppState
}

type PendingExplorerAction = 'create-file' | 'create-folder' | 'rename' | null

interface EntryContextMenu {
  readonly entry: TreeNode
  readonly x: number
  readonly y: number
}

const EMPTY_HIDDEN_ENTRY_PATHS: ReadonlySet<string> = new Set()

const getEntryName = (entryPath: string): string => {
  const separatorIndex = entryPath.lastIndexOf('/')

  return separatorIndex === -1 ? entryPath : entryPath.slice(separatorIndex + 1)
}

const joinEntryPath = (
  directoryPath: string | null,
  entryPath: string
): string => (directoryPath ? `${directoryPath}/${entryPath}` : entryPath)

const findDirectoryPath = (
  nodes: readonly TreeNode[],
  targetPath: string | null
): string | null => {
  if (!targetPath) {
    return null
  }

  for (const node of nodes) {
    if (node.type !== 'directory') {
      continue
    }

    if (node.path === targetPath) {
      return node.path
    }

    const childDirectoryPath = findDirectoryPath(node.children, targetPath)

    if (childDirectoryPath) {
      return childDirectoryPath
    }
  }

  return null
}

const collectDefaultHiddenEntryPaths = (
  nodes: readonly TreeNode[]
): readonly string[] =>
  nodes.reduce<readonly string[]>((entryPaths, node) => {
    const childEntryPaths =
      node.type === 'directory'
        ? collectDefaultHiddenEntryPaths(node.children)
        : []
    const nodeEntryPaths = node.name.startsWith('.') ? [node.path] : []

    return [...entryPaths, ...nodeEntryPaths, ...childEntryPaths]
  }, [])

const resolveCreatedEntryPath = (
  directoryPath: string | null,
  entryPath: string
): string => {
  if (
    !directoryPath ||
    entryPath === directoryPath ||
    entryPath.startsWith(`${directoryPath}/`)
  ) {
    return entryPath
  }

  return joinEntryPath(directoryPath, entryPath)
}

const filterHiddenNodes = (
  nodes: readonly TreeNode[],
  hiddenEntryPaths: ReadonlySet<string>
): readonly TreeNode[] =>
  nodes.reduce<readonly TreeNode[]>((visibleNodes, node) => {
    if (hiddenEntryPaths.has(node.path)) {
      return visibleNodes
    }

    if (node.type === 'file') {
      return [...visibleNodes, node]
    }

    return [
      ...visibleNodes,
      {
        ...node,
        children: filterHiddenNodes(node.children, hiddenEntryPaths)
      }
    ]
  }, [])

export const ExplorerPane = ({
  isCollapsed = false,
  onCreateFile,
  onCreateFolder,
  onDeleteEntry,
  onForgetWorkspace = () => undefined,
  onOpenFile = () => undefined,
  onOpenWorkspace,
  onRenameEntry,
  onSelectEntry,
  onSelectFile,
  onSwitchWorkspace = () => undefined,
  onToggleCollapsed = () => undefined,
  recentWorkspaces = [],
  shouldAutoOpenWorkspaceDialog = false,
  state
}: ExplorerPaneProps): React.JSX.Element => {
  const [pendingAction, setPendingAction] = useState<PendingExplorerAction>(null)
  const [actionTargetDirectoryPath, setActionTargetDirectoryPath] = useState<
    string | null
  >(null)
  const [entryValue, setEntryValue] = useState('')
  const [contextMenu, setContextMenu] = useState<EntryContextMenu | null>(null)
  const [hiddenEntryPathsByWorkspace, setHiddenEntryPathsByWorkspace] = useState<
    ReadonlyMap<string, ReadonlySet<string>>
  >(readHiddenExplorerEntries)
  const [defaultHiddenWorkspaceRoots, setDefaultHiddenWorkspaceRoots] = useState<
    ReadonlySet<string>
  >(readDefaultHiddenExplorerWorkspaces)
  const [hasDismissedAutoWorkspaceDialog, setHasDismissedAutoWorkspaceDialog] =
    useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [
    showingHiddenEntriesWorkspaceRoot,
    setShowingHiddenEntriesWorkspaceRoot
  ] = useState<string | null>(null)
  const [isWorkspaceDialogManuallyOpen, setIsWorkspaceDialogManuallyOpen] =
    useState(false)
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState('')
  const workspaceRoot = state.workspace?.rootPath ?? null
  const hiddenEntryPaths = workspaceRoot
    ? hiddenEntryPathsByWorkspace.get(workspaceRoot) ?? EMPTY_HIDDEN_ENTRY_PATHS
    : EMPTY_HIDDEN_ENTRY_PATHS

  useEffect(() => {
    writeHiddenExplorerEntries(hiddenEntryPathsByWorkspace)
  }, [hiddenEntryPathsByWorkspace])

  useEffect(() => {
    writeDefaultHiddenExplorerWorkspaces(defaultHiddenWorkspaceRoots)
  }, [defaultHiddenWorkspaceRoots])

  const commitHiddenEntryPaths = (nextPaths: ReadonlySet<string>): void => {
    if (!workspaceRoot) {
      return
    }

    setDefaultHiddenWorkspaceRoots((currentRoots) =>
      currentRoots.has(workspaceRoot)
        ? currentRoots
        : new Set([...currentRoots, workspaceRoot])
    )
    setHiddenEntryPathsByWorkspace((currentPathsByWorkspace) => {
      const nextPathsByWorkspace = new Map(currentPathsByWorkspace)

      if (nextPaths.size === 0) {
        nextPathsByWorkspace.delete(workspaceRoot)
      } else {
        nextPathsByWorkspace.set(workspaceRoot, nextPaths)
      }

      return nextPathsByWorkspace
    })
  }

  const beginAction = (
    action: Exclude<PendingExplorerAction, null>,
    defaultValue: string,
    targetDirectoryPath: string | null = null
  ): void => {
    setPendingAction(action)
    setActionTargetDirectoryPath(targetDirectoryPath)
    setEntryValue(defaultValue)
    setIsConfirmingDelete(false)
  }

  const clearPendingAction = (): void => {
    setPendingAction(null)
    setActionTargetDirectoryPath(null)
    setEntryValue('')
  }

  const closeContextMenu = (): void => {
    setContextMenu(null)
  }

  const closeWorkspaceDialog = (): void => {
    setHasDismissedAutoWorkspaceDialog(true)
    setIsWorkspaceDialogManuallyOpen(false)
    setWorkspaceSearchQuery('')
  }

  const toggleWorkspaceDialog = (): void => {
    if (isWorkspaceDialogOpen) {
      closeWorkspaceDialog()
      return
    }

    setIsWorkspaceDialogManuallyOpen(true)
  }

  const beginContextRename = (): void => {
    if (!contextMenu) {
      return
    }

    onSelectEntry(contextMenu.entry.path)
    beginAction('rename', getEntryName(contextMenu.entry.path))
    closeContextMenu()
  }

  const beginContextDelete = (): void => {
    if (!contextMenu) {
      return
    }

    onSelectEntry(contextMenu.entry.path)
    setIsConfirmingDelete(true)
    clearPendingAction()
    closeContextMenu()
  }

  const hideContextEntry = (): void => {
    if (!contextMenu) {
      return
    }

    const entryPath = contextMenu.entry.path

    commitHiddenEntryPaths(new Set([...effectiveHiddenEntryPaths, entryPath]))
    setShowingHiddenEntriesWorkspaceRoot(null)
    closeContextMenu()
  }

  const showContextEntry = (): void => {
    if (!contextMenu) {
      return
    }

    const entryPath = contextMenu.entry.path
    const isLastHiddenEntry =
      effectiveHiddenEntryPaths.size === 1 &&
      effectiveHiddenEntryPaths.has(entryPath)
    const nextPaths = new Set(effectiveHiddenEntryPaths)

    nextPaths.delete(entryPath)
    commitHiddenEntryPaths(nextPaths)
    if (isLastHiddenEntry) {
      setShowingHiddenEntriesWorkspaceRoot(null)
    }
    closeContextMenu()
  }

  const submitPendingAction = (): void => {
    const trimmedValue = entryValue.trim()

    if (!pendingAction || trimmedValue.length === 0) {
      return
    }

    if (pendingAction === 'create-file') {
      onCreateFile(resolveCreatedEntryPath(actionTargetDirectoryPath, trimmedValue))
    } else if (pendingAction === 'create-folder') {
      onCreateFolder(
        resolveCreatedEntryPath(actionTargetDirectoryPath, trimmedValue)
      )
    } else {
      onRenameEntry(trimmedValue)
    }

    clearPendingAction()
  }

  const selectedEntryName = state.selectedEntryPath
    ? getEntryName(state.selectedEntryPath)
    : ''
  const defaultHiddenEntryPaths =
    state.workspace && workspaceRoot && !defaultHiddenWorkspaceRoots.has(workspaceRoot)
      ? collectDefaultHiddenEntryPaths(state.workspace.tree)
      : []
  const effectiveHiddenEntryPaths =
    defaultHiddenEntryPaths.length > 0
      ? new Set([...hiddenEntryPaths, ...defaultHiddenEntryPaths])
      : hiddenEntryPaths
  const hasHiddenEntries = effectiveHiddenEntryPaths.size > 0
  const hasSelectedEntry = Boolean(state.selectedEntryPath)
  const selectedDirectoryPath = state.workspace
    ? findDirectoryPath(state.workspace.tree, state.selectedEntryPath)
    : null
  const isContextEntryHidden = contextMenu
    ? effectiveHiddenEntryPaths.has(contextMenu.entry.path)
    : false
  const isShowingHiddenEntries =
    Boolean(workspaceRoot) && showingHiddenEntriesWorkspaceRoot === workspaceRoot
  const shouldShowAutoWorkspaceDialog =
    shouldAutoOpenWorkspaceDialog && !hasDismissedAutoWorkspaceDialog
  const isWorkspaceDialogOpen =
    isWorkspaceDialogManuallyOpen || shouldShowAutoWorkspaceDialog
  const workspaceTriggerLabel = state.isOpeningWorkspace
    ? 'Opening...'
    : state.workspace?.name ?? 'Open workspace'
  const workspaceTriggerAriaLabel = state.workspace
    ? 'Manage workspaces'
    : 'Open workspace'
  const normalizedWorkspaceSearchQuery = workspaceSearchQuery.trim().toLowerCase()
  const filteredRecentWorkspaces = recentWorkspaces.filter((workspace) => {
    if (normalizedWorkspaceSearchQuery.length === 0) {
      return true
    }

    const searchableText =
      workspace.type === 'file'
        ? `${workspace.name} ${workspace.filePath} ${workspace.rootPath}`
        : `${workspace.name} ${workspace.rootPath}`

    return searchableText.toLowerCase().includes(normalizedWorkspaceSearchQuery)
  })
  const visibleTree = state.workspace
    ? isShowingHiddenEntries
      ? state.workspace.tree
      : filterHiddenNodes(state.workspace.tree, effectiveHiddenEntryPaths)
    : []

  if (isCollapsed) {
    return (
      <aside className="explorer-pane is-collapsed" aria-label="Explorer">
        <button
          aria-label="Expand explorer sidebar"
          className="explorer-icon-button explorer-sidebar-toggle"
          onClick={onToggleCollapsed}
          title="Expand explorer sidebar"
          type="button"
        >
          <PanelLeftOpen aria-hidden="true" focusable="false" size={17} />
        </button>
      </aside>
    )
  }

  return (
    <aside className="explorer-pane" aria-label="Explorer">
      <div className="explorer-header-row">
        <div className="explorer-header">Explorer</div>
        <button
          aria-label="Collapse explorer sidebar"
          className="explorer-icon-button explorer-sidebar-toggle"
          onClick={onToggleCollapsed}
          title="Collapse explorer sidebar"
          type="button"
        >
          <PanelLeftClose aria-hidden="true" focusable="false" size={17} />
        </button>
      </div>
      <button
        aria-expanded={isWorkspaceDialogOpen}
        aria-haspopup="dialog"
        aria-label={workspaceTriggerAriaLabel}
        className="workspace-manager-button workspace-item-button"
        disabled={state.isOpeningWorkspace}
        onClick={toggleWorkspaceDialog}
        type="button"
      >
        <span>{workspaceTriggerLabel}</span>
        {state.workspace ? <span>{state.workspace.rootPath}</span> : null}
      </button>
      {isWorkspaceDialogOpen ? (
        <div
          className="workspace-dialog-backdrop"
          onClick={closeWorkspaceDialog}
        >
          <div
            aria-label="Workspace manager"
            aria-modal="true"
            className="workspace-dialog"
            onClick={(event) => {
              event.stopPropagation()
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                closeWorkspaceDialog()
              }
            }}
            role="dialog"
          >
            <div className="workspace-dialog-header">
              <div className="workspace-dialog-heading">
                <div className="workspace-dialog-mark" aria-hidden="true">
                  MDE
                </div>
                <div className="workspace-dialog-title-group">
                  <h2 className="workspace-dialog-title">
                    {state.workspace ? 'Workspaces' : 'Open workspace'}
                  </h2>
                  <p className="workspace-dialog-subtitle">
                    Choose a folder workspace or a single Markdown file.
                  </p>
                </div>
              </div>
              <button
                aria-label="Close workspace popup"
                className="explorer-icon-button workspace-dialog-close"
                onClick={closeWorkspaceDialog}
                title="Close workspace popup"
                type="button"
              >
                <X aria-hidden="true" focusable="false" size={16} />
              </button>
            </div>
            <div className="workspace-dialog-content">
              <div className="workspace-primary-actions">
                <button
                  className="workspace-item-button workspace-action-button"
                  onClick={() => {
                    closeWorkspaceDialog()
                    onOpenWorkspace()
                  }}
                  type="button"
                >
                  <span className="workspace-action-icon" aria-hidden="true">
                    <FolderOpen aria-hidden="true" focusable="false" size={18} />
                  </span>
                  <span className="workspace-action-copy">
                    <span>Open new workspace</span>
                    <span>Folder workspace</span>
                  </span>
                </button>
                <button
                  className="workspace-item-button workspace-action-button"
                  onClick={() => {
                    closeWorkspaceDialog()
                    onOpenFile()
                  }}
                  type="button"
                >
                  <span className="workspace-action-icon" aria-hidden="true">
                    <FileText aria-hidden="true" focusable="false" size={18} />
                  </span>
                  <span className="workspace-action-copy">
                    <span>Open Markdown file</span>
                    <span>Single file</span>
                  </span>
                </button>
              </div>
              <div className="workspace-recent-header">
                <div className="workspace-section-title">Recent</div>
                <label className="workspace-search-field">
                  <span className="visually-hidden">
                    Search workspaces and files
                  </span>
                  <input
                    onChange={(event) => {
                      setWorkspaceSearchQuery(event.target.value)
                    }}
                    placeholder="Search"
                    type="search"
                    value={workspaceSearchQuery}
                  />
                </label>
              </div>
              {recentWorkspaces.length > 0 ? (
                <div
                  aria-label="Recent workspaces and files"
                  className="workspace-resource-list"
                >
                  {filteredRecentWorkspaces.length > 0 ? (
                    filteredRecentWorkspaces.map((workspace) => {
                      const resourceType =
                        workspace.type === 'file' ? 'file' : 'workspace'
                      const resourcePath =
                        workspace.type === 'file'
                          ? workspace.filePath
                          : workspace.rootPath

                      return (
                        <div
                          className="workspace-resource-row"
                          key={`${resourceType}:${resourcePath}`}
                        >
                          <button
                            aria-label={`Switch to ${resourceType} ${workspace.name}`}
                            className="workspace-item-button workspace-resource-button"
                            onClick={() => {
                              closeWorkspaceDialog()
                              onSwitchWorkspace(workspace)
                            }}
                            type="button"
                          >
                            <span>{workspace.name}</span>
                            <span>{resourcePath}</span>
                          </button>
                          <button
                            aria-label={`Remove recent ${resourceType} ${workspace.name}`}
                            className="explorer-icon-button workspace-resource-delete"
                            onClick={() => {
                              onForgetWorkspace(workspace)
                            }}
                            title={`Remove recent ${resourceType}`}
                            type="button"
                          >
                            <Trash2
                              aria-hidden="true"
                              focusable="false"
                              size={14}
                            />
                          </button>
                        </div>
                      )
                    })
                  ) : (
                    <p className="workspace-dialog-empty">
                      No matching workspaces or files
                    </p>
                  )}
                </div>
              ) : (
                <p className="workspace-dialog-empty">
                  No recent workspaces or files
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {state.errorMessage ? (
        <p className="explorer-error" role="alert">
          {state.errorMessage}
        </p>
      ) : null}
      {state.workspace ? (
        <div className="explorer-workspace">
          <div className="explorer-toolbar" aria-label="Workspace actions">
            <button
              aria-label="New Markdown file"
              className="explorer-icon-button"
              onClick={() => {
                beginAction(
                  'create-file',
                  joinEntryPath(selectedDirectoryPath, 'Untitled.md'),
                  selectedDirectoryPath
                )
              }}
              title="New Markdown file"
              type="button"
            >
              <FilePlus aria-hidden="true" focusable="false" size={16} />
            </button>
            <button
              aria-label="New folder"
              className="explorer-icon-button"
              onClick={() => {
                beginAction(
                  'create-folder',
                  joinEntryPath(selectedDirectoryPath, 'notes'),
                  selectedDirectoryPath
                )
              }}
              title="New folder"
              type="button"
            >
              <FolderPlus aria-hidden="true" focusable="false" size={16} />
            </button>
            <button
              aria-label={
                hasSelectedEntry
                  ? `Rename selected ${selectedEntryName}`
                  : 'Rename selected entry'
              }
              className="explorer-icon-button"
              disabled={!hasSelectedEntry}
              onClick={() => {
                if (!hasSelectedEntry) {
                  return
                }

                beginAction('rename', selectedEntryName)
              }}
              title="Rename"
              type="button"
            >
              <Pencil aria-hidden="true" focusable="false" size={15} />
            </button>
            <button
              aria-label={
                hasSelectedEntry
                  ? `Delete selected ${selectedEntryName}`
                  : 'Delete selected entry'
              }
              className="explorer-icon-button"
              disabled={!hasSelectedEntry}
              onClick={() => {
                if (!hasSelectedEntry) {
                  return
                }

                setIsConfirmingDelete(true)
                clearPendingAction()
              }}
              title="Delete"
              type="button"
            >
              <Trash2 aria-hidden="true" focusable="false" size={15} />
            </button>
            <button
              aria-label={
                isShowingHiddenEntries ? 'Hide hidden entries' : 'Show hidden entries'
              }
              aria-pressed={isShowingHiddenEntries}
              className="explorer-icon-button"
              disabled={!hasHiddenEntries}
              onClick={() => {
                setShowingHiddenEntriesWorkspaceRoot((currentWorkspaceRoot) =>
                  currentWorkspaceRoot === workspaceRoot ? null : workspaceRoot
                )
              }}
              title={
                isShowingHiddenEntries ? 'Hide hidden entries' : 'Show hidden entries'
              }
              type="button"
            >
              {isShowingHiddenEntries ? (
                <EyeOff aria-hidden="true" focusable="false" size={16} />
              ) : (
                <Eye aria-hidden="true" focusable="false" size={16} />
              )}
            </button>
          </div>
          {pendingAction ? (
            <form
              className="explorer-entry-form"
              onSubmit={(event) => {
                event.preventDefault()
                submitPendingAction()
              }}
            >
              <label>
                {pendingAction === 'create-file'
                  ? 'Markdown file path'
                  : pendingAction === 'create-folder'
                    ? 'Folder path'
                    : 'Entry name'}
                <input
                  onChange={(event) => {
                    setEntryValue(event.target.value)
                  }}
                  value={entryValue}
                />
              </label>
              <div className="explorer-form-actions">
                <button type="submit">
                  {pendingAction === 'rename' ? 'Rename' : 'Create'}
                </button>
                <button onClick={clearPendingAction} type="button">
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
          {isConfirmingDelete && state.selectedEntryPath ? (
            <div className="explorer-delete-confirmation">
              <p>Delete {state.selectedEntryPath}?</p>
              <button
                onClick={() => {
                  onDeleteEntry()
                  setIsConfirmingDelete(false)
                }}
                type="button"
              >
                Confirm delete
              </button>
              <button
                onClick={() => {
                  setIsConfirmingDelete(false)
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          ) : null}
          <ExplorerTree
            key={state.workspace.rootPath}
            nodes={visibleTree}
            onOpenEntryMenu={({ clientX, clientY, entry }) => {
              onSelectEntry(entry.path)
              setContextMenu({ entry, x: clientX, y: clientY })
              closeWorkspaceDialog()
            }}
            onSelectEntry={onSelectEntry}
            onSelectFile={onSelectFile}
            selectedEntryPath={state.selectedEntryPath}
            selectedFilePath={state.selectedFilePath}
          />
          {contextMenu ? (
            <div
              aria-label={`${contextMenu.entry.name} actions`}
              className="explorer-context-menu"
              role="menu"
              style={
                {
                  '--context-menu-x': `${contextMenu.x}px`,
                  '--context-menu-y': `${contextMenu.y}px`
                } as CSSProperties
              }
            >
              <button onClick={beginContextRename} role="menuitem" type="button">
                Rename
              </button>
              <button
                onClick={isContextEntryHidden ? showContextEntry : hideContextEntry}
                role="menuitem"
                type="button"
              >
                {isContextEntryHidden ? 'Show' : 'Hide'}
              </button>
              <button onClick={beginContextDelete} role="menuitem" type="button">
                Delete
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="explorer-empty">Open a folder to browse Markdown files.</p>
      )}
    </aside>
  )
}
