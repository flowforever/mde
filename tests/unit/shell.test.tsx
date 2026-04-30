import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

interface MockMarkdownBlockEditorProps {
  readonly colorScheme: 'dark' | 'light'
  readonly errorMessage: string | null
  readonly isDirty: boolean
  readonly isReadOnly?: boolean
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
      <span>{props.markdown}</span>
      <span data-testid="mock-editor-color-scheme">{props.colorScheme}</span>
      {props.isReadOnly ? <span data-testid="mock-editor-readonly">read-only</span> : null}
      {props.isDirty ? <span>Unsaved changes</span> : null}
      {props.isSaving ? <span>Saving...</span> : null}
      {props.errorMessage ? <p role="alert">{props.errorMessage}</p> : null}
      <button
        onClick={() => {
          if (props.isReadOnly) {
            return
          }

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
import { APP_THEME_STORAGE_KEY } from '../../src/renderer/src/theme/appThemes'
import type { AiApi, AiGenerationResult } from '../../src/shared/ai'
import type { UpdateApi } from '../../src/shared/update'
import type { EditorApi } from '../../src/shared/workspace'

const createDeferred = <Value,>(): {
  readonly promise: Promise<Value>
  readonly reject: (reason?: unknown) => void
  readonly resolve: (value: Value) => void
} => {
  let resolveDeferred: (value: Value) => void = () => undefined
  let rejectDeferred: (reason?: unknown) => void = () => undefined
  const promise = new Promise<Value>((resolve, reject) => {
    resolveDeferred = resolve
    rejectDeferred = reject
  })

  return {
    promise,
    reject: rejectDeferred,
    resolve: resolveDeferred
  }
}

const mockSystemThemePreference = (initialMatches: boolean) => {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const mediaQueryList = {
    addEventListener: vi.fn((_type: string, listener: EventListenerOrEventListenerObject) => {
      if (typeof listener === 'function') {
        listeners.add(listener as (event: MediaQueryListEvent) => void)
      }
    }),
    addListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener)
    }),
    dispatchEvent: vi.fn(),
    matches: initialMatches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    removeEventListener: vi.fn(
      (_type: string, listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === 'function') {
          listeners.delete(listener as (event: MediaQueryListEvent) => void)
        }
      }
    ),
    removeListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener)
    })
  } as unknown as MediaQueryList

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue(mediaQueryList)
  })

  return {
    setMatches: (matches: boolean) => {
      Object.defineProperty(mediaQueryList, 'matches', {
        configurable: true,
        value: matches
      })
      listeners.forEach((listener) => {
        listener({
          matches,
          media: '(prefers-color-scheme: dark)'
        } as MediaQueryListEvent)
      })
    }
  }
}

