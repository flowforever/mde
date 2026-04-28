import { useCallback, useEffect, useReducer, useRef } from 'react'

import type { EditorApi } from '../../../shared/workspace'
import { appReducer, createInitialAppState } from './appReducer'
import {
  MarkdownBlockEditor,
  type MarkdownBlockEditorHandle
} from '../editor/MarkdownBlockEditor'
import { ExplorerPane } from '../explorer/ExplorerPane'
import type { TreeNode } from '../../../shared/fileTree'

declare global {
  interface Window {
    readonly editorApi?: EditorApi
  }
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback

const findNodeByPath = (
  nodes: readonly TreeNode[],
  targetPath: string
): TreeNode | null => {
  for (const node of nodes) {
    if (node.path === targetPath) {
      return node
    }

    if (node.type === 'directory') {
      const childNode = findNodeByPath(node.children, targetPath)

      if (childNode) {
        return childNode
      }
    }
  }

  return null
}

const getParentPath = (entryPath: string): string => {
  const separatorIndex = entryPath.lastIndexOf('/')

  return separatorIndex === -1 ? '' : entryPath.slice(0, separatorIndex)
}

const joinWorkspacePath = (parentPath: string, entryName: string): string =>
  parentPath ? `${parentPath}/${entryName}` : entryName

const ensureMarkdownExtension = (filePath: string): string =>
  filePath.toLowerCase().endsWith('.md') ? filePath : `${filePath}.md`

export const App = (): React.JSX.Element => {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialAppState)
  const editorRef = useRef<MarkdownBlockEditorHandle | null>(null)

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
      dispatch({
        type: 'workspace/open-failed',
        message: getErrorMessage(error, 'Unable to open workspace')
      })
    }
  }

  const loadFile = useCallback(async (filePath: string): Promise<void> => {
    const workspaceRoot = state.workspace?.rootPath

    if (!workspaceRoot) {
      dispatch({
        filePath,
        message: 'Open a workspace before reading files',
        type: 'file/load-failed',
        workspaceRoot: ''
      })
      return
    }

    dispatch({ type: 'file/load-started', filePath, workspaceRoot })

    try {
      if (!window.editorApi) {
        throw new Error('Editor API unavailable. Restart the app and try again.')
      }

      const file = await window.editorApi.readMarkdownFile(filePath)

      dispatch({ type: 'file/loaded', file, workspaceRoot })
    } catch (error) {
      dispatch({
        filePath,
        message: getErrorMessage(error, 'Unable to read file'),
        type: 'file/load-failed',
        workspaceRoot
      })
    }
  }, [state.workspace?.rootPath])

  const refreshWorkspaceTree = useCallback(async (workspaceRoot?: string): Promise<void> => {
    const scopedWorkspaceRoot = workspaceRoot ?? state.workspace?.rootPath

    if (!scopedWorkspaceRoot) {
      return
    }

    try {
      if (!window.editorApi) {
        throw new Error('Editor API unavailable. Restart the app and try again.')
      }

      const tree = await window.editorApi.listDirectory('')

      dispatch({
        tree,
        type: 'workspace/tree-refreshed',
        workspaceRoot: scopedWorkspaceRoot
      })
    } catch (error) {
      dispatch({
        message: getErrorMessage(error, 'Unable to refresh workspace'),
        type: 'workspace/operation-failed',
        workspaceRoot: scopedWorkspaceRoot
      })
    }
  }, [state.workspace?.rootPath])

  const saveCurrentFile = useCallback(
    async (serializedMarkdown?: string): Promise<void> => {
      const loadedFile = state.loadedFile
      const workspaceRoot = state.workspace?.rootPath

      if (!loadedFile || !workspaceRoot) {
        return
      }

      dispatch({
        filePath: loadedFile.path,
        type: 'file/save-started',
        workspaceRoot
      })

      try {
        if (!window.editorApi) {
          throw new Error('Editor API unavailable. Restart the app and try again.')
        }

        const contents =
          serializedMarkdown ??
          (await editorRef.current?.getMarkdown()) ??
          state.draftMarkdown ??
          loadedFile.contents

        await window.editorApi.writeMarkdownFile(loadedFile.path, contents)
        dispatch({
          contents,
          filePath: loadedFile.path,
          type: 'file/save-succeeded',
          workspaceRoot
        })
      } catch (error) {
        dispatch({
          filePath: loadedFile.path,
          message: getErrorMessage(error, 'Unable to save file'),
          type: 'file/save-failed',
          workspaceRoot
        })
      }
    },
    [state.draftMarkdown, state.loadedFile, state.workspace?.rootPath]
  )

  useEffect(() => {
    const saveOnShortcut = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') {
        return
      }

      event.preventDefault()
      void saveCurrentFile()
    }

    window.addEventListener('keydown', saveOnShortcut)

    return () => {
      window.removeEventListener('keydown', saveOnShortcut)
    }
  }, [saveCurrentFile])

  const createMarkdownFile = async (promptedPath: string): Promise<void> => {
    const workspaceRoot = state.workspace?.rootPath
    const filePath = ensureMarkdownExtension(promptedPath)

    if (!workspaceRoot) {
      return
    }

    try {
      if (!window.editorApi) {
        throw new Error('Editor API unavailable. Restart the app and try again.')
      }

      await window.editorApi.createMarkdownFile(filePath)
      await refreshWorkspaceTree(workspaceRoot)
      await loadFile(filePath)
    } catch (error) {
      dispatch({
        message: getErrorMessage(error, 'Unable to create Markdown file'),
        type: 'workspace/operation-failed',
        workspaceRoot
      })
    }
  }

  const createFolder = async (folderPath: string): Promise<void> => {
    const workspaceRoot = state.workspace?.rootPath

    if (!workspaceRoot) {
      return
    }

    try {
      if (!window.editorApi) {
        throw new Error('Editor API unavailable. Restart the app and try again.')
      }

      await window.editorApi.createFolder(folderPath)
      await refreshWorkspaceTree(workspaceRoot)
    } catch (error) {
      dispatch({
        message: getErrorMessage(error, 'Unable to create folder'),
        type: 'workspace/operation-failed',
        workspaceRoot
      })
    }
  }

  const renameSelectedEntry = async (promptedName: string): Promise<void> => {
    const selectedEntryPath = state.selectedEntryPath
    const workspaceRoot = state.workspace?.rootPath

    if (!selectedEntryPath || !state.workspace || !workspaceRoot) {
      return
    }

    const selectedNode = findNodeByPath(state.workspace.tree, selectedEntryPath)
    const parentPath = getParentPath(selectedEntryPath)
    const nextEntryName =
      selectedNode?.type === 'file'
        ? ensureMarkdownExtension(promptedName)
        : promptedName
    const nextEntryPath = joinWorkspacePath(parentPath, nextEntryName)

    if (nextEntryPath === selectedEntryPath) {
      return
    }

    try {
      if (!window.editorApi) {
        throw new Error('Editor API unavailable. Restart the app and try again.')
      }

      const result = await window.editorApi.renameEntry(
        selectedEntryPath,
        nextEntryPath
      )

      dispatch({
        newPath: result.path,
        oldPath: selectedEntryPath,
        type: 'file/entry-renamed',
        workspaceRoot
      })
      await refreshWorkspaceTree(workspaceRoot)
    } catch (error) {
      dispatch({
        message: getErrorMessage(error, 'Unable to rename entry'),
        type: 'workspace/operation-failed',
        workspaceRoot
      })
    }
  }

  const deleteSelectedEntry = async (): Promise<void> => {
    const selectedEntryPath = state.selectedEntryPath
    const workspaceRoot = state.workspace?.rootPath

    if (!selectedEntryPath || !workspaceRoot) {
      return
    }

    try {
      if (!window.editorApi) {
        throw new Error('Editor API unavailable. Restart the app and try again.')
      }

      await window.editorApi.deleteEntry(selectedEntryPath)
      dispatch({
        entryPath: selectedEntryPath,
        type: 'file/entry-deleted',
        workspaceRoot
      })
      await refreshWorkspaceTree(workspaceRoot)
    } catch (error) {
      dispatch({
        message: getErrorMessage(error, 'Unable to delete entry'),
        type: 'workspace/operation-failed',
        workspaceRoot
      })
    }
  }

  return (
    <main className="app-shell">
      <ExplorerPane
        onCreateFile={(filePath) => {
          void createMarkdownFile(filePath)
        }}
        onCreateFolder={(folderPath) => {
          void createFolder(folderPath)
        }}
        onDeleteEntry={() => {
          void deleteSelectedEntry()
        }}
        onOpenWorkspace={() => {
          void openWorkspace()
        }}
        onRenameEntry={(entryName) => {
          void renameSelectedEntry(entryName)
        }}
        onSelectEntry={(entryPath) => {
          dispatch({ type: 'explorer/entry-selected', entryPath })
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
            errorMessage={state.fileErrorMessage}
            isDirty={state.isDirty}
            isSaving={state.isSavingFile}
            markdown={state.loadedFile.contents}
            onMarkdownChange={(contents) => {
              dispatch({ type: 'file/content-changed', contents })
            }}
            onSaveRequest={(contents) => {
              void saveCurrentFile(contents)
            }}
            path={state.loadedFile.path}
            ref={editorRef}
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
