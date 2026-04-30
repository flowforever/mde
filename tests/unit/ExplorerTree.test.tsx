import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ExplorerTree } from '../../src/renderer/src/explorer/ExplorerTree'
import { ExplorerPane } from '../../src/renderer/src/explorer/ExplorerPane'
import type { AppState } from '../../src/renderer/src/app/appTypes'
import type { TreeNode } from '../../src/shared/fileTree'
import type { RecentWorkspace } from '../../src/renderer/src/workspaces/recentWorkspaces'

const EXPLORER_INTERACTION_TEST_TIMEOUT = 15_000

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
    const refreshButton = screen.getByRole('button', {
      name: /refresh explorer/i
    })
    const toolbar = screen.getByLabelText(/workspace actions/i)
    const workspaceManagerButton = screen.getByRole('button', {
      name: /manage workspaces/i
    })
    const toolbarButtons = Array.from(
      toolbar.querySelectorAll('button')
    ) as HTMLElement[]

    expect(workspaceManagerButton).toHaveTextContent('workspace')
    expect(workspaceManagerButton).toHaveTextContent('/workspace')
    expect(container.querySelector('.explorer-workspace-name')).not.toBeInTheDocument()
    for (const button of [
      newMarkdownButton,
      newFolderButton,
      renameButton,
      deleteButton,
      showHiddenButton,
      refreshButton
    ]) {
      expect(toolbar).toContainElement(button)
      expect(button.textContent?.trim()).toBe('')
      expect(button.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument()
    }
    expect(toolbarButtons.indexOf(refreshButton)).toBe(
      toolbarButtons.indexOf(showHiddenButton) + 1
    )
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

  it('opens remembered resources in a new window without switching current workspace', async () => {
    const user = userEvent.setup()
    const onOpenWorkspaceInNewWindow = vi.fn()
    const onSwitchWorkspace = vi.fn()
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
        onOpenFile={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onOpenWorkspaceInNewWindow={onOpenWorkspaceInNewWindow}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        onSwitchWorkspace={onSwitchWorkspace}
        recentWorkspaces={recentWorkspaces}
        state={state}
      />
    )

    await user.click(screen.getByRole('button', { name: /^open workspace$/i }))
    await user.click(
      screen.getByRole('button', {
        name: /open workspace Docs in new window/i
      })
    )

    expect(onOpenWorkspaceInNewWindow).toHaveBeenCalledWith(recentWorkspaces[0])
    expect(onSwitchWorkspace).not.toHaveBeenCalled()
    expect(
      screen.getByRole('dialog', { name: /workspace manager/i })
    ).toBeVisible()
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
    await user.clear(screen.getByLabelText(/new markdown file name/i))
    await user.type(screen.getByLabelText(/new markdown file name/i), 'daily.md')
    await user.keyboard('{Enter}')

    expect(onCreateFile).toHaveBeenCalledWith('daily.md')

    await user.click(screen.getByRole('button', { name: /new folder/i }))
    await user.clear(screen.getByLabelText(/new folder name/i))
    await user.type(screen.getByLabelText(/new folder name/i), 'daily')
    await user.keyboard('{Enter}')

    expect(onCreateFolder).toHaveBeenCalledWith('daily')
  }, EXPLORER_INTERACTION_TEST_TIMEOUT)

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
    const docsRow = screen.getByRole('button', { name: /docs folder/i })
    const docsItem = docsRow.closest('li') as HTMLElement
    const nestedFileInput = await within(docsItem).findByLabelText(
      /new markdown file name/i
    )

    expect(nestedFileInput).toHaveValue('Untitled.md')
    await user.clear(nestedFileInput)
    await user.type(nestedFileInput, 'daily.md')
    await user.keyboard('{Enter}')

    expect(onCreateFile).toHaveBeenLastCalledWith('docs/daily.md')

    await user.click(screen.getByRole('button', { name: /new folder/i }))
    const nestedFolderInput = await within(docsItem).findByLabelText(
      /new folder name/i
    )

    expect(nestedFolderInput).toHaveValue('notes')
    await user.clear(nestedFolderInput)
    await user.type(nestedFolderInput, 'assets')
    await user.keyboard('{Enter}')

    expect(onCreateFolder).toHaveBeenLastCalledWith('docs/assets')

    rerender(renderPane(createState('README.md')))

    await user.click(screen.getByRole('button', { name: /new markdown file/i }))
    expect(screen.getByLabelText(/new markdown file name/i)).toHaveValue(
      'Untitled.md'
    )
    await user.clear(screen.getByLabelText(/new markdown file name/i))
    await user.type(screen.getByLabelText(/new markdown file name/i), 'root.md')
    await user.keyboard('{Enter}')

    expect(onCreateFile).toHaveBeenLastCalledWith('root.md')
  }, EXPLORER_INTERACTION_TEST_TIMEOUT)

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
    await user.clear(screen.getByLabelText(/rename README\.md/i))
    await user.type(screen.getByLabelText(/rename README\.md/i), 'renamed.md')
    await user.keyboard('{Enter}')

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
    await user.clear(screen.getByLabelText(/rename docs/i))
    await user.type(screen.getByLabelText(/rename docs/i), 'guides')
    await user.keyboard('{Enter}')

    expect(onRenameEntry).toHaveBeenCalledWith('guides')

    fireEvent.contextMenu(screen.getByRole('button', { name: /docs folder/i }), {
      clientX: 36,
      clientY: 48
    })
    await user.click(screen.getByRole('menuitem', { name: /^delete$/i }))
    await user.click(screen.getByRole('button', { name: /confirm delete/i }))

    expect(onDeleteEntry).toHaveBeenCalledTimes(1)
  }, EXPLORER_INTERACTION_TEST_TIMEOUT)

  it('closes the row context menu when focus moves outside or Escape is pressed', async () => {
    const user = userEvent.setup()
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
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        state={state}
      />
    )

    fireEvent.contextMenu(
      screen.getByRole('button', { name: /README\.md Markdown file/i }),
      { clientX: 36, clientY: 48 }
    )

    expect(screen.getByRole('menu', { name: /README\.md actions/i })).toBeVisible()

    await user.click(screen.getByRole('button', { name: /docs folder/i }))

    expect(
      screen.queryByRole('menu', { name: /README\.md actions/i })
    ).not.toBeInTheDocument()

    fireEvent.contextMenu(
      screen.getByRole('button', { name: /README\.md Markdown file/i }),
      { clientX: 36, clientY: 48 }
    )

    expect(screen.getByRole('menu', { name: /README\.md actions/i })).toBeVisible()

    await user.keyboard('{Escape}')

    expect(
      screen.queryByRole('menu', { name: /README\.md actions/i })
    ).not.toBeInTheDocument()
  })

  it('shows create inputs under the selected folder and cancels inline editing with Escape', async () => {
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
      selectedEntryPath: 'docs',
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

    const docsRow = screen.getByRole('button', { name: /docs folder/i })

    await user.click(screen.getByRole('button', { name: /new markdown file/i }))

    const docsItem = docsRow.closest('li')
    const fileInput = within(docsItem as HTMLElement).getByLabelText(
      /new markdown file name/i
    )

    expect(fileInput).toHaveValue('Untitled.md')

    await user.clear(fileInput)
    await user.type(fileInput, 'daily.md')
    await user.keyboard('{Enter}')

    expect(onCreateFile).toHaveBeenCalledWith('docs/daily.md')

    await user.click(screen.getByRole('button', { name: /new folder/i }))

    const folderInput = within(docsItem as HTMLElement).getByLabelText(
      /new folder name/i
    )

    expect(folderInput).toHaveValue('notes')

    await user.keyboard('{Escape}')

    expect(
      screen.queryByLabelText(/new folder name/i)
    ).not.toBeInTheDocument()
    expect(onCreateFolder).not.toHaveBeenCalled()
  })

  it('refreshes a directory when it is expanded', async () => {
    const user = userEvent.setup()
    const onRefreshTree = vi.fn().mockResolvedValue(undefined)
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
        rootPath: '/workspace-refresh-expand',
        tree
      }
    }

    render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRefreshTree={onRefreshTree}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        state={state}
      />
    )

    await user.click(screen.getByRole('button', { name: /expand docs/i }))

    await waitFor(() => {
      expect(onRefreshTree).toHaveBeenCalledWith(['docs'])
    })
  })

  it('refreshes expanded directories and locates the current open file', async () => {
    const user = userEvent.setup()
    const onRefreshTree = vi.fn().mockResolvedValue(undefined)
    const scrollIntoView = vi.fn()
    const state: AppState = {
      draftMarkdown: '# Deep',
      errorMessage: null,
      fileErrorMessage: null,
      isDirty: false,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      isSavingFile: false,
      loadedFile: {
        contents: '# Deep',
        path: 'docs/nested/deep.md'
      },
      loadingWorkspaceRoot: null,
      selectedEntryPath: 'docs/nested/deep.md',
      selectedFilePath: 'docs/nested/deep.md',
      workspace: {
        name: 'workspace',
        rootPath: '/workspace-refresh-locate',
        tree
      }
    }

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView
    })

    render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRefreshTree={onRefreshTree}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        state={state}
      />
    )

    await user.click(screen.getByRole('button', { name: /expand docs/i }))
    onRefreshTree.mockClear()

    await user.click(screen.getByRole('button', { name: /refresh explorer/i }))

    await waitFor(() => {
      expect(onRefreshTree).toHaveBeenCalledWith(['docs', 'docs/nested'])
    })
    expect(
      screen.getByRole('button', { name: /deep\.md Markdown file/i })
    ).toHaveAttribute('aria-current', 'page')
    expect(scrollIntoView).toHaveBeenCalled()
  })

  it('renames entries inline at their original tree row and cancels with Escape', async () => {
    const user = userEvent.setup()
    const onRenameEntry = vi.fn()
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
        onDeleteEntry={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={onRenameEntry}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        state={state}
      />
    )

    const readmeRow = screen.getByRole('button', {
      name: /README\.md Markdown file/i
    })
    const readmeItem = readmeRow.closest('li')

    await user.click(screen.getByRole('button', { name: /rename selected README\.md/i }))

    const renameInput = within(readmeItem as HTMLElement).getByLabelText(
      /rename README\.md/i
    )

    expect(renameInput).toHaveValue('README.md')

    await user.keyboard('{Escape}')

    expect(
      screen.queryByLabelText(/rename README\.md/i)
    ).not.toBeInTheDocument()
    expect(onRenameEntry).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible()
  })

  it('shows recent files below the tree and supports collapse and resizing', async () => {
    const user = userEvent.setup()
    const onOpenRecentFile = vi.fn()
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
        rootPath: '/workspace-recent-files',
        tree
      }
    }

    const { container } = render(
      <ExplorerPane
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onDeleteEntry={vi.fn()}
        onOpenRecentFile={onOpenRecentFile}
        onOpenWorkspace={vi.fn()}
        onRenameEntry={vi.fn()}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        recentFilePaths={['docs/intro.md', 'README.md']}
        state={state}
      />
    )

    const recentFileButtons = screen.getAllByRole('button', {
      name: /open recent file/i
    })

    expect(recentFileButtons[0]).toHaveTextContent('intro.md')
    expect(recentFileButtons[1]).toHaveTextContent('README.md')

    await user.click(recentFileButtons[1])

    expect(onOpenRecentFile).toHaveBeenCalledWith('README.md')

    await user.click(screen.getByRole('button', { name: /recent files/i }))

    expect(
      screen.queryByRole('button', { name: /open recent file README\.md/i })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /recent files/i }))

    const resizeHandle = screen.getByRole('separator', {
      name: /resize recent files panel/i
    })
    const explorerContent = container.querySelector(
      '.explorer-content'
    )!

    vi.spyOn(explorerContent, 'getBoundingClientRect').mockReturnValue({
      bottom: 500,
      height: 500,
      left: 0,
      right: 288,
      toJSON: () => ({}),
      top: 0,
      width: 288,
      x: 0,
      y: 0
    })

    const pointerDown = new Event('pointerdown', { bubbles: true })

    Object.defineProperty(pointerDown, 'clientY', { value: 360 })
    fireEvent(resizeHandle, pointerDown)
    expect(resizeHandle).toHaveAttribute('aria-valuenow', '140')

    const pointerMove = new Event('pointermove')

    Object.defineProperty(pointerMove, 'clientY', { value: 300 })
    window.dispatchEvent(pointerMove)
    fireEvent.pointerUp(window)

    expect(resizeHandle).toHaveAttribute('aria-valuenow', '200')
    expect(localStorage.getItem('mde.explorerRecentFilesPanel')).toContain(
      '"height":200'
    )
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
