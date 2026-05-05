import { describe, expect, it } from 'vitest'

import { appReducer, createInitialAppState } from '../../src/renderer/src/app/appReducer'
import type { Workspace } from '../../src/shared/workspace'
import type {
  DeletedDocumentHistoryEntry,
  DocumentHistoryVersion
} from '../../src/shared/documentHistory'

describe('appReducer', () => {
  const workspace: Workspace = {
    name: 'workspace',
    rootPath: '/tmp/workspace',
    tree: Object.freeze([
      {
        name: 'README.md',
        path: 'README.md',
        type: 'file'
      }
    ])
  }
  const workspaceA: Workspace = {
    ...workspace,
    name: 'workspace-a',
    rootPath: '/workspace-a'
  }
  const workspaceB: Workspace = {
    ...workspace,
    name: 'workspace-b',
    rootPath: '/workspace-b'
  }
  const refreshedTree = Object.freeze([
    {
      name: 'A.md',
      path: 'A.md',
      type: 'file' as const
    }
  ])

  it('stores an opened workspace', () => {
    const state = appReducer(createInitialAppState(), {
      type: 'workspace/opened',
      workspace
    })

    expect(state.workspace).toEqual(workspace)
    expect(state.selectedFilePath).toBeNull()
  })

  it('clears opening state when workspace open is cancelled or fails', () => {
    const openingState = appReducer(createInitialAppState(), {
      type: 'workspace/open-started'
    })
    const cancelledState = appReducer(openingState, {
      type: 'workspace/open-cancelled'
    })
    const failedState = appReducer(openingState, {
      message: 'Unable to open workspace',
      type: 'workspace/open-failed'
    })

    expect(cancelledState.isOpeningWorkspace).toBe(false)
    expect(failedState).toMatchObject({
      errorMessage: 'Unable to open workspace',
      isOpeningWorkspace: false
    })
  })

  it('stores refreshed trees and current workspace operation errors', () => {
    const workspaceState = appReducer(createInitialAppState(), {
      type: 'workspace/opened',
      workspace
    })
    const refreshedState = appReducer(workspaceState, {
      tree: refreshedTree,
      type: 'workspace/tree-refreshed',
      workspaceRoot: workspace.rootPath
    })
    const failedState = appReducer(refreshedState, {
      message: 'Unable to create file',
      type: 'workspace/operation-failed',
      workspaceRoot: workspace.rootPath
    })

    expect(refreshedState.workspace?.tree).toEqual(refreshedTree)
    expect(failedState.errorMessage).toBe('Unable to create file')
  })

  it('stores the selected file path', () => {
    const state = appReducer(
      { ...createInitialAppState(), workspace },
      {
        type: 'file/selected',
        filePath: 'README.md'
      }
    )

    expect(state.selectedFilePath).toBe('README.md')
    expect(state.workspace).toEqual(workspace)
  })

  it('tracks file loading for the selected file', () => {
    const state = appReducer(
      { ...createInitialAppState(), workspace },
      {
        type: 'file/load-started',
        filePath: 'README.md',
        workspaceRoot: workspace.rootPath
      }
    )

    expect(state.selectedFilePath).toBe('README.md')
    expect(state.isLoadingFile).toBe(true)
    expect(state.loadedFile).toBeNull()
    expect(state.fileErrorMessage).toBeNull()
  })

  it('stores loaded file contents', () => {
    const loadingState = appReducer(
      { ...createInitialAppState(), workspace },
      {
        type: 'file/load-started',
        filePath: 'README.md',
        workspaceRoot: workspace.rootPath
      }
    )

    const state = appReducer(loadingState, {
      file: {
        contents: '# Fixture Workspace',
        path: 'README.md'
      },
      type: 'file/loaded',
      workspaceRoot: workspace.rootPath
    })

    expect(state.isLoadingFile).toBe(false)
    expect(state.loadedFile).toEqual({
      contents: '# Fixture Workspace',
      path: 'README.md'
    })
    expect(state.fileErrorMessage).toBeNull()
  })

  it('stores and clears a read-only history preview for the current workspace', () => {
    const loadedState = {
      ...createInitialAppState(),
      loadedFile: {
        contents: '# Current',
        path: 'README.md'
      },
      selectedFilePath: 'README.md',
      workspace
    }
    const version: DocumentHistoryVersion = {
      blobHash: 'hash',
      byteLength: 10,
      createdAt: '2026-05-02T01:00:00.000Z',
      documentId: 'doc_1',
      event: 'manual-save',
      id: 'version_1',
      path: 'README.md'
    }

    const previewState = appReducer(loadedState, {
      contents: '# Previous',
      mode: 'current-file',
      type: 'history/preview-loaded',
      version,
      workspaceRoot: workspace.rootPath
    })

    expect(previewState.historyPreview).toMatchObject({
      contents: '# Previous',
      mode: 'current-file',
      version
    })

    const closedState = appReducer(previewState, {
      type: 'history/preview-closed',
      workspaceRoot: workspace.rootPath
    })

    expect(closedState.historyPreview).toBeNull()
  })

  it('stores document history versions and selected filter', () => {
    const version: DocumentHistoryVersion = {
      blobHash: 'hash',
      byteLength: 10,
      createdAt: '2026-05-02T01:00:00.000Z',
      documentId: 'doc_1',
      event: 'manual-save',
      id: 'version_1',
      path: 'README.md'
    }
    const workspaceState = appReducer(createInitialAppState(), {
      type: 'workspace/opened',
      workspace
    })
    const loadedState = appReducer(workspaceState, {
      type: 'history/versions-loaded',
      versions: [version],
      workspaceRoot: workspace.rootPath
    })

    expect(loadedState.documentHistoryVersions).toEqual([version])
    expect(loadedState.documentHistoryFilterId).toBe('all')
    expect(loadedState.isDocumentHistoryPanelVisible).toBe(true)

    const filteredState = appReducer(loadedState, {
      filterId: 'saves',
      type: 'history/filter-selected',
      workspaceRoot: workspace.rootPath
    })

    expect(filteredState.documentHistoryFilterId).toBe('saves')

    const hiddenState = appReducer(filteredState, {
      isVisible: false,
      type: 'history/panel-visibility-set',
      workspaceRoot: workspace.rootPath
    })

    expect(hiddenState.isDocumentHistoryPanelVisible).toBe(false)
  })

  it('stores deleted document history for the current workspace', () => {
    const deletedDocument: DeletedDocumentHistoryEntry = {
      deletedAt: '2026-05-02T01:00:00.000Z',
      documentId: 'doc_1',
      latestVersionId: 'version_1',
      path: 'deleted.md',
      reason: 'deleted-in-mde',
      versionCount: 1
    }
    const workspaceState = appReducer(createInitialAppState(), {
      type: 'workspace/opened',
      workspace
    })

    const state = appReducer(workspaceState, {
      documents: [deletedDocument],
      type: 'history/deleted-documents-loaded',
      workspaceRoot: workspace.rootPath
    })

    expect(state.deletedDocumentHistory).toEqual([deletedDocument])
    expect(state.isDeletedDocumentHistoryVisible).toBe(true)

    const hiddenState = appReducer(state, {
      isVisible: false,
      type: 'history/deleted-documents-visibility-set',
      workspaceRoot: workspace.rootPath
    })

    expect(hiddenState.deletedDocumentHistory).toEqual([deletedDocument])
    expect(hiddenState.isDeletedDocumentHistoryVisible).toBe(false)
  })

  it('stores file load failures', () => {
    const loadingState = appReducer(
      { ...createInitialAppState(), workspace },
      {
        type: 'file/load-started',
        filePath: 'README.md',
        workspaceRoot: workspace.rootPath
      }
    )

    const state = appReducer(loadingState, {
      filePath: 'README.md',
      message: 'Unable to read README.md',
      type: 'file/load-failed',
      workspaceRoot: workspace.rootPath
    })

    expect(state.isLoadingFile).toBe(false)
    expect(state.loadedFile).toBeNull()
    expect(state.fileErrorMessage).toBe('Unable to read README.md')
  })

  it('ignores stale file contents for a previously selected file', () => {
    const readmeLoadingState = appReducer(
      { ...createInitialAppState(), workspace },
      {
        type: 'file/load-started',
        filePath: 'README.md',
        workspaceRoot: workspace.rootPath
      }
    )
    const introLoadingState = appReducer(readmeLoadingState, {
      type: 'file/load-started',
      filePath: 'docs/intro.md',
      workspaceRoot: workspace.rootPath
    })

    const state = appReducer(introLoadingState, {
      file: {
        contents: '# Old README',
        path: 'README.md'
      },
      type: 'file/loaded',
      workspaceRoot: workspace.rootPath
    })

    expect(state.selectedFilePath).toBe('docs/intro.md')
    expect(state.isLoadingFile).toBe(true)
    expect(state.loadedFile).toBeNull()
    expect(state.fileErrorMessage).toBeNull()
  })

  it('ignores stale file load failures for a previously selected file', () => {
    const readmeLoadingState = appReducer(
      { ...createInitialAppState(), workspace },
      {
        type: 'file/load-started',
        filePath: 'README.md',
        workspaceRoot: workspace.rootPath
      }
    )
    const introLoadingState = appReducer(readmeLoadingState, {
      type: 'file/load-started',
      filePath: 'docs/intro.md',
      workspaceRoot: workspace.rootPath
    })

    const state = appReducer(introLoadingState, {
      filePath: 'README.md',
      message: 'Unable to read README.md',
      type: 'file/load-failed',
      workspaceRoot: workspace.rootPath
    })

    expect(state.selectedFilePath).toBe('docs/intro.md')
    expect(state.isLoadingFile).toBe(true)
    expect(state.loadedFile).toBeNull()
    expect(state.fileErrorMessage).toBeNull()
  })

  it('ignores stale file contents for the same relative path after changing workspaces', () => {
    const workspaceALoadingState = appReducer(
      appReducer(createInitialAppState(), {
        type: 'workspace/opened',
        workspace: workspaceA
      }),
      {
        filePath: 'README.md',
        type: 'file/load-started',
        workspaceRoot: workspaceA.rootPath
      }
    )
    const workspaceBLoadingState = appReducer(
      appReducer(workspaceALoadingState, {
        type: 'workspace/opened',
        workspace: workspaceB
      }),
      {
        filePath: 'README.md',
        type: 'file/load-started',
        workspaceRoot: workspaceB.rootPath
      }
    )

    const state = appReducer(workspaceBLoadingState, {
      file: {
        contents: '# Workspace A',
        path: 'README.md'
      },
      type: 'file/loaded',
      workspaceRoot: workspaceA.rootPath
    })

    expect(state.workspace).toEqual(workspaceB)
    expect(state.selectedFilePath).toBe('README.md')
    expect(state.isLoadingFile).toBe(true)
    expect(state.loadedFile).toBeNull()
    expect(state.fileErrorMessage).toBeNull()
  })

  it('ignores stale file load failures for the same relative path after changing workspaces', () => {
    const workspaceALoadingState = appReducer(
      appReducer(createInitialAppState(), {
        type: 'workspace/opened',
        workspace: workspaceA
      }),
      {
        filePath: 'README.md',
        type: 'file/load-started',
        workspaceRoot: workspaceA.rootPath
      }
    )
    const workspaceBLoadingState = appReducer(
      appReducer(workspaceALoadingState, {
        type: 'workspace/opened',
        workspace: workspaceB
      }),
      {
        filePath: 'README.md',
        type: 'file/load-started',
        workspaceRoot: workspaceB.rootPath
      }
    )

    const state = appReducer(workspaceBLoadingState, {
      filePath: 'README.md',
      message: 'Unable to read README.md',
      type: 'file/load-failed',
      workspaceRoot: workspaceA.rootPath
    })

    expect(state.workspace).toEqual(workspaceB)
    expect(state.selectedFilePath).toBe('README.md')
    expect(state.isLoadingFile).toBe(true)
    expect(state.loadedFile).toBeNull()
    expect(state.fileErrorMessage).toBeNull()
  })

  it('ignores file load starts from a stale workspace', () => {
    const workspaceBState = appReducer(createInitialAppState(), {
      type: 'workspace/opened',
      workspace: workspaceB
    })

    const state = appReducer(workspaceBState, {
      filePath: 'README.md',
      type: 'file/load-started',
      workspaceRoot: workspaceA.rootPath
    })

    expect(state).toEqual(workspaceBState)
  })

  it('ignores stale tree refreshes after changing workspaces', () => {
    const workspaceBState = appReducer(createInitialAppState(), {
      type: 'workspace/opened',
      workspace: workspaceB
    })

    const state = appReducer(workspaceBState, {
      tree: refreshedTree,
      type: 'workspace/tree-refreshed',
      workspaceRoot: workspaceA.rootPath
    })

    expect(state).toEqual(workspaceBState)
  })

  it('ignores stale operation failures after changing workspaces', () => {
    const workspaceBState = appReducer(createInitialAppState(), {
      type: 'workspace/opened',
      workspace: workspaceB
    })

    const state = appReducer(workspaceBState, {
      message: 'Unable to create file in workspace A',
      type: 'workspace/operation-failed',
      workspaceRoot: workspaceA.rootPath
    })

    expect(state).toEqual(workspaceBState)
  })

  it('ignores stale renames after changing workspaces', () => {
    const workspaceBState = {
      ...createInitialAppState(),
      loadedFile: {
        contents: '# Workspace B',
        path: 'README.md'
      },
      selectedEntryPath: 'README.md',
      selectedFilePath: 'README.md',
      workspace: workspaceB
    }

    const state = appReducer(workspaceBState, {
      newPath: 'A.md',
      oldPath: 'README.md',
      type: 'file/entry-renamed',
      workspaceRoot: workspaceA.rootPath
    })

    expect(state).toEqual(workspaceBState)
  })

  it('ignores stale deletes after changing workspaces', () => {
    const workspaceBState = {
      ...createInitialAppState(),
      loadedFile: {
        contents: '# Workspace B',
        path: 'README.md'
      },
      selectedEntryPath: 'README.md',
      selectedFilePath: 'README.md',
      workspace: workspaceB
    }

    const state = appReducer(workspaceBState, {
      entryPath: 'README.md',
      type: 'file/entry-deleted',
      workspaceRoot: workspaceA.rootPath
    })

    expect(state).toEqual(workspaceBState)
  })

  it('marks the current file dirty after editor changes', () => {
    const loadedState = appReducer(
      appReducer(
        { ...createInitialAppState(), workspace },
        {
          filePath: 'README.md',
          type: 'file/load-started',
          workspaceRoot: workspace.rootPath
        }
      ),
      {
        file: {
          contents: '# Fixture Workspace',
          path: 'README.md'
        },
        type: 'file/loaded',
        workspaceRoot: workspace.rootPath
      }
    )

    const state = appReducer(loadedState, {
      contents: '# Changed',
      filePath: 'README.md',
      type: 'file/content-changed',
      workspaceRoot: workspace.rootPath
    })

    expect(state.isDirty).toBe(true)
    expect(state.draftMarkdown).toBe('# Changed')
  })

  it('clears dirty state after a successful save', () => {
    const dirtyState = appReducer(
      {
        ...createInitialAppState(),
        loadedFile: {
          contents: '# Original',
          path: 'README.md'
        },
        selectedFilePath: 'README.md',
        workspace
      },
      {
        contents: '# Changed',
        filePath: 'README.md',
        type: 'file/content-changed',
        workspaceRoot: workspace.rootPath
      }
    )

    const state = appReducer(dirtyState, {
      contents: '# Changed',
      filePath: 'README.md',
      type: 'file/save-succeeded',
      workspaceRoot: workspace.rootPath
    })

    expect(state.isDirty).toBe(false)
    expect(state.isSavingFile).toBe(false)
    expect(state.draftMarkdown).toBe('# Changed')
    expect(state.loadedFile).toEqual({
      contents: '# Changed',
      path: 'README.md'
    })
  })

  it('keeps newer dirty draft when an older save finishes', () => {
    const dirtyState = appReducer(
      {
        ...createInitialAppState(),
        loadedFile: {
          contents: '# Original',
          path: 'README.md'
        },
        selectedFilePath: 'README.md',
        workspace
      },
      {
        contents: '# First edit',
        filePath: 'README.md',
        type: 'file/content-changed',
        workspaceRoot: workspace.rootPath
      }
    )
    const savingState = appReducer(dirtyState, {
      filePath: 'README.md',
      type: 'file/save-started',
      workspaceRoot: workspace.rootPath
    })
    const newerDirtyState = appReducer(savingState, {
      contents: '# Second edit',
      filePath: 'README.md',
      type: 'file/content-changed',
      workspaceRoot: workspace.rootPath
    })

    const state = appReducer(newerDirtyState, {
      contents: '# First edit',
      filePath: 'README.md',
      type: 'file/save-succeeded',
      workspaceRoot: workspace.rootPath
    })

    expect(state.isDirty).toBe(true)
    expect(state.isSavingFile).toBe(false)
    expect(state.draftMarkdown).toBe('# Second edit')
    expect(state.loadedFile).toEqual({
      contents: '# First edit',
      path: 'README.md'
    })
  })

  it('preserves dirty state after a failed save', () => {
    const dirtyState = appReducer(
      {
        ...createInitialAppState(),
        isSavingFile: true,
        loadedFile: {
          contents: '# Original',
          path: 'README.md'
        },
        selectedFilePath: 'README.md',
        workspace
      },
      {
        contents: '# Changed',
        filePath: 'README.md',
        type: 'file/content-changed',
        workspaceRoot: workspace.rootPath
      }
    )

    const state = appReducer(dirtyState, {
      filePath: 'README.md',
      message: 'Unable to save README.md',
      type: 'file/save-failed',
      workspaceRoot: workspace.rootPath
    })

    expect(state.isDirty).toBe(true)
    expect(state.isSavingFile).toBe(false)
    expect(state.draftMarkdown).toBe('# Changed')
    expect(state.fileErrorMessage).toBe('Unable to save README.md')
  })

  it('ignores stale save lifecycle actions', () => {
    const dirtyState = {
      ...createInitialAppState(),
      isDirty: true,
      loadedFile: {
        contents: '# Workspace B',
        path: 'README.md'
      },
      selectedFilePath: 'README.md',
      workspace: workspaceB
    }

    const saveStartedState = appReducer(dirtyState, {
      filePath: 'README.md',
      type: 'file/save-started',
      workspaceRoot: workspaceA.rootPath
    })
    const saveSucceededState = appReducer(dirtyState, {
      contents: '# Workspace A',
      filePath: 'README.md',
      type: 'file/save-succeeded',
      workspaceRoot: workspaceA.rootPath
    })
    const saveFailedState = appReducer(dirtyState, {
      filePath: 'README.md',
      message: 'Unable to save workspace A',
      type: 'file/save-failed',
      workspaceRoot: workspaceA.rootPath
    })

    expect(saveStartedState).toEqual(dirtyState)
    expect(saveSucceededState).toEqual(dirtyState)
    expect(saveFailedState).toEqual(dirtyState)
  })

  it('ignores stale editor changes for a previously loaded file', () => {
    const workspaceBState = {
      ...createInitialAppState(),
      draftMarkdown: '# Workspace B',
      loadedFile: {
        contents: '# Workspace B',
        path: 'README.md'
      },
      selectedFilePath: 'README.md',
      workspace: workspaceB
    }

    const state = appReducer(workspaceBState, {
      contents: '# Workspace A async change',
      filePath: 'README.md',
      type: 'file/content-changed',
      workspaceRoot: workspaceA.rootPath
    })

    expect(state).toEqual(workspaceBState)
  })

  it('renames loaded files and selected nested entries when a folder is renamed', () => {
    const loadedState = {
      ...createInitialAppState(),
      draftMarkdown: '# Deep',
      loadedFile: {
        contents: '# Deep',
        path: 'docs/deep.md'
      },
      selectedEntryPath: 'docs/deep.md',
      selectedFilePath: 'docs/deep.md',
      workspace
    }

    const state = appReducer(loadedState, {
      newPath: 'notes',
      oldPath: 'docs',
      type: 'file/entry-renamed',
      workspaceRoot: workspace.rootPath
    })

    expect(state.loadedFile?.path).toBe('notes/deep.md')
    expect(state.selectedEntryPath).toBe('notes/deep.md')
    expect(state.selectedFilePath).toBe('notes/deep.md')
  })

  it('keeps editor content when deleting an unrelated selected entry', () => {
    const loadedState = {
      ...createInitialAppState(),
      draftMarkdown: '# README',
      isDirty: true,
      loadedFile: {
        contents: '# README',
        path: 'README.md'
      },
      selectedEntryPath: 'docs',
      selectedFilePath: 'README.md',
      workspace
    }

    const state = appReducer(loadedState, {
      entryPath: 'docs',
      type: 'file/entry-deleted',
      workspaceRoot: workspace.rootPath
    })

    expect(state.loadedFile).toEqual(loadedState.loadedFile)
    expect(state.selectedEntryPath).toBeNull()
    expect(state.selectedFilePath).toBe('README.md')
    expect(state.isDirty).toBe(true)
  })
})
