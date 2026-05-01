import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MarkdownBlockEditor } from '../../src/renderer/src/editor/MarkdownBlockEditor'

interface MockHighlightRegistry {
  readonly delete: ReturnType<typeof vi.fn>
  readonly set: ReturnType<typeof vi.fn>
}

const mockBlockNoteState = vi.hoisted(() => ({
  lastEditor: undefined as
    | {
        blocksToMarkdownLossy: ReturnType<typeof vi.fn>
        document: { content: string; id: string; type: string }[]
        replaceBlocks: ReturnType<typeof vi.fn>
        transaction: { setMeta: ReturnType<typeof vi.fn> }
        transact: ReturnType<typeof vi.fn>
        tryParseMarkdownToBlocks: ReturnType<typeof vi.fn>
      }
    | undefined,
  lastOptions: undefined as
    | { uploadFile?: (file: File, blockId?: string) => Promise<string> }
    | undefined
}))
const mockMermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn().mockResolvedValue({
    svg: '<svg role="img"><text>Rendered flowchart</text></svg>'
  })
}))

vi.mock('@blocknote/react', () => ({
  useCreateBlockNote: (
    options?: { uploadFile?: (file: File, blockId?: string) => Promise<string> }
  ) => {
    mockBlockNoteState.lastOptions = options

    if (!mockBlockNoteState.lastEditor) {
      const blocks = [{ content: '', id: 'initial', type: 'paragraph' }]
      const transaction = { setMeta: vi.fn() }

      mockBlockNoteState.lastEditor = {
        blocksToMarkdownLossy: vi.fn().mockResolvedValue(''),
        document: blocks,
        replaceBlocks: vi.fn(),
        transaction,
        transact: vi.fn((callback: (transaction: unknown) => unknown) =>
          callback(transaction)
        ),
        tryParseMarkdownToBlocks: vi.fn().mockResolvedValue(blocks)
      }
    }

    return mockBlockNoteState.lastEditor
  }
}))

vi.mock('@blocknote/mantine', () => ({
  BlockNoteView: ({
    className,
    'data-testid': testId,
    editable,
    editor,
    onChange,
    theme
  }: {
    readonly className?: string
    readonly 'data-testid'?: string
    readonly editable?: boolean
    readonly editor: unknown
    readonly onChange: (editor: unknown) => void
    readonly theme: 'dark' | 'light'
  }) => (
    <div className={className} data-testid={testId} data-theme={theme} tabIndex={0}>
      <div
        contentEditable={editable !== false}
        data-testid="mock-contenteditable"
        suppressContentEditableWarning
        tabIndex={0}
      />
      <button
        onClick={() => {
          onChange(editor)
        }}
        type="button"
      >
        Trigger editor change
      </button>
    </div>
  )
}))

vi.mock('mermaid', () => ({
  default: mockMermaid
}))

