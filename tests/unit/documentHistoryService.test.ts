import {
  appendFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createDocumentHistoryService } from '../../apps/desktop/src/main/services/documentHistoryService'

describe('documentHistoryService', () => {
  const createWorkspace = async (): Promise<string> =>
    mkdtemp(join(tmpdir(), 'mde-history-'))

  it('captures a deduplicated Markdown blob before a file is overwritten', async () => {
    const workspacePath = await createWorkspace()
    await mkdir(join(workspacePath, 'docs'))
    await writeFile(join(workspacePath, 'docs', 'intro.md'), '# Original\n')
    const service = createDocumentHistoryService({
      now: () => new Date('2026-05-02T01:00:00.000Z')
    })

    const version = await service.captureSnapshot({
      event: 'manual-save',
      filePath: 'docs/intro.md',
      workspacePath
    })

    expect(version).toMatchObject({
      byteLength: Buffer.byteLength('# Original\n'),
      createdAt: '2026-05-02T01:00:00.000Z',
      event: 'manual-save',
      path: 'docs/intro.md'
    })
    await expect(
      readFile(
        join(workspacePath, '.mde', 'history', 'blobs', `${version?.blobHash}.md`),
        'utf8'
      )
    ).resolves.toBe('# Original\n')

    const duplicate = await service.captureSnapshot({
      event: 'manual-save',
      filePath: 'docs/intro.md',
      workspacePath
    })

    expect(duplicate).toBeNull()
    await expect(
      readdir(join(workspacePath, '.mde', 'history', 'blobs'))
    ).resolves.toEqual([`${version?.blobHash}.md`])
  })

  it('ignores malformed JSONL lines when listing document history', async () => {
    const workspacePath = await createWorkspace()
    await writeFile(join(workspacePath, 'README.md'), '# Readme\n')
    const service = createDocumentHistoryService()
    const version = await service.captureSnapshot({
      event: 'manual-save',
      filePath: 'README.md',
      workspacePath
    })
    await appendFile(
      join(workspacePath, '.mde', 'history', 'index.jsonl'),
      'not-json\n',
      'utf8'
    )

    await expect(
      service.listDocumentHistory(workspacePath, 'README.md')
    ).resolves.toMatchObject([
      {
        id: version?.id,
        path: 'README.md'
      }
    ])
  })

  it('keeps document identity when a Markdown file is renamed', async () => {
    const workspacePath = await createWorkspace()
    await writeFile(join(workspacePath, 'draft.md'), '# Draft\n')
    const service = createDocumentHistoryService()
    const beforeRename = await service.captureSnapshot({
      event: 'manual-save',
      filePath: 'draft.md',
      workspacePath
    })
    const renameVersion = await service.captureSnapshot({
      event: 'rename',
      filePath: 'draft.md',
      nextPath: 'final.md',
      workspacePath
    })

    expect(renameVersion?.documentId).toBe(beforeRename?.documentId)
    const finalPathHistory = await service.listDocumentHistory(
      workspacePath,
      'final.md'
    )

    expect(finalPathHistory).toHaveLength(2)
    expect(finalPathHistory.map((version) => version.documentId)).toEqual([
      beforeRename?.documentId,
      beforeRename?.documentId
    ])
  })

  it('throttles autosave snapshots per document', async () => {
    const workspacePath = await createWorkspace()
    await writeFile(join(workspacePath, 'README.md'), '# One\n')
    let currentTime = new Date('2026-05-02T01:00:00.000Z')
    const service = createDocumentHistoryService({
      now: () => currentTime
    })

    const first = await service.captureSnapshot({
      event: 'autosave',
      filePath: 'README.md',
      workspacePath
    })
    await writeFile(join(workspacePath, 'README.md'), '# Two\n')
    currentTime = new Date('2026-05-02T01:04:00.000Z')
    const throttled = await service.captureSnapshot({
      event: 'autosave',
      filePath: 'README.md',
      workspacePath
    })
    currentTime = new Date('2026-05-02T01:06:00.000Z')
    const afterWindow = await service.captureSnapshot({
      event: 'autosave',
      filePath: 'README.md',
      workspacePath
    })

    expect(first).not.toBeNull()
    expect(throttled).toBeNull()
    expect(afterWindow).not.toBeNull()
  })

  it('lists documents deleted inside MDE and files deleted outside MDE', async () => {
    const workspacePath = await createWorkspace()
    await writeFile(join(workspacePath, 'inside.md'), '# Deleted in MDE\n')
    await writeFile(join(workspacePath, 'finder.md'), '# Deleted in Finder\n')
    const service = createDocumentHistoryService({
      now: () => new Date('2026-05-02T01:00:00.000Z')
    })

    const deleteVersion = await service.captureSnapshot({
      event: 'delete',
      filePath: 'inside.md',
      workspacePath
    })
    const finderVersion = await service.captureSnapshot({
      event: 'manual-save',
      filePath: 'finder.md',
      workspacePath
    })
    const finderHistory = await service.listDocumentHistory(workspacePath, 'finder.md')
    await rm(join(workspacePath, 'inside.md'))
    await rm(join(workspacePath, 'finder.md'))

    const deletedDocuments = await service.markExternalDeletes(workspacePath)

    expect(finderVersion).not.toBeNull()
    expect(finderHistory).toHaveLength(1)
    expect(deletedDocuments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          latestVersionId: deleteVersion?.id,
          path: 'inside.md',
          reason: 'deleted-in-mde'
        }),
        expect.objectContaining({
          path: 'finder.md',
          reason: 'deleted-outside-mde'
        })
      ])
    )
  })

  it('rejects symlinked history directories before writing snapshots', async () => {
    const workspacePath = await createWorkspace()
    const outsidePath = await mkdtemp(join(tmpdir(), 'mde-history-outside-'))
    await writeFile(join(workspacePath, 'README.md'), '# Readme\n')
    await mkdir(join(workspacePath, '.mde'))
    await symlink(outsidePath, join(workspacePath, '.mde', 'history'))
    const service = createDocumentHistoryService()

    await expect(
      service.captureSnapshot({
        event: 'manual-save',
        filePath: 'README.md',
        workspacePath
      })
    ).rejects.toThrow(/symlink/i)
  })
})
