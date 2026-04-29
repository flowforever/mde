import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

interface MockMarkdownBlockEditorProps {
  readonly errorMessage: string | null
  readonly isDirty: boolean
  readonly isSaving: boolean
  readonly markdown: string
  readonly onMarkdownChange: (contents: string) => void
  readonly path: string
}

const mockEditorState = vi.hoisted(() => ({
  changeIndex: 0
}))

vi.mock('../../src/renderer/src/editor/MarkdownBlockEditor', () => {
  const MockMarkdownBlockEditor = (props: MockMarkdownBlockEditorProps) => (
    <section aria-label="Mock editor">
      <span>{props.path}</span>
      {props.isDirty ? <span>Unsaved changes</span> : null}
      {props.isSaving ? <span>Saving...</span> : null}
      {props.errorMessage ? <p role="alert">{props.errorMessage}</p> : null}
      <button
        onClick={() => {
          mockEditorState.changeIndex += 1
          props.onMarkdownChange(`# Changed ${mockEditorState.changeIndex}`)
        }}
        type="button"
      >
        Change mock markdown
      </button>
    </section>
  )

  return { MarkdownBlockEditor: MockMarkdownBlockEditor }
})

import { App } from '../../src/renderer/src/app/App'
import type { UpdateApi } from '../../src/shared/update'
import type { EditorApi } from '../../src/shared/workspace'

