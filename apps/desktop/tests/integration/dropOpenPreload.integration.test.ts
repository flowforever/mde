import { describe, expect, it, vi } from 'vitest'

import { createEditorApi } from '../../src/preload/editorApi'

describe('drop open preload integration', () => {
  it('exposes Electron webUtils file path resolution for dropped files', () => {
    const droppedFile = new File(['# External'], 'external.md', {
      type: 'text/markdown'
    })
    const webUtils = {
      getPathForFile: vi.fn().mockReturnValue('/external/external.md')
    }
    const ipcRenderer = {
      invoke: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn()
    }

    const editorApi = createEditorApi(ipcRenderer, webUtils)

    expect(editorApi.getDroppedFilePath?.(droppedFile)).toBe(
      '/external/external.md'
    )
    expect(webUtils.getPathForFile).toHaveBeenCalledWith(droppedFile)
  })
})
