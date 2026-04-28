import { describe, expect, it } from 'vitest'

import { appReducer, createInitialAppState } from '../../src/renderer/src/app/appReducer'
import type { Workspace } from '../../src/shared/workspace'

describe('appReducer', () => {
  const workspace: Workspace = {
    name: 'workspace',
    rootPath: '/tmp/workspace',
    tree: Object.freeze([
      {
        name: 'README.md',
        path: 'README.md',
        type: 'file'
      }
    ])
  }

  it('stores an opened workspace', () => {
    const state = appReducer(createInitialAppState(), {
      type: 'workspace/opened',
      workspace
    })

    expect(state.workspace).toEqual(workspace)
    expect(state.selectedFilePath).toBeNull()
  })

  it('stores the selected file path', () => {
    const state = appReducer(
      { ...createInitialAppState(), workspace },
      {
        type: 'file/selected',
        filePath: 'README.md'
      }
    )

    expect(state.selectedFilePath).toBe('README.md')
    expect(state.workspace).toEqual(workspace)
  })

  it('tracks file loading for the selected file', () => {
    const state = appReducer(
      { ...createInitialAppState(), workspace },
      {
        type: 'file/load-started',
        filePath: 'README.md'
      }
    )

    expect(state.selectedFilePath).toBe('README.md')
    expect(state.isLoadingFile).toBe(true)
    expect(state.loadedFile).toBeNull()
    expect(state.fileErrorMessage).toBeNull()
  })

  it('stores loaded file contents', () => {
    const loadingState = appReducer(
      { ...createInitialAppState(), workspace },
      {
        type: 'file/load-started',
        filePath: 'README.md'
      }
    )

    const state = appReducer(loadingState, {
      file: {
        contents: '# Fixture Workspace',
        path: 'README.md'
      },
      type: 'file/loaded'
    })

    expect(state.isLoadingFile).toBe(false)
    expect(state.loadedFile).toEqual({
      contents: '# Fixture Workspace',
      path: 'README.md'
    })
    expect(state.fileErrorMessage).toBeNull()
  })

  it('stores file load failures', () => {
    const loadingState = appReducer(
      { ...createInitialAppState(), workspace },
      {
        type: 'file/load-started',
        filePath: 'README.md'
      }
    )

    const state = appReducer(loadingState, {
      message: 'Unable to read README.md',
      type: 'file/load-failed'
    })

    expect(state.isLoadingFile).toBe(false)
    expect(state.loadedFile).toBeNull()
    expect(state.fileErrorMessage).toBe('Unable to read README.md')
  })
})
