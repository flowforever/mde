import { chmod, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { expect, test, type Page } from '@playwright/test'

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

const installFakeCodexCli = async (): Promise<string> => {
  const fakeBinPath = await mkdtemp(join(tmpdir(), 'mde-agent-chat-bin-'))
  const fakeCodexPath = join(fakeBinPath, 'codex')

  await writeFile(
    fakeCodexPath,
    ['#!/bin/sh', 'printf "%s\\n" "fake codex"'].join('\n'),
    'utf8'
  )
  await chmod(fakeCodexPath, 0o755)

  return fakeBinPath
}

const ensureWorkspaceDialogOpen = async (window: Page): Promise<void> => {
  const workspaceDialog = window.getByRole('dialog', {
    name: /workspace manager/i
  })
  const workspaceDialogBackdrop = window.locator('.workspace-dialog-backdrop')
  const workspaceTrigger = window
    .getByRole('button', { name: /^open workspace$/i })
    .or(window.getByRole('button', { name: /manage workspaces/i }))

  if (
    await workspaceDialogBackdrop.isVisible({ timeout: 1_000 }).catch(() => false)
  ) {
    return
  }

  await workspaceTrigger.click({ timeout: E2E_UI_READY_TIMEOUT_MS })
  await expect(workspaceDialogBackdrop).toBeVisible()
  await expect(workspaceDialog).toBeVisible()
}

const seedLargeNonGitWorkspace = async (workspacePath: string): Promise<void> => {
  const bulkPath = join(workspacePath, 'bulk')

  await mkdir(bulkPath, { recursive: true })
  for (let start = 0; start < 5_010; start += 100) {
    await Promise.all(
      Array.from({ length: Math.min(100, 5_010 - start) }, (_item, offset) =>
        writeFile(join(bulkPath, `file-${start + offset}.md`), '# Bulk', 'utf8')
      )
    )
  }
}

test('opens Editor Agent Chat through the fake Codex sustained engine', async () => {
  const workspacePath = await createFixtureWorkspace()
  const fakeBinPath = await installFakeCodexCli()
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [workspacePath],
    env: {
      MDE_E2E_AGENT_CHAT_FAKE_CODEX: '1',
      PATH: `${fakeBinPath}:${process.env.PATH ?? ''}`
    }
  })

  try {
    await window
      .getByRole('button', { name: /README\.md Markdown file/i })
      .click({ timeout: E2E_UI_READY_TIMEOUT_MS })
    await expect(window.getByTestId('markdown-block-editor')).toContainText(
      'Root markdown file.'
    )

    const agentChatButton = window.getByRole('button', { name: /^Agent Chat$/ })

    await expect(agentChatButton).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.agentChat.actionButton
    )
    await agentChatButton.click()

    const panel = window.getByRole('complementary', { name: /^Agent Chat$/ })

    await expect(panel).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.agentChat.panel
    )
    const resizeHandle = window.getByRole('separator', {
      name: /resize agent chat panel/i
    })
    const editorPane = window.locator(
      `[data-component-id="${COMPONENT_IDS.editor.pane}"]`
    )

    await expect(resizeHandle).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.agentChat.resizeHandle
    )
    await expect(panel.getByText('Codex sustained chat')).toHaveCount(0)
    await expect(panel.getByText(/^Session$/)).toHaveCount(0)
    await expect(panel.getByRole('button', { name: /^New session$/ })).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.agentChat.newSessionButton
    )
    await expect(panel.getByRole('button', { name: /^New session$/ })).toHaveText(
      ''
    )
    await expect(panel.getByRole('button', { name: /^Attach image$/ })).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.agentChat.attachImageButton
    )

    const initialPanelBox = await panel.boundingBox()
    const editorPaneBox = await editorPane.boundingBox()
    const resizeHandleBox = await resizeHandle.boundingBox()
    const viewportWidth = await window.evaluate(() => globalThis.innerWidth)

    expect(initialPanelBox).not.toBeNull()
    expect(editorPaneBox).not.toBeNull()
    expect(resizeHandleBox).not.toBeNull()
    expect(
      await panel.evaluate((node, editorPaneComponentId) =>
        Boolean(
          node.closest(`[data-component-id="${editorPaneComponentId}"]`)
        ), COMPONENT_IDS.editor.pane)
    ).toBe(false)
    expect(initialPanelBox!.width).toBeGreaterThanOrEqual(378)
    expect(initialPanelBox!.width).toBeLessThanOrEqual(422)
    expect(
      Math.abs(editorPaneBox!.x + editorPaneBox!.width - resizeHandleBox!.x)
    ).toBeLessThanOrEqual(1)
    expect(
      Math.abs(resizeHandleBox!.x + resizeHandleBox!.width - initialPanelBox!.x)
    ).toBeLessThanOrEqual(1)
    expect(
      Math.abs(initialPanelBox!.x + initialPanelBox!.width - viewportWidth)
    ).toBeLessThanOrEqual(1)

    await resizeHandle.hover()
    await window.mouse.down()
    await window.mouse.move(initialPanelBox!.x - 72, initialPanelBox!.y + 24)
    await window.mouse.up()

    const resizedPanelBox = await panel.boundingBox()

    expect(resizedPanelBox).not.toBeNull()
    expect(resizedPanelBox!.width).toBeGreaterThan(initialPanelBox!.width + 48)

    await expect(panel).toContainText('README.md')
    await expect(
      panel.getByRole('combobox', { name: /^Session$/ })
    ).toContainText('Fake codex session')
    await panel.getByRole('textbox', { name: /message agent chat/i }).fill(
      'Summarize the current note'
    )
    const sendButton = panel.getByRole('button', { name: /^Send$/ })

    await expect(sendButton).toHaveAttribute(
      'data-component-id',
      COMPONENT_IDS.agentChat.sendButton
    )
    await sendButton.click()

    await expect(
      panel.getByRole('textbox', { name: /message agent chat/i })
    ).toHaveValue('')
    await expect(panel).toContainText('Summarize the current note')
    await expect(panel).toContainText('Fake codex response')
    await expect(panel.getByRole('alert')).toHaveCount(0)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('keeps Agent Chat scoped when switching workspaces', async () => {
  const firstWorkspacePath = await createFixtureWorkspace()
  const secondWorkspacePath = await createFixtureWorkspace()
  const fakeBinPath = await installFakeCodexCli()

  await writeFile(join(secondWorkspacePath, 'SECOND.md'), '# Second workspace')
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [firstWorkspacePath],
    env: {
      MDE_E2E_AGENT_CHAT_FAKE_CODEX: '1',
      PATH: `${fakeBinPath}:${process.env.PATH ?? ''}`
    }
  })

  try {
    await window.evaluate(
      ({ firstWorkspacePath, secondWorkspacePath }) => {
        globalThis.localStorage.setItem(
          'mde.recentWorkspaces',
          JSON.stringify([
            {
              name: 'Second Workspace',
              rootPath: secondWorkspacePath,
              type: 'workspace'
            },
            {
              name: 'First Workspace',
              rootPath: firstWorkspacePath,
              type: 'workspace'
            }
          ])
        )
      },
      { firstWorkspacePath, secondWorkspacePath }
    )
    await window.reload({ waitUntil: 'domcontentloaded' })
    await window
      .getByRole('button', { name: /README\.md Markdown file/i })
      .click({ timeout: E2E_UI_READY_TIMEOUT_MS })

    await window.getByRole('button', { name: /^Agent Chat$/ }).click()
    const panel = window.getByRole('complementary', { name: /^Agent Chat$/ })

    await panel
      .getByRole('textbox', { name: /message agent chat/i })
      .fill('Workspace A question')
    await panel.getByRole('button', { name: /^Send$/ }).click()
    await expect(panel).toContainText('Workspace A question')
    await expect(panel).toContainText('Fake codex response')

    await ensureWorkspaceDialogOpen(window)
    await window
      .getByRole('button', { name: /switch to workspace Second Workspace/i })
      .click()
    await expect(
      window.getByRole('button', { name: /SECOND\.md Markdown file/i })
    ).toBeVisible()
    await expect(panel).toBeHidden()
    await expect(window.getByText('Workspace A question')).toHaveCount(0)
    await expect(window.getByText('Fake codex response')).toHaveCount(0)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('shows changed-files status when workspace snapshots are unavailable', async () => {
  const workspacePath = await createFixtureWorkspace()
  const fakeBinPath = await installFakeCodexCli()

  await seedLargeNonGitWorkspace(workspacePath)
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [workspacePath],
    env: {
      MDE_E2E_AGENT_CHAT_FAKE_CODEX: '1',
      PATH: `${fakeBinPath}:${process.env.PATH ?? ''}`
    }
  })

  try {
    await window
      .getByRole('button', { name: /README\.md Markdown file/i })
      .click({ timeout: E2E_UI_READY_TIMEOUT_MS })
    await window.getByRole('button', { name: /^Agent Chat$/ }).click()
    const panel = window.getByRole('complementary', { name: /^Agent Chat$/ })

    await panel
      .getByRole('textbox', { name: /message agent chat/i })
      .fill('Check changed files')
    await panel.getByRole('button', { name: /^Send$/ }).click()

    await expect(panel).toContainText('Fake codex response')
    await expect(panel).toContainText(
      'Changed-file summary unavailable for this turn.'
    )
    await expect(panel.getByRole('alert')).toHaveCount(0)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('hides Editor Agent Chat when the Codex sustained protocol is unavailable', async () => {
  const workspacePath = await createFixtureWorkspace()
  const fakeBinPath = await installFakeCodexCli()
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [workspacePath],
    env: {
      MDE_E2E_AGENT_CHAT_FAKE_CODEX: 'unsupported',
      PATH: `${fakeBinPath}:${process.env.PATH ?? ''}`
    }
  })

  try {
    await window
      .getByRole('button', { name: /README\.md Markdown file/i })
      .click({ timeout: E2E_UI_READY_TIMEOUT_MS })
    await expect(window.getByTestId('markdown-block-editor')).toContainText(
      'Root markdown file.'
    )
    await expect(
      window.getByRole('button', { name: /summarize markdown/i })
    ).toBeVisible()
    await window.waitForTimeout(1_000)
    await expect(
      window.getByRole('button', { name: /^Agent Chat$/ })
    ).toBeHidden()
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})
