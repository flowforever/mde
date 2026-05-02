import { createHash, randomUUID } from 'node:crypto'
import {
  appendFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  writeFile
} from 'node:fs/promises'
import { basename, dirname, extname, join, relative, sep } from 'node:path'

import type {
  DeletedDocumentHistoryEntry,
  DocumentHistoryEvent,
  DocumentHistoryPreview,
  DocumentHistoryVersion
} from '../../shared/documentHistory'
import { isDocumentHistoryEvent } from '../../shared/documentHistory'
import { assertPathInsideWorkspace, resolveWorkspacePath } from './pathSafety'

interface DocumentHistoryServiceOptions {
  readonly autosaveThrottleMs?: number
  readonly now?: () => Date
}

export interface CaptureDocumentSnapshotInput {
  readonly event: DocumentHistoryEvent
  readonly filePath: string
  readonly nextPath?: string
  readonly sourceVersionId?: string
  readonly workspacePath: string
}

export interface DocumentHistoryService {
  readonly captureSnapshot: (
    input: CaptureDocumentSnapshotInput
  ) => Promise<DocumentHistoryVersion | null>
  readonly listDeletedDocumentHistory: (
    workspacePath: string
  ) => Promise<readonly DeletedDocumentHistoryEntry[]>
  readonly listDocumentHistory: (
    workspacePath: string,
    filePath: string
  ) => Promise<readonly DocumentHistoryVersion[]>
  readonly markExternalDeletes: (
    workspacePath: string
  ) => Promise<readonly DeletedDocumentHistoryEntry[]>
  readonly readVersion: (
    workspacePath: string,
    versionId: string
  ) => Promise<DocumentHistoryPreview>
  readonly restoreVersion: (
    workspacePath: string,
    versionId: string
  ) => Promise<{ readonly contents: string; readonly path: string }>
}

interface HistoryPaths {
  readonly blobsPath: string
  readonly documentsPath: string
  readonly historyPath: string
  readonly indexPath: string
  readonly workspacePath: string
}

interface DocumentRecord {
  readonly createdAt: string
  readonly currentPath: string
  readonly deletedAt?: string
  readonly documentId: string
  readonly previousPaths: readonly string[]
  readonly schemaVersion: 1
  readonly updatedAt: string
}

interface StoredHistoryVersion extends DocumentHistoryVersion {
  readonly schemaVersion: 1
}

const HISTORY_DIRECTORY_PATH = join('.mde', 'history')
const HISTORY_AUTOSAVE_THROTTLE_MS = 5 * 60 * 1000
const SAVE_EVENT_TYPES = new Set<DocumentHistoryEvent>([
  'manual-save',
  'autosave',
  'ai-write'
])

const isErrorWithCode = (
  error: unknown,
  code: string
): error is NodeJS.ErrnoException =>
  error instanceof Error && (error as NodeJS.ErrnoException).code === code

const hashMarkdown = (contents: string): string =>
  createHash('sha256').update(contents).digest('hex')

const createVersionId = (createdAt: string): string =>
  `${createdAt.replace(/[:.]/g, '-')}_${randomUUID().slice(0, 8)}`

const createDocumentId = (): string =>
  `doc_${randomUUID().replaceAll('-', '').slice(0, 16)}`

const normalizeWorkspacePath = (filePath: string): string => {
  const normalizedPath = filePath.replaceAll('\\', '/').replace(/^\/+/u, '')

  if (normalizedPath.trim().length === 0 || normalizedPath === '.') {
    throw new Error('Workspace path is required')
  }

  return normalizedPath
}

const assertMarkdownPath = (filePath: string): void => {
  if (extname(filePath).toLowerCase() !== '.md') {
    throw new Error('Only Markdown files can use document history')
  }
}

const toWorkspaceRelativePath = (
  workspacePath: string,
  filePath: string
): string => {
  const normalizedPath = normalizeWorkspacePath(filePath)
  const absolutePath = resolveWorkspacePath(workspacePath, normalizedPath)
  const relativePath = relative(workspacePath, absolutePath)
    .split(sep)
    .join('/')

  if (relativePath.length === 0 || relativePath.startsWith('../')) {
    throw new Error('Path is outside workspace')
  }

  assertMarkdownPath(relativePath)

  return relativePath
}

