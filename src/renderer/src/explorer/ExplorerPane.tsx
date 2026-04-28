import { ExplorerTree } from './ExplorerTree'
import type { AppState } from '../app/appTypes'

interface ExplorerPaneProps {
  readonly onOpenWorkspace: () => void
  readonly onSelectFile: (filePath: string) => void
  readonly state: AppState
}

export const ExplorerPane = ({
  onOpenWorkspace,
  onSelectFile,
  state
}: ExplorerPaneProps): React.JSX.Element => (
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
        <ExplorerTree
          nodes={state.workspace.tree}
          onSelectFile={onSelectFile}
          selectedFilePath={state.selectedFilePath}
        />
      </div>
    ) : (
      <p className="explorer-empty">Open a folder to browse Markdown files.</p>
    )}
  </aside>
)
