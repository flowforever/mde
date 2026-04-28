import { useReducer } from 'react'

import type { EditorApi } from '../../../shared/workspace'
import { appReducer, createInitialAppState } from './appReducer'
import { ExplorerPane } from '../explorer/ExplorerPane'

declare global {
  interface Window {
    readonly editorApi?: EditorApi
  }
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unable to open workspace'

export const App = (): React.JSX.Element => {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialAppState)

  const openWorkspace = async (): Promise<void> => {
    dispatch({ type: 'workspace/open-started' })

    try {
      const workspace = await window.editorApi?.openWorkspace()

      if (!workspace) {
        dispatch({ type: 'workspace/open-cancelled' })
        return
      }

      dispatch({ type: 'workspace/opened', workspace })
    } catch (error) {
      dispatch({ type: 'workspace/open-failed', message: getErrorMessage(error) })
    }
  }

  return (
    <main className="app-shell">
      <ExplorerPane
        onOpenWorkspace={() => {
          void openWorkspace()
        }}
        onSelectFile={(filePath) => {
          dispatch({ type: 'file/selected', filePath })
        }}
        state={state}
      />
      <section className="editor-pane" aria-label="Editor">
        <div className="editor-empty-state">
          <p className="editor-kicker">Markdown Editor</p>
          <h1>{state.selectedFilePath ?? 'Select a folder to begin'}</h1>
        </div>
      </section>
    </main>
  )
}
