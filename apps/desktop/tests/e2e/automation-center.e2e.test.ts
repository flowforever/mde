import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
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

test.setTimeout(E2E_TEST_TIMEOUT_MS)

test.beforeAll(async ({ browserName }, testInfo) => {
  void browserName
  testInfo.setTimeout(E2E_BUILD_TIMEOUT_MS)
  await buildElectronApp()
})

const createFlowMarkdown = ({
  flowId,
  lifecycle,
  name
}: {
  readonly flowId: string
  readonly lifecycle: 'archived' | 'enabled'
  readonly name: string
}): string =>
  renderAutomationFlowTemplate(getBuiltInAutomationFlowTemplate('local-dev-task'), {
    defaultEngine: 'codex',
    flowId,
    name,
    scope: 'workspace'
  }).replace('lifecycle: enabled', `lifecycle: ${lifecycle}`)

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
    const flowRoot = join(workspacePath, '.mde', 'automation-flows')

    await mkdir(flowRoot, { recursive: true })
    await writeFile(
      join(flowRoot, 'enabled-flow.md'),
      createFlowMarkdown({
        flowId: 'enabled-flow',
        lifecycle: 'enabled',
        name: 'Enabled Flow'
      }),
      'utf8'
    )
    await writeFile(
      join(flowRoot, 'archived-flow.md'),
      createFlowMarkdown({
        flowId: 'archived-flow',
        lifecycle: 'archived',
        name: 'Archived Flow'
      }),
      'utf8'
    )
  }

  return workspacePath
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

if (logPath) {
  appendFileSync(logPath, JSON.stringify({
    prompt,
    runKind,
    sessionId,
    taskSourcePath: process.env.MDE_AUTOMATION_TASK_SOURCE_PATH
  }) + '\\n')
}

console.log(JSON.stringify({ type: 'session-started', adapterSessionId: sessionId }))

