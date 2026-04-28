import {
  mkdtemp,
  mkdir,
  readFile,
  stat,
  symlink,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createMarkdownFileService } from '../../src/main/services/markdownFileService'

describe('markdownFileService', () => {
  it('reads Markdown files inside the workspace', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mdv-markdown-'))
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

  it('rejects non-Markdown files', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mdv-markdown-'))
    await writeFile(join(rootPath, 'notes.txt'), 'plain text')

    await expect(
      createMarkdownFileService().readMarkdownFile(rootPath, 'notes.txt')
    ).rejects.toThrow(/markdown/i)
  })

  it('rejects paths outside the workspace', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mdv-markdown-'))
    const outsidePath = await mkdtemp(join(tmpdir(), 'mdv-outside-'))
    await writeFile(join(outsidePath, 'outside.md'), '# Outside')

    await expect(
      createMarkdownFileService().readMarkdownFile(
        rootPath,
        join(outsidePath, 'outside.md')
      )
    ).rejects.toThrow(/outside workspace/i)
  })

  it('rejects Markdown symlinks that resolve outside the workspace', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mdv-markdown-'))
    const outsidePath = await mkdtemp(join(tmpdir(), 'mdv-outside-'))
    const outsideFilePath = join(outsidePath, 'outside.md')

    await writeFile(outsideFilePath, '# Outside')
    await symlink(outsideFilePath, join(rootPath, 'leak.md'))

    await expect(
      createMarkdownFileService().readMarkdownFile(rootPath, 'leak.md')
    ).rejects.toThrow(/outside workspace/i)
  })

  it('rejects Markdown symlinks that resolve to non-Markdown files inside the workspace', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mdv-markdown-'))

    await writeFile(join(rootPath, 'secret.txt'), 'plain text')
    await symlink(join(rootPath, 'secret.txt'), join(rootPath, 'leak.md'))

    await expect(
      createMarkdownFileService().readMarkdownFile(rootPath, 'leak.md')
    ).rejects.toThrow(/markdown/i)
  })

  it('writes Markdown files inside the workspace', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mdv-markdown-'))
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

  it('creates Markdown files inside the workspace', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mdv-markdown-'))

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

  it('creates folders inside the workspace', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mdv-markdown-'))

    await createMarkdownFileService().createFolder(rootPath, 'notes/daily')

    const createdFolderStats = await stat(join(rootPath, 'notes', 'daily'))

    expect(createdFolderStats.isDirectory()).toBe(true)
  })

  it('renames files inside the workspace', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mdv-markdown-'))
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

  it('deletes entries inside the workspace', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'mdv-markdown-'))
    await writeFile(join(rootPath, 'old.md'), '# Old')

    await createMarkdownFileService().deleteEntry(rootPath, 'old.md')

    await expect(stat(join(rootPath, 'old.md'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })
})
