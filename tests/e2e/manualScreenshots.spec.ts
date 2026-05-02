import { chmod, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { buildElectronApp, launchElectronApp } from './support/electronApp'
import { createFixtureWorkspace } from './support/fixtureWorkspace'

const SCREENSHOT_TIMEOUT_MS = 300_000
const AI_RESULT_TIMEOUT_MS = 90_000
const OUTPUT_DIR = resolve('user-manual/public/screenshots/zh-CN')

test.setTimeout(SCREENSHOT_TIMEOUT_MS)

test.beforeAll(async ({ browserName }, testInfo) => {
  void browserName
  testInfo.setTimeout(600_000)
  await buildElectronApp()
})

const applyManualPreferences = async (window: Page): Promise<void> => {
  await window.evaluate(() => {
    globalThis.localStorage.setItem('mde.appLanguagePreference', 'zh')
    globalThis.localStorage.removeItem('mde.customAppLanguagePacks')
    globalThis.localStorage.setItem(
      'mde.themePreference',
      JSON.stringify({
        lastDarkThemeId: 'carbon',
        lastLightThemeId: 'manuscript',
        mode: 'light'
      })
    )
  })
  await window.reload({ waitUntil: 'domcontentloaded' })
  await window.locator('.app-shell').waitFor({ state: 'visible' })
}

const normalizeManualWorkspaceLabels = async (window: Page): Promise<void> => {
  await window.evaluate(() => {
    const workspaceTrigger = document.querySelector<HTMLElement>(
      '.workspace-manager-button'
    )
    const workspaceName = workspaceTrigger?.querySelector<HTMLElement>(
      'span:first-child'
    )
    const workspacePath = workspaceTrigger?.querySelector<HTMLElement>(
      'span:nth-child(2)'
    )

    if (workspaceName) {
      workspaceName.textContent = 'mde-manual-workspace'
    }

    if (workspacePath) {
      workspacePath.textContent = '/Manual/MDE Workspace'
    }
  })
}

const capture = async (window: Page, filename: string): Promise<void> => {
  await window.waitForLoadState('domcontentloaded')
  await window.waitForTimeout(500)
  await normalizeManualWorkspaceLabels(window)
  await window.screenshot({
    fullPage: true,
    path: join(OUTPUT_DIR, filename)
  })
}

const installFakeAiCli = async (): Promise<string> => {
  const fakeBinPath = await mkdtemp(join(tmpdir(), 'mde-manual-ai-bin-'))
  const fakeCodexPath = join(fakeBinPath, 'codex')

  await writeFile(
    fakeCodexPath,
    [
      '#!/bin/sh',
      'cat >/dev/null',
      'printf "%s\\n" "## 手册截图摘要" "" "- MDE 可以生成当前 Markdown 的摘要。" "- 结果面板是只读的，并会缓存到工作区。"'
    ].join('\n')
  )
  await chmod(fakeCodexPath, 0o755)

  return fakeBinPath
}

test('generates zh-CN user manual screenshots', async () => {
  await mkdir(OUTPUT_DIR, { recursive: true })

  const workspacePath = await createFixtureWorkspace()
  const fakeBinPath = await installFakeAiCli()

  await writeFile(
    join(workspacePath, 'diagram.md'),
    [
      '# Mermaid Demo',
      '',
      '```mermaid',
      'flowchart TD',
      '  A[打开 MDE] --> B[编辑 Markdown]',
      '  B --> C[自动保存]',
      '```'
    ].join('\n')
  )
  await writeFile(
    join(workspacePath, 'README.md'),
    [
      '# Fixture Workspace',
      '',
      'Root markdown file for the MDE user manual.',
      '',
      'Search target: manual screenshot.'
    ].join('\n')
  )

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`],
    env: {
      PATH: `${fakeBinPath}:${process.env.PATH ?? ''}`
    }
  })

  try {
    await window.setViewportSize({ width: 1280, height: 820 })
    await applyManualPreferences(window)

    await capture(window, 'quick-start-open-workspace.png')

    await window.getByRole('button', { name: /打开新工作区|Open new workspace/i }).click()
    await expect(
      window.getByRole('button', { name: /README\.md Markdown (文件|file)/i })
    ).toBeVisible()
    await capture(window, 'workspace-explorer.png')

    await window
      .getByRole('button', { name: /README\.md Markdown (文件|file)/i })
      .click()
    await expect(window.getByTestId('markdown-block-editor')).toBeVisible()
    await capture(window, 'editor-main.png')

    await window
      .getByRole('button', { name: /搜索当前 Markdown|Search current Markdown/i })
      .click()
    await window.getByPlaceholder(/搜索|Search/i).fill('manual')
    await expect(window.getByText(/manual screenshot/i)).toBeVisible()
    await capture(window, 'editor-search.png')

    await window
      .getByRole('button', { name: /搜索工作区内容|Search workspace contents/i })
      .click()
    await window.getByPlaceholder(/搜索工作区|Search workspace/i).fill('manual')
    await expect(
      window.getByRole('button', { name: /打开搜索结果 README\.md|Open search result README\.md/i })
        .first()
    ).toBeVisible({ timeout: 15_000 })
    await capture(window, 'workspace-search.png')
    await window.keyboard.press('Escape')

    await window
      .getByRole('button', { name: /diagram\.md Markdown (文件|file)/i })
      .click()
    await expect(window.getByText(/Mermaid Demo/i)).toBeVisible()
    await expect(window.getByTestId('mermaid-flowchart-preview-0')).toBeVisible()
    await capture(window, 'mermaid-flowchart.png')

    await window
      .getByRole('button', { name: /README\.md Markdown (文件|file)/i })
      .click()
    const editableDocument = window
      .getByTestId('blocknote-view')
      .locator('[contenteditable="true"]')
      .first()

    await editableDocument.click()
    await window.keyboard.press('End')
    await window.keyboard.press('Enter')
    await window.keyboard.insertText('/')
    await window.getByText(/^链接$|^Link$/).click()
    await expect(
      window.getByRole('dialog', { name: /插入链接|Insert link/i })
    ).toBeVisible()
    await window.getByLabel(/链接目标|Link target/i).fill('docs/intro')
    await capture(window, 'insert-link.png')
    await window.keyboard.press('Escape')

    await window
      .getByRole('button', { name: /总结 Markdown|Summarize Markdown/i })
      .click()
    await expect(window.getByRole('region', { name: /AI 结果|AI result/i }))
      .toContainText(/手册截图摘要|manual/i, { timeout: AI_RESULT_TIMEOUT_MS })
    await capture(window, 'ai-result.png')

    await window.getByRole('button', { name: /打开设置|Open settings/i }).click()
    await window.getByRole('button', { name: /^主题$|^Theme$/i }).click()
    await expect(
      window.getByRole('radiogroup', { name: /主题配色|Theme colorways/i })
    ).toBeVisible()
    await capture(window, 'settings-theme.png')

    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})
