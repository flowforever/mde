import { cleanup, render, screen } from '@testing-library/react'
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
    'data-testid': testId
  }: {
    readonly className?: string
    readonly 'data-testid'?: string
  }) => (
    <div className={className} data-testid={testId}>
      <div contentEditable suppressContentEditableWarning />
    </div>
  )
}))

describe('MarkdownBlockEditor accessibility', () => {
  afterEach(() => {
    cleanup()
  })

  it('gives the save control an accessible file-specific name', () => {
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
      screen.getByRole('button', { name: /save README\.md/i })
    ).toBeInTheDocument()
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
})
