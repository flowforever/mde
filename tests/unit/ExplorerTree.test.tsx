import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ExplorerTree } from '../../src/renderer/src/explorer/ExplorerTree'
import { ExplorerPane } from '../../src/renderer/src/explorer/ExplorerPane'
import type { AppState } from '../../src/renderer/src/app/appTypes'
import type { TreeNode } from '../../src/shared/fileTree'
import type { RecentWorkspace } from '../../src/renderer/src/workspaces/recentWorkspaces'

describe('ExplorerTree', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  const tree: readonly TreeNode[] = Object.freeze([
    {
      name: 'docs',
      path: 'docs',
      type: 'directory',
      children: Object.freeze<TreeNode[]>([
        {
          name: 'nested',
          path: 'docs/nested',
          type: 'directory',
          children: Object.freeze<TreeNode[]>([
            {
              name: 'deep.md',
              path: 'docs/nested/deep.md',
              type: 'file'
            }
          ])
        },
        {
          name: 'intro.md',
          path: 'docs/intro.md',
          type: 'file'
        }
      ])
    },
    {
      name: 'README.md',
      path: 'README.md',
      type: 'file'
    }
  ])
  const treeWithHiddenEntries: readonly TreeNode[] = Object.freeze([
    {
      name: '.vscode',
      path: '.vscode',
      type: 'directory',
      children: Object.freeze<TreeNode[]>([
        {
          name: 'settings.md',
          path: '.vscode/settings.md',
          type: 'file'
        }
      ])
    },
    {
      name: 'docs',
      path: 'docs',
      type: 'directory',
      children: Object.freeze<TreeNode[]>([])
    },
    {
      name: '.draft.md',
      path: '.draft.md',
      type: 'file'
    },
    {
      name: 'README.md',
      path: 'README.md',
      type: 'file'
    }
  ])

  it('renders nested folders and files after expansion', async () => {
    const user = userEvent.setup()

    render(
      <ExplorerTree
        nodes={tree}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        selectedEntryPath={null}
        selectedFilePath={null}
      />
    )

    await user.click(screen.getByRole('button', { name: /expand docs/i }))
    await user.click(screen.getByRole('button', { name: /expand nested/i }))

    expect(
      screen.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /intro\.md Markdown file/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /deep\.md Markdown file/i })
    ).toBeInTheDocument()
  })

  it('toggles a directory from the visible row button with expanded state', async () => {
    const user = userEvent.setup()
    const onSelectEntry = vi.fn()

    const { rerender } = render(
      <ExplorerTree
        nodes={tree}
        onSelectEntry={onSelectEntry}
        onSelectFile={vi.fn()}
        selectedEntryPath={null}
        selectedFilePath={null}
      />
    )

    const docsRow = screen.getByRole('button', { name: /docs folder/i })

    expect(docsRow).toHaveAttribute('aria-expanded', 'false')

    await user.click(docsRow)

    expect(onSelectEntry).toHaveBeenLastCalledWith('docs')
    expect(docsRow).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByRole('button', { name: /intro\.md Markdown file/i })
    ).toBeInTheDocument()

    rerender(
      <ExplorerTree
        nodes={tree}
        onSelectEntry={onSelectEntry}
        onSelectFile={vi.fn()}
        selectedEntryPath="docs"
        selectedFilePath={null}
      />
    )
    await user.click(docsRow)

    expect(onSelectEntry).toHaveBeenLastCalledWith(null)
    expect(docsRow).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByRole('button', { name: /intro\.md Markdown file/i })
    ).not.toBeInTheDocument()
  })

  it('calls onSelectFile when a Markdown file is selected', async () => {
    const user = userEvent.setup()
    const onSelectFile = vi.fn()

    render(
      <ExplorerTree
        nodes={tree}
        onSelectEntry={vi.fn()}
        onSelectFile={onSelectFile}
        selectedEntryPath={null}
        selectedFilePath={null}
      />
    )

    await user.click(
      screen.getByRole('button', { name: /README\.md Markdown file/i })
    )

    expect(onSelectFile).toHaveBeenCalledWith('README.md')
  })

  it('resets expanded folders when the workspace root changes', async () => {
    const user = userEvent.setup()
    const createState = (rootPath: string): AppState => ({
      draftMarkdown: null,
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: null,
      loadingWorkspaceRoot: null,
      selectedEntryPath: null,
      selectedFilePath: null,
      workspace: {
        name: 'workspace',
        rootPath,
        tree
      }
    })

    const { rerender } = render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        state={createState('/workspace-one')}
      />
    )

    await user.click(screen.getByRole('button', { name: /docs folder/i }))
    expect(
      screen.getByRole('button', { name: /intro\.md Markdown file/i })
    ).toBeInTheDocument()

    rerender(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        state={createState('/workspace-two')}
      />
    )

    expect(
      screen.queryByRole('button', { name: /intro\.md Markdown file/i })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /docs folder/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  })

  it('exposes accessible names for workspace and selected-entry controls', () => {
    const state: AppState = {
      draftMarkdown: '# Fixture Workspace',
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: {
        contents: '# Fixture Workspace',
        path: 'README.md'
      },
      loadingWorkspaceRoot: null,
      selectedEntryPath: 'README.md',
      selectedFilePath: 'README.md',
      workspace: {
        name: 'workspace',
        rootPath: '/workspace',
        tree
      }
    }

    const { container } = render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        state={state}
      />
    )

    const newMarkdownButton = screen.getByRole('button', {
      name: /new markdown file/i
    })
    const newFolderButton = screen.getByRole('button', { name: /new folder/i })
    const renameButton = screen.getByRole('button', {
      name: /rename selected README\.md/i
    })
    const deleteButton = screen.getByRole('button', {
      name: /delete selected README\.md/i
    })
    const showHiddenButton = screen.getByRole('button', {
      name: /show hidden entries/i
    })
    const toolbar = screen.getByLabelText(/workspace actions/i)
    const workspaceManagerButton = screen.getByRole('button', {
      name: /manage workspaces/i
    })

    expect(workspaceManagerButton).toHaveTextContent('workspace')
    expect(workspaceManagerButton).toHaveTextContent('/workspace')
    expect(container.querySelector('.explorer-workspace-name')).not.toBeInTheDocument()
    for (const button of [
      newMarkdownButton,
      newFolderButton,
      renameButton,
      deleteButton,
      showHiddenButton
    ]) {
      expect(toolbar).toContainElement(button)
      expect(button.textContent?.trim()).toBe('')
      expect(button.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument()
    }
  })

  it('labels explorer rows with entry type and active state', () => {
    render(
      <ExplorerTree
        nodes={tree}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        selectedEntryPath="README.md"
        selectedFilePath="README.md"
      />
    )

    expect(screen.getByRole('button', { name: /docs folder/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    expect(
      screen.getByRole('button', { name: /README\.md Markdown file/i })
    ).toHaveAttribute('aria-current', 'page')
  })

  it('keeps empty explorer state visible by text', () => {
    const state: AppState = {
      draftMarkdown: null,
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: null,
      loadingWorkspaceRoot: null,
      selectedEntryPath: null,
      selectedFilePath: null,
      workspace: null
    }

    render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        state={state}
      />
    )

    expect(
      screen.getByRole('button', { name: /^open workspace$/i })
    ).toBeVisible()
    expect(
      screen.getByText(/open a folder to browse markdown files/i)
    ).toBeVisible()
  })

  it('searches recent workspace resources and removes them from the manager popup', async () => {
    const user = userEvent.setup()
    const onForgetWorkspace = vi.fn()
    const recentWorkspaces: readonly RecentWorkspace[] = [
      {
        name: 'Docs',
        rootPath: '/workspaces/docs',
        type: 'workspace'
      },
      {
        filePath: '/notes/API.md',
        name: 'API.md',
        openedFilePath: 'API.md',
        rootPath: '/notes',
        type: 'file'
      }
    ]
    const state: AppState = {
      draftMarkdown: null,
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: null,
      loadingWorkspaceRoot: null,
      selectedEntryPath: null,
      selectedFilePath: null,
      workspace: null
    }

    render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onForgetWorkspace={onForgetWorkspace}
        onOpenFile={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        recentWorkspaces={recentWorkspaces}
        state={state}
      />
    )

    await user.click(screen.getByRole('button', { name: /^open workspace$/i }))

    expect(screen.getByRole('dialog', { name: /workspace manager/i })).toHaveClass(
      'workspace-dialog'
    )
    expect(
      screen.getByRole('button', { name: /open markdown file/i })
    ).toBeVisible()

    await user.type(
      screen.getByRole('searchbox', { name: /search workspaces and files/i }),
      'api'
    )

    expect(
      screen.getByRole('button', { name: /switch to file API\.md/i })
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /switch to workspace Docs/i })
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /remove recent file API\.md/i })
    )

    expect(onForgetWorkspace).toHaveBeenCalledWith(recentWorkspaces[1])
  })

  it('submits create file and create folder actions from the toolbar', async () => {
    const user = userEvent.setup()
    const onCreateFile = vi.fn()
    const onCreateFolder = vi.fn()
    const state: AppState = {
      draftMarkdown: null,
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: null,
      loadingWorkspaceRoot: null,
      selectedEntryPath: null,
      selectedFilePath: null,
      workspace: {
        name: 'workspace',
        rootPath: '/workspace',
        tree
      }
    }

    render(
      <ExplorerPane
        onCreateFile={onCreateFile}
        onCreateFolder={onCreateFolder}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        state={state}
      />
    )

    await user.click(screen.getByRole('button', { name: /new markdown file/i }))
    await user.clear(screen.getByLabelText(/markdown file path/i))
    await user.type(screen.getByLabelText(/markdown file path/i), 'daily.md')
    await user.click(screen.getByRole('button', { name: /^create$/i }))

    expect(onCreateFile).toHaveBeenCalledWith('daily.md')

    await user.click(screen.getByRole('button', { name: /new folder/i }))
    await user.clear(screen.getByLabelText(/folder path/i))
    await user.type(screen.getByLabelText(/folder path/i), 'daily')
    await user.click(screen.getByRole('button', { name: /^create$/i }))

    expect(onCreateFolder).toHaveBeenCalledWith('daily')
  })

  it('creates entries inside the selected directory and uses the root for file selections', async () => {
    const user = userEvent.setup()
    const onCreateFile = vi.fn()
    const onCreateFolder = vi.fn()
    const createState = (selectedEntryPath: string | null): AppState => ({
      draftMarkdown: null,
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: null,
      loadingWorkspaceRoot: null,
      selectedEntryPath,
      selectedFilePath:
        selectedEntryPath === 'README.md' ? 'README.md' : null,
      workspace: {
        name: 'workspace',
        rootPath: '/workspace',
        tree
      }
    })
    const renderPane = (state: AppState) => (
      <ExplorerPane
        onCreateFile={onCreateFile}
        onCreateFolder={onCreateFolder}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        state={state}
      />
    )

    const { rerender } = render(renderPane(createState('docs')))

    await user.click(screen.getByRole('button', { name: /new markdown file/i }))
    expect(screen.getByLabelText(/markdown file path/i)).toHaveValue(
      'docs/Untitled.md'
    )
    await user.clear(screen.getByLabelText(/markdown file path/i))
    await user.type(screen.getByLabelText(/markdown file path/i), 'daily.md')
    await user.click(screen.getByRole('button', { name: /^create$/i }))

    expect(onCreateFile).toHaveBeenLastCalledWith('docs/daily.md')

    await user.click(screen.getByRole('button', { name: /new folder/i }))
    expect(screen.getByLabelText(/folder path/i)).toHaveValue('docs/notes')
    await user.clear(screen.getByLabelText(/folder path/i))
    await user.type(screen.getByLabelText(/folder path/i), 'assets')
    await user.click(screen.getByRole('button', { name: /^create$/i }))

    expect(onCreateFolder).toHaveBeenLastCalledWith('docs/assets')

    rerender(renderPane(createState('README.md')))

    await user.click(screen.getByRole('button', { name: /new markdown file/i }))
    expect(screen.getByLabelText(/markdown file path/i)).toHaveValue(
      'Untitled.md'
    )
    await user.clear(screen.getByLabelText(/markdown file path/i))
    await user.type(screen.getByLabelText(/markdown file path/i), 'root.md')
    await user.click(screen.getByRole('button', { name: /^create$/i }))

    expect(onCreateFile).toHaveBeenLastCalledWith('root.md')
  })

  it('submits rename and confirmed delete for the selected entry', async () => {
    const user = userEvent.setup()
    const onRenameEntry = vi.fn()
    const onDeleteEntry = vi.fn()
    const state: AppState = {
      draftMarkdown: '# Fixture Workspace',
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: {
        contents: '# Fixture Workspace',
        path: 'README.md'
      },
      loadingWorkspaceRoot: null,
      selectedEntryPath: 'README.md',
      selectedFilePath: 'README.md',
      workspace: {
        name: 'workspace',
        rootPath: '/workspace',
        tree
      }
    }

    render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={onDeleteEntry}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={onRenameEntry}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        state={state}
      />
    )

    await user.click(screen.getByRole('button', { name: /rename selected README\.md/i }))
    await user.clear(screen.getByLabelText(/entry name/i))
    await user.type(screen.getByLabelText(/entry name/i), 'renamed.md')
    await user.click(screen.getByRole('button', { name: /^rename$/i }))

    expect(onRenameEntry).toHaveBeenCalledWith('renamed.md')

    await user.click(screen.getByRole('button', { name: /delete selected README\.md/i }))
    expect(screen.getByText(/delete README\.md/i)).toBeVisible()
    await user.click(screen.getByRole('button', { name: /confirm delete/i }))

    expect(onDeleteEntry).toHaveBeenCalledTimes(1)
  })

  it('opens a row context menu for rename, hide, and delete actions', async () => {
    const user = userEvent.setup()
    const onRenameEntry = vi.fn()
    const onDeleteEntry = vi.fn()
    const onSelectEntry = vi.fn()
    const state: AppState = {
      draftMarkdown: '# Fixture Workspace',
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: {
        contents: '# Fixture Workspace',
        path: 'README.md'
      },
      loadingWorkspaceRoot: null,
      selectedEntryPath: 'README.md',
      selectedFilePath: 'README.md',
      workspace: {
        name: 'workspace',
        rootPath: '/workspace',
        tree
      }
    }

    render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={onDeleteEntry}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={onRenameEntry}
        onSelectEntry={onSelectEntry}
        onSelectFile={vi.fn()}
        state={state}
      />
    )

    fireEvent.contextMenu(
      screen.getByRole('button', { name: /README\.md Markdown file/i }),
      { clientX: 36, clientY: 48 }
    )

    expect(onSelectEntry).toHaveBeenCalledWith('README.md')
    expect(screen.getByRole('menu', { name: /README\.md actions/i })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: /^rename$/i })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: /^hide$/i })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: /^delete$/i })).toBeVisible()

    await user.click(screen.getByRole('menuitem', { name: /^hide$/i }))

    expect(
      screen.queryByRole('button', { name: /README\.md Markdown file/i })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show hidden entries/i }))

    expect(
      screen.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /hide hidden entries/i }))

    expect(
      screen.queryByRole('button', { name: /README\.md Markdown file/i })
    ).not.toBeInTheDocument()

    fireEvent.contextMenu(screen.getByRole('button', { name: /docs folder/i }), {
      clientX: 36,
      clientY: 48
    })
    await user.click(screen.getByRole('menuitem', { name: /^rename$/i }))
    await user.clear(screen.getByLabelText(/entry name/i))
    await user.type(screen.getByLabelText(/entry name/i), 'guides')
    await user.click(screen.getByRole('button', { name: /^rename$/i }))

    expect(onRenameEntry).toHaveBeenCalledWith('guides')

    fireEvent.contextMenu(screen.getByRole('button', { name: /docs folder/i }), {
      clientX: 36,
      clientY: 48
    })
    await user.click(screen.getByRole('menuitem', { name: /^delete$/i }))
    await user.click(screen.getByRole('button', { name: /confirm delete/i }))

    expect(onDeleteEntry).toHaveBeenCalledTimes(1)
  })

  it('keeps hidden entries scoped by workspace and can show them from the context menu', async () => {
    const user = userEvent.setup()
    const createState = (rootPath: string): AppState => ({
      draftMarkdown: null,
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: null,
      loadingWorkspaceRoot: null,
      selectedEntryPath: null,
      selectedFilePath: null,
      workspace: {
        name: rootPath.endsWith('one') ? 'Workspace One' : 'Workspace Two',
        rootPath,
        tree
      }
    })
    const renderPane = (state: AppState) => (
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        state={state}
      />
    )

    const { rerender } = render(renderPane(createState('/workspace-one')))

    fireEvent.contextMenu(screen.getByRole('button', { name: /docs folder/i }), {
      clientX: 36,
      clientY: 48
    })
    await user.click(screen.getByRole('menuitem', { name: /^hide$/i }))

    expect(screen.queryByRole('button', { name: /docs folder/i })).not.toBeInTheDocument()

    rerender(renderPane(createState('/workspace-two')))

    expect(screen.getByRole('button', { name: /docs folder/i })).toBeInTheDocument()

    rerender(renderPane(createState('/workspace-one')))

    expect(screen.queryByRole('button', { name: /docs folder/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show hidden entries/i }))

    expect(screen.getByRole('button', { name: /docs folder/i })).toBeInTheDocument()

    fireEvent.contextMenu(screen.getByRole('button', { name: /docs folder/i }), {
      clientX: 36,
      clientY: 48
    })

    expect(screen.getByRole('menuitem', { name: /^show$/i })).toBeVisible()

    await user.click(screen.getByRole('menuitem', { name: /^show$/i }))

    expect(screen.getByRole('button', { name: /docs folder/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show hidden entries/i })).toBeDisabled()
  })

  it('defaults dot-prefixed workspace entries to hidden on first open', async () => {
    const user = userEvent.setup()
    const state: AppState = {
      draftMarkdown: null,
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: null,
      loadingWorkspaceRoot: null,
      selectedEntryPath: null,
      selectedFilePath: null,
      workspace: {
        name: 'workspace',
        rootPath: '/workspace-with-hidden-entries',
        tree: treeWithHiddenEntries
      }
    }

    render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        state={state}
      />
    )

    expect(screen.getByRole('button', { name: /docs folder/i })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /\.vscode folder/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /\.draft\.md Markdown file/i })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show hidden entries/i }))

    expect(screen.getByRole('button', { name: /\.vscode folder/i })).toBeVisible()
    expect(
      screen.getByRole('button', { name: /\.draft\.md Markdown file/i })
    ).toBeVisible()
  })

  it('does not reapply default hidden entries after a user shows one', async () => {
    const user = userEvent.setup()
    const state: AppState = {
      draftMarkdown: null,
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: null,
      loadingWorkspaceRoot: null,
      selectedEntryPath: null,
      selectedFilePath: null,
      workspace: {
        name: 'workspace',
        rootPath: '/workspace-default-hidden-override',
        tree: treeWithHiddenEntries
      }
    }
    const renderPane = () => (
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        state={state}
      />
    )

    let renderedPane = render(renderPane())

    await user.click(screen.getByRole('button', { name: /show hidden entries/i }))
    fireEvent.contextMenu(
      screen.getByRole('button', { name: /\.vscode folder/i }),
      { clientX: 36, clientY: 48 }
    )
    await user.click(screen.getByRole('menuitem', { name: /^show$/i }))

    renderedPane.unmount()
    renderedPane = render(renderPane())

    expect(screen.getByRole('button', { name: /\.vscode folder/i })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /\.draft\.md Markdown file/i })
    ).not.toBeInTheDocument()
    renderedPane.unmount()
  })

  it('persists hidden entries across explorer remounts', async () => {
    const user = userEvent.setup()
    const state: AppState = {
      draftMarkdown: null,
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: null,
      loadingWorkspaceRoot: null,
      selectedEntryPath: null,
      selectedFilePath: null,
      workspace: {
        name: 'workspace',
        rootPath: '/workspace',
        tree
      }
    }
    const renderPane = () => (
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        state={state}
      />
    )

    let renderedPane = render(renderPane())

    fireEvent.contextMenu(screen.getByRole('button', { name: /docs folder/i }), {
      clientX: 36,
      clientY: 48
    })
    await user.click(screen.getByRole('menuitem', { name: /^hide$/i }))

    expect(screen.queryByRole('button', { name: /docs folder/i })).not.toBeInTheDocument()

    renderedPane.unmount()
    renderedPane = render(renderPane())

    expect(screen.queryByRole('button', { name: /docs folder/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show hidden entries/i }))
    fireEvent.contextMenu(screen.getByRole('button', { name: /docs folder/i }), {
      clientX: 36,
      clientY: 48
    })
    await user.click(screen.getByRole('menuitem', { name: /^show$/i }))

    renderedPane.unmount()
    renderedPane = render(renderPane())

    expect(screen.getByRole('button', { name: /docs folder/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show hidden entries/i })).toBeDisabled()
    renderedPane.unmount()
  })
})
