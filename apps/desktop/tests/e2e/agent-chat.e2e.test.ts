import { chmod, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { expect, test } from '@playwright/test'

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
    await expect(panel).toContainText('README.md')
    await expect(panel.getByLabel('Session')).toContainText('Fake codex session')
    await panel.getByRole('textbox', { name: /message agent chat/i }).fill(
      'Summarize the current note'
    )
    await panel.getByRole('button', { name: /^Send$/ }).click()

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
