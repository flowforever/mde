import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createAiService } from '../../src/main/services/aiService'

type AiServiceOptions = NonNullable<Parameters<typeof createAiService>[0]>
type LocateCommand = NonNullable<AiServiceOptions['locateCommand']>
type RunPrompt = NonNullable<AiServiceOptions['runPrompt']>

const locateCommands = (
  paths: Partial<Record<'claude' | 'codex', string>>
): LocateCommand => (tool) => Promise.resolve(paths[tool.id] ?? null)

describe('aiService', () => {
  it('detects installed AI CLIs in supported order', async () => {
    const service = createAiService({
      locateCommand: locateCommands({
        claude: '/fake/claude',
        codex: '/fake/codex'
      }),
      runPrompt: () => Promise.resolve('unused')
    })

    await expect(service.detectTools()).resolves.toEqual([
      { commandPath: '/fake/codex', id: 'codex', name: 'Codex' },
      { commandPath: '/fake/claude', id: 'claude', name: 'Claude Code' }
    ])
  })

  it('generates and caches translations beside the source Markdown file', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-ai-service-'))
    let runPromptCalls = 0
    const runPrompt: RunPrompt = () => {
      runPromptCalls += 1

      return Promise.resolve('# English\n\nTranslated from fake CLI.')
    }
    const service = createAiService({
      locateCommand: locateCommands({ codex: '/fake/codex' }),
      runPrompt
    })

    await mkdir(join(workspacePath, 'docs'))
    await writeFile(join(workspacePath, 'docs', 'intro.md'), '# Intro\n\nHello.')

    const generated = await service.translateMarkdown(
      workspacePath,
      'docs/intro.md',
      '# Intro\n\nHello.',
      'English'
    )
    const cached = await service.translateMarkdown(
      workspacePath,
      'docs/intro.md',
      '# Intro\n\nHello.',
      'English'
    )

    expect(generated).toMatchObject({
      cached: false,
      contents: '# English\n\nTranslated from fake CLI.',
      path: 'docs/.mde/translations/intro.English.md',
      tool: { id: 'codex', name: 'Codex' }
    })
    expect(cached).toMatchObject({
      cached: true,
      contents: '# English\n\nTranslated from fake CLI.',
      path: 'docs/.mde/translations/intro.English.md'
    })
    expect(runPromptCalls).toBe(1)
    await expect(
      readFile(join(workspacePath, generated.path), 'utf8')
    ).resolves.toBe('# English\n\nTranslated from fake CLI.')
  })

  it('regenerates cached translations when source Markdown changes', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-ai-service-'))
    const promptResults = [
      '# English\n\nFirst result.',
      '# English\n\nSecond result.'
    ]
    let runPromptCalls = 0
    const runPrompt: RunPrompt = () =>
      Promise.resolve(promptResults[runPromptCalls++] ?? '# English')
    const service = createAiService({
      locateCommand: locateCommands({ codex: '/fake/codex' }),
      runPrompt
    })

    await writeFile(join(workspacePath, 'README.md'), '# Readme')

    await service.translateMarkdown(workspacePath, 'README.md', '# Readme', 'English')
    const regenerated = await service.translateMarkdown(
      workspacePath,
      'README.md',
      '# Readme\n\nChanged',
      'English'
    )

    expect(regenerated).toMatchObject({
      cached: false,
      contents: '# English\n\nSecond result.'
    })
    expect(runPromptCalls).toBe(2)
  })

  it('writes summaries to the translations directory as read-only source artifacts', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-ai-service-'))
    const service = createAiService({
      locateCommand: locateCommands({ claude: '/fake/claude' }),
      runPrompt: () => Promise.resolve('## Summary\n\n- Main point.')
    })

    await writeFile(join(workspacePath, 'README.md'), '# Readme')

    const result = await service.summarizeMarkdown(
      workspacePath,
      'README.md',
      '# Readme'
    )

    expect(result).toMatchObject({
      cached: false,
      contents: '## Summary\n\n- Main point.',
      path: '.mde/translations/README-summary.md',
      tool: { id: 'claude', name: 'Claude Code' }
    })
    await expect(
      readFile(join(workspacePath, '.mde', 'translations', 'README-summary.md'), 'utf8')
    ).resolves.toBe('## Summary\n\n- Main point.')
  })

  it('regenerates summaries when the refinement instruction changes', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-ai-service-'))
    const promptResults = [
      '## Summary\n\n- Initial summary.',
      '## Summary\n\n- Shorter summary.'
    ]
    const prompts: string[] = []
    let runPromptCalls = 0
    const runPrompt: RunPrompt = ({ prompt }) => {
      prompts.push(prompt)

      return Promise.resolve(promptResults[runPromptCalls++] ?? '## Summary')
    }
    const service = createAiService({
      locateCommand: locateCommands({ codex: '/fake/codex' }),
      runPrompt
    })

    await writeFile(join(workspacePath, 'README.md'), '# Readme')

    const initial = await service.summarizeMarkdown(
      workspacePath,
      'README.md',
      '# Readme'
    )
    const refined = await service.summarizeMarkdown(
      workspacePath,
      'README.md',
      '# Readme',
      'Make it shorter'
    )
    const cachedRefined = await service.summarizeMarkdown(
      workspacePath,
      'README.md',
      '# Readme',
      'Make it shorter'
    )

    expect(initial).toMatchObject({
      cached: false,
      contents: '## Summary\n\n- Initial summary.'
    })
    expect(refined).toMatchObject({
      cached: false,
      contents: '## Summary\n\n- Shorter summary.'
    })
    expect(cachedRefined).toMatchObject({
      cached: true,
      contents: '## Summary\n\n- Shorter summary.'
    })
    expect(runPromptCalls).toBe(2)
    expect(prompts[1]).toContain('Make it shorter')
    await expect(
      readFile(join(workspacePath, '.mde', 'translations', 'README-summary.md'), 'utf8')
    ).resolves.toBe('## Summary\n\n- Shorter summary.')
    await expect(
      readFile(
        join(workspacePath, '.mde', 'translations', 'README-summary.meta.json'),
        'utf8'
      ).then((contents) => JSON.parse(contents) as { instruction?: string })
    ).resolves.toMatchObject({
      instruction: 'Make it shorter'
    })
  })

  it('rejects translation writes through symlinked .mde directories', async () => {
    const { symlink } = await import('node:fs/promises')
    const workspacePath = await mkdtemp(join(tmpdir(), 'mde-ai-service-'))
    const outsidePath = await mkdtemp(join(tmpdir(), 'mde-ai-outside-'))
    const service = createAiService({
      locateCommand: locateCommands({ codex: '/fake/codex' }),
      runPrompt: () => Promise.resolve('# English')
    })

    await writeFile(join(workspacePath, 'README.md'), '# Readme')
    await symlink(outsidePath, join(workspacePath, '.mde'))

    await expect(
      service.translateMarkdown(workspacePath, 'README.md', '# Readme', 'English')
    ).rejects.toThrow(/symlink/i)
    await expect(stat(join(outsidePath, 'translations'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })
})
