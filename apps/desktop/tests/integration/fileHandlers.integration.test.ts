import {
  link,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { describe, expect, it, vi } from 'vitest'

import { FILE_CHANNELS, WORKSPACE_CHANNELS } from '../../src/main/ipc/channels'
import { registerFileHandlers } from '../../src/main/ipc/registerFileHandlers'
import { registerWorkspaceHandlers } from '../../src/main/ipc/registerWorkspaceHandlers'
import { createMarkdownFileService } from '../../src/main/services/markdownFileService'
import { createDocumentHistoryService } from '../../src/main/services/documentHistoryService'
import { createWorkspaceService } from '../../src/main/services/workspaceService'
import type { FileContents } from '../../src/shared/workspace'

const fixtureWorkspacePath = resolve('tests/fixtures/workspace')

interface RegisteredHandlers {
  readonly handlers: Map<string, (...args: unknown[]) => unknown>
}

interface RegisterHandlerOptions {
  readonly clipboardFormats?: Readonly<Record<string, string>>
  readonly clipboardText?: string
  readonly moveEntryToTrash?: (entryPath: string) => Promise<void>
}

describe('fileHandlers integration', () => {
  const registerHandlers = (
    workspacePath = fixtureWorkspacePath,
    options: RegisterHandlerOptions = {}
  ): RegisteredHandlers => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      })
    }

    const workspaceSession = registerWorkspaceHandlers({
      dialog: { showOpenDialog: vi.fn() },
      ipcMain,
      testWorkspacePath: workspacePath,
      workspaceService: createWorkspaceService()
    })

    registerFileHandlers({
      clipboard: {
        availableFormats: vi.fn(() => Object.keys(options.clipboardFormats ?? {})),
        read: vi.fn((format: string) => options.clipboardFormats?.[format] ?? ''),
        readBuffer: vi.fn((format: string) =>
          Buffer.from(options.clipboardFormats?.[format] ?? '')
        ),
        readText: vi.fn(() => options.clipboardText ?? ''),
        writeText: vi.fn()
      },
      getActiveWorkspaceRoot: workspaceSession.getActiveWorkspaceRoot,
      ipcMain,
      markdownFileService: createMarkdownFileService({
        moveEntryToTrash: options.moveEntryToTrash
      })
    })

    return { handlers }
  }

  it('reads a Markdown file from the active fixture workspace', async () => {
    const { handlers } = registerHandlers()

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }

    const result = (await handlers
      .get(FILE_CHANNELS.readMarkdownFile)
      ?.({}, 'README.md', workspace.rootPath)) as FileContents

    expect(result).toEqual({
      contents: '# Fixture Workspace\n\nRoot markdown file.\n',
      path: 'README.md'
    })
  })

  it('checks whether a workspace Markdown file still exists through IPC', async () => {
    const { handlers } = registerHandlers()

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }

    await expect(
      handlers
        .get(FILE_CHANNELS.markdownFileExists)
        ?.({}, 'README.md', workspace.rootPath)
    ).resolves.toBe(true)
    await expect(
      handlers
        .get(FILE_CHANNELS.markdownFileExists)
        ?.({}, 'missing.md', workspace.rootPath)
    ).resolves.toBe(false)
    await expect(
      handlers
        .get(FILE_CHANNELS.markdownFileExists)
        ?.({}, 'plain.txt', workspace.rootPath)
    ).resolves.toBe(false)
  })

  it('repairs moved image assets while reading Markdown through IPC', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-workspace-'))
    const imageBytes = Buffer.from([137, 80, 78, 71])

    await mkdir(join(workspacePath, 'docs'))
    await mkdir(join(workspacePath, 'old', '.mde', 'assets'), {
      recursive: true
    })
    await writeFile(
      join(workspacePath, 'docs', 'README.md'),
      '# Workspace\n\n![Moved](.mde/assets/moved.png)'
    )
    await writeFile(
      join(workspacePath, 'old', '.mde', 'assets', 'moved.png'),
      imageBytes
    )

    const { handlers } = registerHandlers(workspacePath)
    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }

    const result = (await handlers
      .get(FILE_CHANNELS.readMarkdownFile)
      ?.({}, 'docs/README.md', workspace.rootPath)) as FileContents

    expect(result.repairedImageAssetCount).toBe(1)
    await expect(
      readFile(join(workspacePath, 'docs', '.mde', 'assets', 'moved.png'))
    ).resolves.toEqual(imageBytes)
  })

  it('rejects non-Markdown files', async () => {
    const { handlers } = registerHandlers()

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }

    await expect(
      handlers
        .get(FILE_CHANNELS.readMarkdownFile)
        ?.({}, 'package.json', workspace.rootPath)
    ).rejects.toThrow(/markdown/i)
  })

  it('rejects path traversal outside the active workspace', async () => {
    const { handlers } = registerHandlers()

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }

    await expect(
      handlers
        .get(FILE_CHANNELS.readMarkdownFile)
        ?.({}, '../package.json', workspace.rootPath)
    ).rejects.toThrow(/outside workspace/i)
  })

  it('rejects Markdown symlinks that resolve outside the active workspace', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-workspace-'))
    const outsidePath = await mkdtemp(join(tmpdir(), 'mde-outside-'))
    const outsideFilePath = join(outsidePath, 'outside.md')

    await writeFile(join(workspacePath, 'README.md'), '# Workspace')
    await writeFile(outsideFilePath, '# Outside')
    await symlink(outsideFilePath, join(workspacePath, 'leak.md'))

    const { handlers } = registerHandlers(workspacePath)

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }

    await expect(
      handlers
        .get(FILE_CHANNELS.readMarkdownFile)
        ?.({}, 'leak.md', workspace.rootPath)
    ).rejects.toThrow(/outside workspace/i)
  })

  it('rejects Markdown symlinks that resolve to non-Markdown files inside the active workspace', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-workspace-'))

    await writeFile(join(workspacePath, 'README.md'), '# Workspace')
    await writeFile(join(workspacePath, 'secret.txt'), 'plain text')
    await symlink(join(workspacePath, 'secret.txt'), join(workspacePath, 'leak.md'))

    const { handlers } = registerHandlers(workspacePath)

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }

    await expect(
      handlers
        .get(FILE_CHANNELS.readMarkdownFile)
        ?.({}, 'leak.md', workspace.rootPath)
    ).rejects.toThrow(/markdown/i)
  })

  it('keeps file reads pinned to the canonical workspace root after an opened symlink is retargeted', async () => {
    const originalWorkspacePath = await mkdtemp(join(tmpdir(), 'mde-original-'))
    const retargetedWorkspacePath = await mkdtemp(join(tmpdir(), 'mde-retargeted-'))
    const workspaceLinkPath = join(
      await mkdtemp(join(tmpdir(), 'mde-link-parent-')),
      'workspace-link'
    )

    await writeFile(join(originalWorkspacePath, 'README.md'), '# Original')
    await writeFile(join(retargetedWorkspacePath, 'README.md'), '# Retargeted')
    await symlink(originalWorkspacePath, workspaceLinkPath)

    const { handlers } = registerHandlers(workspaceLinkPath)

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }
    await rm(workspaceLinkPath)
    await symlink(retargetedWorkspacePath, workspaceLinkPath)

    const result = (await handlers
      .get(FILE_CHANNELS.readMarkdownFile)
      ?.({}, 'README.md', workspace.rootPath)) as FileContents

    expect(result).toEqual({
      contents: '# Original',
      path: 'README.md'
    })
  })

  it('rejects Markdown hard links before reading through the file IPC handler', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-workspace-'))
    const outsidePath = await mkdtemp(join(tmpdir(), 'mde-outside-'))
    const outsideFilePath = join(outsidePath, 'outside.md')

    await writeFile(join(workspacePath, 'README.md'), '# Workspace')
    await writeFile(outsideFilePath, '# Outside')
    await link(outsideFilePath, join(workspacePath, 'inside.md'))

    const { handlers } = registerHandlers(workspacePath)

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }

    await expect(
      handlers
        .get(FILE_CHANNELS.readMarkdownFile)
        ?.({}, 'inside.md', workspace.rootPath)
    ).rejects.toThrow(/hard-linked/i)
  })

  it('rejects Markdown hard links before writing through the file IPC handler', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-workspace-'))
    const outsidePath = await mkdtemp(join(tmpdir(), 'mde-outside-'))
    const outsideFilePath = join(outsidePath, 'outside.md')

    await writeFile(join(workspacePath, 'README.md'), '# Workspace')
    await writeFile(outsideFilePath, '# Outside')
    await link(outsideFilePath, join(workspacePath, 'inside.md'))

    const { handlers } = registerHandlers(workspacePath)

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }

    await expect(
      handlers
        .get(FILE_CHANNELS.writeMarkdownFile)
        ?.({}, 'inside.md', '# Changed', workspace.rootPath)
    ).rejects.toThrow(/hard-linked/i)
    await expect(readFile(outsideFilePath, 'utf8')).resolves.toBe('# Outside')
  })

  it('rejects stale writes when the expected workspace is no longer active', async () => {
    const originalWorkspacePath = await mkdtemp(join(tmpdir(), 'mde-original-'))
    const activeWorkspacePath = await mkdtemp(join(tmpdir(), 'mde-active-'))
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      })
    }

    await writeFile(join(originalWorkspacePath, 'README.md'), '# Original')
    await writeFile(join(activeWorkspacePath, 'README.md'), '# Active')

    registerFileHandlers({
      getActiveWorkspaceRoot: () => activeWorkspacePath,
      ipcMain,
      markdownFileService: createMarkdownFileService()
    })

    await expect(
      handlers
        .get(FILE_CHANNELS.writeMarkdownFile)
        ?.({}, 'README.md', '# Stale write', originalWorkspacePath)
    ).rejects.toThrow(/workspace changed/i)
    await expect(readFile(join(activeWorkspacePath, 'README.md'), 'utf8')).resolves.toBe(
      '# Active'
    )
  })

  it('searches Markdown files through the active workspace IPC handler', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-search-workspace-'))

    await mkdir(join(workspacePath, 'docs'))
    await writeFile(join(workspacePath, 'README.md'), '# Search\n\nAlpha root')
    await writeFile(join(workspacePath, 'docs', 'guide.md'), 'Nested alpha')
    const { handlers } = registerHandlers(workspacePath)

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }
    const result = await handlers
      .get(FILE_CHANNELS.searchWorkspaceMarkdown)
      ?.({}, 'alpha', workspace.rootPath)

    expect(result).toMatchObject({
      limited: false,
      query: 'alpha',
      results: [
        {
          path: 'README.md'
        },
        {
          path: 'docs/guide.md'
        }
      ]
    })
  })

  it('marks frontmatter workspace search matches as metadata hits', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-search-workspace-'))

    await writeFile(
      join(workspacePath, 'README.md'),
      ['---', 'name: metadata-target', '---', '# Body', '', 'Body target'].join(
        '\n'
      )
    )
    const { handlers } = registerHandlers(workspacePath)

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }
    const metadataResult = await handlers
      .get(FILE_CHANNELS.searchWorkspaceMarkdown)
      ?.({}, 'metadata-target', workspace.rootPath)
    const bodyResult = await handlers
      .get(FILE_CHANNELS.searchWorkspaceMarkdown)
      ?.({}, 'Body target', workspace.rootPath)

    expect(metadataResult).toMatchObject({
      results: [
        {
          matches: [
            {
              kind: 'metadata',
              lineNumber: 2,
              preview: 'name: metadata-target'
            }
          ],
          path: 'README.md'
        }
      ]
    })
    expect(bodyResult).toMatchObject({
      results: [
        {
          matches: [
            {
              kind: 'body',
              preview: 'Body target'
            }
          ],
          path: 'README.md'
        }
      ]
    })
  })

  it('rejects stale workspace search requests', async () => {
    const originalWorkspacePath = await mkdtemp(join(tmpdir(), 'mde-original-'))
    const activeWorkspacePath = await mkdtemp(join(tmpdir(), 'mde-active-'))
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      })
    }

    await writeFile(join(originalWorkspacePath, 'README.md'), '# Original alpha')
    await writeFile(join(activeWorkspacePath, 'README.md'), '# Active alpha')

    registerFileHandlers({
      getActiveWorkspaceRoot: () => activeWorkspacePath,
      ipcMain,
      markdownFileService: createMarkdownFileService()
    })

    await expect(
      handlers
        .get(FILE_CHANNELS.searchWorkspaceMarkdown)
        ?.({}, 'alpha', originalWorkspacePath)
    ).rejects.toThrow(/workspace changed/i)
  })

  it('rejects stale destructive operations when the expected workspace is no longer active', async () => {
    const originalWorkspacePath = await mkdtemp(join(tmpdir(), 'mde-original-'))
    const activeWorkspacePath = await mkdtemp(join(tmpdir(), 'mde-active-'))
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      })
    }

    await writeFile(join(originalWorkspacePath, 'README.md'), '# Original')
    await writeFile(join(activeWorkspacePath, 'README.md'), '# Active')

    registerFileHandlers({
      getActiveWorkspaceRoot: () => activeWorkspacePath,
      ipcMain,
      markdownFileService: createMarkdownFileService()
    })

    await expect(
      handlers
        .get(FILE_CHANNELS.deleteEntry)
        ?.({}, 'README.md', originalWorkspacePath)
    ).rejects.toThrow(/workspace changed/i)
    await expect(readFile(join(activeWorkspacePath, 'README.md'), 'utf8')).resolves.toBe(
      '# Active'
    )
  })

  it('saves edited Markdown through the file IPC handler', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-workspace-'))
    await writeFile(join(workspacePath, 'README.md'), '# Original\n')
    const { handlers } = registerHandlers(workspacePath)

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }
    await handlers
      .get(FILE_CHANNELS.writeMarkdownFile)
      ?.({}, 'README.md', '# Edited\n\nSaved from integration.\n', workspace.rootPath)

    await expect(readFile(join(workspacePath, 'README.md'), 'utf8')).resolves.toBe(
      '# Edited\n\nSaved from integration.\n'
    )
  })

  it('captures the previous Markdown contents before writing through the file IPC handler', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-workspace-'))
    await writeFile(join(workspacePath, 'README.md'), '# Original\n')
    const { handlers } = registerHandlers(workspacePath)

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }
    await handlers
      .get(FILE_CHANNELS.writeMarkdownFile)
      ?.({}, 'README.md', '# Edited\n', workspace.rootPath)

    const historyService = createDocumentHistoryService()
    const [version] = await historyService.listDocumentHistory(
      workspacePath,
      'README.md'
    )
    const preview = await historyService.readVersion(workspacePath, version.id)

    expect(version).toMatchObject({
      event: 'manual-save',
      path: 'README.md'
    })
    expect(preview.contents).toBe('# Original\n')
  })

  it('blocks Markdown overwrites when the history directory is symlinked', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-workspace-'))
    const outsidePath = await mkdtemp(join(tmpdir(), 'mde-history-outside-'))
    await writeFile(join(workspacePath, 'README.md'), '# Original\n')
    await mkdir(join(workspacePath, '.mde'))
    await symlink(outsidePath, join(workspacePath, '.mde', 'history'))
    const { handlers } = registerHandlers(workspacePath)

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }

    await expect(
      handlers
        .get(FILE_CHANNELS.writeMarkdownFile)
        ?.({}, 'README.md', '# Edited\n', workspace.rootPath)
    ).rejects.toThrow(/symlink/i)
    await expect(readFile(join(workspacePath, 'README.md'), 'utf8')).resolves.toBe(
      '# Original\n'
    )
  })

  it('saves pasted image assets through the file IPC handler', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-workspace-'))

    await mkdir(join(workspacePath, 'docs'))
    await writeFile(join(workspacePath, 'docs', 'README.md'), '# Workspace')
    const { handlers } = registerHandlers(workspacePath)

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }
    const result = (await handlers
      .get(FILE_CHANNELS.saveImageAsset)
      ?.(
        {},
        'docs/README.md',
        'clipboard.png',
        'image/png',
        new Uint8Array([137, 80, 78, 71]).buffer,
        workspace.rootPath
      )) as { fileUrl: string; markdownPath: string }

    expect(result.markdownPath).toMatch(/^\.mde\/assets\/image-.+\.png$/)
    expect(result.fileUrl).toContain('/docs/.mde/assets/image-')
    await expect(
      readFile(join(workspacePath, 'docs', result.markdownPath))
    ).resolves.toEqual(Buffer.from([137, 80, 78, 71]))
  })

  it('creates a Markdown file through the file IPC handler', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-workspace-'))
    await writeFile(join(workspacePath, 'README.md'), '# Workspace')
    const { handlers } = registerHandlers(workspacePath)

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }
    const result = (await handlers
      .get(FILE_CHANNELS.createMarkdownFile)
      ?.({}, 'notes/today.md', workspace.rootPath)) as FileContents

    expect(result).toEqual({
      contents: '',
      path: 'notes/today.md'
    })
    await expect(readFile(join(workspacePath, 'notes', 'today.md'), 'utf8')).resolves.toBe(
      ''
    )
  })

  it('creates a folder through the file IPC handler', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-workspace-'))
    await writeFile(join(workspacePath, 'README.md'), '# Workspace')
    const { handlers } = registerHandlers(workspacePath)

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }
    await handlers.get(FILE_CHANNELS.createFolder)?.({}, 'notes/daily', workspace.rootPath)

    const createdFolderStats = await stat(join(workspacePath, 'notes', 'daily'))

    expect(createdFolderStats.isDirectory()).toBe(true)
  })

  it('renames an entry through the file IPC handler', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-workspace-'))
    await writeFile(join(workspacePath, 'draft.md'), '# Draft')
    const { handlers } = registerHandlers(workspacePath)

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }
    const result = (await handlers
      .get(FILE_CHANNELS.renameEntry)
      ?.({}, 'draft.md', 'final.md', workspace.rootPath)) as { path: string }

    expect(result).toEqual({ path: 'final.md' })
    await expect(readFile(join(workspacePath, 'final.md'), 'utf8')).resolves.toBe(
      '# Draft'
    )
    await expect(stat(join(workspacePath, 'draft.md'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('records rename history and keeps the document identity on the new path', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-workspace-'))
    await writeFile(join(workspacePath, 'draft.md'), '# Draft\n')
    const { handlers } = registerHandlers(workspacePath)

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }
    await handlers
      .get(FILE_CHANNELS.renameEntry)
      ?.({}, 'draft.md', 'final.md', workspace.rootPath)

    const historyService = createDocumentHistoryService()
    const versions = await historyService.listDocumentHistory(
      workspacePath,
      'final.md'
    )

    expect(versions).toHaveLength(1)
    expect(versions[0]).toMatchObject({
      event: 'rename',
      path: 'draft.md'
    })
  })

  it('deletes an entry through the file IPC handler', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-workspace-'))
    await writeFile(join(workspacePath, 'old.md'), '# Old')
    const absoluteEntryPath = await realpath(join(workspacePath, 'old.md'))
    const moveEntryToTrash = vi.fn(async (entryPath: string) => {
      await rm(entryPath, { force: false, recursive: true })
    })
    const { handlers } = registerHandlers(workspacePath, { moveEntryToTrash })

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }
    await handlers.get(FILE_CHANNELS.deleteEntry)?.({}, 'old.md', workspace.rootPath)

    expect(moveEntryToTrash).toHaveBeenCalledWith(absoluteEntryPath)
    await expect(stat(join(workspacePath, 'old.md'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('records deleted Markdown documents as recoverable history entries', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-workspace-'))
    await writeFile(join(workspacePath, 'old.md'), '# Old\n')
    const { handlers } = registerHandlers(workspacePath)

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }
    await handlers.get(FILE_CHANNELS.deleteEntry)?.({}, 'old.md', workspace.rootPath)

    const historyService = createDocumentHistoryService()
    const deletedDocuments = await historyService.listDeletedDocumentHistory(
      workspacePath
    )

    expect(deletedDocuments).toEqual([
      expect.objectContaining({
        path: 'old.md',
        reason: 'deleted-in-mde'
      })
    ])
  })

  it('excludes app-managed history blobs from workspace search', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-workspace-'))
    await mkdir(join(workspacePath, '.mde', 'history', 'blobs'), {
      recursive: true
    })
    await writeFile(join(workspacePath, 'README.md'), '# Visible\n')
    await writeFile(
      join(workspacePath, '.mde', 'history', 'blobs', 'hidden.md'),
      'secret-history-keyword'
    )
    const { handlers } = registerHandlers(workspacePath)

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }
    const result = await handlers
      .get(FILE_CHANNELS.searchWorkspaceMarkdown)
      ?.({}, 'secret-history-keyword', workspace.rootPath)

    expect(result).toMatchObject({
      limited: false,
      query: 'secret-history-keyword',
      results: []
    })
  })

  it('lists document history through an intent-level IPC handler', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-workspace-'))
    await writeFile(join(workspacePath, 'README.md'), '# Original\n')
    const { handlers } = registerHandlers(workspacePath)

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }
    await handlers
      .get(FILE_CHANNELS.writeMarkdownFile)
      ?.({}, 'README.md', '# Edited\n', workspace.rootPath)

    const history = await handlers
      .get(FILE_CHANNELS.listDocumentHistory)
      ?.({}, 'README.md', workspace.rootPath)

    expect(history).toEqual([
      expect.objectContaining({
        event: 'manual-save',
        path: 'README.md'
      })
    ])
  })

  it('rejects stale document history list requests', async () => {
    const originalWorkspacePath = await mkdtemp(join(tmpdir(), 'mde-original-'))
    const activeWorkspacePath = await mkdtemp(join(tmpdir(), 'mde-active-'))
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const ipcMain = {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      })
    }

    registerFileHandlers({
      getActiveWorkspaceRoot: () => activeWorkspacePath,
      ipcMain,
      markdownFileService: createMarkdownFileService()
    })

    await expect(
      handlers
        .get(FILE_CHANNELS.listDocumentHistory)
        ?.({}, 'README.md', originalWorkspacePath)
    ).rejects.toThrow(/workspace changed/i)
  })

  it('reads and restores document history versions through IPC handlers', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-workspace-'))
    await writeFile(join(workspacePath, 'README.md'), '# Original\n')
    const { handlers } = registerHandlers(workspacePath)

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }
    await handlers
      .get(FILE_CHANNELS.writeMarkdownFile)
      ?.({}, 'README.md', '# Edited\n', workspace.rootPath)
    const [version] = (await handlers
      .get(FILE_CHANNELS.listDocumentHistory)
      ?.({}, 'README.md', workspace.rootPath)) as readonly { id: string }[]

    const preview = await handlers
      .get(FILE_CHANNELS.readDocumentHistoryVersion)
      ?.({}, version.id, workspace.rootPath)

    expect(preview).toMatchObject({
      contents: '# Original\n',
      version: {
        id: version.id,
        path: 'README.md'
      }
    })

    await handlers
      .get(FILE_CHANNELS.restoreDocumentHistoryVersion)
      ?.({}, version.id, workspace.rootPath)

    await expect(readFile(join(workspacePath, 'README.md'), 'utf8')).resolves.toBe(
      '# Original\n'
    )
    await expect(
      handlers
        .get(FILE_CHANNELS.listDocumentHistory)
        ?.({}, 'README.md', workspace.rootPath)
    ).resolves.toEqual([
      expect.objectContaining({
        event: 'restore',
        sourceVersionId: version.id
      }),
      expect.objectContaining({
        event: 'manual-save'
      })
    ])
  })

  it('lists deleted documents through a workspace-level IPC handler', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-workspace-'))
    await writeFile(join(workspacePath, 'old.md'), '# Old\n')
    const { handlers } = registerHandlers(workspacePath)

    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }
    await handlers.get(FILE_CHANNELS.deleteEntry)?.({}, 'old.md', workspace.rootPath)

    await expect(
      handlers
        .get(FILE_CHANNELS.listDeletedDocumentHistory)
        ?.({}, workspace.rootPath)
    ).resolves.toEqual([
      expect.objectContaining({
        path: 'old.md',
        reason: 'deleted-in-mde'
      })
    ])
  })

  it('copies Markdown entries and pasted clipboard paths through IPC', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-workspace-'))
    const externalPath = await mkdtemp(join(tmpdir(), 'mde-external-'))
    const imageBytes = Buffer.from([137, 80, 78, 71])

    await mkdir(join(workspacePath, 'docs', '.mde', 'assets'), {
      recursive: true
    })
    await mkdir(join(workspacePath, 'archive'))
    await writeFile(
      join(workspacePath, 'docs', 'intro.md'),
      '# Intro\n\n![Hero](.mde/assets/hero.png)'
    )
    await writeFile(join(workspacePath, 'docs', '.mde', 'assets', 'hero.png'), imageBytes)
    await mkdir(join(externalPath, 'images'))
    await writeFile(
      join(externalPath, 'outside.md'),
      '# Outside\n\n![Photo](images/photo.png)'
    )
    await writeFile(join(externalPath, 'images', 'photo.png'), imageBytes)

    const { handlers } = registerHandlers(workspacePath, {
      clipboardText: join(externalPath, 'outside.md')
    })
    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }

    await expect(
      handlers
        .get(FILE_CHANNELS.copyWorkspaceEntry)
        ?.({}, 'docs/intro.md', 'archive', workspace.rootPath)
    ).resolves.toEqual({
      path: 'archive/intro.md',
      type: 'file'
    })
    await expect(
      readFile(join(workspacePath, 'archive', '.mde', 'assets', 'hero.png'))
    ).resolves.toEqual(imageBytes)

    await expect(
      handlers
        .get(FILE_CHANNELS.pasteClipboardEntries)
        ?.({}, 'docs', workspace.rootPath)
    ).resolves.toEqual([
      {
        path: 'docs/outside.md',
        type: 'file'
      }
    ])
    await expect(readFile(join(workspacePath, 'docs', 'outside.md'), 'utf8')).resolves.toBe(
      '# Outside\n\n![Photo](.mde/assets/photo.png)'
    )
    await expect(
      readFile(join(workspacePath, 'docs', '.mde', 'assets', 'photo.png'))
    ).resolves.toEqual(imageBytes)
  })

  it('pastes Finder file-url clipboard entries through IPC', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-workspace-'))
    const externalPath = await mkdtemp(join(tmpdir(), 'mde-external-'))
    const imageBytes = Buffer.from([137, 80, 78, 71])

    await mkdir(join(workspacePath, 'docs'))
    await mkdir(join(externalPath, 'assets'))
    await writeFile(
      join(externalPath, 'finder.md'),
      '# Finder\n\n![Photo](assets/photo.png)'
    )
    await writeFile(join(externalPath, 'assets', 'photo.png'), imageBytes)

    const { handlers } = registerHandlers(workspacePath, {
      clipboardFormats: {
        'public.file-url': pathToFileURL(join(externalPath, 'finder.md')).href
      }
    })
    const workspace = (await handlers.get(WORKSPACE_CHANNELS.openWorkspace)?.({})) as {
      rootPath: string
    }

    await expect(
      handlers
        .get(FILE_CHANNELS.pasteClipboardEntries)
        ?.({}, 'docs', workspace.rootPath)
    ).resolves.toEqual([
      {
        path: 'docs/finder.md',
        type: 'file'
      }
    ])
    await expect(readFile(join(workspacePath, 'docs', 'finder.md'), 'utf8')).resolves.toBe(
      '# Finder\n\n![Photo](.mde/assets/photo.png)'
    )
    await expect(
      readFile(join(workspacePath, 'docs', '.mde', 'assets', 'photo.png'))
    ).resolves.toEqual(imageBytes)
  })
})