describe('App shell', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    mockEditorState.changeIndex = 0
    localStorage.clear()
    document.title = 'MDE'
    Reflect.deleteProperty(window, 'editorApi')
    Reflect.deleteProperty(window, 'updateApi')
  })

  it('opens a centered workspace popup on initial empty launch', () => {
    render(<App />)

    expect(
      screen.getByRole('dialog', { name: /workspace manager/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /^open workspace$/i })
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: /open new workspace/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /open markdown file/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', { name: /search workspaces and files/i })
    ).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('reopens the initial workspace popup from the trigger after dismissal', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: /close workspace popup/i }))

    expect(
      screen.queryByRole('dialog', { name: /workspace manager/i })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^open workspace$/i }))

    expect(
      screen.getByRole('dialog', { name: /workspace manager/i })
    ).toBeInTheDocument()
  })

  it('keeps initial empty states visible by text', () => {
    render(<App />)

    expect(
      screen.getByText(/open a folder to browse markdown files/i)
    ).toBeVisible()
    expect(screen.getByRole('heading', { name: /select a folder to begin/i }))
      .toBeVisible()
  })

  it('surfaces a useful error when the preload editor API is missing', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: /open new workspace/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/editor api unavailable/i)
  })

  it('opens a launch path supplied by preload', async () => {
    const editorApi = {
      consumeLaunchPath: vi
        .fn()
        .mockResolvedValueOnce('/notes/API.md')
        .mockResolvedValue(null),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: '/notes/API.md',
        name: 'API.md',
        openedFilePath: 'API.md',
        rootPath: '/notes',
        tree: [{ name: 'API.md', path: 'API.md', type: 'file' }],
        type: 'file'
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: '# API',
        path: 'API.md'
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn()
    } satisfies EditorApi

    Object.defineProperty(window, 'editorApi', {
      configurable: true,
      value: editorApi
    })

    render(<App />)

    await waitFor(() => {
      expect(editorApi.openPath).toHaveBeenCalledWith('/notes/API.md')
    })

    expect(editorApi.readMarkdownFile).toHaveBeenCalledWith('API.md', '/notes')
    expect(
      await screen.findByRole('button', { name: /manage workspaces/i })
    ).toHaveTextContent('API.md')
    await waitFor(() => {
      expect(document.title).toBe('API.md - /notes')
    })
    expect(
      screen.queryByRole('dialog', { name: /workspace manager/i })
    ).not.toBeInTheDocument()
  })

  it('switches to a remembered workspace from the workspace menu', async () => {
    const user = userEvent.setup()
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue(null),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockRejectedValue(
        new Error(
          "Error invoking remote method 'workspace:open-path': Error: No handler registered for 'workspace:open-path'"
        )
      ),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn().mockResolvedValue({
        name: 'Second Workspace',
        rootPath: '/workspaces/second',
        tree: [],
        type: 'workspace'
      }),
      readMarkdownFile: vi.fn(),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn()
    } satisfies EditorApi

    Object.defineProperty(window, 'editorApi', {
      configurable: true,
      value: editorApi
    })
    localStorage.setItem(
      'mde.recentWorkspaces',
      JSON.stringify([
        {
          name: 'Second Workspace',
          rootPath: '/workspaces/second',
          type: 'workspace'
        }
      ])
    )

    render(<App />)

    await screen.findByRole('dialog', { name: /workspace manager/i })
    await user.click(
      screen.getByRole('button', {
        name: /switch to workspace Second Workspace/i
      })
    )

    expect(editorApi.openWorkspaceByPath).toHaveBeenCalledWith('/workspaces/second')
    expect(editorApi.openPath).not.toHaveBeenCalled()
    expect(
      await screen.findByRole('button', { name: /manage workspaces/i })
    ).toHaveTextContent('Second Workspace')
    expect(document.title).toBe('/workspaces/second')
  })

  it('switches to a remembered file from the workspace menu without generic openPath IPC', async () => {
    const user = userEvent.setup()
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue(null),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn().mockResolvedValue({
        filePath: '/notes/API.md',
        name: 'API.md',
        openedFilePath: 'API.md',
        rootPath: '/notes',
        tree: [{ name: 'API.md', path: 'API.md', type: 'file' }],
        type: 'file'
      }),
      openPath: vi.fn().mockRejectedValue(
        new Error(
          "Error invoking remote method 'workspace:open-path': Error: No handler registered for 'workspace:open-path'"
        )
      ),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: '# API',
        path: 'API.md'
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn()
    } satisfies EditorApi

    Object.defineProperty(window, 'editorApi', {
      configurable: true,
      value: editorApi
    })
    localStorage.setItem(
      'mde.recentWorkspaces',
      JSON.stringify([
        {
          filePath: '/notes/API.md',
          name: 'API.md',
          openedFilePath: 'API.md',
          rootPath: '/notes',
          type: 'file'
        }
      ])
    )

    render(<App />)

    await screen.findByRole('dialog', { name: /workspace manager/i })
    await user.click(
      screen.getByRole('button', {
        name: /switch to file API\.md/i
      })
    )

    expect(editorApi.openFileByPath).toHaveBeenCalledWith('/notes/API.md')
    expect(editorApi.openPath).not.toHaveBeenCalled()
    expect(editorApi.readMarkdownFile).toHaveBeenCalledWith('API.md', '/notes')
    expect(
      await screen.findByRole('button', { name: /manage workspaces/i })
    ).toHaveTextContent('API.md')
    expect(document.title).toBe('API.md - /notes')
  })

  it('searches and forgets remembered workspace resources in the popup', async () => {
    const user = userEvent.setup()

    localStorage.setItem(
      'mde.recentWorkspaces',
      JSON.stringify([
        ...Array.from({ length: 12 }, (_, index) => ({
          name: `Workspace ${index + 1}`,
          rootPath: `/workspaces/${index + 1}`,
          type: 'workspace'
        })),
        {
          filePath: '/notes/API.md',
          name: 'API.md',
          openedFilePath: 'API.md',
          rootPath: '/notes',
          type: 'file'
        }
      ])
    )

    render(<App />)

    await screen.findByRole('dialog', { name: /workspace manager/i })
    await user.type(
      screen.getByRole('searchbox', { name: /search workspaces and files/i }),
      'api'
    )

    expect(
      screen.getByRole('button', { name: /switch to file API\.md/i })
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /switch to workspace Workspace 1/i })
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /remove recent file API\.md/i })
    )

    expect(
      screen.queryByRole('button', { name: /switch to file API\.md/i })
    ).not.toBeInTheDocument()
    expect(localStorage.getItem('mde.recentWorkspaces')).not.toContain('API.md')
  })

  it('opens a standalone markdown file and remembers it from the popup', async () => {
    const user = userEvent.setup()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn()
      }))
    })
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue(null),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn().mockResolvedValue({
        filePath: '/notes/API.md',
        name: 'API.md',
        openedFilePath: 'API.md',
        rootPath: '/notes',
        tree: [{ name: 'API.md', path: 'API.md', type: 'file' }],
        type: 'file'
      }),
      openFileByPath: vi.fn(),
      openPath: vi.fn(),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: '# API',
        path: 'API.md'
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn()
    } satisfies EditorApi

    Object.defineProperty(window, 'editorApi', {
      configurable: true,
      value: editorApi
    })

    render(<App />)

    await screen.findByRole('dialog', { name: /workspace manager/i })
    await user.click(screen.getByRole('button', { name: /open markdown file/i }))

    expect(editorApi.openFile).toHaveBeenCalledTimes(1)
    expect(editorApi.readMarkdownFile).toHaveBeenCalledWith('API.md', '/notes')
    expect(
      await screen.findByRole('button', { name: /manage workspaces/i })
    ).toHaveTextContent('API.md')
    expect(localStorage.getItem('mde.recentWorkspaces')).toContain('"type":"file"')
  })

  it('shows a macOS update dialog and opens the downloaded installer', async () => {
    const user = userEvent.setup()
    const updateApi = {
      checkForUpdates: vi.fn().mockResolvedValue({
        currentVersion: '1.1.1',
        update: {
          assetName: 'MDE-1.2.0-mac-arm64.dmg',
          assetSize: 456,
          currentVersion: '1.1.1',
          installMode: 'open-dmg',
          latestVersion: '1.2.0',
          publishedAt: '2026-04-29T09:11:32.622Z',
          releaseName: 'MDE 1.2.0',
          releaseNotes: 'Editor update improvements.',
          releaseUrl: 'https://github.com/flowforever/mde/releases/tag/v1.2.0'
        },
        updateAvailable: true
      }),
      downloadAndOpenUpdate: vi.fn().mockResolvedValue({
        filePath: '/Users/test/Library/Application Support/MDE/updates/MDE-1.2.0-mac-arm64.dmg',
        version: '1.2.0'
      }),
      installWindowsUpdate: vi.fn(),
      onUpdateAvailable: vi.fn(() => vi.fn()),
      onUpdateDownloadProgress: vi.fn(() => vi.fn()),
      onUpdateReady: vi.fn(() => vi.fn())
    } satisfies UpdateApi

    Object.defineProperty(window, 'updateApi', {
      configurable: true,
      value: updateApi
    })

    render(<App />)

    expect(
      await screen.findByRole('dialog', { name: /mde update/i })
    ).toBeVisible()
    expect(screen.getByText(/editor update improvements/i)).toBeVisible()

    await user.click(
      screen.getByRole('button', { name: /download and install/i })
    )

    await waitFor(() => {
      expect(updateApi.downloadAndOpenUpdate).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByText(/installer has opened/i)).toBeVisible()
    expect(screen.getByText(/drag MDE to Applications/i)).toBeVisible()
  })

  it('toggles the editor between centered and full-width views', async () => {
    const user = userEvent.setup()
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue('/workspace/README.md'),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: '/workspace/README.md',
        name: 'README.md',
        openedFilePath: 'README.md',
        rootPath: '/workspace',
        tree: [{ name: 'README.md', path: 'README.md', type: 'file' }],
        type: 'file'
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: '# Original',
        path: 'README.md'
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn()
    } satisfies EditorApi

    Object.defineProperty(window, 'editorApi', {
      configurable: true,
      value: editorApi
    })

    render(<App />)

    const editorPane = screen.getByRole('region', { name: /editor/i })
    const fullWidthButton = await screen.findByRole('button', {
      name: /use full-width editor view/i
    })

    expect(editorPane).not.toHaveClass('is-editor-full-width')

    await user.click(fullWidthButton)

    expect(editorPane).toHaveClass('is-editor-full-width')
    expect(localStorage.getItem('mde.editorViewMode')).toBe('full-width')

    await user.click(
      screen.getByRole('button', { name: /use centered editor view/i })
    )

    expect(editorPane).not.toHaveClass('is-editor-full-width')
    expect(localStorage.getItem('mde.editorViewMode')).toBe('centered')
  })

  it('restores the remembered full-width editor view on launch', async () => {
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue('/workspace/README.md'),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: '/workspace/README.md',
        name: 'README.md',
        openedFilePath: 'README.md',
        rootPath: '/workspace',
        tree: [{ name: 'README.md', path: 'README.md', type: 'file' }],
        type: 'file'
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: '# Original',
        path: 'README.md'
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn()
    } satisfies EditorApi

    Object.defineProperty(window, 'editorApi', {
      configurable: true,
      value: editorApi
    })
    localStorage.setItem('mde.editorViewMode', 'full-width')

    render(<App />)

    expect(screen.getByRole('region', { name: /editor/i })).toHaveClass(
      'is-editor-full-width'
    )
    expect(
      await screen.findByRole('button', {
        name: /use centered editor view/i
      })
    ).toBeVisible()
  })

  it('auto-saves the latest dirty editor contents after five idle seconds', async () => {
    const editorApi = {
      consumeLaunchPath: vi.fn().mockResolvedValue('/workspace/README.md'),
      createFolder: vi.fn(),
      createMarkdownFile: vi.fn(),
      deleteEntry: vi.fn(),
      listDirectory: vi.fn(),
      onLaunchPath: vi.fn(() => vi.fn()),
      openFile: vi.fn(),
      openFileByPath: vi.fn(),
      openPath: vi.fn().mockResolvedValue({
        filePath: '/workspace/README.md',
        name: 'README.md',
        openedFilePath: 'README.md',
        rootPath: '/workspace',
        tree: [{ name: 'README.md', path: 'README.md', type: 'file' }],
        type: 'file'
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: '# Original',
        path: 'README.md'
      }),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn().mockResolvedValue(undefined)
    } satisfies EditorApi

    Object.defineProperty(window, 'editorApi', {
      configurable: true,
      value: editorApi
    })

    render(<App />)

    const changeButton = await screen.findByRole('button', {
      name: /change mock markdown/i
    })

    vi.useFakeTimers()
    fireEvent.click(changeButton)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    fireEvent.click(changeButton)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4999)
    })

    expect(editorApi.writeMarkdownFile).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })

    expect(editorApi.writeMarkdownFile).toHaveBeenCalledWith(
      'README.md',
      '# Changed 2',
      '/workspace'
    )
  })

  it('resizes the explorer sidebar from the drag separator', () => {
    render(<App />)

    const shell = screen.getByRole('main')
    const resizeHandle = screen.getByRole('separator', {
      name: /resize explorer sidebar/i
    })

    expect(resizeHandle).toHaveAttribute('aria-valuenow', '288')
    expect(shell.style.getPropertyValue('--explorer-width')).toBe('288px')

    fireEvent.pointerDown(resizeHandle, { clientX: 288, pointerId: 1 })
    const pointerMove = new Event('pointermove')

    Object.defineProperty(pointerMove, 'clientX', { value: 360 })
    window.dispatchEvent(pointerMove)
    fireEvent.pointerUp(window)

    expect(resizeHandle).toHaveAttribute('aria-valuenow', '360')
    expect(shell.style.getPropertyValue('--explorer-width')).toBe('360px')
  })

  it('toggles the explorer sidebar between collapsed and expanded states', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(
      screen.getByRole('button', { name: /collapse explorer sidebar/i })
    )

    expect(screen.getByRole('main')).toHaveClass('is-explorer-collapsed')
    expect(
      screen.queryByRole('button', { name: /^open workspace$/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('separator', { name: /resize explorer sidebar/i })
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /expand explorer sidebar/i })
    )

    expect(screen.getByRole('main')).not.toHaveClass('is-explorer-collapsed')
    expect(
      screen.getByRole('button', { name: /^open workspace$/i })
    ).toBeVisible()
    expect(
      screen.getByRole('separator', { name: /resize explorer sidebar/i })
    ).toBeVisible()
  })
})
