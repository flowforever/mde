import { describe, expect, it } from 'vitest'

import type { TreeNode } from '@mde/editor-host/file-tree'
import { createDesktopEditorHost } from '../../src/renderer/src/editorHost/desktopEditorHost'

const document = { path: 'docs/current.md', workspaceRoot: '/workspace' }
const workspaceTree: readonly TreeNode[] = [
  { name: 'current.md', path: 'docs/current.md', type: 'file' }
]

describe('desktop editor host adapter', () => {
  it('maps editor host operations onto desktop editor callbacks', async () => {
    const calls: string[] = []
    const host = createDesktopEditorHost({
      createLinkedDocument: ({ requestedPath }) => {
        calls.push(`create:${requestedPath}`)
        return { path: requestedPath }
      },
      getWorkspaceTree: ({ document }) => {
        calls.push(`tree:${document.path}`)
        return { rootPath: '/workspace', tree: workspaceTree }
      },
      openLink: ({ href }) => {
        calls.push(`open:${href}`)
      },
      saveDocument: ({ markdown, reason }) => {
        calls.push(`save:${reason}:${markdown}`)
        return { normalizedMarkdown: markdown, savedAt: '2026-05-04T00:00:00.000Z' }
      },
      uploadImage: ({ fileName, mimeType }) => {
        calls.push(`upload:${fileName}:${mimeType}`)
        return { src: '.mde/assets/image.png' }
      }
    })

    expect(host.capabilities).toEqual({
      canCreateLinkedDocument: true,
      canOpenLinks: true,
      canUploadImages: true,
      hasWorkspaceTree: true
    })
    await expect(
      host.saveDocument({ document, markdown: '# Updated', reason: 'manual' })
    ).resolves.toEqual({
      ok: true,
      value: {
        normalizedMarkdown: '# Updated',
        savedAt: '2026-05-04T00:00:00.000Z'
      }
    })
    await expect(
      host.uploadImage?.({
        bytes: new ArrayBuffer(8),
        document,
        fileName: 'image.png',
        mimeType: 'image/png'
      })
    ).resolves.toEqual({ ok: true, value: { src: '.mde/assets/image.png' } })
    await expect(
      host.createLinkedDocument?.({
        document,
        requestedPath: 'docs/created.md'
      })
    ).resolves.toEqual({ ok: true, value: { path: 'docs/created.md' } })
    await expect(host.openLink?.({ document, href: 'docs/target.md' })).resolves.toEqual({
      ok: true,
      value: undefined
    })
    await expect(host.getWorkspaceTree?.(document)).resolves.toEqual({
      ok: true,
      value: { rootPath: '/workspace', tree: workspaceTree }
    })
    expect(calls).toEqual([
      'save:manual:# Updated',
      'upload:image.png:image/png',
      'create:docs/created.md',
      'open:docs/target.md',
      'tree:docs/current.md'
    ])
  })

  it('returns structured host errors for missing or failed desktop callbacks', async () => {
    const host = createDesktopEditorHost({
      openLink: () => {
        throw new Error('Cannot open link')
      }
    })

    await expect(
      host.saveDocument({ document, markdown: '# Updated', reason: 'manual' })
    ).resolves.toEqual({
      ok: false,
      error: { code: 'unsupported', retryable: false }
    })
    await expect(host.openLink?.({ document, href: 'docs/target.md' })).resolves.toEqual({
      ok: false,
      error: {
        code: 'unknown',
        message: 'Cannot open link',
        retryable: false
      }
    })
    expect(host.capabilities).toEqual({
      canCreateLinkedDocument: false,
      canOpenLinks: true,
      canUploadImages: false,
      hasWorkspaceTree: false
    })
  })
})
