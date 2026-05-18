import {
  chmod,
  lstat,
  mkdir,
  readFile,
  realpath,
  rm,
  writeFile
} from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

import {
  expect,
  test,
  type ElectronApplication,
  type Locator,
  type Page
} from '@playwright/test'
import {
  getBuiltInAutomationFlowTemplate,
  renderAutomationFlowTemplate
} from '@mde/automation-flow'

import { buildElectronApp, launchElectronApp } from './support/electronApp'
import { createFixtureWorkspace } from './support/fixtureWorkspace'
import { COMPONENT_IDS } from '../../src/renderer/src/componentIds'

const E2E_TEST_TIMEOUT_MS = 120_000
const E2E_BUILD_TIMEOUT_MS = 900_000
const E2E_UI_READY_TIMEOUT_MS = 20_000
const REAL_CODEX_E2E_TIMEOUT_MS = 300_000
const isRealCodexE2eEnabled = process.env.MDE_E2E_REAL_CODEX === '1'

test.setTimeout(E2E_TEST_TIMEOUT_MS)

test.beforeAll(async ({ browserName }, testInfo) => {
  void browserName
  testInfo.setTimeout(E2E_BUILD_TIMEOUT_MS)
  await buildElectronApp()
})

const createFlowMarkdown = ({
  flowId,
  lifecycle,
  name,
  scope = 'workspace'
}: {
  readonly flowId: string
  readonly lifecycle: 'archived' | 'enabled'
  readonly name: string
  readonly scope?: 'user' | 'workspace'
}): string =>
  renderAutomationFlowTemplate(
    getBuiltInAutomationFlowTemplate(
      scope === 'user' ? 'research-and-notes' : 'local-dev-task'
    ),
    {
      defaultEngine: 'codex',
      flowId,
      name,
      scope
    }
  )
    .replace('lifecycle: enabled', `lifecycle: ${lifecycle}`)

const createExecutorMarkdown = (name: string): string =>
  [
    `# ${name}`,
    '',
    '## Purpose',
    '',
    'Run selected task data with the fake E2E adapter.',
    '',
    '## Steps',
    '',
    '1. Inspect the task data.',
    '2. Report the result.'
  ].join('\n')

const createSeedAutomationFlow = async ({
  executorIds = ['implementation'],
  flowId,
  lifecycle = 'enabled',
  name,
  rootPath,
  scope = 'workspace'
}: {
  readonly executorIds?: readonly string[]
  readonly flowId: string
  readonly lifecycle?: 'archived' | 'enabled'
  readonly name: string
  readonly rootPath: string
  readonly scope?: 'user' | 'workspace'
}): Promise<void> => {
  const flowRoot = join(rootPath, '.mde', 'automation-flows')
  const executorRoot = join(flowRoot, flowId)

  await mkdir(executorRoot, { recursive: true })
  await writeFile(
    join(flowRoot, `${flowId}.md`),
    createFlowMarkdown({
      flowId,
      lifecycle,
      name,
      scope
    }),
    'utf8'
  )
  await Promise.all(
    executorIds.map((executorId) =>
      writeFile(
        join(executorRoot, `${executorId}.md`),
        createExecutorMarkdown(executorId),
        'utf8'
      )
    )
  )
}

const createAutomationWorkspace = async (
  options: { readonly includeSeedFlows?: boolean } = {}
): Promise<string> => {
  const workspacePath = await createFixtureWorkspace()
  const taskRoot = join(workspacePath, '.mde', 'docs', 'tasks')

  await mkdir(taskRoot, { recursive: true })
  await writeFile(
    join(taskRoot, 'ready.md'),
    ['# READY Implement automation E2E', '', 'Verify the Automation Center path.'].join('\n'),
    'utf8'
  )

  if (options.includeSeedFlows) {
    await createSeedAutomationFlow({
      flowId: 'enabled-flow',
      lifecycle: 'enabled',
      name: 'Enabled Flow',
      rootPath: workspacePath
    })
    await createSeedAutomationFlow({
      flowId: 'archived-flow',
      lifecycle: 'archived',
      name: 'Archived Flow',
      rootPath: workspacePath
    })
  }

  return workspacePath
}

const writeAutomationSourceMarkdown = async ({
  body,
  relativePath,
  title,
  workspacePath
}: {
  readonly body: string
  readonly relativePath: string
  readonly title: string
  readonly workspacePath: string
}): Promise<string> => {
  const sourcePath = join(workspacePath, relativePath)

  await mkdir(dirname(sourcePath), { recursive: true })
  await writeFile(sourcePath, [`# ${title}`, '', body].join('\n'), 'utf8')

  return sourcePath
}

const createAutomationFakeCli = async (
  workspacePath: string
): Promise<{ readonly commandPath: string; readonly logPath: string }> => {
  const commandPath = join(workspacePath, 'fake-automation-cli.mjs')
  const logPath = join(workspacePath, 'fake-automation-cli.jsonl')

  await writeFile(
    commandPath,
    `#!/usr/bin/env node
import { appendFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const chunks = []
for await (const chunk of process.stdin) {
  chunks.push(Buffer.from(chunk))
}
const prompt = Buffer.concat(chunks).toString('utf8')
const runKind = process.env.MDE_AUTOMATION_RUN_KIND
const workspaceRoot = process.env.MDE_AUTOMATION_WORKSPACE_ROOT
const sessionId = process.env.MDE_AUTOMATION_ADAPTER_SESSION_ID || 'fake-session'
const logPath = process.env.MDE_FAKE_AUTOMATION_LOG

const emit = (event) => {
  console.log(JSON.stringify(event))
}

const createWorkspaceMarkdownSource = ({ relativePath, sourceItemId, title }) => {
  const sourcePath = join(workspaceRoot, relativePath)

  return {
    automationFlowId: process.env.MDE_AUTOMATION_FLOW_ID,
    contentSnapshot: readFileSync(sourcePath, 'utf8'),
    discoveredAt: '2026-05-10T08:00:00.000Z',
    provider: 'fake-cli',
    relativePath,
    sourceItemId,
    sourcePath,
    sourceSnapshotHash: 'fake-hash-' + sourceItemId,
    sourceType: 'workspace-markdown',
    sourceUri: 'file://' + sourcePath,
    title,
    workspaceId: workspaceRoot
  }
}

if (logPath) {
  appendFileSync(logPath, JSON.stringify({
    prompt,
    runKind,
    sessionId,
    taskSourcePath: process.env.MDE_AUTOMATION_TASK_SOURCE_PATH
  }) + '\\n')
}

emit({ type: 'session-started', adapterSessionId: sessionId })

if (runKind === 'discovery') {
  if (process.env.MDE_FAKE_AUTOMATION_SOURCE_MODE === 'user-prompt') {
    emit({
      type: 'discovered-task-sources',
      sources: [{
        automationFlowId: process.env.MDE_AUTOMATION_FLOW_ID,
        contentSnapshot: '# READY Use global prompt\\n',
        discoveredAt: '2026-05-10T08:00:00.000Z',
        provider: 'fake-cli',
        relativePath: 'research.md',
        sourceItemId: 'user-prompt:research.md',
        sourceSnapshotHash: 'fake-hash-user-prompt',
        sourceType: 'user-prompt',
        tags: ['research'],
        title: 'READY Use global prompt'
      }]
    })
    process.exit(0)
  }

  if (process.env.MDE_FAKE_AUTOMATION_SOURCE_MODE === 'workspace-matrix') {
    emit({
      type: 'discovered-task-sources',
      sources: [
        createWorkspaceMarkdownSource({
          relativePath: '.mde/docs/tasks/ready.md',
          sourceItemId: 'matrix-ready',
          title: 'READY Matrix ready task'
        }),
        createWorkspaceMarkdownSource({
          relativePath: '.mde/docs/bugs/needs-me.md',
          sourceItemId: 'matrix-needs-me',
          title: 'READY Matrix needs me bug'
        }),
        createWorkspaceMarkdownSource({
          relativePath: '.mde/docs/requirements/running.md',
          sourceItemId: 'matrix-running',
          title: 'READY Matrix running requirement'
        }),
        createWorkspaceMarkdownSource({
          relativePath: '.mde/docs/tasks/done.md',
          sourceItemId: 'matrix-done',
          title: 'READY Matrix done task'
        })
      ]
    })
    process.exit(0)
  }

  const sourcePath = join(workspaceRoot, '.mde', 'docs', 'tasks', 'ready.md')
  const contentSnapshot = readFileSync(sourcePath, 'utf8')
  emit({
    type: 'discovered-task-sources',
    sources: [{
      automationFlowId: process.env.MDE_AUTOMATION_FLOW_ID,
      contentSnapshot,
      discoveredAt: '2026-05-10T08:00:00.000Z',
      provider: 'fake-cli',
      relativePath: '.mde/docs/tasks/ready.md',
      sourceItemId: 'fake-cli:ready.md',
      sourcePath,
      sourceSnapshotHash: 'fake-hash-ready-md',
      sourceType: 'workspace-markdown',
      sourceUri: 'file://' + sourcePath,
      title: 'READY Implement automation E2E',
      workspaceId: workspaceRoot
    }]
  })
} else if (runKind === 'task') {
  const taskSourcePath = process.env.MDE_AUTOMATION_TASK_SOURCE_PATH || ''

  if (taskSourcePath.includes('needs-me.md')) {
    emit({
      type: 'phase-update',
      phaseTitle: 'Inspect the task',
      status: 'done'
    })
    emit({
      type: 'decision-required',
      prompt: 'Confirm the matrix needs-me task can continue.'
    })
    process.exit(0)
  }

  if (taskSourcePath.includes('running.md')) {
    emit({
      type: 'phase-update',
      phaseTitle: 'Inspect the task',
      status: 'running'
    })
    process.exit(0)
  }

  emit({
    type: 'phase-update',
    phaseTitle: 'Inspect the task',
    status: 'done'
  })
  emit({
    type: 'final-report',
    outcome: 'succeeded',
    summary: 'Fake CLI completed the task.',
    title: taskSourcePath.includes('done.md')
      ? 'READY Matrix done task'
      : 'READY Implement automation E2E'
  })
}
`,
    'utf8'
  )
  await chmod(commandPath, 0o755)

  return { commandPath, logPath }
}

