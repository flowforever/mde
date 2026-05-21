import * as fsPromises from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type {
  AutomationDiscoveredTaskSource,
  AutomationFlowSourceType,
  ParsedAutomationFlow
} from '@mde/automation-flow'
import { createAutomationDiscoverySourceSnapshotHash } from '@mde/automation-flow'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { filterValidDiscoveredSourcesForCurrentOwners } from '../../src/main/services/automation/automationDiscoveredSourceValidation'

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof fsPromises>()

  return {
    ...actual,
    readFile: vi.fn(actual.readFile)
  }
})

const createTempRoot = (prefix: string): Promise<string> =>
  fsPromises.mkdtemp(join(tmpdir(), prefix))

const createFlow = (
  sourceTypes: readonly AutomationFlowSourceType[] = ['workspace-markdown'],
  scope: ParsedAutomationFlow['scope'] = 'workspace'
): ParsedAutomationFlow =>
  Object.freeze({
    allowedEngines: ['codex'],
    confirmationPolicy: {
      fileWrites: 'automation-flow-controlled',
      highRisk: 'require-user',
      unclearScope: 'require-user'
    },
    defaultEngine: 'codex',
    executors: [],
    id: 'cache-flow',
    lifecycle: 'enabled',
    loopPolicy: {
      intervalMinutes: 15,
      maxActiveRuns: 1,
      mode: 'continuous',
      onBlocked: 'skip-and-continue',
      onEmpty: 'wait'
    },
    match: {
      taskPathGlobs: [
        '.mde/docs/bugs/**/*.md',
        '.mde/docs/requirements/**/*.md'
      ],
      titleIncludes: ['READY']
    },
    name: 'Cache Flow',
    pickOrder: ['.mde/docs/bugs/**/*.md', '.mde/docs/requirements/**/*.md'],
    priority: 100,
    reportPattern: 'Report verification.',
    scope,
    sections: {
      acceptanceStandard: 'Complete the task.',
      executionStandard: 'Run the task.',
      pickRules: 'Pick ready tasks.',
      reportPattern: 'Report verification.',
      verificationExpectations: 'Run tests.'
    },
    sourceTypes,
    status: 'formal'
  } satisfies ParsedAutomationFlow)

const readyMarkdown = (title = 'READY Cached task'): string => `---
automation:
  status: ready
---
# ${title}
`

const sourceForPath = ({
  sourcePath,
  workspaceRoot
}: {
  readonly sourcePath: string
  readonly workspaceRoot: string
}): AutomationDiscoveredTaskSource =>
  Object.freeze({
    automationFlowId: 'cache-flow',
    automationFlowOwnerKey: 'owner:cache-flow',
    discoveredAt: '2026-05-10T08:00:00.000Z',
    relativePath: sourcePath.replace(`${workspaceRoot}/`, ''),
    sourceItemId: `source:${sourcePath}`,
    sourcePath,
    sourceSnapshotHash: `hash:${sourcePath}`,
    sourceType: 'workspace-markdown',
    title: 'READY Cached task',
    workspaceId: workspaceRoot
  })

const filterSources = async ({
  flow = createFlow(),
  sources,
  workspaceRoot
}: {
  readonly flow?: ParsedAutomationFlow
  readonly sources: readonly AutomationDiscoveredTaskSource[]
  readonly workspaceRoot: string
}): Promise<readonly AutomationDiscoveredTaskSource[]> =>
  filterValidDiscoveredSourcesForCurrentOwners({
    automationFlows: [flow],
    ownerKeyByFlow: new Map([[flow, 'owner:cache-flow']]),
    sources,
    workspaceRoot
  })

