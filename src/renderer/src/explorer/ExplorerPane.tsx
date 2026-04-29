import { useState } from 'react'
import type { CSSProperties } from 'react'
import {
  Eye,
  EyeOff,
  FilePlus,
  FolderPlus,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Trash2,
  X
} from 'lucide-react'

import { ExplorerTree } from './ExplorerTree'
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
  readonly onSelectEntry: (entryPath: string) => void
  readonly onSelectFile: (filePath: string) => void
  readonly onSwitchWorkspace?: (workspace: RecentWorkspace) => void
  readonly onToggleCollapsed?: () => void
  readonly recentWorkspaces?: readonly RecentWorkspace[]
  readonly state: AppState
}

type PendingExplorerAction = 'create-file' | 'create-folder' | 'rename' | null

interface EntryContextMenu {
  readonly entry: TreeNode
  readonly x: number
  readonly y: number
}

const getEntryName = (entryPath: string): string => {
  const separatorIndex = entryPath.lastIndexOf('/')

  return separatorIndex === -1 ? entryPath : entryPath.slice(separatorIndex + 1)
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
  state
}: ExplorerPaneProps): React.JSX.Element => {
  const [pendingAction, setPendingAction] = useState<PendingExplorerAction>(null)
  const [entryValue, setEntryValue] = useState('')
  const [contextMenu, setContextMenu] = useState<EntryContextMenu | null>(null)
  const [hiddenEntryPaths, setHiddenEntryPaths] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isShowingHiddenEntries, setIsShowingHiddenEntries] = useState(false)
  const [isWorkspaceDialogOpen, setIsWorkspaceDialogOpen] = useState(false)
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState('')

  const beginAction = (
    action: Exclude<PendingExplorerAction, null>,
    defaultValue: string
  ): void => {
    setPendingAction(action)
    setEntryValue(defaultValue)
    setIsConfirmingDelete(false)
  }

  const clearPendingAction = (): void => {
    setPendingAction(null)
    setEntryValue('')
  }

  const closeContextMenu = (): void => {
    setContextMenu(null)
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

    setHiddenEntryPaths((currentPaths) => new Set([...currentPaths, entryPath]))
    setIsShowingHiddenEntries(false)
    closeContextMenu()
  }

  const submitPendingAction = (): void => {
    const trimmedValue = entryValue.trim()

    if (!pendingAction || trimmedValue.length === 0) {
      return
    }

    if (pendingAction === 'create-file') {
      onCreateFile(trimmedValue)
    } else if (pendingAction === 'create-folder') {
      onCreateFolder(trimmedValue)
    } else {
      onRenameEntry(trimmedValue)
    }

    clearPendingAction()
  }

  const selectedEntryName = state.selectedEntryPath
    ? getEntryName(state.selectedEntryPath)
    : ''
  const hasHiddenEntries = hiddenEntryPaths.size > 0
  const hasSelectedEntry = Boolean(state.selectedEntryPath)
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
      : filterHiddenNodes(state.workspace.tree, hiddenEntryPaths)
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
        onClick={() => {
          setIsWorkspaceDialogOpen((currentValue) => !currentValue)
        }}
        type="button"
      >
        <span>{workspaceTriggerLabel}</span>
        {state.workspace ? <span>{state.workspace.rootPath}</span> : null}
      </button>
      {isWorkspaceDialogOpen ? (
        <div
          className="workspace-dialog-backdrop"
          onClick={() => {
            setIsWorkspaceDialogOpen(false)
          }}
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
                setIsWorkspaceDialogOpen(false)
              }
            }}
            role="dialog"
          >
            <div className="workspace-dialog-header">
              <div className="workspace-dialog-title">Workspaces</div>
              <button
                aria-label="Close workspace popup"
                className="explorer-icon-button workspace-dialog-close"
                onClick={() => {
                  setIsWorkspaceDialogOpen(false)
                }}
                title="Close workspace popup"
                type="button"
              >
                <X aria-hidden="true" focusable="false" size={16} />
              </button>
            </div>
            <div className="workspace-dialog-content">
              <label className="workspace-search-field">
                <span>Search workspaces and files</span>
                <input
                  onChange={(event) => {
                    setWorkspaceSearchQuery(event.target.value)
                  }}
                  placeholder="Search"
                  type="search"
                  value={workspaceSearchQuery}
                />
              </label>
              <button
                className="workspace-item-button"
                onClick={() => {
                  setIsWorkspaceDialogOpen(false)
                  onOpenWorkspace()
                }}
                type="button"
              >
                <span>Open new workspace</span>
              </button>
              <button
                className="workspace-item-button"
                onClick={() => {
                  setIsWorkspaceDialogOpen(false)
                  onOpenFile()
                }}
                type="button"
              >
                <span>Open Markdown file</span>
              </button>
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
                              setIsWorkspaceDialogOpen(false)
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
          <div className="explorer-workspace-name">{state.workspace.name}</div>
          <div className="explorer-toolbar" aria-label="Workspace actions">
            <button
              aria-label="New Markdown file"
              className="explorer-icon-button"
              onClick={() => {
                beginAction('create-file', 'Untitled.md')
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
                beginAction('create-folder', 'notes')
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
                setIsShowingHiddenEntries((currentValue) => !currentValue)
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
              setIsWorkspaceDialogOpen(false)
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
              <button onClick={hideContextEntry} role="menuitem" type="button">
                Hide
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
