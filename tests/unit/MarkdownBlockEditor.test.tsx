import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MarkdownBlockEditor } from '../../src/renderer/src/editor/MarkdownBlockEditor'

const mockBlockNoteState = vi.hoisted(() => ({
  lastOptions: undefined as
    | { uploadFile?: (file: File, blockId?: string) => Promise<string> }
    | undefined
}))

vi.mock('@blocknote/react', () => ({
  useCreateBlockNote: (
    options?: { uploadFile?: (file: File, blockId?: string) => Promise<string> }
  ) => {
    mockBlockNoteState.lastOptions = options
    const blocks = [{ content: '', id: 'initial', type: 'paragraph' }]

    return {
      blocksToMarkdownLossy: vi.fn().mockResolvedValue(''),
      document: blocks,
      replaceBlocks: vi.fn(),
      tryParseMarkdownToBlocks: vi.fn().mockResolvedValue(blocks)
    }
  }
}))

vi.mock('@blocknote/mantine', () => ({
  BlockNoteView: ({
    className,
    'data-testid': testId,
    editor,
    onChange
  }: {
    readonly className?: string
    readonly 'data-testid'?: string
    readonly editor: unknown
    readonly onChange: (editor: unknown) => void
  }) => (
    <div className={className} data-testid={testId} tabIndex={0}>
      <div contentEditable suppressContentEditableWarning tabIndex={0} />
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
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({
      svg: '<svg role="img"><text>Rendered flowchart</text></svg>'
    })
  }
}))

describe('MarkdownBlockEditor accessibility', () => {
  afterEach(() => {
    cleanup()
    mockBlockNoteState.lastOptions = undefined
  })

  it('does not render a manual save control', () => {
    render(
      <MarkdownBlockEditor
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

  it('shows visible dirty state text for unsaved changes', () => {
    render(
      <MarkdownBlockEditor
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

  it('passes pasted image files to the provided image upload handler', async () => {
    const onImageUpload = vi
      .fn()
      .mockResolvedValue('file:///workspace/.mde/assets/image.png')

    render(
      <MarkdownBlockEditor
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
