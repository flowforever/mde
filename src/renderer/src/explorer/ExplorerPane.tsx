import { useState } from 'react'

import { ExplorerTree } from './ExplorerTree'
import type { AppState } from '../app/appTypes'

interface ExplorerPaneProps {
  readonly onCreateFile: (filePath: string) => void
  readonly onCreateFolder: (folderPath: string) => void
  readonly onDeleteEntry: () => void
  readonly onOpenWorkspace: () => void
  readonly onRenameEntry: (entryName: string) => void
  readonly onSelectEntry: (entryPath: string) => void
  readonly onSelectFile: (filePath: string) => void
  readonly state: AppState
}

type PendingExplorerAction = 'create-file' | 'create-folder' | 'rename' | null

const getEntryName = (entryPath: string): string => {
  const separatorIndex = entryPath.lastIndexOf('/')

  return separatorIndex === -1 ? entryPath : entryPath.slice(separatorIndex + 1)
}

export const ExplorerPane = ({
  onCreateFile,
  onCreateFolder,
  onDeleteEntry,
  onOpenWorkspace,
  onRenameEntry,
  onSelectEntry,
  onSelectFile,
  state
}: ExplorerPaneProps): React.JSX.Element => {
  const [pendingAction, setPendingAction] = useState<PendingExplorerAction>(null)
  const [entryValue, setEntryValue] = useState('')
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

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

  return (
    <aside className="explorer-pane" aria-label="Explorer">
      <div className="explorer-header">Explorer</div>
      <button
        className="open-folder-button"
        disabled={state.isOpeningWorkspace}
        onClick={onOpenWorkspace}
        type="button"
      >
        {state.isOpeningWorkspace ? 'Opening...' : 'Open Folder'}
      </button>
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
              onClick={() => {
                beginAction('create-file', 'Untitled.md')
              }}
              type="button"
            >
              New Markdown file
            </button>
            <button
              onClick={() => {
                beginAction('create-folder', 'notes')
              }}
              type="button"
            >
              New folder
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
          {state.selectedEntryPath ? (
            <div
              className="explorer-selection-actions"
              aria-label="Selected entry actions"
            >
              <button
                onClick={() => {
                  beginAction('rename', selectedEntryName)
                }}
                type="button"
              >
                Rename
              </button>
              <button
                onClick={() => {
                  setIsConfirmingDelete(true)
                  clearPendingAction()
                }}
                type="button"
              >
                Delete
              </button>
            </div>
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
            nodes={state.workspace.tree}
            onSelectEntry={onSelectEntry}
            onSelectFile={onSelectFile}
            selectedEntryPath={state.selectedEntryPath}
            selectedFilePath={state.selectedFilePath}
          />
        </div>
      ) : (
        <p className="explorer-empty">Open a folder to browse Markdown files.</p>
      )}
    </aside>
  )
}