describe('MarkdownBlockEditor accessibility', () => {
  const installHighlightMock = (): MockHighlightRegistry => {
    const registry = {
      delete: vi.fn(),
      set: vi.fn()
    }

    Object.defineProperty(window, 'Highlight', {
      configurable: true,
      value: vi.fn()
    })
    Object.defineProperty(window.CSS, 'highlights', {
      configurable: true,
      value: registry
    })

    return registry
  }

  afterEach(() => {
    cleanup()
    mockBlockNoteState.lastEditor = undefined
    mockBlockNoteState.lastOptions = undefined
    mockMermaid.initialize.mockClear()
    mockMermaid.render.mockClear()
    Reflect.deleteProperty(window, 'Highlight')
    Reflect.deleteProperty(window.CSS, 'highlights')
  })

  it('does not render a manual save control', () => {
    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Fixture Workspace"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="# Fixture Workspace"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        workspaceRoot="/workspace"
      />
    )

    expect(
      screen.queryByRole('button', { name: /save README\.md/i })
    ).not.toBeInTheDocument()
  })

  it('renders read-only markdown without propagating editor changes', async () => {
    const user = userEvent.setup()
    const onMarkdownChange = vi.fn()
    const onSaveRequest = vi.fn()

    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="## Summary"
        errorMessage={null}
        isDirty={false}
        isReadOnly
        isSaving={false}
        markdown="## Summary"
        onImageUpload={vi.fn()}
        onMarkdownChange={onMarkdownChange}
        onSaveRequest={onSaveRequest}
        path=".mde/translations/README-summary.md"
        workspaceRoot="/workspace"
      />
    )

    expect(screen.getByTestId('mock-contenteditable')).toHaveAttribute(
      'contenteditable',
      'false'
    )

    await user.click(screen.getByRole('button', { name: /trigger editor change/i }))

    expect(onMarkdownChange).not.toHaveBeenCalled()
    expect(onSaveRequest).not.toHaveBeenCalled()
  })

  it('shows visible dirty state text for unsaved changes', () => {
    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Fixture Workspace"
        errorMessage={null}
        isDirty
        isSaving={false}
        markdown="# Fixture Workspace"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        workspaceRoot="/workspace"
      />
    )

    expect(screen.getByText(/unsaved changes/i)).toBeVisible()
  })

  it('serializes markdown when the dirty editor loses focus', async () => {
    const user = userEvent.setup()
    const onSaveRequest = vi.fn()

    render(
      <>
        <MarkdownBlockEditor
          colorScheme="light"
          draftMarkdown="# Fixture Workspace"
          errorMessage={null}
          isDirty
          isSaving={false}
          markdown="# Fixture Workspace"
          onImageUpload={vi.fn()}
          onMarkdownChange={vi.fn()}
          onSaveRequest={onSaveRequest}
          path="README.md"
          workspaceRoot="/workspace"
        />
        <button type="button">Outside editor</button>
      </>
    )

    await user.click(screen.getByRole('button', { name: /trigger editor change/i }))
    await user.click(screen.getByRole('button', { name: /outside editor/i }))

    expect(onSaveRequest).toHaveBeenCalledWith('')
  })

  it('saves block editor changes on blur even after the draft has updated', async () => {
    const user = userEvent.setup()
    const onSaveRequest = vi.fn()
    const { rerender } = render(
      <>
        <MarkdownBlockEditor
          colorScheme="light"
          draftMarkdown="# Fixture Workspace"
          errorMessage={null}
          isDirty
          isSaving={false}
          markdown="# Fixture Workspace"
          onImageUpload={vi.fn()}
          onMarkdownChange={vi.fn()}
          onSaveRequest={onSaveRequest}
          path="README.md"
          workspaceRoot="/workspace"
        />
        <button type="button">Outside editor</button>
      </>
    )

    await user.click(screen.getByRole('button', { name: /trigger editor change/i }))

    rerender(
      <>
        <MarkdownBlockEditor
          colorScheme="light"
          draftMarkdown=""
          errorMessage={null}
          isDirty
          isSaving={false}
          markdown="# Fixture Workspace"
          onImageUpload={vi.fn()}
          onMarkdownChange={vi.fn()}
          onSaveRequest={onSaveRequest}
          path="README.md"
          workspaceRoot="/workspace"
        />
        <button type="button">Outside editor</button>
      </>
    )

    await user.click(screen.getByRole('button', { name: /outside editor/i }))

    expect(onSaveRequest).toHaveBeenCalledWith('')
  })

  it('reports serialized markdown after editor changes', async () => {
    const user = userEvent.setup()
    const onMarkdownChange = vi.fn()

    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Fixture Workspace"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="# Fixture Workspace"
        onImageUpload={vi.fn()}
        onMarkdownChange={onMarkdownChange}
        onSaveRequest={vi.fn()}
        path="README.md"
        workspaceRoot="/workspace"
      />
    )

    await user.click(screen.getByRole('button', { name: /trigger editor change/i }))

    expect(onMarkdownChange).toHaveBeenCalledWith('')
  })

  it('reports current search matches and publishes highlight ranges', async () => {
    const highlightRegistry = installHighlightMock()
    const onSearchStateChange = vi.fn()

    render(
      <MarkdownBlockEditor
        activeSearchMatchIndex={1}
        colorScheme="light"
        draftMarkdown="Alpha beta\nalpha ALPHA"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="Alpha beta\nalpha ALPHA"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        onSearchStateChange={onSearchStateChange}
        path="README.md"
        searchQuery="alpha"
        workspaceRoot="/workspace"
      />
    )

    act(() => {
      screen.getByTestId('mock-contenteditable').textContent =
        'Alpha beta\nalpha ALPHA'
    })

    await waitFor(() => {
      expect(onSearchStateChange).toHaveBeenLastCalledWith({
        activeMatchIndex: 1,
        matchCount: 3
      })
    })
    expect(highlightRegistry.set).toHaveBeenCalledWith(
      'mde-editor-search-match',
      expect.anything()
    )
    expect(highlightRegistry.set).toHaveBeenCalledWith(
      'mde-editor-search-active',
      expect.anything()
    )
  })

  it('counts search matches from rendered editor text instead of raw markdown syntax', async () => {
    installHighlightMock()
    const onSearchStateChange = vi.fn()

    render(
      <MarkdownBlockEditor
        activeSearchMatchIndex={0}
        colorScheme="light"
        draftMarkdown="[Link title](https://example.com)"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="[Link title](https://example.com)"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        onSearchStateChange={onSearchStateChange}
        path="README.md"
        searchQuery="https"
        workspaceRoot="/workspace"
      />
    )

    act(() => {
      screen.getByTestId('mock-contenteditable').textContent = 'Link title'
    })

    await waitFor(() => {
      expect(onSearchStateChange).toHaveBeenLastCalledWith({
        activeMatchIndex: -1,
        matchCount: 0
      })
    })
  })

  it('keeps imported markdown replacement out of the undo history', async () => {
    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Fixture Workspace"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="# Fixture Workspace"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        workspaceRoot="/workspace"
      />
    )

    await waitFor(() => {
      expect(mockBlockNoteState.lastEditor?.replaceBlocks).toHaveBeenCalled()
    })

    expect(mockBlockNoteState.lastEditor?.transact).toHaveBeenCalled()
    expect(mockBlockNoteState.lastEditor?.transaction.setMeta).toHaveBeenCalledWith(
      'addToHistory',
      false
    )
  })

  it('does not rehydrate the editor after a local autosave updates persisted markdown', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Original"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="# Original"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        workspaceRoot="/workspace"
      />
    )

    await waitFor(() => {
      expect(mockBlockNoteState.lastEditor?.replaceBlocks).toHaveBeenCalledTimes(1)
    })

    await user.click(screen.getByRole('button', { name: /trigger editor change/i }))

    const editedMarkdown = ['# Original', '', '  indented middle line'].join('\n')

    rerender(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown={editedMarkdown}
        errorMessage={null}
        isDirty
        isSaving={false}
        markdown="# Original"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        workspaceRoot="/workspace"
      />
    )

    rerender(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown={editedMarkdown}
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown={editedMarkdown}
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        workspaceRoot="/workspace"
      />
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(mockBlockNoteState.lastEditor?.replaceBlocks).toHaveBeenCalledTimes(1)
  })

  it('rehydrates the editor when persisted markdown changes without local edits', async () => {
    const { rerender } = render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Original"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="# Original"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        workspaceRoot="/workspace"
      />
    )

    await waitFor(() => {
      expect(mockBlockNoteState.lastEditor?.replaceBlocks).toHaveBeenCalledTimes(1)
    })

    rerender(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# External update"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="# External update"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        workspaceRoot="/workspace"
      />
    )

    await waitFor(() => {
      expect(mockBlockNoteState.lastEditor?.replaceBlocks).toHaveBeenCalledTimes(2)
    })
  })

  it('passes pasted image files to the provided image upload handler', async () => {
    const onImageUpload = vi
      .fn()
      .mockResolvedValue('file:///workspace/.mde/assets/image.png')

    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Fixture Workspace"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="# Fixture Workspace"
        onImageUpload={onImageUpload}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        workspaceRoot="/workspace"
      />
    )

    const file = new File([new Uint8Array([137, 80, 78, 71])], 'clipboard.png', {
      type: 'image/png'
    })
    const result = await mockBlockNoteState.lastOptions?.uploadFile?.(file)

    expect(onImageUpload).toHaveBeenCalledWith(file)
    expect(result).toBe('file:///workspace/.mde/assets/image.png')
  })

  it('passes dark color scheme to BlockNote and Mermaid rendering', async () => {
    const markdown = [
      '```mermaid',
      'flowchart TD',
      '  A --> B',
      '```'
    ].join('\n')

    render(
      <MarkdownBlockEditor
        colorScheme="dark"
        draftMarkdown={markdown}
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown={markdown}
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        workspaceRoot="/workspace"
      />
    )

    expect(screen.getByTestId('blocknote-view')).toHaveAttribute(
      'data-theme',
      'dark'
    )
    await waitFor(() => {
      expect(mockMermaid.initialize).toHaveBeenCalledWith(
        expect.objectContaining({ theme: 'dark' })
      )
    })
  })

  it('renders Mermaid flowchart previews and edits the fenced source', async () => {
    const onMarkdownChange = vi.fn()
    const markdown = [
      '## End-to-End Flow',
      '',
      '```mermaid',
      'flowchart TD',
      '  A --> B',
      '```'
    ].join('\n')

    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown={markdown}
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown={markdown}
        onImageUpload={vi.fn()}
        onMarkdownChange={onMarkdownChange}
        onSaveRequest={vi.fn()}
        path="README.md"
        workspaceRoot="/workspace"
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('mermaid-flowchart-preview-0')).toContainHTML(
        '<svg'
      )
    })

    fireEvent.change(screen.getByLabelText(/mermaid source 1/i), {
      target: { value: 'flowchart LR\n  B --> C' }
    })

    expect(onMarkdownChange).toHaveBeenLastCalledWith(
      [
        '## End-to-End Flow',
        '',
        '```mermaid',
        'flowchart LR',
        '  B --> C',
        '```'
      ].join('\n')
    )
  })
})
