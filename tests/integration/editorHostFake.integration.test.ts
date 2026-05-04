import { describe, expect, it } from 'vitest'

import { createFakeEditorHost } from '@mde/editor-host/fake'

describe('fake editor host integration', () => {
  it('covers save, upload image, create linked document, open link, and workspace tree flows', async () => {
    const host = createFakeEditorHost({
      documents: {
        'README.md': '# Root'
      },
      workspaceTree: [
        { name: 'README.md', path: 'README.md', type: 'file' },
        {
          children: [{ name: 'intro.md', path: 'docs/intro.md', type: 'file' }],
          name: 'docs',
          path: 'docs',
          type: 'directory'
        }
      ]
    })
    const document = { path: 'README.md', workspaceRoot: '/workspace' }

    expect(
      await host.saveDocument({
        document,
        markdown: '# Updated',
        reason: 'idle-autosave'
      })
    ).toMatchObject({ ok: true })
    expect(
      await host.createLinkedDocument?.({
        document,
        requestedPath: 'docs/new.md'
      })
    ).toEqual({ ok: true, value: { path: 'docs/new.md' } })
    expect(
      await host.uploadImage?.({
        bytes: new ArrayBuffer(4),
        document,
        fileName: 'diagram.png',
        mimeType: 'image/png'
      })
    ).toEqual({ ok: true, value: { src: 'assets/diagram.png' } })
    expect(await host.openLink?.({ document, href: 'docs/intro.md' })).toEqual({
      ok: true,
      value: undefined
    })
    expect(await host.getWorkspaceTree?.(document)).toEqual({
      ok: true,
      value: {
        rootPath: '/workspace',
        tree: [
          { name: 'README.md', path: 'README.md', type: 'file' },
          {
            children: [
              { name: 'intro.md', path: 'docs/intro.md', type: 'file' }
            ],
            name: 'docs',
            path: 'docs',
            type: 'directory'
          }
        ]
      }
    })

    expect(host.openedLinks).toEqual(['docs/intro.md'])
    expect(host.readDocument('docs/new.md')).toBe('')
  })
})
