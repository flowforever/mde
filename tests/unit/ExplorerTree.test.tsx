import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ExplorerTree } from '../../src/renderer/src/explorer/ExplorerTree'
import { ExplorerPane } from '../../src/renderer/src/explorer/ExplorerPane'
import type { AppState } from '../../src/renderer/src/app/appTypes'
import type { TreeNode } from '../../src/shared/fileTree'

describe('ExplorerTree', () => {
  afterEach(() => {
    cleanup()
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

    render(
      <ExplorerTree
        nodes={tree}
        onSelectEntry={vi.fn()}
        onSelectFile={vi.fn()}
        selectedEntryPath={null}
        selectedFilePath={null}
      />
    )

    const docsRow = screen.getByRole('button', { name: /docs folder/i })

    expect(docsRow).toHaveAttribute('aria-expanded', 'false')

    await user.click(docsRow)

    expect(docsRow).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByRole('button', { name: /intro\.md Markdown file/i })
    ).toBeInTheDocument()

    await user.click(docsRow)

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
      screen.getByRole('button', { name: /open folder/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /new markdown file/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new folder/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /rename selected README\.md/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /delete selected README\.md/i })
    ).toBeInTheDocument()
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
      screen.getByText(/open a folder to browse markdown files/i)
    ).toBeVisible()
  })
})
