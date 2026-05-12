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

  it('marks summary unavailable when snapshot capture fails', () => {
    const summary = summarizeChangedFiles({
      afterError: new Error('git failed'),
      before: [{ hash: '1', path: 'a.md' }]
    })

    expect(summary.available).toBe(false)
    expect(summary.diagnostic?.code).toBe('changed-files-unavailable')
  })
})
