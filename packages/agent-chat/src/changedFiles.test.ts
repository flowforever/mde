import { describe, expect, it } from 'vitest'

import { summarizeChangedFiles } from './changedFiles'

describe('summarizeChangedFiles', () => {
  it('reports modified and added files from before and after snapshots', () => {
    const summary = summarizeChangedFiles({
      after: [
        { hash: '2', path: 'a.md' },
        { hash: 'new', path: 'b.md' }
      ],
      before: [{ hash: '1', path: 'a.md' }]
    })

    expect(summary.files).toEqual([
      { changeType: 'modified', path: 'a.md' },
      { changeType: 'added', path: 'b.md' }
    ])
  })

  it('uses snapshot change-type hints for git working tree summaries', () => {
    const summary = summarizeChangedFiles({
      after: [
        { changeType: 'modified', hash: '2', path: 'clean-before.md' },
        { changeType: 'deleted', hash: 'deleted', path: 'removed.md' }
      ],
      before: []
    })

    expect(summary.files).toEqual([
      { changeType: 'modified', path: 'clean-before.md' },
      { changeType: 'deleted', path: 'removed.md' }
    ])
  })

  it('labels dirty-before paths that become clean after the turn', () => {
    const summary = summarizeChangedFiles({
      after: [],
      before: [
        { changeType: 'added', hash: 'untracked', path: 'removed-untracked.md' },
        { changeType: 'deleted', hash: 'deleted', path: 'restored-delete.md' },
        { changeType: 'modified', hash: 'dirty', path: 'reverted-edit.md' },
        { hash: 'tracked', path: 'deleted-tracked.md' }
      ]
    })

    expect(summary.files).toEqual([
      { changeType: 'deleted', path: 'deleted-tracked.md' },
      { changeType: 'deleted', path: 'removed-untracked.md' },
      { changeType: 'modified', path: 'restored-delete.md' },
      { changeType: 'modified', path: 'reverted-edit.md' }
    ])
  })

  it('marks summary unavailable when snapshot capture fails', () => {
    const summary = summarizeChangedFiles({
      afterError: new Error('git failed'),
      before: [{ hash: '1', path: 'a.md' }]
    })

    expect(summary.available).toBe(false)
    expect(summary.diagnostic?.code).toBe('changed-files-unavailable')
  })
})
