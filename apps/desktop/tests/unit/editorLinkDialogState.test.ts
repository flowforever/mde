import { describe, expect, it } from 'vitest'

import {
  createInitialLinkDialogState,
  ensureMarkdownExtension,
  getEditorLinkEntryName,
  joinWorkspacePath,
  moveLinkDialogSuggestionSelection,
  selectLinkDialogDirectory,
  setLinkDialogMode,
  updateLinkDialogHref,
  updateLinkDialogNewDocumentName
} from '@mde/editor-react'
import type { TreeNode } from '@mde/editor-host/file-tree'

const tree: readonly TreeNode[] = [
  {
    children: [{ name: 'intro.md', path: 'docs/intro.md', type: 'file' }],
    name: 'docs',
    path: 'docs',
    type: 'directory'
  }
]

describe('editor link dialog state helpers', () => {
  it('creates initial state from visible workspace tree and current file path', () => {
    expect(
      createInitialLinkDialogState({
        currentFilePath: 'docs/current.md',
        defaultNewDocumentName: 'Untitled',
        visibleWorkspaceTree: tree
      })
    ).toMatchObject({
      errorMessage: null,
      hrefInput: '',
      mode: 'insert',
      newDocumentDirectoryPath: 'docs',
      newDocumentName: 'Untitled',
      selectedSuggestionIndex: 0,
      visibleWorkspaceTree: tree
    })
  })

  it('updates mode, href, new document name, and directory without mutating prior state', () => {
    const state = createInitialLinkDialogState({
      currentFilePath: 'README.md',
      defaultNewDocumentName: 'Untitled',
      visibleWorkspaceTree: tree
    })
    const nextState = updateLinkDialogHref(
      updateLinkDialogNewDocumentName(
        setLinkDialogMode(state, 'new-document'),
        'Project Notes'
      ),
      'docs/intro.md'
    )
    const selectedState = selectLinkDialogDirectory(nextState, {
      hasChildDirectories: true,
      isExpanded: false,
      path: 'docs'
    })

    expect(state.mode).toBe('insert')
    expect(nextState).toMatchObject({
      errorMessage: null,
      hrefInput: 'docs/intro.md',
      mode: 'new-document',
      newDocumentName: 'Project Notes',
      selectedSuggestionIndex: 0
    })
    expect(selectedState.expandedDirectoryPaths.has('docs')).toBe(true)
    expect(selectedState.newDocumentDirectoryPath).toBe('docs')
  })

  it('wraps suggestion selection and normalizes new document paths', () => {
    const state = createInitialLinkDialogState({
      currentFilePath: 'README.md',
      defaultNewDocumentName: 'Untitled',
      visibleWorkspaceTree: []
    })

    expect(moveLinkDialogSuggestionSelection(state, 1, 3)).toMatchObject({
      selectedSuggestionIndex: 1
    })
    expect(moveLinkDialogSuggestionSelection(state, -1, 3)).toMatchObject({
      selectedSuggestionIndex: 2
    })
    expect(moveLinkDialogSuggestionSelection(state, 1, 0)).toMatchObject({
      selectedSuggestionIndex: 0
    })
    expect(joinWorkspacePath('docs', ensureMarkdownExtension('notes'))).toBe(
      'docs/notes.md'
    )
    expect(getEditorLinkEntryName('docs/notes.md')).toBe('notes.md')
  })
})