describe('App shell', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    mockEditorState.changeIndex = 0
    localStorage.clear()
    document.title = 'MDE'
    Reflect.deleteProperty(window, 'aiApi')
    Reflect.deleteProperty(window, 'editorApi')
    Reflect.deleteProperty(window, 'updateApi')
  })

  it('opens a centered workspace popup on initial empty launch', () => {
    render(<App />)

    expect(screen.getByRole('main')).toHaveAttribute('data-theme', 'manuscript')
    expect(screen.getByRole('main')).toHaveAttribute('data-theme-family', 'light')
    expect(screen.getByRole('main')).toHaveAttribute('data-panel-family', 'light')
    expect(
      screen.getByRole('switch', { name: /follow system appearance/i })
    ).toBeChecked()
    expect(
      screen.getByRole('button', { name: /choose theme/i })
    ).toBeEnabled()
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

  it('restores the active workspace and last opened file on renderer launch', async () => {
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
      openPath: vi.fn(),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn().mockResolvedValue({
        name: 'Workspace',
        rootPath: '/workspace',
        tree: [
          { name: 'README.md', path: 'README.md', type: 'file' },
          {
            children: [
              { name: 'intro.md', path: 'docs/intro.md', type: 'file' }
            ],
            name: 'docs',
            path: 'docs',
            type: 'directory'
          }
        ],
        type: 'workspace'
      }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        contents: '# Intro',
        path: 'docs/intro.md'
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
      'mde.activeWorkspace',
      JSON.stringify({
        name: 'Workspace',
        rootPath: '/workspace',
        type: 'workspace'
      })
    )
    localStorage.setItem(
      'mde.workspaceFileHistory',
      JSON.stringify([
        {
          lastOpenedFilePath: 'docs/intro.md',
          recentFilePaths: ['docs/intro.md', 'README.md'],
          workspaceRoot: '/workspace'
        }
      ])
    )

    render(<App />)

    await waitFor(() => {
      expect(editorApi.openWorkspaceByPath).toHaveBeenCalledWith('/workspace')
    })
    expect(editorApi.readMarkdownFile).toHaveBeenCalledWith(
      'docs/intro.md',
      '/workspace'
    )
    expect(await screen.findAllByText('docs/intro.md')).not.toHaveLength(0)
    await user.click(
      screen.getByRole('button', { name: /open recent file README\.md/i })
    )
    await waitFor(() => {
      expect(editorApi.readMarkdownFile).toHaveBeenCalledWith(
        'README.md',
        '/workspace'
      )
    })
    expect(
      screen.queryByRole('dialog', { name: /workspace manager/i })
    ).not.toBeInTheDocument()
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

  it('shows AI actions for detected CLIs and renders read-only generated results', async () => {
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
      writeMarkdownFile: vi.fn().mockResolvedValue(undefined)
    } satisfies EditorApi
    const aiApi = {
      detectTools: vi.fn().mockResolvedValue({
        tools: [{ commandPath: '/fake/codex', id: 'codex', name: 'Codex' }]
      }),
      summarizeMarkdown: vi
        .fn()
        .mockResolvedValueOnce({
          cached: false,
          contents: '## Summary\n\n- Original summarized.',
          kind: 'summary',
          path: '.mde/translations/README-summary.md',
          tool: { commandPath: '/fake/codex', id: 'codex', name: 'Codex' }
        })
        .mockResolvedValueOnce({
          cached: false,
          contents: '## Summary\n\n- Shorter original summary.',
          kind: 'summary',
          path: '.mde/translations/README-summary.md',
          tool: { commandPath: '/fake/codex', id: 'codex', name: 'Codex' }
        }),
      translateMarkdown: vi.fn().mockResolvedValue({
        cached: false,
        contents: '# English\n\nOriginal translated.',
        kind: 'translation',
        language: 'English',
        path: '.mde/translations/README.English.md',
        tool: { commandPath: '/fake/codex', id: 'codex', name: 'Codex' }
      })
    } satisfies AiApi

    Object.defineProperty(window, 'editorApi', {
      configurable: true,
      value: editorApi
    })
    Object.defineProperty(window, 'aiApi', {
      configurable: true,
      value: aiApi
    })

    render(<App />)

    const summaryButton = await screen.findByRole('button', {
      name: /summarize markdown/i
    })

    await user.click(summaryButton)

    expect(aiApi.summarizeMarkdown).toHaveBeenCalledWith(
      'README.md',
      '# Original',
      '/workspace',
      undefined
    )
    const summaryResult = await screen.findByRole('region', {
      name: /ai result/i
    })

    expect(summaryResult).toHaveTextContent('Original summarized')
    expect(within(summaryResult).getByTestId('mock-editor-readonly')).toBeVisible()
    expect(
      screen.getByRole('textbox', { name: /refine summary instruction/i })
    ).toBeVisible()

    await user.type(
      screen.getByRole('textbox', { name: /refine summary instruction/i }),
      'Make it shorter'
    )
    await user.click(screen.getByRole('button', { name: /regenerate summary/i }))

    expect(aiApi.summarizeMarkdown).toHaveBeenLastCalledWith(
      'README.md',
      '# Original',
      '/workspace',
      'Make it shorter'
    )
    expect(
      await screen.findByRole('region', { name: /ai result/i })
    ).toHaveTextContent('Shorter original summary')

    await user.click(
      screen.getByRole('button', { name: /translate markdown/i })
    )
    await user.click(screen.getByRole('menuitem', { name: /English/i }))

    expect(aiApi.translateMarkdown).toHaveBeenCalledWith(
      'README.md',
      '# Original',
      'English',
      '/workspace'
    )
    expect(
      await screen.findByRole('region', { name: /ai result/i })
    ).toHaveTextContent('Original translated')
    expect(
      screen.queryByRole('textbox', { name: /refine summary instruction/i })
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /translate markdown/i })
    )
    await user.type(
      screen.getByRole('textbox', { name: /custom translation language/i }),
      'Japanese'
    )
    await user.click(
      screen.getByRole('button', { name: /add translation language/i })
    )

    expect(aiApi.translateMarkdown).toHaveBeenLastCalledWith(
      'README.md',
      '# Original',
      'Japanese',
      '/workspace'
    )
    expect(localStorage.getItem('mde.customTranslationLanguages')).toContain(
      'Japanese'
    )

    await user.click(
      screen.getByRole('button', { name: /translate markdown/i })
    )
    await user.click(
      screen.getByRole('button', { name: /remove custom language Japanese/i })
    )

    expect(localStorage.getItem('mde.customTranslationLanguages')).not.toContain(
      'Japanese'
    )
  })

  it('keeps AI button state scoped to the active Markdown file', async () => {
    const user = userEvent.setup()
    const translation = createDeferred<AiGenerationResult>()
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
        tree: [
          { name: 'README.md', path: 'README.md', type: 'file' },
          { name: 'notes.md', path: 'notes.md', type: 'file' }
        ],
        type: 'file'
      }),
      openWorkspace: vi.fn(),
      openWorkspaceByPath: vi.fn(),
      readMarkdownFile: vi.fn((filePath: string) =>
        Promise.resolve({
          contents: filePath === 'notes.md' ? '# Notes' : '# Original',
          path: filePath
        })
      ),
      renameEntry: vi.fn(),
      saveImageAsset: vi.fn(),
      writeMarkdownFile: vi.fn().mockResolvedValue(undefined)
    } satisfies EditorApi
    const aiApi = {
      detectTools: vi.fn().mockResolvedValue({
        tools: [{ commandPath: '/fake/codex', id: 'codex', name: 'Codex' }]
      }),
      summarizeMarkdown: vi.fn(),
      translateMarkdown: vi.fn().mockReturnValue(translation.promise)
    } satisfies AiApi

    Object.defineProperty(window, 'editorApi', {
      configurable: true,
      value: editorApi
    })
    Object.defineProperty(window, 'aiApi', {
      configurable: true,
      value: aiApi
    })

    render(<App />)

    expect(await screen.findByText('# Original')).toBeVisible()

    await user.click(screen.getByRole('button', { name: /translate markdown/i }))
    await user.click(screen.getByRole('menuitem', { name: /English/i }))

    expect(
      screen.getByRole('button', { name: /summarize markdown/i })
    ).toHaveAttribute('aria-busy', 'false')
    expect(
      screen.getByRole('button', { name: /translate markdown/i })
    ).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /notes\.md Markdown file/i })
    )

    expect(await screen.findByText('# Notes')).toBeVisible()
    expect(
      screen.getByRole('button', { name: /summarize markdown/i })
    ).toHaveAttribute('aria-busy', 'false')
    expect(
      screen.getByRole('button', { name: /translate markdown/i })
    ).toHaveAttribute('aria-busy', 'false')
    expect(screen.queryByTestId('ai-action-spinner')).not.toBeInTheDocument()

    await act(async () => {
      translation.resolve({
        cached: false,
        contents: '# English\n\nOriginal translated.',
        kind: 'translation',
        language: 'English',
        path: '.mde/translations/README.English.md',
        tool: { commandPath: '/fake/codex', id: 'codex', name: 'Codex' }
      })
      await Promise.resolve()
    })

    expect(
      screen.queryByRole('region', { name: /ai result/i })
    ).not.toBeInTheDocument()
    expect(screen.getByText('# Notes')).toBeVisible()
  })

  it('opens a manual theme selector and persists the selected theme', async () => {
    const user = userEvent.setup()

    localStorage.setItem(
      APP_THEME_STORAGE_KEY,
      JSON.stringify({
        lastDarkThemeId: 'cedar',
        lastLightThemeId: 'porcelain',
        mode: 'dark'
      })
    )

    render(<App />)

    expect(screen.getByRole('main')).toHaveAttribute('data-theme', 'cedar')
    expect(
      screen.getByRole('switch', { name: /follow system appearance/i })
    ).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: /choose theme/i }))

    expect(screen.getByRole('dialog', { name: /themes/i })).toBeVisible()
    const colorwayPicker = screen.getByRole('radiogroup', {
      name: /theme colorways/i
    })

    expect(within(colorwayPicker).queryByText(/^Dark$/i)).not.toBeInTheDocument()
    expect(within(colorwayPicker).queryByText(/Light panel/i))
      .not.toBeInTheDocument()
    expect(within(colorwayPicker).queryByText(/Dark panel/i))
      .not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /glacier/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /cedar/i })).toBeChecked()

    await user.click(screen.getByRole('radio', { name: /sage paper/i }))

    expect(screen.getByRole('main')).toHaveAttribute('data-theme', 'sage-paper')
    expect(screen.getByRole('main')).toHaveAttribute('data-theme-family', 'light')
    expect(screen.getByRole('main')).toHaveAttribute('data-panel-family', 'light')
    expect(localStorage.getItem(APP_THEME_STORAGE_KEY)).toBe(
      JSON.stringify({
        lastDarkThemeId: 'cedar',
        lastLightThemeId: 'sage-paper',
        mode: 'light'
      })
    )
  })

  it('updates follow-system themes when the OS appearance changes', () => {
    const systemTheme = mockSystemThemePreference(false)

    localStorage.setItem(
      APP_THEME_STORAGE_KEY,
      JSON.stringify({
        lastDarkThemeId: 'moss',
        lastLightThemeId: 'porcelain',
        mode: 'system'
      })
    )

    render(<App />)

    expect(screen.getByRole('main')).toHaveAttribute('data-theme', 'porcelain')

    act(() => {
      systemTheme.setMatches(true)
    })

    expect(screen.getByRole('main')).toHaveAttribute('data-theme', 'moss')
    expect(localStorage.getItem(APP_THEME_STORAGE_KEY)).toBe(
      JSON.stringify({
        lastDarkThemeId: 'moss',
        lastLightThemeId: 'porcelain',
        mode: 'system'
      })
    )
  })

  it('selects only the current system family while keeping follow-system enabled', async () => {
    const user = userEvent.setup()
    mockSystemThemePreference(false)
    localStorage.setItem(
      APP_THEME_STORAGE_KEY,
      JSON.stringify({
        lastDarkThemeId: 'moss',
        lastLightThemeId: 'porcelain',
        mode: 'system'
      })
    )

    render(<App />)

    await user.click(screen.getByRole('button', { name: /choose theme/i }))

    expect(screen.getByRole('dialog', { name: /themes/i })).toBeVisible()
    const colorwayPicker = screen.getByRole('radiogroup', {
      name: /theme colorways/i
    })

    expect(within(colorwayPicker).queryByText(/^Dark$/i)).not.toBeInTheDocument()
    expect(within(colorwayPicker).queryByText(/Light panel/i))
      .not.toBeInTheDocument()
    expect(within(colorwayPicker).queryByText(/Dark panel/i))
      .not.toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /blue hour/i }))
      .not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /glacier/i })).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /binder/i }))

    expect(screen.getByRole('main')).toHaveAttribute('data-theme', 'binder')
    expect(
      screen.getByRole('switch', { name: /follow system appearance/i })
    ).toBeChecked()
    expect(localStorage.getItem(APP_THEME_STORAGE_KEY)).toBe(
      JSON.stringify({
        lastDarkThemeId: 'moss',
        lastLightThemeId: 'binder',
        mode: 'system'
      })
    )
  })

  it('passes the resolved color scheme to the Markdown editor', async () => {
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
    localStorage.setItem(
      APP_THEME_STORAGE_KEY,
      JSON.stringify({
        lastDarkThemeId: 'blue-hour',
        lastLightThemeId: 'manuscript',
        mode: 'dark'
      })
    )

    render(<App />)

    expect(await screen.findByTestId('mock-editor-color-scheme')).toHaveTextContent(
      'dark'
    )
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