const openAutomationCenter = async (
  app: ElectronApplication,
  window: Page
): Promise<Page> => {
  const automationWindowPromise = app.waitForEvent('window', {
    timeout: E2E_UI_READY_TIMEOUT_MS
  })

  await window.getByRole('button', { name: /open automation center/i }).click()

  const automationWindow = await automationWindowPromise

  await automationWindow.waitForLoadState('domcontentloaded')
  await expect(
    automationWindow.getByRole('main', { name: /automation center/i })
  ).toHaveAttribute('data-component-id', COMPONENT_IDS.automation.centerWindow)

  return automationWindow
}

const rememberRecentWorkspaceInRenderer = async (
  window: Page,
  workspacePath: string
): Promise<string> => {
  const rootPath = await realpath(workspacePath)

  await window.evaluate((workspace) => {
    const storageKey = 'mde.recentWorkspaces'
    const parsed = JSON.parse(
      globalThis.localStorage.getItem(storageKey) ?? '[]'
    ) as unknown
    const current: readonly unknown[] = Array.isArray(parsed) ? parsed : []

    globalThis.localStorage.setItem(
      storageKey,
      JSON.stringify([
        workspace,
        ...current.filter(
          (entry) =>
            !(
              typeof entry === 'object' &&
              entry !== null &&
              (entry as { readonly rootPath?: unknown }).rootPath ===
                workspace.rootPath
            )
        )
      ])
    )
  }, { name: basename(rootPath), rootPath, type: 'workspace' })

  return rootPath
}

const waitForAutomationCenterSteadyState = async (
  automationWindow: Page
): Promise<void> => {
  await expect(
    automationWindow.locator('.automation-console-pane')
  ).not.toHaveClass(/automation-console-pane--loading/u, {
    timeout: E2E_UI_READY_TIMEOUT_MS
  })
  await expect(
    automationWindow.getByRole('region', { name: 'Signal Stack' })
  ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })
  await expect(
    automationWindow.getByRole('region', { name: 'Flowline' })
  ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })
}

