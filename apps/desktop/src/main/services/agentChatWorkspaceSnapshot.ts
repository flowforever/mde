import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

import type {
  AgentChatProcessRunner,
  AgentChatWorkspaceFileSnapshot,
  AgentChatWorkspaceSnapshotProvider
} from '@mde/agent-chat'

const SNAPSHOT_MAX_FILE_COUNT = 5000
const SNAPSHOT_STAT_CONCURRENCY = 16
const DELETED_FILE_HASH = 'mde-deleted-file'
const IGNORED_WORKSPACE_ENTRY_NAMES = new Set([
  '.git',
  '.mde',
  'coverage',
  'node_modules',
  'out'
])

interface ChangedPathRecord {
  readonly changeType?: AgentChatWorkspaceFileSnapshot['changeType']
  readonly path: string
}

const normalizeRelativePaths = (
  relativePaths: readonly string[]
): readonly string[] => {
  const paths = [
    ...new Set(relativePaths.map((line) => line.trim()).filter(Boolean))
  ].sort()

  if (paths.length > SNAPSHOT_MAX_FILE_COUNT) {
    throw new Error(
      `Agent Chat changed-file snapshot exceeded ${SNAPSHOT_MAX_FILE_COUNT} files`
    )
  }

  return Object.freeze(paths)
}

const normalizeChangedPathRecords = (
  records: readonly ChangedPathRecord[]
): readonly ChangedPathRecord[] => {
  const recordsByPath = new Map<string, ChangedPathRecord>()
  for (const record of records) {
    const path = record.path.trim()
    if (!path) {
      continue
    }
    recordsByPath.set(path, { ...record, path })
  }

  const normalizedRecords = [...recordsByPath.values()].sort((left, right) =>
    left.path.localeCompare(right.path)
  )

  if (normalizedRecords.length > SNAPSHOT_MAX_FILE_COUNT) {
    throw new Error(
      `Agent Chat changed-file snapshot exceeded ${SNAPSHOT_MAX_FILE_COUNT} files`
    )
  }

  return Object.freeze(normalizedRecords)
}

const parseGitDiffNameStatus = (stdout: string): readonly ChangedPathRecord[] => {
  const tokens = stdout.split('\0').filter(Boolean)
  const records: ChangedPathRecord[] = []

  for (let index = 0; index < tokens.length; index += 2) {
    const status = tokens[index]?.charAt(0)
    const path = tokens[index + 1]
    if (!status || !path) {
      continue
    }

    const changeType =
      status === 'A' || status === 'C'
        ? 'added'
        : status === 'D'
          ? 'deleted'
          : 'modified'
    records.push({ changeType, path })
  }

  return records
}

const parseGitUntrackedPaths = (stdout: string): readonly ChangedPathRecord[] =>
  stdout
    .split('\0')
    .filter(Boolean)
    .map((path) => ({ changeType: 'added' as const, path }))

const captureGitChangedPathRecords = async (
  processRunner: AgentChatProcessRunner,
  workspaceRoot: string
): Promise<readonly ChangedPathRecord[]> => {
  const [trackedResult, untrackedResult] = await Promise.all([
    processRunner.execFile(
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
    ),
    processRunner.execFile(
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
  ])

  return normalizeChangedPathRecords([
    ...parseGitDiffNameStatus(trackedResult.stdout),
    ...parseGitUntrackedPaths(untrackedResult.stdout)
  ])
}

const createWorkspaceFileSignature = async (
  workspaceRoot: string,
  record: ChangedPathRecord
): Promise<AgentChatWorkspaceFileSnapshot | undefined> => {
  if (record.changeType === 'deleted') {
    return {
      changeType: 'deleted',
      hash: DELETED_FILE_HASH,
      path: record.path
    }
  }

  try {
    const fileStat = await stat(join(workspaceRoot, record.path))
    if (!fileStat.isFile()) {
      return undefined
    }

    return {
      ...(record.changeType ? { changeType: record.changeType } : {}),
      hash: [
        fileStat.size,
        fileStat.mtimeMs,
        fileStat.ctimeMs
      ].join(':'),
      path: record.path
    }
  } catch {
    return {
      changeType: 'deleted',
      hash: DELETED_FILE_HASH,
      path: record.path
    }
  }
}

const scanWorkspaceFiles = async (
  workspaceRoot: string
): Promise<readonly ChangedPathRecord[]> => {
  const directories = [workspaceRoot]
  const paths: string[] = []

  for (const currentDirectory of directories) {
    const entries = await readdir(currentDirectory, { withFileTypes: true })

    for (const entry of entries) {
      if (IGNORED_WORKSPACE_ENTRY_NAMES.has(entry.name)) {
        continue
      }

      const absolutePath = join(currentDirectory, entry.name)
      const relativePath = absolutePath.slice(workspaceRoot.length + 1)

      if (entry.isDirectory()) {
        directories.push(absolutePath)
      } else if (entry.isFile()) {
        paths.push(relativePath)
        if (paths.length > SNAPSHOT_MAX_FILE_COUNT) {
          throw new Error(
            `Agent Chat changed-file snapshot exceeded ${SNAPSHOT_MAX_FILE_COUNT} files`
          )
        }
      }
    }
  }

  return normalizeRelativePaths(paths).map((path) => ({ path }))
}

const createWorkspaceFileSignatures = async (
  workspaceRoot: string,
  records: readonly ChangedPathRecord[]
): Promise<readonly (AgentChatWorkspaceFileSnapshot | undefined)[]> => {
  const snapshots: (AgentChatWorkspaceFileSnapshot | undefined)[] = []

  for (let index = 0; index < records.length; index += SNAPSHOT_STAT_CONCURRENCY) {
    const batch = records.slice(index, index + SNAPSHOT_STAT_CONCURRENCY)
    snapshots.push(
      ...(await Promise.all(
        batch.map((record) => createWorkspaceFileSignature(workspaceRoot, record))
      ))
    )
  }

  return Object.freeze(snapshots)
}

export const createWorkspaceSnapshotProvider = (
  processRunner: AgentChatProcessRunner
): AgentChatWorkspaceSnapshotProvider => ({
  captureSnapshot: async (workspaceRoot) => {
    let records: readonly ChangedPathRecord[]
    try {
      records = await captureGitChangedPathRecords(processRunner, workspaceRoot)
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith('Agent Chat changed-file snapshot exceeded')
      ) {
        throw error
      }
      records = await scanWorkspaceFiles(workspaceRoot)
    }

    const snapshots = await createWorkspaceFileSignatures(workspaceRoot, records)

    return snapshots.filter(
      (snapshot): snapshot is AgentChatWorkspaceFileSnapshot =>
        snapshot !== undefined
    )
  }
})
