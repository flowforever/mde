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

    render(<ExplorerTree nodes={tree} selectedFilePath={null} onSelectFile={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /expand docs/i }))
    await user.click(screen.getByRole('button', { name: /expand nested/i }))

    expect(screen.getByRole('button', { name: 'README.md' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'intro.md' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'deep.md' })).toBeInTheDocument()
  })

  it('toggles a directory from the visible row button with expanded state', async () => {
    const user = userEvent.setup()

    render(<ExplorerTree nodes={tree} selectedFilePath={null} onSelectFile={vi.fn()} />)

    const docsRow = screen.getByRole('button', { name: /^docs$/ })

    expect(docsRow).toHaveAttribute('aria-expanded', 'false')

    await user.click(docsRow)

    expect(docsRow).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'intro.md' })).toBeInTheDocument()

    await user.click(docsRow)

    expect(docsRow).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'intro.md' })).not.toBeInTheDocument()
  })

  it('calls onSelectFile when a Markdown file is selected', async () => {
    const user = userEvent.setup()
    const onSelectFile = vi.fn()

    render(
      <ExplorerTree
        nodes={tree}
        selectedFilePath={null}
        onSelectFile={onSelectFile}
      />
    )

    await user.click(screen.getByRole('button', { name: 'README.md' }))

    expect(onSelectFile).toHaveBeenCalledWith('README.md')
  })

  it('resets expanded folders when the workspace root changes', async () => {
    const user = userEvent.setup()
    const createState = (rootPath: string): AppState => ({
      errorMessage: null,
      fileErrorMessage: null,
      isLoadingFile: false,
      isOpeningWorkspace: false,
      loadedFile: null,
      selectedFilePath: null,
      workspace: {
        name: 'workspace',
        rootPath,
        tree
      }
    })

    const { rerender } = render(
      <ExplorerPane
        onOpenWorkspace={vi.fn()}
        onSelectFile={vi.fn()}
        state={createState('/workspace-one')}
      />
    )

    await user.click(screen.getByRole('button', { name: /^docs$/ }))
    expect(screen.getByRole('button', { name: 'intro.md' })).toBeInTheDocument()

    rerender(
      <ExplorerPane
        onOpenWorkspace={vi.fn()}
        onSelectFile={vi.fn()}
        state={createState('/workspace-two')}
      />
    )

    expect(screen.queryByRole('button', { name: 'intro.md' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^docs$/ })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  })
})
