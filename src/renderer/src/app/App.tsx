import { useReducer } from 'react'

import type { EditorApi } from '../../../shared/workspace'
import { appReducer, createInitialAppState } from './appReducer'
import { MarkdownBlockEditor } from '../editor/MarkdownBlockEditor'
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
      if (!window.editorApi) {
        throw new Error('Editor API unavailable. Restart the app and try again.')
      }

      const workspace = await window.editorApi.openWorkspace()

      if (!workspace) {
        dispatch({ type: 'workspace/open-cancelled' })
        return
      }

      dispatch({ type: 'workspace/opened', workspace })
    } catch (error) {
      dispatch({ type: 'workspace/open-failed', message: getErrorMessage(error) })
    }
  }

  const loadFile = async (filePath: string): Promise<void> => {
    dispatch({ type: 'file/load-started', filePath })

    try {
      if (!window.editorApi) {
        throw new Error('Editor API unavailable. Restart the app and try again.')
      }

      const file = await window.editorApi.readMarkdownFile(filePath)

      dispatch({ type: 'file/loaded', file })
    } catch (error) {
      dispatch({ type: 'file/load-failed', message: getErrorMessage(error) })
    }
  }

  return (
    <main className="app-shell">
      <ExplorerPane
        onOpenWorkspace={() => {
          void openWorkspace()
        }}
        onSelectFile={(filePath) => {
          void loadFile(filePath)
        }}
        state={state}
      />
      <section className="editor-pane" aria-label="Editor">
        {state.loadedFile ? (
          <MarkdownBlockEditor
            key={state.loadedFile.path}
            markdown={state.loadedFile.contents}
            path={state.loadedFile.path}
          />
        ) : (
          <div className="editor-empty-state">
            <p className="editor-kicker">Markdown Editor</p>
            <h1>{state.selectedFilePath ?? 'Select a folder to begin'}</h1>
            {state.isLoadingFile ? <p>Loading file...</p> : null}
            {state.fileErrorMessage ? (
              <p className="editor-error" role="alert">
                {state.fileErrorMessage}
              </p>
            ) : null}
          </div>
        )}
      </section>
    </main>
  )
}
