import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MarkdownBlockEditor } from '../../src/renderer/src/editor/MarkdownBlockEditor'

vi.mock('@blocknote/react', () => ({
  useCreateBlockNote: () => {
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

describe('MarkdownBlockEditor accessibility', () => {
  afterEach(() => {
    cleanup()
  })

  it('does not render a manual save control', () => {
    render(
      <MarkdownBlockEditor
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="# Fixture Workspace"
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
      />
    )

    expect(
      screen.queryByRole('button', { name: /save README\.md/i })
    ).not.toBeInTheDocument()
  })

  it('shows visible dirty state text for unsaved changes', () => {
    render(
      <MarkdownBlockEditor
        errorMessage={null}
        isDirty
        isSaving={false}
        markdown="# Fixture Workspace"
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
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
          errorMessage={null}
          isDirty
          isSaving={false}
          markdown="# Fixture Workspace"
          onMarkdownChange={vi.fn()}
          onSaveRequest={onSaveRequest}
          path="README.md"
        />
        <button type="button">Outside editor</button>
      </>
    )

    await user.click(screen.getByTestId('blocknote-view'))
    await user.click(screen.getByRole('button', { name: /outside editor/i }))

    expect(onSaveRequest).toHaveBeenCalledWith('')
  })

  it('reports serialized markdown after editor changes', async () => {
    const user = userEvent.setup()
    const onMarkdownChange = vi.fn()

    render(
      <MarkdownBlockEditor
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="# Fixture Workspace"
        onMarkdownChange={onMarkdownChange}
        onSaveRequest={vi.fn()}
        path="README.md"
      />
    )

    await user.click(screen.getByRole('button', { name: /trigger editor change/i }))

    expect(onMarkdownChange).toHaveBeenCalledWith('')
  })
})
