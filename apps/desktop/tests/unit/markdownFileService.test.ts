import {
  mkdtemp,
  mkdir,
  link,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { createMarkdownFileService } from '../../src/main/services/markdownFileService'

describe('markdownFileService', () => {
  it('reads Markdown files inside the workspace', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))
    await mkdir(join(rootPath, 'docs'))
    await writeFile(join(rootPath, 'docs', 'intro.md'), '# Intro\n\nHello.')

    const result = await createMarkdownFileService().readMarkdownFile(
      rootPath,
      'docs/intro.md'
    )

    expect(result).toEqual({
      contents: '# Intro\n\nHello.',
      path: 'docs/intro.md'
    })
  })

  it('repairs missing moved image assets when a unique source asset exists', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))
    const imageBytes = Buffer.from([137, 80, 78, 71])

    await mkdir(join(rootPath, 'docs'))
    await mkdir(join(rootPath, 'archive', '.mde', 'assets'), { recursive: true })
    await writeFile(
      join(rootPath, 'docs', 'intro.md'),
      '# Intro\n\n![Moved image](.mde/assets/moved.png)'
    )
    await writeFile(
      join(rootPath, 'archive', '.mde', 'assets', 'moved.png'),
      imageBytes
    )

    const result = await createMarkdownFileService().readMarkdownFile(
      rootPath,
      'docs/intro.md'
    )

    expect(result).toEqual({
      contents: '# Intro\n\n![Moved image](.mde/assets/moved.png)',
      path: 'docs/intro.md',
      repairedImageAssetCount: 1
    })
    await expect(
      readFile(join(rootPath, 'docs', '.mde', 'assets', 'moved.png'))
    ).resolves.toEqual(imageBytes)
  })

  it('does not repair missing image assets when multiple source assets match', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))

    await mkdir(join(rootPath, 'docs'))
    await mkdir(join(rootPath, 'left', '.mde', 'assets'), { recursive: true })
    await mkdir(join(rootPath, 'right', '.mde', 'assets'), { recursive: true })
    await writeFile(
      join(rootPath, 'docs', 'intro.md'),
      '# Intro\n\n![Moved image](.mde/assets/moved.png)'
    )
    await writeFile(join(rootPath, 'left', '.mde', 'assets', 'moved.png'), 'left')
    await writeFile(
      join(rootPath, 'right', '.mde', 'assets', 'moved.png'),
      'right'
    )

    const result = await createMarkdownFileService().readMarkdownFile(
      rootPath,
      'docs/intro.md'
    )

    expect(result).toEqual({
      contents: '# Intro\n\n![Moved image](.mde/assets/moved.png)',
      path: 'docs/intro.md'
    })
    await expect(
      stat(join(rootPath, 'docs', '.mde', 'assets', 'moved.png'))
    ).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects non-Markdown files', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))
    await writeFile(join(rootPath, 'notes.txt'), 'plain text')

    await expect(
      createMarkdownFileService().readMarkdownFile(rootPath, 'notes.txt')
    ).rejects.toThrow(/markdown/i)
  })

  it('rejects paths outside the workspace', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))
    const outsidePath = await mkdtemp(join(tmpdir(), 'mde-outside-'))
    await writeFile(join(outsidePath, 'outside.md'), '# Outside')

    await expect(
      createMarkdownFileService().readMarkdownFile(
        rootPath,
        join(outsidePath, 'outside.md')
      )
    ).rejects.toThrow(/outside workspace/i)
  })

  it('rejects Markdown symlinks that resolve outside the workspace', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))
    const outsidePath = await mkdtemp(join(tmpdir(), 'mde-outside-'))
    const outsideFilePath = join(outsidePath, 'outside.md')

    await writeFile(outsideFilePath, '# Outside')
    await symlink(outsideFilePath, join(rootPath, 'leak.md'))

    await expect(
      createMarkdownFileService().readMarkdownFile(rootPath, 'leak.md')
    ).rejects.toThrow(/outside workspace/i)
  })

  it('rejects Markdown symlinks that resolve to non-Markdown files inside the workspace', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))

    await writeFile(join(rootPath, 'secret.txt'), 'plain text')
    await symlink(join(rootPath, 'secret.txt'), join(rootPath, 'leak.md'))

    await expect(
      createMarkdownFileService().readMarkdownFile(rootPath, 'leak.md')
    ).rejects.toThrow(/markdown/i)
  })

  it('rejects Markdown hard links before reading', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))
    const outsidePath = await mkdtemp(join(tmpdir(), 'mde-outside-'))
    const outsideFilePath = join(outsidePath, 'outside.md')

    await writeFile(outsideFilePath, '# Outside')
    await link(outsideFilePath, join(rootPath, 'inside.md'))

    await expect(
      createMarkdownFileService().readMarkdownFile(rootPath, 'inside.md')
    ).rejects.toThrow(/hard-linked/i)
  })

  it('rejects Markdown hard links before writing and leaves the linked file unchanged', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))
    const outsidePath = await mkdtemp(join(tmpdir(), 'mde-outside-'))
    const outsideFilePath = join(outsidePath, 'outside.md')

    await writeFile(outsideFilePath, '# Outside')
    await link(outsideFilePath, join(rootPath, 'inside.md'))

    await expect(
      createMarkdownFileService().writeMarkdownFile(
        rootPath,
        'inside.md',
        '# Changed'
      )
    ).rejects.toThrow(/hard-linked/i)
    await expect(readFile(outsideFilePath, 'utf8')).resolves.toBe('# Outside')
  })

  it('writes Markdown files inside the workspace', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))
    await mkdir(join(rootPath, 'docs'))
    await writeFile(join(rootPath, 'docs', 'intro.md'), '# Intro')

    await createMarkdownFileService().writeMarkdownFile(
      rootPath,
      'docs/intro.md',
      '# Changed\n\nSaved from editor.\n'
    )

    await expect(readFile(join(rootPath, 'docs', 'intro.md'), 'utf8')).resolves.toBe(
      '# Changed\n\nSaved from editor.\n'
    )
  })

  it('saves pasted images beside the Markdown file under .mde/assets', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))

    await mkdir(join(rootPath, 'docs'))
    await writeFile(join(rootPath, 'docs', 'intro.md'), '# Intro')

    const result = await createMarkdownFileService().saveImageAsset(rootPath, {
      contents: new Uint8Array([137, 80, 78, 71]),
      fileName: 'clipboard.png',
      markdownFilePath: 'docs/intro.md',
      mimeType: 'image/png'
    })

    expect(result.markdownPath).toMatch(/^\.mde\/assets\/image-.+\.png$/)
    expect(result.fileUrl).toContain('/docs/.mde/assets/image-')
    await expect(
      readFile(join(rootPath, 'docs', result.markdownPath))
    ).resolves.toEqual(Buffer.from([137, 80, 78, 71]))
  })

  it('rejects non-image assets before writing clipboard content', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))

    await writeFile(join(rootPath, 'README.md'), '# Readme')

    await expect(
      createMarkdownFileService().saveImageAsset(rootPath, {
        contents: new Uint8Array([1, 2, 3]),
        fileName: 'notes.txt',
        markdownFilePath: 'README.md',
        mimeType: 'text/plain'
      })
    ).rejects.toThrow(/image/i)
    await expect(stat(join(rootPath, '.mde'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('rejects image asset writes through symlinked asset directories', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))
    const outsidePath = await mkdtemp(join(tmpdir(), 'mde-assets-outside-'))

    await writeFile(join(rootPath, 'README.md'), '# Readme')
    await mkdir(join(rootPath, '.mde'))
    await symlink(outsidePath, join(rootPath, '.mde', 'assets'))

    await expect(
      createMarkdownFileService().saveImageAsset(rootPath, {
        contents: new Uint8Array([137, 80, 78, 71]),
        fileName: 'clipboard.png',
        markdownFilePath: 'README.md',
        mimeType: 'image/png'
      })
    ).rejects.toThrow(/symlink/i)
  })

  it('rejects writes to non-Markdown files inside the workspace', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))

    await writeFile(join(rootPath, 'package.json'), '{}')

    await expect(
      createMarkdownFileService().writeMarkdownFile(
        rootPath,
        'package.json',
        '# Changed'
      )
    ).rejects.toThrow(/markdown/i)
    await expect(readFile(join(rootPath, 'package.json'), 'utf8')).resolves.toBe(
      '{}'
    )
  })

  it('rejects writes through symlinked parent paths', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))

    await mkdir(join(rootPath, 'realdir'))
    await writeFile(join(rootPath, 'realdir', 'file.md'), '# Original')
    await symlink(join(rootPath, 'realdir'), join(rootPath, 'linkdir'))

    await expect(
      createMarkdownFileService().writeMarkdownFile(
        rootPath,
        'linkdir/file.md',
        '# Changed'
      )
    ).rejects.toThrow(/symlink/i)
    await expect(readFile(join(rootPath, 'realdir', 'file.md'), 'utf8')).resolves.toBe(
      '# Original'
    )
  })

  it('creates Markdown files inside the workspace', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))

    const result = await createMarkdownFileService().createMarkdownFile(
      rootPath,
      'notes/today.md'
    )

    expect(result).toEqual({
      contents: '',
      path: 'notes/today.md'
    })
    await expect(readFile(join(rootPath, 'notes', 'today.md'), 'utf8')).resolves.toBe(
      ''
    )
  })

  it('rejects Markdown file creation in ignored workspace paths', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))

    await mkdir(join(rootPath, 'node_modules'))

    await expect(
      createMarkdownFileService().createMarkdownFile(
        rootPath,
        'node_modules/hidden.md'
      )
    ).rejects.toThrow(/unsupported/i)
    await expect(stat(join(rootPath, 'node_modules', 'hidden.md'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('rejects Markdown file creation through symlinked parent paths', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))

    await mkdir(join(rootPath, 'realdir'))
    await symlink(join(rootPath, 'realdir'), join(rootPath, 'linkdir'))

    await expect(
      createMarkdownFileService().createMarkdownFile(rootPath, 'linkdir/new.md')
    ).rejects.toThrow(/symlink/i)
    await expect(stat(join(rootPath, 'realdir', 'new.md'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('creates folders inside the workspace', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))

    await createMarkdownFileService().createFolder(rootPath, 'notes/daily')

    const createdFolderStats = await stat(join(rootPath, 'notes', 'daily'))

    expect(createdFolderStats.isDirectory()).toBe(true)
  })

  it('copies a Markdown file with its local .mde image assets into another folder', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))
    const imageBytes = Buffer.from([137, 80, 78, 71])

    await mkdir(join(rootPath, 'docs', '.mde', 'assets'), { recursive: true })
    await mkdir(join(rootPath, 'archive'))
    await writeFile(
      join(rootPath, 'docs', 'intro.md'),
      '# Intro\n\n![Hero](.mde/assets/hero.png)'
    )
    await writeFile(join(rootPath, 'docs', '.mde', 'assets', 'hero.png'), imageBytes)

    const result = await createMarkdownFileService().copyWorkspaceEntry(
      rootPath,
      'docs/intro.md',
      'archive'
    )

    expect(result).toEqual({
      path: 'archive/intro.md',
      type: 'file'
    })
    await expect(
      readFile(join(rootPath, 'archive', 'intro.md'), 'utf8')
    ).resolves.toBe('# Intro\n\n![Hero](.mde/assets/hero.png)')
    await expect(
      readFile(join(rootPath, 'archive', '.mde', 'assets', 'hero.png'))
    ).resolves.toEqual(imageBytes)
  })

  it('imports external Markdown files and rewrites relative image paths to .mde assets', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))
    const externalPath = await mkdtemp(join(tmpdir(), 'mde-external-'))
    const imageBytes = Buffer.from([137, 80, 78, 71])

    await mkdir(join(rootPath, 'docs'))
    await mkdir(join(externalPath, 'images'))
    await writeFile(
      join(externalPath, 'external.md'),
      '# External\n\n![Photo](images/photo.png)'
    )
    await writeFile(join(externalPath, 'images', 'photo.png'), imageBytes)

    const result = await createMarkdownFileService().pasteExternalEntries(
      rootPath,
      [join(externalPath, 'external.md')],
      'docs'
    )

    expect(result).toEqual([
      {
        path: 'docs/external.md',
        type: 'file'
      }
    ])
    await expect(
      readFile(join(rootPath, 'docs', 'external.md'), 'utf8')
    ).resolves.toBe('# External\n\n![Photo](.mde/assets/photo.png)')
    await expect(
      readFile(join(rootPath, 'docs', '.mde', 'assets', 'photo.png'))
    ).resolves.toEqual(imageBytes)
  })

  it('copies Markdown directories with nested .mde assets', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))
    const imageBytes = Buffer.from([137, 80, 78, 71])

    await mkdir(join(rootPath, 'docs', '.mde', 'assets'), { recursive: true })
    await mkdir(join(rootPath, 'archive'))
    await writeFile(
      join(rootPath, 'docs', 'intro.md'),
      '# Intro\n\n![Hero](.mde/assets/hero.png)'
    )
    await writeFile(join(rootPath, 'docs', '.mde', 'assets', 'hero.png'), imageBytes)

    const result = await createMarkdownFileService().copyWorkspaceEntry(
      rootPath,
      'docs',
      'archive'
    )

    expect(result).toEqual({
      path: 'archive/docs',
      type: 'directory'
    })
    await expect(
      readFile(join(rootPath, 'archive', 'docs', 'intro.md'), 'utf8')
    ).resolves.toBe('# Intro\n\n![Hero](.mde/assets/hero.png)')
    await expect(
      readFile(join(rootPath, 'archive', 'docs', '.mde', 'assets', 'hero.png'))
    ).resolves.toEqual(imageBytes)
  })

  it('rejects ignored folder creation targets', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))

    await expect(
      createMarkdownFileService().createFolder(rootPath, '.git')
    ).rejects.toThrow(/unsupported/i)
    await expect(stat(join(rootPath, '.git'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('rejects folder creation through symlinked parent paths', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))

    await mkdir(join(rootPath, 'realdir'))
    await symlink(join(rootPath, 'realdir'), join(rootPath, 'linkdir'))

    await expect(
      createMarkdownFileService().createFolder(rootPath, 'linkdir/new-folder')
    ).rejects.toThrow(/symlink/i)
    await expect(stat(join(rootPath, 'realdir', 'new-folder'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('renames files inside the workspace', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))
    await writeFile(join(rootPath, 'draft.md'), '# Draft')

    const result = await createMarkdownFileService().renameEntry(
      rootPath,
      'draft.md',
      'final.md'
    )

    expect(result).toEqual({
      path: 'final.md'
    })
    await expect(readFile(join(rootPath, 'final.md'), 'utf8')).resolves.toBe(
      '# Draft'
    )
    await expect(stat(join(rootPath, 'draft.md'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('rejects renames of non-Markdown files inside the workspace', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))

    await writeFile(join(rootPath, 'package.json'), '{}')

    await expect(
      createMarkdownFileService().renameEntry(
        rootPath,
        'package.json',
        'package.md'
      )
    ).rejects.toThrow(/markdown/i)
    await expect(readFile(join(rootPath, 'package.json'), 'utf8')).resolves.toBe(
      '{}'
    )
    await expect(stat(join(rootPath, 'package.md'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('rejects renames through symlinked parent paths', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))

    await mkdir(join(rootPath, 'realdir'))
    await writeFile(join(rootPath, 'realdir', 'file.md'), '# Original')
    await symlink(join(rootPath, 'realdir'), join(rootPath, 'linkdir'))

    await expect(
      createMarkdownFileService().renameEntry(
        rootPath,
        'linkdir/file.md',
        'linkdir/renamed.md'
      )
    ).rejects.toThrow(/symlink/i)
    await expect(readFile(join(rootPath, 'realdir', 'file.md'), 'utf8')).resolves.toBe(
      '# Original'
    )
    await expect(stat(join(rootPath, 'realdir', 'renamed.md'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('deletes entries inside the workspace', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))
    await writeFile(join(rootPath, 'old.md'), '# Old')
    const absoluteEntryPath = await realpath(join(rootPath, 'old.md'))
    const moveEntryToTrash = vi.fn(async (entryPath: string) => {
      await rm(entryPath, { force: false, recursive: true })
    })

    await createMarkdownFileService({ moveEntryToTrash }).deleteEntry(
      rootPath,
      'old.md'
    )

    expect(moveEntryToTrash).toHaveBeenCalledWith(absoluteEntryPath)
    await expect(stat(join(rootPath, 'old.md'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })

  it('rejects deletion of non-Markdown files inside the workspace', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))

    await writeFile(join(rootPath, 'package.json'), '{}')

    await expect(
      createMarkdownFileService().deleteEntry(rootPath, 'package.json')
    ).rejects.toThrow(/markdown/i)
    await expect(readFile(join(rootPath, 'package.json'), 'utf8')).resolves.toBe(
      '{}'
    )
  })

  it('rejects recursive deletion of directories containing unsupported entries', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))

    await mkdir(join(rootPath, 'notes'))
    await writeFile(join(rootPath, 'notes', 'keep.txt'), 'plain text')

    await expect(
      createMarkdownFileService().deleteEntry(rootPath, 'notes')
    ).rejects.toThrow(/unsupported/i)
    await expect(readFile(join(rootPath, 'notes', 'keep.txt'), 'utf8')).resolves.toBe(
      'plain text'
    )
  })

  it('rejects deletes through symlinked parent paths', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mde-markdown-'))

    await mkdir(join(rootPath, 'realdir'))
    await writeFile(join(rootPath, 'realdir', 'file.md'), '# Original')
    await symlink(join(rootPath, 'realdir'), join(rootPath, 'linkdir'))

    await expect(
      createMarkdownFileService().deleteEntry(rootPath, 'linkdir/file.md')
    ).rejects.toThrow(/symlink/i)
    await expect(readFile(join(rootPath, 'realdir', 'file.md'), 'utf8')).resolves.toBe(
      '# Original'
    )
  })
})
