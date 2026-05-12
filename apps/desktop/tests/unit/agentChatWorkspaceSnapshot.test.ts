import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { createWorkspaceSnapshotProvider } from '../../src/main/services/agentChatWorkspaceSnapshot'
import type { AgentChatProcessRunner } from '@mde/agent-chat'

const createRunner = (responses: {
  readonly diff?: string
  readonly untracked?: string
}): AgentChatProcessRunner => ({
  execFile: vi.fn<AgentChatProcessRunner['execFile']>((command, args) => {
    if (command === 'git') {
      if (args.includes('diff')) {
        return Promise.resolve({ stderr: '', stdout: responses.diff ?? '' })
      }

      if (args.includes('ls-files')) {
        return Promise.resolve({ stderr: '', stdout: responses.untracked ?? '' })
      }
    }

    return Promise.resolve({ stderr: '', stdout: '' })
  }),
  spawn: vi.fn(() => {
    throw new Error('spawn is not used in snapshot tests')
  })
})

describe('agent chat workspace snapshots', () => {
  it('captures only git changed paths instead of scanning the whole workspace', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'mde-agent-chat-snapshot-'))
    await mkdir(join(workspaceRoot, 'docs'), { recursive: true })
    await mkdir(join(workspaceRoot, 'notes'), { recursive: true })
    await writeFile(join(workspaceRoot, 'docs/a.md'), '# A changed')
    await writeFile(join(workspaceRoot, 'notes/new.md'), '# New')
    const runner = createRunner({
      diff: 'M\0docs/a.md\0D\0docs/deleted.md\0',
      untracked: 'notes/new.md\0'
    })
    const provider = createWorkspaceSnapshotProvider(runner)

    const snapshots = await provider.captureSnapshot(workspaceRoot)

    expect(snapshots.map((snapshot) => snapshot.path)).toEqual([
      'docs/a.md',
      'docs/deleted.md',
      'notes/new.md'
    ])
    expect(snapshots.map((snapshot) => snapshot.changeType)).toEqual([
      'modified',
      'deleted',
      'added'
    ])
    expect(runner.execFile).toHaveBeenCalledTimes(2)
    expect(runner.execFile).toHaveBeenCalledWith(
      'git',
      [
        '-C',
        workspaceRoot,
        'diff',
        '--relative',
        '--name-status',
        '--no-renames',
        '-z',
        'HEAD',
        '--',
        '.'
      ],
      { timeoutMs: 10_000 }
    )
    expect(runner.execFile).toHaveBeenCalledWith(
      'git',
      [
        '-C',
        workspaceRoot,
        'ls-files',
        '--others',
        '--exclude-standard',
        '-z',
        '--',
        '.'
      ],
      { timeoutMs: 10_000 }
    )
  })

  it('caps changed-path snapshots before statting oversized dirty workspaces', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'mde-agent-chat-snapshot-'))
    const paths = Array.from(
      { length: 5001 },
      (_item, index) => `M\0docs/file-${index}.md`
    ).join('\0')
    const runner = createRunner({ diff: `${paths}\0` })
    const provider = createWorkspaceSnapshotProvider(runner)

    await expect(provider.captureSnapshot(workspaceRoot)).rejects.toThrow(
      'Agent Chat changed-file snapshot exceeded 5000 files'
    )
    expect(runner.execFile).toHaveBeenCalledTimes(2)
  })

  it('limits fallback traversal and ignores heavy workspace cache directories', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'mde-agent-chat-scan-'))
    await mkdir(join(workspaceRoot, 'docs'), { recursive: true })
    await mkdir(join(workspaceRoot, 'node_modules/pkg'), { recursive: true })
    await writeFile(join(workspaceRoot, 'docs/a.md'), '# A')
    await writeFile(join(workspaceRoot, 'node_modules/pkg/b.md'), '# B')
    const runner = {
      ...createRunner({}),
      execFile: vi.fn(() => Promise.reject(new Error('git unavailable')))
    } satisfies AgentChatProcessRunner
    const provider = createWorkspaceSnapshotProvider(runner)

    const snapshots = await provider.captureSnapshot(workspaceRoot)

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]?.path).toBe('docs/a.md')
    expect(typeof snapshots[0]?.hash).toBe('string')
  })
})
