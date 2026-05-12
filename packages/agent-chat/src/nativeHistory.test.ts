import { describe, expect, it } from 'vitest'

import { filterNativeSessionsForWorkspace } from './nativeHistory'

describe('filterNativeSessionsForWorkspace', () => {
  it('includes native sessions with matching cwd', () => {
    expect(
      filterNativeSessionsForWorkspace({
        sessions: [{ cwd: '/workspace', nativeSessionId: 'thread-1', title: 'Plan' }],
        workspaceRoot: '/workspace'
      })
    ).toHaveLength(1)
  })

  it('excludes sessions without reliable workspace evidence', () => {
    expect(
      filterNativeSessionsForWorkspace({
        sessions: [{ nativeSessionId: 'thread-2', title: 'Unknown' }],
        workspaceRoot: '/workspace'
      })
    ).toEqual([])
  })
})
