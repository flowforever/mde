import { describe, expect, it, vi } from 'vitest'

import { replaceEditorDocumentWithoutUndoHistory } from '../../src/renderer/src/editor/editorHydration'

describe('editor hydration integration', () => {
  it('replaces imported editor content without adding the load to undo history', () => {
    interface TestTransaction {
      readonly setMeta: ReturnType<typeof vi.fn>
    }
    const transaction = {
      setMeta: vi.fn()
    } satisfies TestTransaction
    const editor = {
      document: [
        {
          id: 'initial'
        }
      ],
      replaceBlocks: vi.fn(),
      transact: vi.fn((callback: (transaction: TestTransaction) => void) => {
        callback(transaction)
      })
    }
    const importedBlocks = [
      {
        content: 'Loaded markdown',
        id: 'loaded',
        type: 'paragraph'
      }
    ]

    replaceEditorDocumentWithoutUndoHistory(editor, importedBlocks)

    expect(editor.transact).toHaveBeenCalledTimes(1)
    expect(transaction.setMeta).toHaveBeenCalledWith('addToHistory', false)
    expect(editor.replaceBlocks).toHaveBeenCalledWith(['initial'], importedBlocks)
  })
})