if (runKind === 'discovery') {
  const sourcePath = join(workspaceRoot, '.mde', 'docs', 'tasks', 'ready.md')
  const contentSnapshot = readFileSync(sourcePath, 'utf8')
  console.log(JSON.stringify({
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
      sourceType: 'local-file',
      sourceUri: 'file://' + sourcePath,
      title: 'READY Implement automation E2E',
      workspaceId: workspaceRoot
    }]
  }))
} else if (runKind === 'task') {
  console.log(JSON.stringify({
    type: 'phase-update',
    phaseTitle: 'Inspect the task',
    status: 'done'
  }))
  console.log(JSON.stringify({
    type: 'final-report',
    outcome: 'succeeded',
    summary: 'Fake CLI completed the task.',
    title: 'READY Implement automation E2E'
  }))
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

const createWorkspaceAutomationFlow = async (
  automationWindow: Page
): Promise<void> => {
  await automationWindow
    .getByRole('button', { name: 'New automation-flow' })
    .click()
  await expect(automationWindow.getByLabel('Template')).toHaveValue(
    'local-dev-task'
  )
  await automationWindow
    .getByRole('button', { name: 'Create automation-flow' })
    .click()
  await expect(
    automationWindow.getByRole('region', { name: 'Validation diagnostics' })
  ).toContainText('Validation passed.')
  await expect(
    automationWindow.locator(
      '[data-component-id="editor.markdown-editor-shell"]'
    )
  ).toBeVisible()
  await automationWindow
    .getByRole('button', { name: 'Save automation-flow' })
    .click()
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

test('creates a workspace automation-flow and projects a READY task', async () => {
  const workspacePath = await createAutomationWorkspace()
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [workspacePath]
  })

  try {
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })

    const automationWindow = await openAutomationCenter(app, window)

    await createWorkspaceAutomationFlow(automationWindow)
    await automationWindow
      .getByRole('button', { name: 'Close automation-flow editor' })
      .click()
    await expect(
      automationWindow.getByRole('region', { name: 'Ready' })
    ).toContainText('READY Implement automation E2E')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('runs discovery and task execution through a fake CLI executable', async () => {
  const workspacePath = await createAutomationWorkspace()
  const flowRoot = join(workspacePath, '.mde', 'automation-flows')
  const fakeCli = await createAutomationFakeCli(workspacePath)

  await mkdir(flowRoot, { recursive: true })
  await writeFile(
    join(flowRoot, 'continuous-flow.md'),
    renderAutomationFlowTemplate(getBuiltInAutomationFlowTemplate('bug-fix'), {
      defaultEngine: 'codex',
      flowId: 'continuous-flow',
      name: 'Continuous Flow',
      scope: 'workspace'
    }),
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

    const automationWindow = await openAutomationCenter(app, window)

    await expect(
      automationWindow.getByRole('region', { name: 'Ready' })
    ).toContainText('READY Implement automation E2E')
    await automationWindow
      .getByRole('button', { name: 'Start automation task' })
      .click()
    await expect(
      automationWindow.getByRole('region', { name: 'Done' })
    ).toContainText('READY Implement automation E2E')

    await expect
      .poll(async () => {
        const log = await readFile(fakeCli.logPath, 'utf8')
        const entries = log
          .trim()
          .split(/\r?\n/u)
          .filter(Boolean)
          .map((line) => JSON.parse(line) as { readonly runKind: string; readonly prompt: string })

        return {
          discoveryRuns: entries.filter((entry) => entry.runKind === 'discovery')
            .length,
          taskPrompt: entries.find((entry) => entry.runKind === 'task')?.prompt
        }
      }, { timeout: E2E_UI_READY_TIMEOUT_MS })
      .toMatchObject({
        discoveryRuns: 2,
        taskPrompt: expect.stringContaining('Verify the Automation Center path.')
      })
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('moves a task through Needs me and resumes the same MDE run', async () => {
  const workspacePath = await createAutomationWorkspace()
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

    await createWorkspaceAutomationFlow(automationWindow)
    await automationWindow
      .getByRole('button', { name: 'Close automation-flow editor' })
      .click()
    await automationWindow
      .getByRole('button', { name: 'Start automation task' })
      .click()
    await expect(
      automationWindow.getByRole('region', { name: 'Needs me' })
    ).toContainText('READY Implement automation E2E')
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
    await expect(
      automationWindow.getByRole('region', { name: 'Running' })
    ).toContainText('READY Implement automation E2E')

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

    await createWorkspaceAutomationFlow(automationWindow)
    await automationWindow
      .getByRole('button', { name: 'Close automation-flow editor' })
      .click()
    await automationWindow
      .getByRole('button', { name: 'Start automation task' })
      .click()
    await expect(
      automationWindow.getByRole('region', { name: 'Needs me' })
    ).toContainText('READY Implement automation E2E')

    const runIdsBefore = await getAutomationRunIds(automationWindow)

    await automationWindow.close()

    const reopenedAutomationWindow = await openAutomationCenter(app, window)

    await expect(
      reopenedAutomationWindow.getByRole('region', { name: 'Needs me' })
    ).toContainText('READY Implement automation E2E')
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
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [workspacePath]
  })

  try {
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })

    const automationWindow = await openAutomationCenter(app, window)

    await createWorkspaceAutomationFlow(automationWindow)
    await automationWindow
      .getByRole('button', { name: 'Close automation-flow editor' })
      .click()
    await expect(
      automationWindow.getByRole('region', { name: 'Ready' })
    ).toContainText('READY Implement automation E2E')

    const duplicateResult = await automationWindow.evaluate(async () => {
      const automationApi = (
        globalThis as typeof globalThis & {
          readonly mdeAutomation?: {
            readonly getProjection: () => Promise<{
              readonly projection: {
                readonly tasks: readonly { readonly taskId: string }[]
              }
            }>
            readonly startRun: (request: {
              readonly taskId: string
            }) => Promise<{ readonly runId?: string }>
          }
        }
      ).mdeAutomation
      const projection = await automationApi?.getProjection()
      const taskId = projection?.projection.tasks[0]?.taskId

      if (automationApi === undefined || taskId === undefined) {
        throw new Error('Automation task was not projected')
      }

      return Promise.all([
        automationApi.startRun({ taskId }),
        automationApi.startRun({ taskId })
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
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [workspacePath]
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
    await expect(workspaceFlows.getByText('Enabled Flow')).toBeVisible()
    await expect(
      workspaceFlows.getByText('Archived Flow', { exact: true })
    ).toHaveCount(0)
    await expect
      .poll(() => getProjectedTaskTitles(automationWindow), {
        timeout: E2E_UI_READY_TIMEOUT_MS
      })
      .toContain('READY Implement automation E2E')
    await expect(
      automationWindow.getByRole('region', { name: 'Ready' })
    ).toContainText('READY Implement automation E2E', {
      timeout: E2E_UI_READY_TIMEOUT_MS
    })

    await automationWindow
      .getByRole('checkbox', { name: 'Show archived flows' })
      .check()

    await expect(
      workspaceFlows.getByText('Archived Flow', { exact: true })
    ).toBeVisible()
    await workspaceFlows.getByRole('button', { name: 'Archived Flow' }).click()
    await expect(
      automationWindow.getByRole('region', { name: 'Ready' })
    ).toContainText('No tasks in this bucket.')
    await expect(
      automationWindow
        .getByRole('region', { name: 'Ready' })
        .locator('[data-component-id="automation.task-card"]')
    ).toHaveCount(0)
    const selectedFlowFilter = await automationWindow.evaluate(async () => {
      const automationApi = (
        globalThis as typeof globalThis & {
          readonly mdeAutomation?: {
            readonly getProjection: () => Promise<{
              readonly projection: {
                readonly filters: { readonly flowId?: string }
              }
            }>
          }
        }
      ).mdeAutomation
      const projection = await automationApi?.getProjection()

      return projection?.projection.filters.flowId
    })

    expect(selectedFlowFilter).toBe('archived-flow')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})