const assertDirectoryIsNotSymlink = async (
  directoryPath: string,
  label: string
): Promise<void> => {
  try {
    const directoryStats = await lstat(directoryPath)

    if (directoryStats.isSymbolicLink()) {
      throw new Error(`${label} cannot be a symlink`)
    }

    if (!directoryStats.isDirectory()) {
      throw new Error(`${label} must be a directory`)
    }
  } catch (error) {
    if (isErrorWithCode(error, 'ENOENT')) {
      await mkdir(directoryPath, { recursive: true })
      return
    }

    throw error
  }
}

const getHistoryPaths = async (workspacePath: string): Promise<HistoryPaths> => {
  const realWorkspacePath = await realpath(workspacePath)
  const mdePath = join(realWorkspacePath, '.mde')
  const historyPath = join(realWorkspacePath, HISTORY_DIRECTORY_PATH)
  const documentsPath = join(historyPath, 'documents')
  const blobsPath = join(historyPath, 'blobs')

  assertPathInsideWorkspace(realWorkspacePath, historyPath)
  await assertDirectoryIsNotSymlink(mdePath, '.mde')
  await assertDirectoryIsNotSymlink(historyPath, '.mde/history')
  await assertDirectoryIsNotSymlink(documentsPath, '.mde/history/documents')
  await assertDirectoryIsNotSymlink(blobsPath, '.mde/history/blobs')

  return Object.freeze({
    blobsPath,
    documentsPath,
    historyPath,
    indexPath: join(historyPath, 'index.jsonl'),
    workspacePath: realWorkspacePath
  })
}

const readJsonFile = async <Value>(
  filePath: string,
  validate: (value: unknown) => value is Value
): Promise<Value | null> => {
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf8')) as unknown

    return validate(parsed) ? parsed : null
  } catch (error) {
    if (isErrorWithCode(error, 'ENOENT') || error instanceof SyntaxError) {
      return null
    }

    throw error
  }
}

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

const isDocumentRecord = (value: unknown): value is DocumentRecord => {
  const record = value as DocumentRecord

  return (
    typeof value === 'object' &&
    value !== null &&
    record.schemaVersion === 1 &&
    typeof record.documentId === 'string' &&
    typeof record.currentPath === 'string' &&
    isStringArray(record.previousPaths) &&
    typeof record.createdAt === 'string' &&
    typeof record.updatedAt === 'string' &&
    (record.deletedAt === undefined || typeof record.deletedAt === 'string')
  )
}

const isStoredHistoryVersion = (
  value: unknown
): value is StoredHistoryVersion => {
  const version = value as StoredHistoryVersion

  return (
    typeof value === 'object' &&
    value !== null &&
    version.schemaVersion === 1 &&
    typeof version.id === 'string' &&
    typeof version.documentId === 'string' &&
    typeof version.path === 'string' &&
    typeof version.createdAt === 'string' &&
    typeof version.blobHash === 'string' &&
    typeof version.byteLength === 'number' &&
    isDocumentHistoryEvent(version.event) &&
    (version.previousPath === undefined ||
      typeof version.previousPath === 'string') &&
    (version.sourceVersionId === undefined ||
      typeof version.sourceVersionId === 'string')
  )
}

const readDocumentRecords = async (
  paths: HistoryPaths
): Promise<readonly DocumentRecord[]> => {
  const entries = await readdir(paths.documentsPath, { withFileTypes: true })
  const records = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) =>
        readJsonFile(join(paths.documentsPath, entry.name), isDocumentRecord)
      )
  )

  return Object.freeze(records.filter((record): record is DocumentRecord => !!record))
}

const writeDocumentRecord = async (
  paths: HistoryPaths,
  record: DocumentRecord
): Promise<void> => {
  await writeFile(
    join(paths.documentsPath, `${record.documentId}.json`),
    `${JSON.stringify(record, null, 2)}\n`,
    'utf8'
  )
}

const createDocumentRecord = async (
  paths: HistoryPaths,
  filePath: string,
  createdAt: string
): Promise<DocumentRecord> => {
  const record = Object.freeze({
    createdAt,
    currentPath: filePath,
    documentId: createDocumentId(),
    previousPaths: [],
    schemaVersion: 1,
    updatedAt: createdAt
  } satisfies DocumentRecord)

  await writeDocumentRecord(paths, record)

  return record
}

const findDocumentRecord = (
  records: readonly DocumentRecord[],
  filePath: string
): DocumentRecord | null =>
  records.find(
    (record) =>
      record.currentPath === filePath || record.previousPaths.includes(filePath)
  ) ?? null