describe('filterValidDiscoveredSourcesForCurrentOwners', () => {
  afterEach(() => {
    vi.mocked(fsPromises.readFile).mockClear()
  })

  it('filters a cached local source when the file no longer exists', async () => {
    const workspaceRoot = await createTempRoot('mde-cache-workspace-')
    const missingPath = join(workspaceRoot, '.mde', 'docs', 'bugs', 'missing.md')
    const source = sourceForPath({ sourcePath: missingPath, workspaceRoot })

    await expect(filterSources({ sources: [source], workspaceRoot })).resolves
      .toEqual([])
  })

  it('filters a cached local source that moved under done', async () => {
    const workspaceRoot = await createTempRoot('mde-cache-workspace-')
    const sourcePath = join(
      workspaceRoot,
      '.mde',
      'docs',
      'bugs',
      'done',
      'ready.md'
    )

    await fsPromises.mkdir(join(workspaceRoot, '.mde', 'docs', 'bugs', 'done'), {
      recursive: true
    })
    await fsPromises.writeFile(sourcePath, readyMarkdown(), 'utf8')

    const source = sourceForPath({ sourcePath, workspaceRoot })

    await expect(filterSources({ sources: [source], workspaceRoot })).resolves
      .toEqual([])
  })

  it('filters a cached local source that moved under archived', async () => {
    const workspaceRoot = await createTempRoot('mde-cache-workspace-')
    const sourcePath = join(
      workspaceRoot,
      '.mde',
      'docs',
      'requirements',
      'archived',
      'ready.md'
    )

    await fsPromises.mkdir(
      join(workspaceRoot, '.mde', 'docs', 'requirements', 'archived'),
      {
        recursive: true
      }
    )
    await fsPromises.writeFile(sourcePath, readyMarkdown(), 'utf8')

    const source = sourceForPath({ sourcePath, workspaceRoot })

    await expect(filterSources({ sources: [source], workspaceRoot })).resolves
      .toEqual([])
  })

  it('filters a cached local source that is no longer ready', async () => {
    const workspaceRoot = await createTempRoot('mde-cache-workspace-')
    const sourcePath = join(
      workspaceRoot,
      '.mde',
      'docs',
      'requirements',
      'draft.md'
    )

    await fsPromises.mkdir(join(workspaceRoot, '.mde', 'docs', 'requirements'), {
      recursive: true
    })
    await fsPromises.writeFile(sourcePath, '# Draft cached task\n', 'utf8')

    const source = sourceForPath({ sourcePath, workspaceRoot })

    await expect(filterSources({ sources: [source], workspaceRoot })).resolves
      .toEqual([])
  })

  it('filters an existing ready cached local source outside the current task path globs', async () => {
    const workspaceRoot = await createTempRoot('mde-cache-workspace-')
    const sourcePath = join(workspaceRoot, '.mde', 'docs', 'tasks', 'ready.md')

    await fsPromises.mkdir(join(workspaceRoot, '.mde', 'docs', 'tasks'), {
      recursive: true
    })
    await fsPromises.writeFile(sourcePath, readyMarkdown(), 'utf8')

    const source = sourceForPath({ sourcePath, workspaceRoot })

    await expect(filterSources({ sources: [source], workspaceRoot })).resolves
      .toEqual([])
  })

  it('keeps a cached local source that still exists inside active roots and is ready', async () => {
    const workspaceRoot = await createTempRoot('mde-cache-workspace-')
    const sourcePath = join(
      workspaceRoot,
      '.mde',
      'docs',
      'requirements',
      'ready.md'
    )
    const source = sourceForPath({ sourcePath, workspaceRoot })
    const markdown = readyMarkdown('Cached task from status')

    await fsPromises.mkdir(join(workspaceRoot, '.mde', 'docs', 'requirements'), {
      recursive: true
    })
    await fsPromises.writeFile(sourcePath, markdown, 'utf8')

    await expect(filterSources({ sources: [source], workspaceRoot })).resolves
      .toEqual([
        expect.objectContaining({
          automationFlowId: source.automationFlowId,
          automationFlowOwnerKey: source.automationFlowOwnerKey,
          contentSnapshot: markdown,
          relativePath: '.mde/docs/requirements/ready.md',
          sourceItemId: source.sourceItemId,
          sourcePath,
          sourceType: 'workspace-markdown',
          title: 'Cached task from status'
        })
      ])
  })

  it('filters a symlinked cached workspace task path before reading it', async () => {
    const workspaceRoot = await createTempRoot('mde-cache-workspace-')
    const outsideRoot = await createTempRoot('mde-cache-outside-')
    const outsidePath = join(outsideRoot, 'ready.md')
    const sourcePath = join(
      workspaceRoot,
      '.mde',
      'docs',
      'requirements',
      'linked-ready.md'
    )

    await fsPromises.mkdir(join(workspaceRoot, '.mde', 'docs', 'requirements'), {
      recursive: true
    })
    await fsPromises.writeFile(outsidePath, readyMarkdown('Linked ready task'), 'utf8')
    await fsPromises.symlink(outsidePath, sourcePath)

    const source = sourceForPath({ sourcePath, workspaceRoot })

    vi.mocked(fsPromises.readFile).mockClear()

    await expect(filterSources({ sources: [source], workspaceRoot })).resolves
      .toEqual([])
    expect(fsPromises.readFile).not.toHaveBeenCalledWith(sourcePath, 'utf8')
  })

  it('filters a cached user-prompt source with an arbitrary absolute path before reading it', async () => {
    const workspaceRoot = await createTempRoot('mde-cache-workspace-')
    const outsideRoot = await createTempRoot('mde-cache-outside-')
    const sourcePath = join(outsideRoot, 'research.md')
    const flow = createFlow(['user-prompt'], 'user')
    const source: AutomationDiscoveredTaskSource = Object.freeze({
      automationFlowId: 'cache-flow',
      automationFlowOwnerKey: 'owner:cache-flow',
      discoveredAt: '2026-05-10T08:00:00.000Z',
      relativePath: 'research.md',
      sourceItemId: 'user-prompt:research.md',
      sourcePath,
      sourceSnapshotHash: 'stale-user-prompt-hash',
      sourceType: 'user-prompt',
      tags: ['research'],
      title: 'READY Cached research prompt'
    })

    await fsPromises.writeFile(
      sourcePath,
      readyMarkdown('READY Cached research prompt'),
      'utf8'
    )
    vi.mocked(fsPromises.readFile).mockClear()

    await expect(filterSources({ flow, sources: [source], workspaceRoot }))
      .resolves.toEqual([])
    expect(fsPromises.readFile).not.toHaveBeenCalledWith(sourcePath, 'utf8')
  })

  it('recomputes the source snapshot hash when current local content changes', async () => {
    const workspaceRoot = await createTempRoot('mde-cache-workspace-')
    const sourcePath = join(
      workspaceRoot,
      '.mde',
      'docs',
      'requirements',
      'ready.md'
    )
    const source = Object.freeze({
      ...sourceForPath({ sourcePath, workspaceRoot }),
      sourceSnapshotHash: 'stale-source-hash',
      tags: ['old'],
      title: 'READY Old cached title'
    } satisfies AutomationDiscoveredTaskSource)
    const markdown = `---
automation:
  status: ready
tags: current
---
# READY Current hash task
`

    await fsPromises.mkdir(join(workspaceRoot, '.mde', 'docs', 'requirements'), {
      recursive: true
    })
    await fsPromises.writeFile(sourcePath, markdown, 'utf8')

    const [currentedSource] = await filterSources({ sources: [source], workspaceRoot })

    expect(currentedSource?.sourceSnapshotHash).toBe(
      createAutomationDiscoverySourceSnapshotHash({
        automationFlow: createFlow(),
        source: {
          automationFlowOwnerKey: 'owner:cache-flow',
          contentSnapshot: markdown,
          relativePath: '.mde/docs/requirements/ready.md',
          sourceItemId: source.sourceItemId,
          sourcePath,
          sourceType: 'workspace-markdown',
          tags: ['current'],
          title: 'READY Current hash task',
          workspaceId: workspaceRoot
        }
      })
    )
    expect(currentedSource?.sourceSnapshotHash).not.toBe('stale-source-hash')
  })

  it('keeps a valid remote source that has no local source path', async () => {
    const workspaceRoot = await createTempRoot('mde-cache-workspace-')
    const flow = createFlow(['remote-issue'])
    const source: AutomationDiscoveredTaskSource = Object.freeze({
      automationFlowId: 'cache-flow',
      automationFlowOwnerKey: 'owner:cache-flow',
      discoveredAt: '2026-05-10T08:00:00.000Z',
      externalId: '42',
      provider: 'github',
      sourceItemId: 'github:flowforever/mde#42',
      sourceSnapshotHash: 'remote-hash',
      sourceType: 'remote-issue',
      sourceUri: 'https://github.com/flowforever/mde/issues/42',
      title: 'READY Remote cached task'
    })

    await expect(filterSources({ flow, sources: [source], workspaceRoot }))
      .resolves.toEqual([source])
  })

  it('filters a cached remote source that no longer matches the current source type', async () => {
    const workspaceRoot = await createTempRoot('mde-cache-workspace-')
    const flow = createFlow(['remote-issue'])
    const source: AutomationDiscoveredTaskSource = Object.freeze({
      automationFlowId: 'cache-flow',
      automationFlowOwnerKey: 'owner:cache-flow',
      discoveredAt: '2026-05-10T08:00:00.000Z',
      externalId: '42',
      provider: 'github',
      sourceItemId: 'github:flowforever/mde!42',
      sourceSnapshotHash: 'remote-hash',
      sourceType: 'remote-mr',
      sourceUri: 'https://github.com/flowforever/mde/pull/42',
      title: 'READY Remote cached task'
    })

    await expect(filterSources({ flow, sources: [source], workspaceRoot }))
      .resolves.toEqual([])
  })
})
