import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { describe, expect, it } from 'vitest'

import {
  scanUserPromptSources,
  scanWorkspaceMarkdownSources
} from '../../src/main/services/automation/automationSourceScanner'

const createTempRoot = (prefix: string): Promise<string> =>
  mkdtemp(join(tmpdir(), prefix))

const readyMarkdown = (title: string): string => `---
automation:
  status: ready
---
# ${title}
`

describe('automationSourceScanner', () => {
  it('scans only default workspace .mde docs Markdown queues and ignores done files', async () => {
    const workspaceRoot = await createTempRoot('mde-workspace-')

    await mkdir(join(workspaceRoot, '.mde', 'docs', 'tasks', 'done'), {
      recursive: true
    })
    await mkdir(join(workspaceRoot, 'docs', 'requirements'), { recursive: true })
    await writeFile(
      join(workspaceRoot, '.mde', 'docs', 'tasks', 'ready.md'),
      readyMarkdown('Implement automation')
    )
    await writeFile(
      join(workspaceRoot, '.mde', 'docs', 'tasks', 'plain.txt'),
      'plain'
    )
    await writeFile(
      join(workspaceRoot, '.mde', 'docs', 'tasks', 'done', 'done.md'),
      readyMarkdown('Done automation')
    )
    await writeFile(
      join(workspaceRoot, 'docs', 'requirements', 'legacy.md'),
      readyMarkdown('Legacy requirement')
    )

    const result = await scanWorkspaceMarkdownSources({ workspaceRoot })

    expect(result.sourceItems).toMatchObject([
      {
        automationStatus: 'ready',
        relativePath: '.mde/docs/tasks/ready.md',
        sourceType: 'workspace-markdown',
        title: 'Implement automation'
      }
    ])
    expect(result.diagnostics).toEqual([])
  })

  it('reports malformed source frontmatter as diagnostics', async () => {
    const workspaceRoot = await createTempRoot('mde-workspace-')

    await mkdir(join(workspaceRoot, '.mde', 'docs', 'bugs'), {
      recursive: true
    })
    await writeFile(
      join(workspaceRoot, '.mde', 'docs', 'bugs', 'broken.md'),
      '---\nautomation:\n  status: [ready\n---\n# Broken'
    )

    const result = await scanWorkspaceMarkdownSources({ workspaceRoot })

    expect(result.sourceItems).toEqual([])
    expect(result.diagnostics).toMatchObject([
      {
        code: 'automationSource.invalidFrontmatter',
        severity: 'error'
      }
    ])
  })

  it('requires explicit ready status for user prompts', async () => {
    const userPromptRoot = await createTempRoot('mde-prompts-')

    await writeFile(join(userPromptRoot, 'draft.md'), '# READY Draft prompt')
    await writeFile(
      join(userPromptRoot, 'ready.md'),
      `${readyMarkdown('Research automation')}\nTags: research`
    )

    const result = await scanUserPromptSources({ userPromptRoot })

    expect(result.sourceItems).toMatchObject([
      {
        automationStatus: 'ready',
        sourceType: 'user-prompt',
        tags: ['research'],
        title: 'Research automation'
      }
    ])
  })
})