const getOrCreateDocumentRecord = async (
  paths: HistoryPaths,
  filePath: string,
  createdAt: string
): Promise<DocumentRecord> =>
  findDocumentRecord(await readDocumentRecords(paths), filePath) ??
  createDocumentRecord(paths, filePath, createdAt)

const readHistoryVersions = async (
  paths: HistoryPaths
): Promise<readonly StoredHistoryVersion[]> => {
  let indexContents = ''

  try {
    indexContents = await readFile(paths.indexPath, 'utf8')
  } catch (error) {
    if (isErrorWithCode(error, 'ENOENT')) {
      return []
    }

    throw error
  }

  const versions = indexContents
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line): StoredHistoryVersion | null => {
      try {
        const parsed = JSON.parse(line) as unknown

        return isStoredHistoryVersion(parsed) ? parsed : null
      } catch {
        return null
      }
    })
    .filter((version): version is StoredHistoryVersion => !!version)

  return Object.freeze(versions)
}

const appendHistoryVersion = async (
  paths: HistoryPaths,
  version: StoredHistoryVersion
): Promise<void> => {
  await appendFile(paths.indexPath, `${JSON.stringify(version)}\n`, 'utf8')
}

const toPublicVersion = (
  version: StoredHistoryVersion
): DocumentHistoryVersion =>
  Object.freeze({
    blobHash: version.blobHash,
    byteLength: version.byteLength,
    createdAt: version.createdAt,
    documentId: version.documentId,
    event: version.event,
    id: version.id,
    path: version.path,
    previousPath: version.previousPath,
    sourceVersionId: version.sourceVersionId
  })

const compareNewestFirst = (
  left: DocumentHistoryVersion,
  right: DocumentHistoryVersion
): number => right.createdAt.localeCompare(left.createdAt)

const writeBlobIfMissing = async (
  paths: HistoryPaths,
  blobHash: string,
  contents: string
): Promise<void> => {
  try {
    await writeFile(join(paths.blobsPath, `${blobHash}.md`), contents, {
      encoding: 'utf8',
      flag: 'wx'
    })
  } catch (error) {
    if (!isErrorWithCode(error, 'EEXIST')) {
      throw error
    }
  }
}

const getLatestVersion = (
  versions: readonly StoredHistoryVersion[],
  documentId: string
): StoredHistoryVersion | null =>
  versions
    .filter((version) => version.documentId === documentId)
    .sort(compareNewestFirst)[0] ?? null

const shouldSkipSaveSnapshot = (
  event: DocumentHistoryEvent,
  latestVersion: StoredHistoryVersion | null,
  blobHash: string
): boolean =>
  SAVE_EVENT_TYPES.has(event) && latestVersion?.blobHash === blobHash

const shouldThrottleAutosave = (
  event: DocumentHistoryEvent,
  versions: readonly StoredHistoryVersion[],
  documentId: string,
  now: Date,
  throttleMs: number
): boolean => {
  if (event !== 'autosave') {
    return false
  }

  const latestAutosave = versions
    .filter(
      (version) =>
        version.documentId === documentId && version.event === 'autosave'
    )
    .sort(compareNewestFirst)[0]

  if (!latestAutosave) {
    return false
  }

  return now.getTime() - new Date(latestAutosave.createdAt).getTime() < throttleMs
}

const updateDocumentRecordForEvent = async (
  paths: HistoryPaths,
  record: DocumentRecord,
  input: CaptureDocumentSnapshotInput,
  createdAt: string
): Promise<void> => {
  if (input.event === 'rename' && input.nextPath) {
    const nextPath = toWorkspaceRelativePath(paths.workspacePath, input.nextPath)
    const previousPaths = new Set([...record.previousPaths, record.currentPath])

    await writeDocumentRecord(paths, {
      ...record,
      currentPath: nextPath,
      deletedAt: undefined,
      previousPaths: Array.from(previousPaths),
      updatedAt: createdAt
    })
    return
  }

  if (input.event === 'delete') {
    await writeDocumentRecord(paths, {
      ...record,
      deletedAt: createdAt,
      updatedAt: createdAt
    })
  }
}