const readAutomationPrototypeLayout = async (
  automationWindow: Page
): Promise<{
  readonly flowlineLeft: number
  readonly flowlineWidth: number
  readonly signalLeft: number
  readonly signalRight: number
  readonly sidebarRight: number
  readonly sidebarWidth: number
}> =>
  automationWindow.evaluate((componentIds) => {
    const getRect = (componentId: string): DOMRect => {
      const element = document.querySelector(
        `[data-component-id="${componentId}"]`
      )

      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing Automation Center layout element ${componentId}`)
      }

      return element.getBoundingClientRect()
    }
    const sidebar = getRect(componentIds.workspaceFilters)
    const signalStack = getRect(componentIds.signalStack)
    const flowline = getRect(componentIds.flowline)

    return {
      flowlineLeft: flowline.left,
      flowlineWidth: flowline.width,
      signalLeft: signalStack.left,
      signalRight: signalStack.right,
      sidebarRight: sidebar.right,
      sidebarWidth: sidebar.width
    }
  }, {
    flowline: COMPONENT_IDS.automation.flowline,
    signalStack: COMPONENT_IDS.automation.signalStack,
    workspaceFilters: COMPONENT_IDS.automation.workspaceFilters
  })

const getExplorerAutomationProjection = async (
  window: Page
): Promise<{
  readonly flows: readonly {
    readonly executors: readonly {
      readonly displayName: string
      readonly executorId: string
      readonly sourcePath?: string
      readonly type: string
    }[]
    readonly id: string
    readonly name: string
    readonly scope: string
    readonly sourceFile?: string
  }[]
}> =>
  window.evaluate(async () => {
    const automationApi = (
      globalThis as typeof globalThis & {
        readonly mdeAutomation?: {
          readonly getExplorerAutomationProjection: () => Promise<{
            readonly projection: {
              readonly flows: readonly {
                readonly executors: readonly {
                  readonly displayName: string
                  readonly executorId: string
                  readonly sourcePath?: string
                  readonly type: string
                }[]
                readonly id: string
                readonly name: string
                readonly scope: string
                readonly sourceFile?: string
              }[]
            }
          }>
        }
      }
    ).mdeAutomation
    const projection = await automationApi?.getExplorerAutomationProjection()

    return { flows: projection?.projection.flows ?? [] }
  })

const expectNormalEditorOpen = async (
  window: Page,
  fileName: string
): Promise<void> => {
  await expect(window).toHaveTitle(new RegExp(`${fileName.replace('.', '\\.')} - `))
  await expect(
    window.locator(
      `[data-component-id="${COMPONENT_IDS.editor.markdownEditingSurface}"]`
    )
  ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })
  await expect(
    window.locator(`[data-component-id="${COMPONENT_IDS.automation.editorHost}"]`)
  ).toHaveCount(0)
}

const expandDetailsCard = async (page: Page, details: Locator): Promise<void> => {
  const summaryBox = await details.locator('summary').boundingBox()

  if (!summaryBox) {
    throw new Error('Details summary is not visible')
  }

  await page.mouse.click(summaryBox.x + 12, summaryBox.y + summaryBox.height / 2)
  await expect
    .poll(() =>
      details.evaluate((element) => (element as HTMLDetailsElement).open)
    )
    .toBe(true)
}

const createWorkspaceAutomationFlowFromExplorer = async (
  window: Page,
  beforeExecutor?: (flow: {
    readonly id: string
    readonly name: string
    readonly sourceFile?: string
  }) => Promise<void>
): Promise<{
  readonly executorId: string
  readonly executorPath: string
  readonly flowId: string
  readonly flowPath: string
}> => {
  await window
    .getByRole('button', { name: 'Add automation flow' })
    .click()
  await expect(window).toHaveTitle(/automation-flow-\d+\.md - /)
  const createdFlowFileName = (await window.title()).split(' - ')[0]

  await expect
    .poll(async () => {
      const projection = await getExplorerAutomationProjection(window)

      return projection.flows.find(
        (candidate) =>
          candidate.scope === 'workspace' &&
          candidate.sourceFile !== undefined &&
          basename(candidate.sourceFile) === createdFlowFileName
      )
    }, { timeout: E2E_UI_READY_TIMEOUT_MS })
    .toBeTruthy()
  const flow = await getExplorerAutomationProjection(window).then(
    (projection) => {
      const created = projection.flows.find(
        (candidate) =>
          candidate.scope === 'workspace' &&
          candidate.sourceFile !== undefined &&
          basename(candidate.sourceFile) === createdFlowFileName
      )

      if (!created?.sourceFile) {
        throw new Error('Explorer did not create a workspace automation flow')
      }

      return {
        ...created,
        sourceFile: created.sourceFile
      }
    }
  )

  await expectNormalEditorOpen(window, basename(flow.sourceFile))
  await beforeExecutor?.(flow)
  await window
    .getByRole('button', { name: `Add executor to ${flow.name}` })
    .click()

  await expect
    .poll(async () => {
      const projection = await getExplorerAutomationProjection(window)
      const currentFlow = projection.flows.find(
        (candidate) => candidate.id === flow.id
      )

      return currentFlow?.executors.find(
        (candidate) =>
          candidate.type === 'markdown' &&
          candidate.executorId !== 'implementation' &&
          candidate.sourcePath !== undefined
      )
    }, { timeout: E2E_UI_READY_TIMEOUT_MS })
    .toBeTruthy()
  const executor = await getExplorerAutomationProjection(window).then(
    (projection) => {
      const currentFlow = projection.flows.find(
        (candidate) => candidate.id === flow.id
      )
      const created = currentFlow?.executors.find(
        (candidate) =>
          candidate.type === 'markdown' &&
          candidate.executorId !== 'implementation' &&
          candidate.sourcePath !== undefined
      )

      if (!created?.sourcePath) {
        throw new Error('Explorer did not create a Markdown executor')
      }

      return {
        ...created,
        sourcePath: created.sourcePath
      }
    }
  )

  await expectNormalEditorOpen(window, basename(executor.sourcePath))
  await window
    .getByRole('button', { name: `Open automation flow ${flow.name}` })
    .click()
  await expectNormalEditorOpen(window, basename(flow.sourceFile))
  await window
    .getByRole('button', { name: `Open Markdown executor ${executor.displayName}` })
    .click()
  await expectNormalEditorOpen(window, basename(executor.sourcePath))

  return {
    executorId: executor.executorId,
    executorPath: executor.sourcePath,
    flowId: flow.id,
    flowPath: flow.sourceFile
  }
}

const getAutomationRunIds = async (
  automationWindow: Page
): Promise<readonly string[]> =>
  automationWindow.evaluate(async () => {
    const automationApi = (
      globalThis as typeof globalThis & {
        readonly mdeAutomation?: {
          readonly getProjection: () => Promise<{
            readonly projection: {
              readonly runs: readonly {
                readonly runId: string
                readonly runKind: string
              }[]
            }
          }>
        }
      }
    ).mdeAutomation
    const projection = await automationApi?.getProjection()

    return (
      projection?.projection.runs
        .filter((run) => run.runKind === 'task')
        .map((run) => run.runId) ?? []
    )
  })

const getProjectedTaskTitles = async (
  automationWindow: Page
): Promise<readonly string[]> =>
  automationWindow.evaluate(async () => {
    const automationApi = (
      globalThis as typeof globalThis & {
        readonly mdeAutomation?: {
          readonly getProjection: () => Promise<{
            readonly projection: {
              readonly tasks: readonly { readonly title: string }[]
            }
          }>
        }
      }
    ).mdeAutomation
    const projection = await automationApi?.getProjection()

    return projection?.projection.tasks.map((task) => task.title) ?? []
  })

const getAutomationProjection = async (
  page: Page
): Promise<{
  readonly buckets: {
    readonly done: readonly { readonly title: string }[]
    readonly needsMe: readonly { readonly title: string }[]
    readonly ready: readonly { readonly title: string }[]
    readonly running: readonly { readonly title: string }[]
  }
  readonly filters: {
    readonly archivedVisible?: boolean
    readonly flowOwnerKeys?: readonly string[]
    readonly scopeIds?: readonly string[]
  }
  readonly flows: readonly {
    readonly automationFlowId: string
    readonly automationFlowOwnerKey?: string
    readonly lifecycle?: string
    readonly name: string
    readonly scope: string
    readonly workspaceId?: string
  }[]
  readonly runs: readonly {
    readonly executorId?: string
    readonly runKind: string
  }[]
  readonly tasks: readonly {
    readonly automationFlowId: string
    readonly automationFlowOwnerKey?: string
    readonly blockingDiagnostics?: readonly { readonly code: string }[]
    readonly bucket?: string
    readonly eligibleExecutors?: readonly {
      readonly displayName: string
      readonly executorId: string
    }[]
    readonly primaryExecutor?: { readonly executorId: string }
    readonly taskDataId?: string
    readonly taskDataSnapshotId?: string
    readonly taskId: string
    readonly title: string
  }[]
}> =>
  page.evaluate(async () => {
    const automationApi = (
      globalThis as typeof globalThis & {
        readonly mdeAutomation?: {
          readonly getProjection: () => Promise<{
            readonly projection: {
              readonly buckets: {
                readonly done: readonly { readonly title: string }[]
                readonly needsMe: readonly { readonly title: string }[]
                readonly ready: readonly { readonly title: string }[]
                readonly running: readonly { readonly title: string }[]
              }
              readonly filters: {
                readonly archivedVisible?: boolean
                readonly flowOwnerKeys?: readonly string[]
                readonly scopeIds?: readonly string[]
              }
              readonly flows: readonly {
                readonly automationFlowId: string
                readonly automationFlowOwnerKey?: string
                readonly lifecycle?: string
                readonly name: string
                readonly scope: string
                readonly workspaceId?: string
              }[]
              readonly runs: readonly {
                readonly executorId?: string
                readonly runKind: string
              }[]
              readonly tasks: readonly {
                readonly automationFlowId: string
                readonly automationFlowOwnerKey?: string
                readonly blockingDiagnostics?: readonly { readonly code: string }[]
                readonly bucket?: string
                readonly eligibleExecutors?: readonly {
                  readonly displayName: string
                  readonly executorId: string
                }[]
                readonly primaryExecutor?: { readonly executorId: string }
                readonly taskDataId?: string
                readonly taskDataSnapshotId?: string
                readonly taskId: string
                readonly title: string
              }[]
            }
          }>
        }
      }
    ).mdeAutomation
    const response = await automationApi?.getProjection()

    return {
      buckets: response?.projection.buckets ?? {
        done: [],
        needsMe: [],
        ready: [],
        running: []
      },
      filters: response?.projection.filters ?? {},
      flows: response?.projection.flows ?? [],
      runs: response?.projection.runs ?? [],
      tasks: response?.projection.tasks ?? []
    }
  })

const expectSignalStackToContainTask = async (
  automationWindow: Page,
  taskTitle: string
): Promise<void> => {
  await expect(
    automationWindow.getByRole('region', { name: 'Signal Stack' })
  ).toContainText(taskTitle, { timeout: E2E_UI_READY_TIMEOUT_MS })
}

const signalStackBucketKeys = {
  Done: 'done',
  'Needs me': 'needsMe',
  Ready: 'ready',
  Running: 'running'
} as const

type SignalStackBucketName = keyof typeof signalStackBucketKeys

const selectTaskStackBucket = async (
  automationWindow: Page,
  bucketName: SignalStackBucketName
): Promise<void> => {
  const bucketButton = automationWindow
    .locator('[data-component-id="automation.bucket-filter-button"]')
    .filter({ hasText: bucketName })

  await bucketButton.click()
  await expect(bucketButton).toHaveAttribute('aria-pressed', 'true', {
    timeout: E2E_UI_READY_TIMEOUT_MS
  })
  await waitForAutomationCenterSteadyState(automationWindow)
}

const waitForProjectionBucketTask = async (
  automationWindow: Page,
  bucketName: SignalStackBucketName,
  taskTitle: string
): Promise<void> => {
  const bucketKey = signalStackBucketKeys[bucketName]

  await expect
    .poll(async () => {
      const projection = await getAutomationProjection(automationWindow)

      return projection.buckets[bucketKey].map((task) => task.title)
    }, { timeout: E2E_UI_READY_TIMEOUT_MS })
    .toContain(taskTitle)
}

const selectReadyTaskForFlow = async (
  automationWindow: Page,
  flowText: string
): Promise<void> => {
  const taskRow = automationWindow
    .locator(`[data-component-id="${COMPONENT_IDS.automation.signalTaskRow}"]`)
    .filter({ hasText: flowText })
    .first()

  await expect(taskRow).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })
  await taskRow.click()
  await expect(
    automationWindow.getByRole('button', { name: 'Start with selected executor' })
  ).toBeEnabled({ timeout: E2E_UI_READY_TIMEOUT_MS })
}

const selectTaskByTitle = async (
  automationWindow: Page,
  taskTitle: string
): Promise<void> => {
  const taskRow = automationWindow
    .locator(`[data-component-id="${COMPONENT_IDS.automation.signalTaskRow}"]`)
    .filter({ hasText: taskTitle })
    .first()

  await expect(taskRow).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })
  await taskRow.click()
}

const selectTaskByTitleAndWaitForFlowline = async (
  automationWindow: Page,
  taskTitle: string,
  taskSourcePath: string
): Promise<void> => {
  await selectTaskByTitle(automationWindow, taskTitle)
  await expect(
    automationWindow.getByRole('region', { name: 'Flowline' })
  ).toContainText(taskSourcePath, { timeout: E2E_UI_READY_TIMEOUT_MS })
  await expect(
    automationWindow.getByRole('button', { name: 'Start with selected executor' })
  ).toBeEnabled({ timeout: E2E_UI_READY_TIMEOUT_MS })
}

const expectSelectedFlowlinePhaseStatus = async (
  automationWindow: Page,
  phaseTitle: string,
  phaseStatus: 'done' | 'needs-me' | 'pending' | 'ready' | 'running'
): Promise<void> => {
  await expect(
    automationWindow
      .locator(`[data-component-id="${COMPONENT_IDS.automation.flowlinePhase}"]`)
      .filter({ hasText: phaseTitle })
      .first()
  ).toHaveClass(new RegExp(`automation-flowline-phase--${phaseStatus}`), {
    timeout: E2E_UI_READY_TIMEOUT_MS
  })
}

const setAutomationFlowLifecycle = async (
  page: Page,
  filePath: string,
  lifecycle: 'disabled' | 'enabled'
): Promise<void> => {
  await page.evaluate(async (command) => {
    const automationApi = (
      globalThis as typeof globalThis & {
        readonly mdeAutomation?: {
          readonly setFlowLifecycle: (request: {
            readonly filePath: string
            readonly lifecycle: 'disabled' | 'enabled'
          }) => Promise<unknown>
        }
      }
    ).mdeAutomation

    await automationApi?.setFlowLifecycle(command)
  }, { filePath, lifecycle })
}

test('links the built-in automation-flow helper skill into AI tool skill roots on startup', async () => {
  const workspacePath = await createAutomationWorkspace()
  const { app, e2eUserDataPath, startupDiagnostics, window } =
    await launchElectronApp({
      args: [workspacePath]
    })

  try {
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })

    for (const skillRoot of [
      join(e2eUserDataPath, '.codex', 'skills', 'automation-flow-helper'),
      join(e2eUserDataPath, '.agents', 'skills', 'automation-flow-helper')
    ]) {
      await expect
        .poll(async () => {
          try {
            const metadata = await lstat(skillRoot)
            const markdown = await readFile(join(skillRoot, 'SKILL.md'), 'utf8')

            return {
              isSymbolicLink: metadata.isSymbolicLink(),
              markdown
            }
          } catch {
            return {
              isSymbolicLink: false,
              markdown: ''
            }
          }
        }, { timeout: E2E_UI_READY_TIMEOUT_MS })
        .toMatchObject({
          isSymbolicLink: true,
          markdown: expect.stringContaining('name: automation-flow-helper')
        })
    }

    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('opens Automation Center in a separate window and keeps the editor usable', async () => {
  const workspacePath = await createAutomationWorkspace()
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [workspacePath]
  })

  try {
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })

    const automationWindow = await openAutomationCenter(app, window)

    await expect(
      automationWindow.getByRole('region', { name: 'Signal Stack' })
    ).toBeVisible()
    await expect(automationWindow.locator('.automation-window-frame')).toHaveCount(0)
    await expect(automationWindow.locator('.automation-center-window')).toHaveCSS(
      'grid-template-columns',
      /\d+(?:\.\d+)?px 6px \d+(?:\.\d+)?px/
    )
    await expect(
      automationWindow.getByRole('region', { name: 'Task stack' })
    ).toBeVisible()
    await expect(
      automationWindow.getByRole('region', {
        name: 'Workspaces · flow filters'
      })
    ).toBeVisible()
    await expect(
      automationWindow.locator(
        '[data-component-id="automation.sidebar-resize-handle"]'
      )
    ).toBeVisible()
    await automationWindow
      .getByRole('button', { name: 'Return to workspace' })
      .click()
    await expect(window.locator('.app-shell')).toBeVisible()
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible()
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('opens Automation Center with the theme selected in the main window', async () => {
  const workspacePath = await createAutomationWorkspace()
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [workspacePath]
  })

  try {
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })

    const appShell = window.locator('.app-shell')

    await window.getByRole('button', { name: /change theme/i }).click()
    await expect(window.getByRole('dialog', { name: /settings/i })).toBeVisible()
    const followSystemSwitch = window.getByRole('switch', {
      name: /follow system appearance/i
    })

    if (await followSystemSwitch.isChecked()) {
      await followSystemSwitch.click()
    }

    await window.getByRole('radio', { name: /blue hour/i }).click()
    await expect(appShell).toHaveAttribute('data-theme', 'blue-hour')
    await expect(appShell).toHaveAttribute('data-theme-family', 'dark')
    await expect(appShell).toHaveAttribute('data-theme-mode', 'dark')
    await window.getByRole('button', { name: /close settings/i }).click()
    await expect(window.getByRole('dialog', { name: /settings/i })).toHaveCount(0)

    const automationWindow = await openAutomationCenter(app, window)
    const automationShell = automationWindow.getByRole('main', {
      name: /automation center/i
    })

    await expect(automationShell).toHaveAttribute('data-theme', 'blue-hour')
    await expect(automationShell).toHaveAttribute('data-theme-family', 'dark')
    await expect(automationShell).toHaveAttribute('data-theme-mode', 'dark')
    await expect(automationShell).toHaveAttribute('data-panel-family', 'dark')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('focuses the existing Automation Center on repeated Home clicks', async () => {
  const workspacePath = await createAutomationWorkspace()
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [workspacePath]
  })

  try {
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })

    const automationWindow = await openAutomationCenter(app, window)
    const windowCount = app.windows().length

    await window.getByRole('button', { name: /open automation center/i }).click()

    await expect
      .poll(() => app.windows().length, {
        timeout: E2E_UI_READY_TIMEOUT_MS
      })
      .toBe(windowCount)
    await expect(
      automationWindow.getByRole('main', { name: /automation center/i })
    ).toBeVisible()
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible()
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('shows actionable setup diagnostics and opens workspace automation-flow management', async () => {
  const workspacePath = await createAutomationWorkspace()
  const fakeCli = await createAutomationFakeCli(workspacePath)

  await createSeedAutomationFlow({
    flowId: 'broken-flow',
    name: 'Broken Flow',
    rootPath: workspacePath
  })
  const brokenFlowPath = join(
    workspacePath,
    '.mde',
    'automation-flows',
    'broken-flow.md'
  )
  const validFlowMarkdown = await readFile(brokenFlowPath, 'utf8')

  await writeFile(
    brokenFlowPath,
    validFlowMarkdown.replace(
      /\n## Verification Expectations\n[\s\S]*?\n## Report Pattern\n/u,
      '\n## Report Pattern\n'
    ),
    'utf8'
  )

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [workspacePath],
    env: {
      MDE_E2E_AUTOMATION_JSONL_ADAPTER: fakeCli.commandPath,
      MDE_FAKE_AUTOMATION_LOG: fakeCli.logPath
    }
  })

  try {
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })
    await window.evaluate(() => {
      globalThis.localStorage.setItem(
        'mde.explorerAutomationFlowsPanel',
        'collapsed'
      )
    })
    await window.reload({ waitUntil: 'domcontentloaded' })
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })

    const automationWindow = await openAutomationCenter(app, window)
    const diagnosticList = automationWindow.locator(
      `[data-component-id="${COMPONENT_IDS.automation.diagnosticList}"]`
    )

    await expect(diagnosticList).toContainText(
      'setup issue needs changes before tasks can appear',
      { timeout: E2E_UI_READY_TIMEOUT_MS }
    )
    await expect(diagnosticList).toContainText(
      'Missing required section Verification Expectations. Add this Markdown section to the automation-flow file.'
    )
    await expect(diagnosticList).toContainText('broken-flow.md')
    await expect(diagnosticList).toContainText(
      'Code: automationFlow.missingRequiredSection'
    )
    await expect
      .poll(
        () =>
          automationWindow.evaluate(async () => {
            const automationApi = (
              globalThis as typeof globalThis & {
                readonly mdeAutomation?: {
                  readonly getProjection: () => Promise<{
                    readonly projection: { readonly workspaceRoot?: string }
                  }>
                }
              }
            ).mdeAutomation
            const response = await automationApi?.getProjection()

            return response?.projection.workspaceRoot
          }),
        { timeout: E2E_UI_READY_TIMEOUT_MS }
      )
      .toBe(await realpath(workspacePath))
    const windowCountBeforeManagement = app.windows().length

    await diagnosticList
      .getByRole('button', { name: 'Open Automation Flows' })
      .click()
    await expect
      .poll(() => app.windows().length, {
        timeout: E2E_UI_READY_TIMEOUT_MS
      })
      .toBe(windowCountBeforeManagement)

    const automationFlowsPanel = window.locator(
      `[data-component-id="${COMPONENT_IDS.explorer.automationFlowsPanel}"]`
    )

    await expect(automationFlowsPanel).toBeVisible({
      timeout: E2E_UI_READY_TIMEOUT_MS
    })
    await expect(automationFlowsPanel).not.toHaveClass(/is-collapsed/u)
    await expect(
      automationFlowsPanel.getByRole('button', { name: 'Add automation flow' })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('lists recent workspace automation-flows in the enabled section without selecting them', async () => {
  const workspacePath = await createAutomationWorkspace()
  const sidecarWorkspacePath = await createAutomationWorkspace()

  await createSeedAutomationFlow({
    flowId: 'sidecar-flow',
    name: 'Sidecar Workspace Flow',
    rootPath: sidecarWorkspacePath
  })
  const fakeCli = await createAutomationFakeCli(workspacePath)

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [workspacePath],
    env: {
      MDE_E2E_AUTOMATION_JSONL_ADAPTER: fakeCli.commandPath,
      MDE_FAKE_AUTOMATION_LOG: fakeCli.logPath
    }
  })

  try {
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })

    const currentRootPath = await realpath(workspacePath)
    const sidecarRootPath = await rememberRecentWorkspaceInRenderer(
      window,
      sidecarWorkspacePath
    )

    await window.reload({ waitUntil: 'domcontentloaded' })
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })
    const automationWindow = await openAutomationCenter(app, window)
    await expect
      .poll(
        () =>
          automationWindow.evaluate(
            () => globalThis.localStorage.getItem('mde.recentWorkspaces') ?? ''
          ),
        { timeout: E2E_UI_READY_TIMEOUT_MS }
      )
      .toContain(sidecarRootPath)
    const workspaceFlows = automationWindow.getByRole('region', {
      name: 'Workspace flows'
    })
    const enabledSection = workspaceFlows.locator(
      `[data-component-id="${COMPONENT_IDS.automation.flowEnabledSection}"]`
    )
    const notEnabledSection = workspaceFlows.locator(
      `[data-component-id="${COMPONENT_IDS.automation.flowNotEnabledSection}"]`
    )

    await expect(enabledSection).toContainText(basename(sidecarRootPath), {
      timeout: E2E_UI_READY_TIMEOUT_MS
    })
    await expect(enabledSection).toContainText('Sidecar Workspace Flow')
    await expect(notEnabledSection).not.toContainText(basename(sidecarRootPath))
    await expect
      .poll(async () => (await getAutomationProjection(automationWindow)).filters.scopeIds)
      .toEqual([`workspace:${currentRootPath}`])
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('manages automation flows from Explorer and starts task data with the selected executor', async () => {
  const workspacePath = await createAutomationWorkspace()
  const fakeCli = await createAutomationFakeCli(workspacePath)

  await createSeedAutomationFlow({
    executorIds: ['implementation', 'reviewer'],
    flowId: 'selector-flow',
    name: 'Selector Flow',
    rootPath: workspacePath
  })

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [workspacePath],
    env: {
      MDE_E2E_AUTOMATION_JSONL_ADAPTER: fakeCli.commandPath,
      MDE_FAKE_AUTOMATION_LOG: fakeCli.logPath
    }
  })

  try {
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })

    const created = await createWorkspaceAutomationFlowFromExplorer(
      window,
      async (flow) => {
        await expect
          .poll(async () => {
            const projection = await getAutomationProjection(window)
            const task = projection.tasks.find(
              (candidate) => candidate.automationFlowId === flow.id
            )

            return task?.blockingDiagnostics?.length ?? 0
          }, { timeout: E2E_UI_READY_TIMEOUT_MS })
          .toBeGreaterThan(0)
      }
    )

    await expect(readFile(created.flowPath, 'utf8')).resolves.toContain(
      `id: ${created.flowId}`
    )
    await expect(readFile(created.executorPath, 'utf8')).resolves.toContain(
      '# Add executor'
    )

    await window.evaluate(async () => {
      const automationApi = (
        globalThis as typeof globalThis & {
          readonly mdeAutomation?: {
            readonly createFlowDraft: (request: {
              readonly displayName: string
              readonly flowId: string
              readonly scope: 'user'
            }) => Promise<unknown>
          }
        }
      ).mdeAutomation

      await automationApi?.createFlowDraft({
        displayName: 'Global Review Flow',
        flowId: 'global-review-flow',
        scope: 'user'
      })
    })
    await window
      .getByRole('button', { name: 'Refresh automation skills' })
      .click()
    await expect
      .poll(async () => {
        const projection = await getExplorerAutomationProjection(window)

        return projection.flows.some(
          (flow) => flow.id === 'global-review-flow' && flow.scope === 'user'
        )
      }, { timeout: E2E_UI_READY_TIMEOUT_MS })
      .toBe(true)
    await window
      .getByRole('button', { name: 'Apply global workflow' })
      .click()
    await expect
      .poll(async () => {
        const refs = JSON.parse(
          await readFile(
            join(
              workspacePath,
              '.mde',
              'automation-flows',
              '.applied-global-flows.json'
            ),
            'utf8'
          )
        ) as { readonly flowIds: readonly string[] }

        return refs.flowIds
      }, { timeout: E2E_UI_READY_TIMEOUT_MS })
      .toHaveLength(1)
    await expect(
      window.locator(
        `[data-component-id="${COMPONENT_IDS.explorer.jumpGlobalAutomationFlowButton}"]`
      ).first()
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })
    await window
      .locator(
        `[data-component-id="${COMPONENT_IDS.explorer.removeAppliedGlobalFlowButton}"]`
      )
      .first()
      .click()
    await expect
      .poll(async () => {
        const refs = JSON.parse(
          await readFile(
            join(
              workspacePath,
              '.mde',
              'automation-flows',
              '.applied-global-flows.json'
            ),
            'utf8'
          )
        ) as { readonly flowIds: readonly string[] }

        return refs.flowIds
      }, { timeout: E2E_UI_READY_TIMEOUT_MS })
      .toEqual([])

    const automationWindow = await openAutomationCenter(app, window)

    await expectSignalStackToContainTask(
      automationWindow,
      'READY Implement automation E2E'
    )
    const expectedWorkspaceScopeId = `workspace:${await realpath(workspacePath)}`

    await expect
      .poll(async () => (await getAutomationProjection(automationWindow)).filters.scopeIds)
      .toEqual([expectedWorkspaceScopeId])

    const initialProjection = await getAutomationProjection(automationWindow)
    const selectorFlow = initialProjection.flows.find(
      (flow) => flow.automationFlowId === 'selector-flow'
    )

    if (!selectorFlow?.workspaceId || !selectorFlow.automationFlowOwnerKey) {
      throw new Error('Selector flow was not projected with filter identities')
    }

    await automationWindow.evaluate(async (scopeId) => {
      const automationApi = (
        globalThis as typeof globalThis & {
          readonly mdeAutomation?: {
            readonly updateFilters: (request: {
              readonly filters: {
                readonly bucket: 'ready'
                readonly scopeIds: readonly string[]
              }
            }) => Promise<unknown>
          }
        }
      ).mdeAutomation

      await automationApi?.updateFilters({
        filters: {
          bucket: 'ready',
          scopeIds: [scopeId]
        }
      })
    }, `workspace:${selectorFlow.workspaceId}`)
    await automationWindow.reload({ waitUntil: 'domcontentloaded' })
    await expect
      .poll(async () => (await getAutomationProjection(automationWindow)).filters.scopeIds)
      .toEqual([`workspace:${selectorFlow.workspaceId}`])

    await automationWindow.evaluate(async (flowOwnerKey) => {
      const automationApi = (
        globalThis as typeof globalThis & {
          readonly mdeAutomation?: {
            readonly updateFilters: (request: {
              readonly filters: {
                readonly bucket: 'ready'
                readonly flowOwnerKeys: readonly string[]
              }
            }) => Promise<unknown>
          }
        }
      ).mdeAutomation

      await automationApi?.updateFilters({
        filters: {
          bucket: 'ready',
          flowOwnerKeys: [flowOwnerKey]
        }
      })
    }, selectorFlow.automationFlowOwnerKey)
    await automationWindow.reload({ waitUntil: 'domcontentloaded' })
    await expect
      .poll(async () => {
        const projection = await getAutomationProjection(automationWindow)

        return projection.tasks.every(
          (task) => task.automationFlowOwnerKey === selectorFlow.automationFlowOwnerKey
        )
      }, { timeout: E2E_UI_READY_TIMEOUT_MS })
      .toBe(true)
    await expect(
      automationWindow.locator(
        `[data-component-id="${COMPONENT_IDS.automation.executorSelector}"]`
      )
    ).toBeVisible()
    await automationWindow
      .locator(`[data-component-id="${COMPONENT_IDS.automation.executorSelector}"]`)
      .selectOption('reviewer')
    await automationWindow
      .getByRole('button', { name: 'Start with selected executor' })
      .click()
    await selectTaskStackBucket(automationWindow, 'Done')
    await expectSignalStackToContainTask(
      automationWindow,
      'READY Implement automation E2E'
    )
    await expect
      .poll(async () => {
        const projection = await getAutomationProjection(automationWindow)

        return projection.runs.some(
          (run) => run.runKind === 'task' && run.executorId === 'reviewer'
        )
      }, { timeout: E2E_UI_READY_TIMEOUT_MS })
      .toBe(true)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('manages global automation-flow executors from Explorer', async () => {
  const workspacePath = await createAutomationWorkspace()
  const globalFlowId = 'global-explorer-flow'
  let globalFlowPath: string | undefined

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [workspacePath]
  })

  try {
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })

    globalFlowPath = await window.evaluate(async (flowId) => {
      const automationApi = (
        globalThis as typeof globalThis & {
          readonly mdeAutomation?: {
            readonly createFlowDraft: (request: {
              readonly displayName: string
              readonly flowId: string
              readonly scope: 'user'
            }) => Promise<{ readonly path: string }>
          }
        }
      ).mdeAutomation

      const document = await automationApi?.createFlowDraft({
        displayName: 'Global Explorer Flow',
        flowId,
        scope: 'user'
      })

      if (!document) {
        throw new Error('Automation API did not create a global flow')
      }

      return document.path
    }, globalFlowId)
    await window
      .getByRole('button', { name: 'Refresh automation skills' })
      .click()
    await expect
      .poll(async () => {
        const projection = await getExplorerAutomationProjection(window)

        return projection.flows.some(
          (flow) => flow.id === globalFlowId && flow.scope === 'user'
        )
      }, { timeout: E2E_UI_READY_TIMEOUT_MS })
      .toBe(true)

    await window
      .getByRole('button', { name: 'Add executor to Global Explorer Flow' })
      .click()
    await expect
      .poll(async () => {
        const projection = await getExplorerAutomationProjection(window)
        const flow = projection.flows.find(
          (candidate) => candidate.id === globalFlowId
        )
        const created = flow?.executors.find(
          (candidate) =>
            candidate.type === 'markdown' &&
            candidate.executorId !== 'implementation' &&
            candidate.sourcePath !== undefined
        )

        return created?.sourcePath ?? null
      }, { timeout: E2E_UI_READY_TIMEOUT_MS })
      .not.toBeNull()

    const executor = await getExplorerAutomationProjection(window).then(
      (projection) => {
        const flow = projection.flows.find(
          (candidate) => candidate.id === globalFlowId
        )
        const created = flow?.executors.find(
          (candidate) =>
            candidate.type === 'markdown' &&
            candidate.executorId !== 'implementation' &&
            candidate.sourcePath !== undefined
        )

        if (!created?.sourcePath) {
          throw new Error('Explorer did not create a global Markdown executor')
        }

        return {
          ...created,
          sourcePath: created.sourcePath
        }
      }
    )

    await window
      .getByRole('button', {
        name: `Open Markdown executor ${executor.displayName}`
      })
      .click()
    await expectNormalEditorOpen(window, basename(executor.sourcePath))
    expect(globalFlowPath).toBeDefined()
    const createdGlobalFlowPath = globalFlowPath

    if (!createdGlobalFlowPath) {
      throw new Error('Global automation-flow path was not returned')
    }

    expect(
      executor.sourcePath.startsWith(join(dirname(createdGlobalFlowPath), globalFlowId))
    ).toBe(true)

    await window
      .getByRole('button', { name: 'Rename automation flow Global Explorer Flow' })
      .click()
    await window
      .getByRole('textbox', { name: 'Rename automation flow Global Explorer Flow' })
      .fill('Global Explorer Flow Renamed')
    await window.keyboard.press('Enter')
    await expect
      .poll(() => readFile(createdGlobalFlowPath, 'utf8'), {
        timeout: E2E_UI_READY_TIMEOUT_MS
      })
      .toContain('name: Global Explorer Flow Renamed')

    await window
      .getByRole('button', {
        name: 'Delete automation flow Global Explorer Flow Renamed'
      })
      .click()
    await expect
      .poll(async () => {
        try {
          await readFile(createdGlobalFlowPath, 'utf8')

          return false
        } catch {
          return true
        }
      }, { timeout: E2E_UI_READY_TIMEOUT_MS })
      .toBe(true)
    await expect
      .poll(async () => {
        try {
          await readFile(executor.sourcePath, 'utf8')

          return false
        } catch {
          return true
        }
      }, { timeout: E2E_UI_READY_TIMEOUT_MS })
      .toBe(true)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
    if (globalFlowPath) {
      await Promise.all([
        rm(globalFlowPath, { force: true }),
        rm(join(dirname(globalFlowPath), globalFlowId), {
          force: true,
          recursive: true
        })
      ])
    }
  }
})

test('creates a workspace automation-flow and projects a READY task', async () => {
  const workspacePath = await createAutomationWorkspace()
  const fakeCli = await createAutomationFakeCli(workspacePath)
  await createSeedAutomationFlow({
    flowId: 'continuous-flow',
    name: 'Continuous Flow',
    rootPath: workspacePath
  })
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [workspacePath],
    env: {
      MDE_E2E_AUTOMATION_JSONL_ADAPTER: fakeCli.commandPath,
      MDE_FAKE_AUTOMATION_LOG: fakeCli.logPath
    }
  })

  try {
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })

    const automationWindow = await openAutomationCenter(app, window)

    await expectSignalStackToContainTask(
      automationWindow,
      'READY Implement automation E2E'
    )
    await waitForAutomationCenterSteadyState(automationWindow)
    const layout = await readAutomationPrototypeLayout(automationWindow)

    expect(layout.sidebarWidth).toBeGreaterThanOrEqual(240)
    expect(layout.sidebarWidth).toBeLessThanOrEqual(276)
    expect(layout.sidebarRight).toBeLessThan(layout.signalLeft)
    expect(layout.signalRight).toBeLessThan(layout.flowlineLeft)
    expect(layout.flowlineWidth).toBeGreaterThanOrEqual(340)
    expect(layout.flowlineWidth).toBeLessThanOrEqual(430)
    const taskCard = automationWindow
      .locator('[data-component-id="automation.signal-task-row"]')
      .filter({ hasText: 'READY Implement automation E2E' })
      .filter({ hasText: 'continuous-flow' })

    await expect(taskCard).toHaveClass(/automation-task-card/u)
    await expect(taskCard).toContainText('Source: .mde/docs/tasks/ready.md')
    await expect(taskCard).toContainText('Inspect Flowline')
    await expect(taskCard.locator('.automation-task-badge')).toHaveCount(4)
    await expect(
      automationWindow.locator('[data-component-id="automation.flowline-phase"]')
    ).toHaveCount(3)
    await expect(
      automationWindow.locator(
        '[data-component-id="automation.flowline-close-button"]'
      )
    ).toBeVisible()
    await expect
      .poll(async () =>
        (await readFile(fakeCli.logPath, 'utf8'))
          .split(/\r?\n/u)
          .filter(Boolean)
          .map((line) => JSON.parse(line) as { readonly runKind?: string })
          .filter((record) => record.runKind === 'discovery').length
      )
      .toBeGreaterThanOrEqual(1)
    await expect(
      automationWindow.getByRole('region', { name: 'Signal Stack' })
    ).toContainText(basename(workspacePath))
    await expect(
      automationWindow
        .getByRole('region', { name: 'Signal Stack' })
        .getByText('Workspace', { exact: true })
    ).toHaveCount(0)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('runs discovery and task execution through a fake CLI executable', async () => {
  const workspacePath = await createAutomationWorkspace()
  const fakeCli = await createAutomationFakeCli(workspacePath)
  await createSeedAutomationFlow({
    flowId: 'continuous-flow',
    name: 'Continuous Flow',
    rootPath: workspacePath
  })
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [workspacePath],
    env: {
      MDE_E2E_AUTOMATION_JSONL_ADAPTER: fakeCli.commandPath,
      MDE_FAKE_AUTOMATION_LOG: fakeCli.logPath
    }
  })

  try {
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })

    const automationWindow = await openAutomationCenter(app, window)

    await expectSignalStackToContainTask(
      automationWindow,
      'READY Implement automation E2E'
    )
    await selectReadyTaskForFlow(automationWindow, 'continuous-flow')
    await automationWindow
      .getByRole('button', { name: 'Start with selected executor' })
      .click()
    await selectTaskStackBucket(automationWindow, 'Done')
    await expectSignalStackToContainTask(
      automationWindow,
      'READY Implement automation E2E'
    )
    const runHistory = automationWindow.getByRole('region', {
      name: 'Run history'
    })

    await expect(runHistory).toBeVisible()
    await expect
      .poll(() =>
        runHistory.evaluate((element) =>
          Math.round(element.getBoundingClientRect().height)
        )
      )
      .toBeGreaterThanOrEqual(320)
    await expect(runHistory).toContainText('READY Implement automation E2E')
    await expect(runHistory).toContainText('Done')
    await expect(runHistory).toContainText('codex')
    const discoveryRow = runHistory
      .locator(
        `[data-component-id="${COMPONENT_IDS.automation.runHistoryRow}"]`
      )
      .filter({ hasText: 'Continuous Flow discovery' })
      .first()

    await discoveryRow
      .getByRole('button', { name: /View run details for run/i })
      .click()
    const detailDialog = automationWindow.getByRole('dialog', {
      name: 'Run details'
    })

    await expect(detailDialog).toBeVisible()
    await expect(detailDialog).toContainText('Parse result')
    await expect(detailDialog).toContainText('READY Implement automation E2E')
    await expect(detailDialog).toContainText('Parse process')
    await expect(detailDialog).not.toContainText('MDE Automation Runtime Contract')
    await detailDialog.getByRole('button', { name: 'Close run details' }).click()

    await expect
      .poll(async () => {
        const log = await readFile(fakeCli.logPath, 'utf8')
        const entries = log
          .trim()
          .split(/\r?\n/u)
          .filter(Boolean)
          .map((line) => JSON.parse(line) as { readonly runKind: string; readonly prompt: string })
        const discoveryRuns = entries.filter(
          (entry) => entry.runKind === 'discovery'
        ).length

        return {
          discoveryRunsAtLeastInitial: discoveryRuns >= 1,
          taskPrompt: entries.find((entry) => entry.runKind === 'task')?.prompt
        }
      }, { timeout: E2E_UI_READY_TIMEOUT_MS })
      .toMatchObject({
        discoveryRunsAtLeastInitial: true,
        taskPrompt: expect.stringContaining('Verify the Automation Center path.')
      })
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('covers a valid automation-flow across lifecycle, task buckets, and Flowline states', async () => {
  const workspacePath = await createAutomationWorkspace()

  await Promise.all([
    writeAutomationSourceMarkdown({
      body: 'Leave this task ready so the user can inspect the ready Flowline.',
      relativePath: '.mde/docs/tasks/ready.md',
      title: 'READY Matrix ready task',
      workspacePath
    }),
    writeAutomationSourceMarkdown({
      body: 'This task should request user input before continuing.',
      relativePath: '.mde/docs/bugs/needs-me.md',
      title: 'READY Matrix needs me bug',
      workspacePath
    }),
    writeAutomationSourceMarkdown({
      body: 'This task should stay running after the adapter exits.',
      relativePath: '.mde/docs/requirements/running.md',
      title: 'READY Matrix running requirement',
      workspacePath
    }),
    writeAutomationSourceMarkdown({
      body: 'This task should complete successfully.',
      relativePath: '.mde/docs/tasks/done.md',
      title: 'READY Matrix done task',
      workspacePath
    })
  ])
  await createSeedAutomationFlow({
    flowId: 'matrix-flow',
    name: 'Matrix Flow',
    rootPath: workspacePath
  })
  const fakeCli = await createAutomationFakeCli(workspacePath)
  const resolvedWorkspacePath = await realpath(workspacePath)
  const flowPath = join(
    resolvedWorkspacePath,
    '.mde',
    'automation-flows',
    'matrix-flow.md'
  )
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [workspacePath],
    env: {
      MDE_E2E_AUTOMATION_JSONL_ADAPTER: fakeCli.commandPath,
      MDE_FAKE_AUTOMATION_LOG: fakeCli.logPath,
      MDE_FAKE_AUTOMATION_SOURCE_MODE: 'workspace-matrix'
    }
  })

  try {
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })

    await setAutomationFlowLifecycle(window, flowPath, 'disabled')
    const automationWindow = await openAutomationCenter(app, window)

    await expect
      .poll(async () => {
        const projection = await getAutomationProjection(automationWindow)

        return projection.flows.find(
          (flow) => flow.automationFlowId === 'matrix-flow'
        )?.lifecycle
      }, { timeout: E2E_UI_READY_TIMEOUT_MS })
      .toBe('disabled')
    expect(
      (await getAutomationProjection(automationWindow)).tasks.some(
        (task) => task.automationFlowId === 'matrix-flow'
      )
    ).toBe(false)

    const enabledFlowSection = automationWindow.locator(
      `[data-component-id="${COMPONENT_IDS.automation.flowEnabledSection}"]`
    )
    const matrixWorkspaceCard = enabledFlowSection
      .locator(`[data-component-id="${COMPONENT_IDS.automation.workspaceFilterCard}"]`)
      .filter({ hasText: basename(resolvedWorkspacePath) })
      .first()

    await expect(matrixWorkspaceCard).toBeVisible({
      timeout: E2E_UI_READY_TIMEOUT_MS
    })
    await expandDetailsCard(automationWindow, matrixWorkspaceCard)
    const enableMatrixFlowButton = matrixWorkspaceCard.getByRole('button', {
      name: 'Enable automation-flow Matrix Flow'
    })

    await expect(enableMatrixFlowButton).toBeVisible({
      timeout: E2E_UI_READY_TIMEOUT_MS
    })
    await enableMatrixFlowButton.click()
    await automationWindow.reload({ waitUntil: 'domcontentloaded' })
    await waitForAutomationCenterSteadyState(automationWindow)
    await expect
      .poll(async () => {
        const projection = await getAutomationProjection(automationWindow)

        return projection.flows.find(
          (flow) => flow.automationFlowId === 'matrix-flow'
        )?.lifecycle
      }, { timeout: E2E_UI_READY_TIMEOUT_MS })
      .toBe('enabled')
    await expect
      .poll(async () => {
        const projection = await getAutomationProjection(automationWindow)

        return projection.flows.find(
          (flow) => flow.automationFlowId === 'matrix-flow'
        )?.automationFlowOwnerKey
      }, { timeout: E2E_UI_READY_TIMEOUT_MS })
      .toBeTruthy()
    const matrixFlow = (await getAutomationProjection(automationWindow)).flows.find(
      (flow) => flow.automationFlowId === 'matrix-flow'
    )
    const matrixFlowOwnerKey = matrixFlow?.automationFlowOwnerKey
    const matrixScopeId =
      matrixFlow?.workspaceId === undefined
        ? undefined
        : `workspace:${matrixFlow.workspaceId}`

    if (matrixFlowOwnerKey === undefined || matrixScopeId === undefined) {
      throw new Error('Matrix flow was not projected with an owner key')
    }

    await automationWindow.evaluate(async ({ flowOwnerKey, scopeId }) => {
      const automationApi = (
        globalThis as typeof globalThis & {
          readonly mdeAutomation?: {
            readonly updateFilters: (request: {
              readonly filters: {
                readonly bucket: 'ready'
                readonly flowOwnerKeys: readonly string[]
                readonly scopeIds: readonly string[]
              }
            }) => Promise<unknown>
          }
        }
      ).mdeAutomation

      await automationApi?.updateFilters({
        filters: {
          bucket: 'ready',
          flowOwnerKeys: [flowOwnerKey],
          scopeIds: [scopeId]
        }
      })
    }, { flowOwnerKey: matrixFlowOwnerKey, scopeId: matrixScopeId })
    await automationWindow.reload({ waitUntil: 'domcontentloaded' })
    await waitForAutomationCenterSteadyState(automationWindow)
    await expect
      .poll(async () => {
        const projection = await getAutomationProjection(automationWindow)

        return projection.filters.flowOwnerKeys
      }, { timeout: E2E_UI_READY_TIMEOUT_MS })
      .toEqual([matrixFlowOwnerKey])
    await expect
      .poll(async () => {
        const projection = await getAutomationProjection(automationWindow)

        return projection.buckets.ready
          .map((task) => task.title)
          .sort()
      }, { timeout: E2E_UI_READY_TIMEOUT_MS })
      .toEqual([
        'READY Matrix done task',
        'READY Matrix needs me bug',
        'READY Matrix ready task',
        'READY Matrix running requirement'
      ])
    await automationWindow.reload({ waitUntil: 'domcontentloaded' })
    await waitForAutomationCenterSteadyState(automationWindow)

    await selectTaskByTitle(automationWindow, 'READY Matrix ready task')
    await expect(
      automationWindow.getByRole('region', { name: 'Flowline' })
    ).toContainText('.mde/docs/tasks/ready.md')
    await expectSelectedFlowlinePhaseStatus(
      automationWindow,
      'Run the owning automation-flow',
      'ready'
    )
    await expectSelectedFlowlinePhaseStatus(
      automationWindow,
      'Verify the engine result',
      'pending'
    )
    await expect(
      automationWindow.getByRole('button', { name: 'Start with selected executor' })
    ).toBeEnabled()

    await selectTaskByTitleAndWaitForFlowline(
      automationWindow,
      'READY Matrix done task',
      '.mde/docs/tasks/done.md'
    )
    await automationWindow
      .getByRole('button', { name: 'Start with selected executor' })
      .click()
    await waitForProjectionBucketTask(
      automationWindow,
      'Done',
      'READY Matrix done task'
    )
    await automationWindow.reload({ waitUntil: 'domcontentloaded' })
    await waitForAutomationCenterSteadyState(automationWindow)
    await selectTaskStackBucket(automationWindow, 'Done')
    await expectSignalStackToContainTask(
      automationWindow,
      'READY Matrix done task'
    )
    await selectTaskByTitle(automationWindow, 'READY Matrix done task')
    await expectSelectedFlowlinePhaseStatus(
      automationWindow,
      'Run the owning automation-flow',
      'done'
    )
    await expectSelectedFlowlinePhaseStatus(
      automationWindow,
      'Verify the engine result',
      'done'
    )

    await selectTaskStackBucket(automationWindow, 'Ready')
    await selectTaskByTitleAndWaitForFlowline(
      automationWindow,
      'READY Matrix running requirement',
      '.mde/docs/requirements/running.md'
    )
    await automationWindow
      .getByRole('button', { name: 'Start with selected executor' })
      .click()
    await waitForProjectionBucketTask(
      automationWindow,
      'Running',
      'READY Matrix running requirement'
    )
    await automationWindow.reload({ waitUntil: 'domcontentloaded' })
    await waitForAutomationCenterSteadyState(automationWindow)
    await selectTaskStackBucket(automationWindow, 'Running')
    await expectSignalStackToContainTask(
      automationWindow,
      'READY Matrix running requirement'
    )
    await selectTaskByTitle(automationWindow, 'READY Matrix running requirement')
    await expectSelectedFlowlinePhaseStatus(
      automationWindow,
      'Run the owning automation-flow',
      'running'
    )
    await expectSelectedFlowlinePhaseStatus(
      automationWindow,
      'Verify the engine result',
      'pending'
    )

    await selectTaskStackBucket(automationWindow, 'Ready')
    await selectTaskByTitleAndWaitForFlowline(
      automationWindow,
      'READY Matrix needs me bug',
      '.mde/docs/bugs/needs-me.md'
    )
    await automationWindow
      .getByRole('button', { name: 'Start with selected executor' })
      .click()
    await waitForProjectionBucketTask(
      automationWindow,
      'Needs me',
      'READY Matrix needs me bug'
    )
    await automationWindow.reload({ waitUntil: 'domcontentloaded' })
    await waitForAutomationCenterSteadyState(automationWindow)
    await selectTaskStackBucket(automationWindow, 'Needs me')
    await expectSignalStackToContainTask(
      automationWindow,
      'READY Matrix needs me bug'
    )
    await selectTaskByTitle(automationWindow, 'READY Matrix needs me bug')
    await expectSelectedFlowlinePhaseStatus(
      automationWindow,
      'Run the owning automation-flow',
      'needs-me'
    )
    await expect(
      automationWindow.getByRole('region', { name: 'Decision required' })
    ).toContainText('Confirm the matrix needs-me task can continue.')

    await expect
      .poll(async () => {
        const projection = await getAutomationProjection(automationWindow)

        return {
          done: projection.buckets.done.map((task) => task.title).sort(),
          needsMe: projection.buckets.needsMe.map((task) => task.title).sort(),
          ready: projection.buckets.ready.map((task) => task.title).sort(),
          running: projection.buckets.running.map((task) => task.title).sort()
        }
      }, { timeout: E2E_UI_READY_TIMEOUT_MS })
      .toEqual({
        done: ['READY Matrix done task'],
        needsMe: ['READY Matrix needs me bug'],
        ready: ['READY Matrix ready task'],
        running: ['READY Matrix running requirement']
      })
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test(
  'runs real local Codex discovery for a workspace automation-flow',
  async ({ browserName }, testInfo) => {
    void browserName
    test.skip(
      !isRealCodexE2eEnabled,
      'Set MDE_E2E_REAL_CODEX=1 to run local Codex smoke coverage.'
    )
    testInfo.setTimeout(REAL_CODEX_E2E_TIMEOUT_MS)
    const workspacePath = await createAutomationWorkspace()
    const taskTitle = 'READY Local Codex Automation Smoke'

    await writeAutomationSourceMarkdown({
      body: [
        'This is a read-only local Codex automation smoke.',
        'Return it as a discovered workspace-markdown source.',
        'Do not edit files during discovery.'
      ].join('\n'),
      relativePath: '.mde/docs/tasks/ready-real-codex.md',
      title: taskTitle,
      workspacePath
    })
    await createSeedAutomationFlow({
      flowId: 'real-codex-flow',
      name: 'Real Codex Flow',
      rootPath: workspacePath
    })
    const { app, startupDiagnostics, window } = await launchElectronApp({
      args: [workspacePath],
      env: {
        ...(process.env.CODEX_HOME !== undefined
          ? { CODEX_HOME: process.env.CODEX_HOME }
          : {})
      }
    })

    try {
      await expect(
        window.getByRole('button', { name: /README\.md Markdown file/i })
      ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })

      const automationWindow = await openAutomationCenter(app, window)
      await expect
        .poll(async () => {
          const projection = await getAutomationProjection(automationWindow)

          return projection.flows.find(
            (flow) => flow.automationFlowId === 'real-codex-flow'
          )?.automationFlowOwnerKey
        }, { timeout: REAL_CODEX_E2E_TIMEOUT_MS })
        .toBeTruthy()
      const flowOwnerKey = (await getAutomationProjection(automationWindow)).flows
        .find((flow) => flow.automationFlowId === 'real-codex-flow')
        ?.automationFlowOwnerKey

      if (flowOwnerKey === undefined) {
        throw new Error('Real Codex flow was not projected with an owner key')
      }

      await automationWindow.evaluate(async (ownerKey) => {
        const automationApi = (
          globalThis as typeof globalThis & {
            readonly mdeAutomation?: {
              readonly updateFilters: (request: {
                readonly filters: {
                  readonly bucket: 'ready'
                  readonly flowOwnerKeys: readonly string[]
                }
              }) => Promise<unknown>
            }
          }
        ).mdeAutomation

        await automationApi?.updateFilters({
          filters: {
            bucket: 'ready',
            flowOwnerKeys: [ownerKey]
          }
        })
      }, flowOwnerKey)
      await automationWindow.reload({ waitUntil: 'domcontentloaded' })
      await expect
        .poll(async () => {
          const projection = await getAutomationProjection(automationWindow)

          return projection.buckets.ready.some((task) => task.title === taskTitle)
        }, { timeout: REAL_CODEX_E2E_TIMEOUT_MS })
        .toBe(true)
      await selectTaskByTitle(automationWindow, taskTitle)
      await expect(
        automationWindow.getByRole('region', { name: 'Flowline' })
      ).toContainText('.mde/docs/tasks/ready-real-codex.md')
      await expect(
        automationWindow.getByRole('button', {
          name: 'Start with selected executor'
        })
      ).toBeEnabled({ timeout: E2E_UI_READY_TIMEOUT_MS })
      expect(startupDiagnostics.errors).toEqual([])
    } finally {
      await app.close()
    }
  }
)

test('keeps user-global tasks visible under no-workspace-only filters', async () => {
  const workspacePath = await createAutomationWorkspace()
  const fakeCli = await createAutomationFakeCli(workspacePath)

  await createSeedAutomationFlow({
    flowId: 'research-flow',
    name: 'Research Flow',
    rootPath: workspacePath,
    scope: 'user'
  })
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [workspacePath],
    env: {
      MDE_E2E_AUTOMATION_JSONL_ADAPTER: fakeCli.commandPath,
      MDE_FAKE_AUTOMATION_LOG: fakeCli.logPath,
      MDE_FAKE_AUTOMATION_SOURCE_MODE: 'user-prompt'
    }
  })

  try {
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })

    const automationWindow = await openAutomationCenter(app, window)

    await expect(
      automationWindow.getByRole('region', { name: 'Signal Stack' })
    ).toContainText('No automation tasks yet', {
      timeout: E2E_UI_READY_TIMEOUT_MS
    })
    await automationWindow.evaluate(async () => {
      const automationApi = (
        globalThis as typeof globalThis & {
          readonly mdeAutomation?: {
            readonly updateFilters: (request: {
              readonly filters: {
                readonly bucket: 'ready'
                readonly workspaceIds: readonly string[]
              }
            }) => Promise<unknown>
          }
        }
      ).mdeAutomation

      await automationApi?.updateFilters({
        filters: {
          bucket: 'ready',
          workspaceIds: ['mde:no-workspace']
        }
      })
    })
    await automationWindow.reload({ waitUntil: 'domcontentloaded' })
    await expectSignalStackToContainTask(automationWindow, 'READY Use global prompt')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('moves a task through Needs me and resumes the same MDE run', async () => {
  const workspacePath = await createAutomationWorkspace()
  await createSeedAutomationFlow({
    flowId: 'approval-flow',
    name: 'Approval Flow',
    rootPath: workspacePath
  })
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [workspacePath],
    env: {
      MDE_E2E_AUTOMATION_AUTONOMY_GATE: 'false'
    }
  })

  try {
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })

    const automationWindow = await openAutomationCenter(app, window)

    await selectReadyTaskForFlow(automationWindow, 'approval-flow')
    await automationWindow
      .getByRole('button', { name: 'Start with selected executor' })
      .click()
    await selectTaskStackBucket(automationWindow, 'Needs me')
    await expectSignalStackToContainTask(
      automationWindow,
      'READY Implement automation E2E'
    )
    await expect(
      automationWindow.getByRole('region', { name: 'Decision required' })
    ).toBeVisible()

    const runIdBefore = await automationWindow.evaluate(async () => {
      const automationApi = (
        globalThis as typeof globalThis & {
          readonly mdeAutomation?: {
            readonly getProjection: () => Promise<{
              readonly projection: {
                readonly runs: readonly {
                  readonly runId: string
                  readonly runKind: string
                }[]
              }
            }>
          }
        }
      ).mdeAutomation
      const projection = await automationApi?.getProjection()

      return projection?.projection.runs.find((run) => run.runKind === 'task')?.runId
    })

    await automationWindow
      .getByRole('button', { name: 'Approve and resume' })
      .click()
    await selectTaskStackBucket(automationWindow, 'Running')
    await expectSignalStackToContainTask(
      automationWindow,
      'READY Implement automation E2E'
    )

    const runIdAfter = await automationWindow.evaluate(async () => {
      const automationApi = (
        globalThis as typeof globalThis & {
          readonly mdeAutomation?: {
            readonly getProjection: () => Promise<{
              readonly projection: {
                readonly runs: readonly {
                  readonly runId: string
                  readonly runKind: string
                }[]
              }
            }>
          }
        }
      ).mdeAutomation
      const projection = await automationApi?.getProjection()

      return projection?.projection.runs.find((run) => run.runKind === 'task')?.runId
    })

    expect(runIdAfter).toBe(runIdBefore)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('keeps the same run after closing and reopening Automation Center', async () => {
  const workspacePath = await createAutomationWorkspace()
  await createSeedAutomationFlow({
    flowId: 'reopen-flow',
    name: 'Reopen Flow',
    rootPath: workspacePath
  })
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [workspacePath],
    env: {
      MDE_E2E_AUTOMATION_AUTONOMY_GATE: 'false'
    }
  })

  try {
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })

    const automationWindow = await openAutomationCenter(app, window)

    await selectReadyTaskForFlow(automationWindow, 'reopen-flow')
    await automationWindow
      .getByRole('button', { name: 'Start with selected executor' })
      .click()
    await selectTaskStackBucket(automationWindow, 'Needs me')
    await expectSignalStackToContainTask(
      automationWindow,
      'READY Implement automation E2E'
    )

    await expect
      .poll(() => getAutomationRunIds(automationWindow), {
        timeout: E2E_UI_READY_TIMEOUT_MS
      })
      .toHaveLength(1)
    const runIdsBefore = await getAutomationRunIds(automationWindow)

    await automationWindow.close()

    const reopenedAutomationWindow = await openAutomationCenter(app, window)

    await selectTaskStackBucket(reopenedAutomationWindow, 'Needs me')
    await expectSignalStackToContainTask(
      reopenedAutomationWindow,
      'READY Implement automation E2E'
    )
    await expect
      .poll(() => getAutomationRunIds(reopenedAutomationWindow), {
        timeout: E2E_UI_READY_TIMEOUT_MS
      })
      .toEqual(runIdsBefore)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('duplicate task starts return one MDE run', async () => {
  const workspacePath = await createAutomationWorkspace()
  const fakeCli = await createAutomationFakeCli(workspacePath)
  await createSeedAutomationFlow({
    flowId: 'duplicate-flow',
    name: 'Duplicate Flow',
    rootPath: workspacePath
  })
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [workspacePath],
    env: {
      MDE_E2E_AUTOMATION_JSONL_ADAPTER: fakeCli.commandPath,
      MDE_FAKE_AUTOMATION_LOG: fakeCli.logPath
    }
  })

  try {
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })

    const automationWindow = await openAutomationCenter(app, window)

    await expectSignalStackToContainTask(
      automationWindow,
      'READY Implement automation E2E'
    )

    const duplicateResult = await automationWindow.evaluate(async () => {
      const automationApi = (
        globalThis as typeof globalThis & {
          readonly mdeAutomation?: {
            readonly getProjection: () => Promise<{
              readonly projection: {
                readonly tasks: readonly {
                  readonly automationFlowId: string
                  readonly primaryExecutor?: {
                    readonly executorId: string
                    readonly executorSnapshotId?: string
                  }
                  readonly taskDataId?: string
                  readonly taskDataSnapshotId?: string
                  readonly taskId: string
                }[]
              }
            }>
            readonly startRun: (request: {
              readonly executorId: string
              readonly executorSnapshotId?: string
              readonly taskDataId: string
              readonly taskDataSnapshotId: string
              readonly taskId: string
            }) => Promise<{ readonly runId?: string }>
          }
        }
      ).mdeAutomation
      const projection = await automationApi?.getProjection()
      const task = projection?.projection.tasks.find(
        (candidate) => candidate.automationFlowId === 'duplicate-flow'
      )

      if (
        automationApi === undefined ||
        task?.primaryExecutor === undefined ||
        task.taskDataId === undefined ||
        task.taskDataSnapshotId === undefined
      ) {
        throw new Error('Automation task was not projected')
      }
      const request = {
        executorId: task.primaryExecutor.executorId,
        ...(task.primaryExecutor.executorSnapshotId !== undefined
          ? { executorSnapshotId: task.primaryExecutor.executorSnapshotId }
          : {}),
        taskDataId: task.taskDataId,
        taskDataSnapshotId: task.taskDataSnapshotId,
        taskId: task.taskId
      }

      return Promise.all([
        automationApi.startRun(request),
        automationApi.startRun(request)
      ])
    })
    const runIds = await getAutomationRunIds(automationWindow)

    expect(duplicateResult[0]?.runId).toBe(duplicateResult[1]?.runId)
    expect(runIds).toEqual([duplicateResult[0]?.runId])
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('shows archived flows without re-enabling archived discovery', async () => {
  const workspacePath = await createAutomationWorkspace({ includeSeedFlows: true })
  const fakeCli = await createAutomationFakeCli(workspacePath)
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [workspacePath],
    env: {
      MDE_E2E_AUTOMATION_JSONL_ADAPTER: fakeCli.commandPath,
      MDE_FAKE_AUTOMATION_LOG: fakeCli.logPath
    }
  })

  try {
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })

    const automationWindow = await openAutomationCenter(app, window)
    const projectedFlowLifecycles = await automationWindow.evaluate(async () => {
      const automationApi = (
        globalThis as typeof globalThis & {
          readonly mdeAutomation?: {
            readonly getProjection: () => Promise<{
              readonly projection: {
                readonly flows: readonly {
                  readonly lifecycle: string
                  readonly name: string
                }[]
              }
            }>
          }
        }
      ).mdeAutomation
      const projection = await automationApi?.getProjection()

      return projection?.projection.flows.map((flow) => ({
        lifecycle: flow.lifecycle,
        name: flow.name
      }))
    })
    const workspaceFlows = automationWindow.getByRole('region', {
      name: 'Workspace flows'
    })

    expect(projectedFlowLifecycles).toEqual(
      expect.arrayContaining([
        { lifecycle: 'enabled', name: 'Enabled Flow' },
        { lifecycle: 'archived', name: 'Archived Flow' }
      ])
    )
    const enabledSection = workspaceFlows.locator(
      `[data-component-id="${COMPONENT_IDS.automation.flowEnabledSection}"]`
    )
    const workspaceFlowCard = enabledSection
      .locator(`[data-component-id="${COMPONENT_IDS.automation.workspaceFilterCard}"]`)
      .filter({ hasText: basename(workspacePath) })
      .first()

    await expect
      .poll(() =>
        workspaceFlowCard.evaluate(
          (element) => (element as HTMLDetailsElement).open
        )
      )
      .toBe(false)
    await expandDetailsCard(automationWindow, workspaceFlowCard)
    await expect(
      workspaceFlowCard.getByText('Enabled Flow', { exact: true })
    ).toBeVisible()
    await expect(
      workspaceFlowCard.getByText('Archived Flow', { exact: true })
    ).toHaveCount(0)
    await expect
      .poll(() => getProjectedTaskTitles(automationWindow), {
        timeout: E2E_UI_READY_TIMEOUT_MS
      })
      .toContain('READY Implement automation E2E')
    await expectSignalStackToContainTask(
      automationWindow,
      'READY Implement automation E2E'
    )

    await automationWindow
      .getByRole('button', { name: 'Show archived flows' })
      .click()
    await expect
      .poll(async () => (await getAutomationProjection(automationWindow)).filters.archivedVisible)
      .toBe(true)

    await expect(
      workspaceFlowCard.getByText('Archived Flow', { exact: true })
    ).toBeVisible()
    const archivedFlowOwnerKey = (await getAutomationProjection(automationWindow)).flows.find(
      (flow) => flow.automationFlowId === 'archived-flow'
    )?.automationFlowOwnerKey

    if (!archivedFlowOwnerKey) {
      throw new Error('Archived flow owner key was not projected')
    }

    await automationWindow.evaluate(async (flowOwnerKey) => {
      const automationApi = (
        globalThis as typeof globalThis & {
          readonly mdeAutomation?: {
            readonly updateFilters: (request: {
              readonly filters: {
                readonly archivedVisible: true
                readonly flowOwnerKeys: readonly string[]
              }
            }) => Promise<unknown>
          }
        }
      ).mdeAutomation

      await automationApi?.updateFilters({
        filters: {
          archivedVisible: true,
          flowOwnerKeys: [flowOwnerKey]
        }
      })
    }, archivedFlowOwnerKey)
    await expect
      .poll(async () => (await getAutomationProjection(automationWindow)).filters.flowOwnerKeys)
      .toEqual([archivedFlowOwnerKey])
    await automationWindow.reload({ waitUntil: 'domcontentloaded' })
    await expect(
      automationWindow.getByRole('region', { name: 'Signal Stack' })
    ).toContainText('No automation tasks yet.')
    await expect(
      automationWindow
        .getByRole('region', { name: 'Signal Stack' })
        .locator('[data-component-id="automation.signal-task-row"]')
    ).toHaveCount(0)
    const selectedFlowFilter = await automationWindow.evaluate(async () => {
      const automationApi = (
        globalThis as typeof globalThis & {
          readonly mdeAutomation?: {
            readonly getProjection: () => Promise<{
              readonly projection: {
                readonly filters: { readonly flowOwnerKeys?: readonly string[] }
              }
            }>
          }
        }
      ).mdeAutomation
      const projection = await automationApi?.getProjection()

      return projection?.projection.filters.flowOwnerKeys
    })

    expect(selectedFlowFilter).toEqual([archivedFlowOwnerKey])
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})