const createVersion = ({
  blobHash,
  byteLength,
  createdAt,
  input,
  record,
  paths
}: {
  readonly blobHash: string
  readonly byteLength: number
  readonly createdAt: string
  readonly input: CaptureDocumentSnapshotInput
  readonly paths: HistoryPaths
  readonly record: DocumentRecord
}): StoredHistoryVersion =>
  Object.freeze({
    blobHash,
    byteLength,
    createdAt,
    documentId: record.documentId,
    event: input.event,
    id: createVersionId(createdAt),
    path: toWorkspaceRelativePath(paths.workspacePath, input.filePath),
    previousPath:
      input.event === 'rename' && input.nextPath ? record.currentPath : undefined,
    schemaVersion: 1,
    sourceVersionId: input.sourceVersionId
  } satisfies StoredHistoryVersion)

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await lstat(filePath)
    return true
  } catch (error) {
    if (isErrorWithCode(error, 'ENOENT')) {
      return false
    }

    throw error
  }
}

const createAdjacentRestoredPath = async (
  workspacePath: string,
  filePath: string
): Promise<string> => {
  const directoryPath = dirname(filePath)
  const fileName = basename(filePath, '.md')
  let candidatePath =
    directoryPath === '.'
      ? `${fileName}.restored.md`
      : `${directoryPath}/${fileName}.restored.md`
  let candidateIndex = 2

  while (await fileExists(resolveWorkspacePath(workspacePath, candidatePath))) {
    candidatePath =
      directoryPath === '.'
        ? `${fileName}.restored-${candidateIndex}.md`
        : `${directoryPath}/${fileName}.restored-${candidateIndex}.md`
    candidateIndex += 1
  }

  return candidatePath
}

const findVersionById = async (
  paths: HistoryPaths,
  versionId: string
): Promise<StoredHistoryVersion> => {
  const version = (await readHistoryVersions(paths)).find(
    (candidateVersion) => candidateVersion.id === versionId
  )

  if (!version) {
    throw new Error('Document history version was not found')
  }

  return version
}

const listDeletedDocumentsFromPaths = async (
  paths: HistoryPaths
): Promise<readonly DeletedDocumentHistoryEntry[]> => {
  const records = await readDocumentRecords(paths)
  const versions = await readHistoryVersions(paths)
  const deletedDocuments = await Promise.all(
    records.map(async (record): Promise<DeletedDocumentHistoryEntry | null> => {
      const documentVersions = versions
        .filter((version) => version.documentId === record.documentId)
        .sort(compareNewestFirst)
      const latestVersion = documentVersions[0]

      if (!latestVersion) {
        return null
      }

      if (latestVersion.event === 'delete') {
        return Object.freeze({
          deletedAt: latestVersion.createdAt,
          documentId: record.documentId,
          latestVersionId: latestVersion.id,
          path: record.currentPath,
          reason: 'deleted-in-mde',
          versionCount: documentVersions.length
        })
      }

      if (latestVersion.event === 'external-delete') {
        return Object.freeze({
          deletedAt: latestVersion.createdAt,
          documentId: record.documentId,
          latestVersionId: latestVersion.id,
          path: record.currentPath,
          reason: 'deleted-outside-mde',
          versionCount: documentVersions.length
        })
      }

      if (!(await fileExists(resolveWorkspacePath(paths.workspacePath, record.currentPath)))) {
        return Object.freeze({
          deletedAt: record.deletedAt ?? latestVersion.createdAt,
          documentId: record.documentId,
          latestVersionId: latestVersion.id,
          path: record.currentPath,
          reason: 'deleted-outside-mde',
          versionCount: documentVersions.length
        })
      }

      return null
    })
  )

  return Object.freeze(
    deletedDocuments
      .filter((entry): entry is DeletedDocumentHistoryEntry => !!entry)
      .sort((left, right) => right.deletedAt.localeCompare(left.deletedAt))
  )
}

export const createDocumentHistoryService = ({
  autosaveThrottleMs = HISTORY_AUTOSAVE_THROTTLE_MS,
  now = () => new Date()
}: DocumentHistoryServiceOptions = {}): DocumentHistoryService => {
  const service: DocumentHistoryService = {
  async captureSnapshot(input) {
    const paths = await getHistoryPaths(input.workspacePath)
    const filePath = toWorkspaceRelativePath(paths.workspacePath, input.filePath)
    const createdAtDate = now()
    const createdAt = createdAtDate.toISOString()
    const contents = await readFile(
      resolveWorkspacePath(paths.workspacePath, filePath),
      'utf8'
    )
    const blobHash = hashMarkdown(contents)
    const record = await getOrCreateDocumentRecord(paths, filePath, createdAt)
    const versions = await readHistoryVersions(paths)
    const latestVersion = getLatestVersion(versions, record.documentId)

    if (
      shouldThrottleAutosave(
        input.event,
        versions,
        record.documentId,
        createdAtDate,
        autosaveThrottleMs
      ) ||
      shouldSkipSaveSnapshot(input.event, latestVersion, blobHash)
    ) {
      return null
    }

    const version = createVersion({
      blobHash,
      byteLength: Buffer.byteLength(contents),
      createdAt,
      input,
      paths,
      record
    })

    await writeBlobIfMissing(paths, blobHash, contents)
    await appendHistoryVersion(paths, version)
    await updateDocumentRecordForEvent(paths, record, input, createdAt)

    return toPublicVersion(version)
  },
  async listDeletedDocumentHistory(workspacePath) {
    const paths = await getHistoryPaths(workspacePath)

    return listDeletedDocumentsFromPaths(paths)
  },
  async listDocumentHistory(workspacePath, filePath) {
    const paths = await getHistoryPaths(workspacePath)
    const normalizedPath = toWorkspaceRelativePath(paths.workspacePath, filePath)
    const record = findDocumentRecord(
      await readDocumentRecords(paths),
      normalizedPath
    )

    if (!record) {
      return []
    }

    return Object.freeze(
      (await readHistoryVersions(paths))
        .filter((version) => version.documentId === record.documentId)
        .map(toPublicVersion)
        .sort(compareNewestFirst)
    )
  },
  async markExternalDeletes(workspacePath) {
    const paths = await getHistoryPaths(workspacePath)
    const records = await readDocumentRecords(paths)
    const versions = await readHistoryVersions(paths)

    for (const record of records) {
      const documentVersions = versions
        .filter((version) => version.documentId === record.documentId)
        .sort(compareNewestFirst)
      const latestVersion = documentVersions[0]

      if (
        !latestVersion ||
        latestVersion.event === 'delete' ||
        latestVersion.event === 'external-delete' ||
        (await fileExists(resolveWorkspacePath(paths.workspacePath, record.currentPath)))
      ) {
        continue
      }

      const createdAt = now().toISOString()
      const externalDeleteVersion = Object.freeze({
        blobHash: latestVersion.blobHash,
        byteLength: latestVersion.byteLength,
        createdAt,
        documentId: record.documentId,
        event: 'external-delete',
        id: createVersionId(createdAt),
        path: record.currentPath,
        schemaVersion: 1
      } satisfies StoredHistoryVersion)

      await appendHistoryVersion(paths, externalDeleteVersion)
      await writeDocumentRecord(paths, {
        ...record,
        deletedAt: createdAt,
        updatedAt: createdAt
      })
    }

    return listDeletedDocumentsFromPaths(paths)
  },
  async readVersion(workspacePath, versionId) {
    if (versionId.trim().length === 0) {
      throw new Error('Document history version is required')
    }

    const paths = await getHistoryPaths(workspacePath)
    const version = await findVersionById(paths, versionId)

    return Object.freeze({
      contents: await readFile(
        join(paths.blobsPath, `${version.blobHash}.md`),
        'utf8'
      ),
      version: toPublicVersion(version)
    })
  },
  async restoreVersion(workspacePath, versionId) {
    const paths = await getHistoryPaths(workspacePath)
    const version = await findVersionById(paths, versionId)
    const contents = await readFile(
      join(paths.blobsPath, `${version.blobHash}.md`),
      'utf8'
    )
    const absoluteOriginalPath = resolveWorkspacePath(paths.workspacePath, version.path)
    const restorePath =
      (version.event === 'delete' || version.event === 'external-delete') &&
      (await fileExists(absoluteOriginalPath))
        ? await createAdjacentRestoredPath(paths.workspacePath, version.path)
        : version.path
    const absoluteRestorePath = resolveWorkspacePath(paths.workspacePath, restorePath)

    assertPathInsideWorkspace(paths.workspacePath, absoluteRestorePath)
    await mkdir(dirname(absoluteRestorePath), { recursive: true })
    if (await fileExists(absoluteRestorePath)) {
      await service.captureSnapshot({
        event: 'restore',
        filePath: restorePath,
        sourceVersionId: versionId,
        workspacePath
      })
    }
    await writeFile(absoluteRestorePath, contents, 'utf8')

    return Object.freeze({
      contents,
      path: restorePath
    })
  }
  }

  return service
}
