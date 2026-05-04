import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  stat,
  writeFile
} from 'node:fs/promises'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { expect, test, type Page } from '@playwright/test'

import { buildElectronApp, launchElectronApp } from './support/electronApp'
import { createFixtureWorkspace } from './support/fixtureWorkspace'
import { COMPONENT_IDS } from '../../src/renderer/src/componentIds'
import { getAppThemeRows, type AppThemeId } from '../../src/renderer/src/theme/appThemes'

const E2E_TEST_TIMEOUT_MS = 120_000
const E2E_BUILD_TIMEOUT_MS = 600_000
const E2E_UI_READY_TIMEOUT_MS = 20_000
const E2E_AI_RESULT_TIMEOUT_MS = 30_000
const AUTO_SUPERPOWER_FLOWCHART = [
  'flowchart TD',
  '    S1[init] --> C1{single-project run ready?}',
  '    C1 -->|confirm project + branch/base| S2[pre-setup]',
  '    C1 -->|multi-project: choose one project| S1R[resume init with selected project]',
  '    S1R --> S2',
  '    C1 -->|no clean single-project slice| SX[stop and split ticket]',
  '    S2 --> S3a[brainstorm feature]',
  '    S2 --> S3b[debug bug]',
  '    S3a --> S4[spec-auto-review]',
  '    S3b --> S4',
  '    S4 --> S5[spec-approval manual gate]',
  '    S5 --> S6[write-plan]',
  '    S6 --> S7[plan-auto-review]',
  '    S7 --> S8[plan-approval manual gate]',
  '    S8 --> S9[dev]',
  '    S9 --> RB[review_baseline_sha fixed]',
  '    RB --> S10[code-auto-review parallel-capable]',
  '    RB --> S11[post-dev-review parallel-capable]',
  '    RB --> S12[code-review parallel-capable]',
  '    S10 --> SF[serial fallback only when subagents unavailable]',
  '    S11 --> SF',
  '    S12 --> SF',
  '    S10 --> S13[finish human gate + post-deploy validation when reachable]',
  '    S11 --> S13',
  '    S12 --> S13',
  '    SF --> S13'
]
const THEME_VISIBILITY_THEME_IDS: readonly AppThemeId[] = getAppThemeRows()
  .flatMap((row) => [
    row.darkTheme.id,
    row.lightPanelTheme.id,
    row.darkPanelTheme.id
  ])

test.setTimeout(E2E_TEST_TIMEOUT_MS)

test.beforeAll(async ({ browserName }, testInfo) => {
  void browserName
  testInfo.setTimeout(E2E_BUILD_TIMEOUT_MS)
  await buildElectronApp()
})

const readTextFileOrNull = async (filePath: string): Promise<string | null> => {
  try {
    return await readFile(filePath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }

    throw error
  }
}

const startUpdateFallbackServer = async (): Promise<{
  close: () => Promise<void>
  requests: string[]
  url: string
}> => {
  const requests: string[] = []
  const server = createServer((request, response) => {
    const requestUrl = request.url ?? '/'

    requests.push(requestUrl)

    if (requestUrl === '/api/releases') {
      response.writeHead(403, { 'content-type': 'text/plain' })
      response.end('rate limited')
      return
    }

    if (requestUrl === '/releases.atom') {
      response.writeHead(200, { 'content-type': 'application/atom+xml' })
      response.end(`<?xml version="1.0" encoding="UTF-8"?>
        <feed>
          <entry>
            <title>MDE 1.2.19</title>
            <link rel="alternate" href="https://github.com/flowforever/mde/releases/tag/v1.2.19" />
            <updated>2026-04-30T12:00:00Z</updated>
            <content type="html">&lt;p&gt;Fallback release feed update.&lt;/p&gt;</content>
          </entry>
        </feed>`)
      return
    }

    response.writeHead(404, { 'content-type': 'text/plain' })
    response.end('not found')
  })

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address() as AddressInfo

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }

          resolve()
        })
      }),
    requests,
    url: `http://127.0.0.1:${address.port}`
  }
}

const ensureWorkspaceDialogOpen = async (window: Page): Promise<void> => {
  const workspaceDialog = window.getByRole('dialog', {
    name: /workspace manager/i
  })
  const workspaceDialogBackdrop = window.locator('.workspace-dialog-backdrop')
  const workspaceTrigger = window
    .getByRole('button', { name: /^open workspace$/i })
    .or(window.getByRole('button', { name: /manage workspaces/i }))
  const waitForWorkspaceDialog = async (): Promise<boolean> => {
    await workspaceDialogBackdrop
      .waitFor({ state: 'visible', timeout: E2E_UI_READY_TIMEOUT_MS })
      .catch(() => undefined)

    return workspaceDialogBackdrop.isVisible().catch(() => false)
  }

  if (await waitForWorkspaceDialog()) {
    return
  }

  try {
    await workspaceTrigger.click({ timeout: E2E_UI_READY_TIMEOUT_MS })
  } catch (error) {
    if (await waitForWorkspaceDialog()) {
      return
    }

    throw error
  }

  await expect(workspaceDialogBackdrop).toBeVisible()
  await expect(workspaceDialog).toBeVisible()
}

const dispatchResourceDragEvent = async (
  window: Page,
  type: 'dragenter' | 'dragover' | 'dragleave' | 'drop',
  resourcePath: string
): Promise<boolean> => {
  const canonicalResourcePath = await realpath(resourcePath)

  return window.evaluate(
    ({ eventType, uri }) => {
      const shell = document.querySelector('.app-shell')

      if (!shell) {
        throw new Error('Missing app shell')
      }

      const dataTransfer = new DataTransfer()

      dataTransfer.setData('text/uri-list', uri)

      const event = new DragEvent(eventType, {
        bubbles: true,
        cancelable: true,
        dataTransfer
      })

      return !shell.dispatchEvent(event)
    },
    {
      eventType: type,
      uri: pathToFileURL(canonicalResourcePath).toString()
    }
  )
}

const openNewWorkspace = async (window: Page): Promise<void> => {
  await ensureWorkspaceDialogOpen(window)

  const openWorkspaceButton = window.getByRole('button', {
    name: /open new workspace/i
  })

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await openWorkspaceButton.click({ timeout: 5_000 })
      return
    } catch (error) {
      if (attempt === 2) {
        throw error
      }

      await window.waitForTimeout(250)
      await ensureWorkspaceDialogOpen(window)
    }
  }
}

const openMarkdownFile = async (window: Page): Promise<void> => {
  await ensureWorkspaceDialogOpen(window)

  await window.getByRole('button', { name: /open markdown file/i }).click()
}

const revealEditorOverflowActions = async (window: Page): Promise<void> => {
  const expandButton = window.getByRole('button', {
    name: /show all editor actions/i
  })

  if (await expandButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await expandButton.click()
  }
}

const resetThemePreference = async (window: Page): Promise<void> => {
  await window.evaluate(() => {
    globalThis.localStorage.removeItem('mde.themePreference')
  })
  await window.reload({ waitUntil: 'domcontentloaded' })
  await window.locator('.app-shell').waitFor({ state: 'visible' })
}

const setAppLanguagePreference = async (
  window: Page,
  languageId: string
): Promise<void> => {
  await window.evaluate((nextLanguageId) => {
    globalThis.localStorage.setItem('mde.appLanguagePreference', nextLanguageId)
    globalThis.localStorage.removeItem('mde.customAppLanguagePacks')
  }, languageId)
  await window.reload({ waitUntil: 'domcontentloaded' })
  await window.locator('.app-shell').waitFor({ state: 'visible' })
}

const addCustomAppLanguagePack = async (window: Page): Promise<void> => {
  await window.evaluate(() => {
    globalThis.localStorage.setItem(
      'mde.customAppLanguagePacks',
      JSON.stringify([
        {
          id: 'custom:spanish',
          label: 'Spanish',
          locale: 'es',
          messages: {
            'settings.title': 'Ajustes',
            'workspace.openWorkspace': 'Abrir workspace'
          }
        }
      ])
    )
  })
  await window.reload({ waitUntil: 'domcontentloaded' })
  await window.locator('.app-shell').waitFor({ state: 'visible' })
}

const focusTextEndInEditor = async (
  window: Page,
  text: string
): Promise<void> => {
  await window.evaluate((targetText) => {
    const editorSurface = document.querySelector('.markdown-editor-surface')

    if (!editorSurface) {
      throw new Error('Markdown editor surface is not available')
    }

    const walker = document.createTreeWalker(editorSurface, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()

    while (node) {
      const textContent = node.textContent ?? ''
      const textIndex = textContent.indexOf(targetText)

      if (textIndex !== -1) {
        const range = document.createRange()
        const selection = document.getSelection()
        const editableElement = node.parentElement?.closest<HTMLElement>(
          '[contenteditable="true"]'
        ) ?? editorSurface.querySelector<HTMLElement>('[contenteditable="true"]')

        editableElement?.focus()
        range.setStart(node, textIndex + targetText.length)
        range.collapse(true)
        selection?.removeAllRanges()
        selection?.addRange(range)
        return
      }

      node = walker.nextNode()
    }

    throw new Error(`Unable to find editor text: ${targetText}`)
  }, text)
}

test('shows the initial centered workspace popup', async () => {
  const { app, startupDiagnostics, window } = await launchElectronApp()

  try {
    await resetThemePreference(window)

    const appShell = window.locator('.app-shell')
    const workspaceButton = window.getByRole('button', {
      name: /^open workspace$/i
    })

    const workspaceDialog = window.getByRole('dialog', {
      name: /workspace manager/i
    })
    const openWorkspaceItem = window.getByRole('button', {
      name: /open new workspace/i
    })

    await expect(workspaceButton).toBeVisible()
    await expect(appShell).toHaveAttribute('data-theme', 'manuscript')
    await expect(appShell).toHaveAttribute('data-theme-family', 'light')
    await expect(appShell).toHaveAttribute('data-panel-family', 'light')
    await expect(window.getByRole('button', { name: /open settings/i }))
      .toBeEnabled()
    await expect(workspaceDialog).toBeVisible()
    await expect(
      window.getByRole('heading', { name: /^Open workspace$/ })
    ).toBeVisible()
    await expect(openWorkspaceItem).toBeVisible()
    await expect(window.getByRole('menu')).toHaveCount(0)

    const buttonBackground = await workspaceButton.evaluate(
      (element) => globalThis.getComputedStyle(element).backgroundColor
    )
    const itemBackground = await openWorkspaceItem.evaluate(
      (element) => globalThis.getComputedStyle(element).backgroundColor
    )
    const dialogCenter = await workspaceDialog.evaluate((element) => {
      const rect = element.getBoundingClientRect()

      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      }
    })
    const viewportCenter = await window.evaluate(() => ({
      x: globalThis.innerWidth / 2,
      y: globalThis.innerHeight / 2
    }))

    expect(buttonBackground).not.toBe('rgb(46, 111, 143)')
    expect(itemBackground).not.toBe('rgb(46, 111, 143)')
    expect(Math.abs(dialogCenter.x - viewportCenter.x)).toBeLessThan(12)
    expect(Math.abs(dialogCenter.y - viewportCenter.y)).toBeLessThan(12)
    await expect
      .poll(async () =>
        window.evaluate(() => {
          const shellWindow = globalThis as unknown as Window & {
            markdownEditorShell?: { preloadLoaded?: boolean }
          }

          return shellWindow.markdownEditorShell?.preloadLoaded === true
        })
      )
      .toBe(true)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('selects and persists a manual theme from settings', async () => {
  const { app, startupDiagnostics, window } = await launchElectronApp()

  try {
    await resetThemePreference(window)

    const appShell = window.locator('.app-shell')

    await expect(appShell).toHaveAttribute('data-theme', 'manuscript')
    await window.getByRole('button', { name: /close workspace popup/i }).click()

    await window.getByRole('button', { name: /change theme/i }).click()
    await expect(window.getByRole('dialog', { name: /settings/i })).toBeVisible()
    await expect(window.getByRole('button', { name: /^Theme$/ })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(
      await window.getByRole('button', { name: /^Theme$/ }).evaluate((element) => {
        const style = globalThis.getComputedStyle(element)

        return {
          bottom: style.paddingBottom,
          left: style.paddingLeft,
          right: style.paddingRight,
          top: style.paddingTop
        }
      })
    ).toEqual({
      bottom: '8px',
      left: '8px',
      right: '8px',
      top: '8px'
    })
    await window
      .getByRole('switch', { name: /follow system appearance/i })
      .click()
    await expect(
      window.getByRole('switch', { name: /follow system appearance/i })
    ).not.toBeChecked()

    const themePicker = window.locator('.theme-colorway-grid')
    const blueColorway = window.locator('[data-theme-row="blue"]')

    await expect(themePicker).toHaveAttribute('data-column-count', '3')
    await expect(window.locator('.theme-column-heading')).toHaveCount(0)
    await expect(window.locator('.theme-colorway-row')).toHaveCount(8)
    await expect(blueColorway.locator('[data-theme-id="blue-hour"]')).toBeVisible()
    await expect(blueColorway.locator('[data-theme-id="glacier"]')).toBeVisible()
    await expect(blueColorway.locator('[data-theme-id="paper-blue"]')).toBeVisible()
    await expect(blueColorway.locator('[role="radio"]')).toHaveCount(3)

    await window.getByRole('radio', { name: /blue hour/i }).click()

    await expect(appShell).toHaveAttribute('data-theme', 'blue-hour')
    await expect(appShell).toHaveAttribute('data-theme-family', 'dark')
    expect(
      await window.evaluate(() =>
        globalThis.localStorage.getItem('mde.themePreference')
      )
    ).toContain('"lastDarkThemeId":"blue-hour"')

    await window.evaluate(() => {
      globalThis.location.reload()
    })

    await expect(window.locator('.app-shell')).toHaveAttribute(
      'data-theme',
      'blue-hour'
    )
    await window.getByRole('button', { name: /close workspace popup/i }).click()
    await window.getByRole('button', { name: /change theme/i }).click()
    await expect(
      window.getByRole('switch', { name: /follow system appearance/i })
    ).not.toBeChecked()
    await expect(window.getByRole('button', { name: /open settings/i }))
      .toBeEnabled()
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('keeps calibrated theme tokens visible across every colorway mode', async () => {
  const workspacePath = await createFixtureWorkspace()
  const themeFixturePath = join(workspacePath, 'theme-visibility.md')
  const searchShortcut = process.platform === 'darwin' ? 'Meta+F' : 'Control+F'

  await writeFile(
    themeFixturePath,
    [
      '---',
      'owner: design',
      'status: theme review',
      '---',
      '# Theme Visibility Fixture',
      '',
      'Theme review text with `inline code`, workspace metadata, and search target theme.',
      '',
      '> Theme quote rail should remain visible without becoming a large card.',
      '',
      '```ts',
      'const themeToken = "theme";',
      '```',
      '',
      '```mermaid',
      'flowchart TD',
      '  Theme[Theme] --> Editor[Editor paper]',
      '  Theme --> Panel[Panel rail]',
      '```'
    ].join('\n')
  )

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await window.setViewportSize({ width: 1440, height: 900 })
    await openNewWorkspace(window)
    await window
      .getByRole('button', { name: /theme-visibility\.md Markdown file/i })
      .click()

    await expect(window.getByTestId('markdown-block-editor')).toContainText(
      'Theme Visibility Fixture'
    )
    await expect(window.locator('.frontmatter-panel')).toBeVisible()
    await expect(
      window.locator(
        ".markdown-editor-surface .bn-block-content[data-content-type='codeBlock']"
      ).first()
    ).toBeVisible()
    await expect(window.locator('.mermaid-flowchart-card')).toBeVisible({
      timeout: 15_000
    })

    await window.keyboard.press(searchShortcut)
    const searchBox = window.getByRole('searchbox', {
      name: /search current markdown/i
    })

    await searchBox.fill('theme')
    await window.keyboard.press('Enter')
    await expect(window.locator('.editor-search-count')).toContainText(/\d+\/\d+/)

    await window.getByRole('button', { name: /change theme/i }).click()
    await expect(window.getByRole('dialog', { name: /settings/i })).toBeVisible()
    await window
      .getByRole('switch', { name: /follow system appearance/i })
      .click()
    await expect(
      window.getByRole('switch', { name: /follow system appearance/i })
    ).not.toBeChecked()

    const appShell = window.locator('.app-shell')

    for (const themeId of THEME_VISIBILITY_THEME_IDS) {
      const previousErrorCount = startupDiagnostics.errors.length

      await window.locator(`[data-theme-id="${themeId}"]`).click()
      await expect(appShell).toHaveAttribute('data-theme', themeId)

      const metrics = await window.evaluate(() => {
        const parseHexColor = (hexColor: string): readonly [number, number, number] => {
          const normalizedHexColor = hexColor.trim().replace('#', '')

          if (!/^[0-9a-fA-F]{6}$/.test(normalizedHexColor)) {
            throw new Error(`Expected hex color, received ${hexColor}`)
          }

          return [
            Number.parseInt(normalizedHexColor.slice(0, 2), 16) / 255,
            Number.parseInt(normalizedHexColor.slice(2, 4), 16) / 255,
            Number.parseInt(normalizedHexColor.slice(4, 6), 16) / 255
          ]
        }
        const toLinearChannel = (channel: number): number =>
          channel <= 0.03928
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4
        const getRelativeLuminance = (hexColor: string): number => {
          const [red, green, blue] = parseHexColor(hexColor).map(toLinearChannel)

          return 0.2126 * red + 0.7152 * green + 0.0722 * blue
        }
        const parseCssRgbColor = (
          color: string
        ): readonly [number, number, number] => {
          const rgbMatch = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color)

          if (!rgbMatch) {
            throw new Error(`Expected rgb color, received ${color}`)
          }

          return [
            Number.parseInt(rgbMatch[1], 10) / 255,
            Number.parseInt(rgbMatch[2], 10) / 255,
            Number.parseInt(rgbMatch[3], 10) / 255
          ]
        }
        const getRelativeLuminanceFromRgb = (color: string): number => {
          const [red, green, blue] = parseCssRgbColor(color).map(toLinearChannel)

          return 0.2126 * red + 0.7152 * green + 0.0722 * blue
        }
        const getContrastRatio = (
          firstColor: string,
          secondColor: string
        ): number => {
          const firstLuminance = getRelativeLuminance(firstColor)
          const secondLuminance = getRelativeLuminance(secondColor)
          const lighter = Math.max(firstLuminance, secondLuminance)
          const darker = Math.min(firstLuminance, secondLuminance)

          return (lighter + 0.05) / (darker + 0.05)
        }
        const getCssContrastRatio = (
          firstColor: string,
          secondColor: string
        ): number => {
          const firstLuminance = getRelativeLuminanceFromRgb(firstColor)
          const secondLuminance = getRelativeLuminanceFromRgb(secondColor)
          const lighter = Math.max(firstLuminance, secondLuminance)
          const darker = Math.min(firstLuminance, secondLuminance)

          return (lighter + 0.05) / (darker + 0.05)
        }
        const toRenderedColor = (color: string): string => {
          const probe = document.createElement('span')

          probe.style.color = color
          document.body.append(probe)
          const renderedColor = getComputedStyle(probe).color
          probe.remove()

          return renderedColor
        }
        const requireElement = <ElementType extends Element>(
          selector: string
        ): ElementType => {
          const element = document.querySelector<ElementType>(selector)

          if (!element) {
            throw new Error(`Missing themed element ${selector}`)
          }

          return element
        }
        const shell = requireElement<HTMLElement>('.app-shell')
        const shellStyles = getComputedStyle(shell)
        const editorBg = shellStyles.getPropertyValue('--editor-bg').trim()
        const editorText = shellStyles.getPropertyValue('--editor-text').trim()
        const editorMuted = shellStyles.getPropertyValue('--editor-muted').trim()
        const editorAccent = shellStyles.getPropertyValue('--editor-accent').trim()
        const panelBg = shellStyles.getPropertyValue('--panel-bg').trim()
        const panelText = shellStyles.getPropertyValue('--panel-text').trim()
        const panelMuted = shellStyles.getPropertyValue('--panel-muted').trim()
        const strongSurface = shellStyles
          .getPropertyValue('--editor-surface-strong')
          .trim()
        const strongSurfaceColor = toRenderedColor(strongSurface)
        const codeBlock = requireElement<HTMLElement>(
          ".markdown-editor-surface .bn-block-content[data-content-type='codeBlock']"
        )
        const mermaidCard = requireElement<HTMLElement>('.mermaid-flowchart-card')
        const frontmatterPanel = requireElement<HTMLElement>('.frontmatter-panel')
        const selectedThemeOption = requireElement<HTMLElement>(
          '.theme-option-button.is-selected'
        )
        const codeBlockStyles = getComputedStyle(codeBlock)
        const mermaidCardStyles = getComputedStyle(mermaidCard)
        const frontmatterRect = frontmatterPanel.getBoundingClientRect()
        const selectedThemeRect = selectedThemeOption.getBoundingClientRect()
        const codeTokenMetrics = Array.from(
          codeBlock.querySelectorAll<HTMLElement>('span.shiki')
        ).map((token) => {
          const tokenColor = getComputedStyle(token).color

          return {
            color: tokenColor,
            contrast: getCssContrastRatio(
              tokenColor,
              codeBlockStyles.backgroundColor
            ),
            style: token.getAttribute('style') ?? '',
            text: token.textContent ?? ''
          }
        })
        const minimumCodeTokenMetric = codeTokenMetrics.reduce(
          (minimumMetric, metric) =>
            metric.contrast < minimumMetric.contrast ? metric : minimumMetric,
          codeTokenMetrics[0]
        )

        return {
          accentContrast: getContrastRatio(editorAccent, editorBg),
          codeBackgroundMatchesStrong:
            codeBlockStyles.backgroundColor === strongSurfaceColor,
          codeTokenMinimumContrast: minimumCodeTokenMetric?.contrast ?? 0,
          codeTokenMinimumMetric: minimumCodeTokenMetric,
          editorMutedContrast: getContrastRatio(editorMuted, editorBg),
          editorTextContrast: getContrastRatio(editorText, editorBg),
          frontmatterVisible:
            frontmatterRect.width > 100 && frontmatterRect.height > 20,
          highlightedCodeTokenCount: codeTokenMetrics.length,
          mermaidBackgroundMatchesStrong:
            mermaidCardStyles.backgroundColor === strongSurfaceColor,
          panelMutedContrast: getContrastRatio(panelMuted, panelBg),
          panelTextContrast: getContrastRatio(panelText, panelBg),
          selectedThemeVisible:
            selectedThemeRect.width > 100 && selectedThemeRect.height > 40
        }
      })

      expect(metrics.editorTextContrast).toBeGreaterThanOrEqual(7)
      expect(metrics.editorMutedContrast).toBeGreaterThanOrEqual(4.5)
      expect(metrics.panelTextContrast).toBeGreaterThanOrEqual(7)
      expect(metrics.panelMutedContrast).toBeGreaterThanOrEqual(4.5)
      expect(metrics.accentContrast).toBeGreaterThanOrEqual(4.5)
      expect(metrics.codeBackgroundMatchesStrong).toBe(true)
      expect(metrics.highlightedCodeTokenCount).toBeGreaterThan(0)
      expect(
        metrics.codeTokenMinimumContrast,
        `minimum code token after selecting ${themeId}: ${JSON.stringify(
          metrics.codeTokenMinimumMetric
        )}`
      ).toBeGreaterThanOrEqual(4.5)
      expect(metrics.mermaidBackgroundMatchesStrong).toBe(true)
      expect(metrics.frontmatterVisible).toBe(true)
      expect(metrics.selectedThemeVisible).toBe(true)
      expect(
        startupDiagnostics.errors.slice(previousErrorCount),
        `renderer errors after selecting ${themeId}`
      ).toEqual([])
    }

    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('switches the app language from Preference settings and persists it', async () => {
  const { app, startupDiagnostics, window } = await launchElectronApp()

  try {
    await setAppLanguagePreference(window, 'en')
    await addCustomAppLanguagePack(window)
    await expect(window.getByRole('button', { name: /close workspace popup/i }))
      .toBeVisible()
    await window.getByRole('button', { name: /close workspace popup/i }).click()

    expect(await window.evaluate(() => document.documentElement.lang)).toBe('en')
    await window.getByRole('button', { name: /open settings/i }).click()
    await expect(window.getByRole('dialog', { name: /settings/i })).toBeVisible()
    await window.getByRole('button', { name: /^Preference$/ }).click()

    const languageSelect = window.getByRole('combobox', { name: /^Language$/ })

    await expect(languageSelect).toHaveValue('en')
    await expect(
      languageSelect.locator('option', { hasText: 'Spanish (Custom)' })
    ).toHaveCount(1)
    await languageSelect.selectOption('zh')

    await expect(window.getByRole('dialog', { name: /^设置$/ })).toBeVisible()
    await expect(window.getByRole('button', { name: /^偏好$/ })).toHaveAttribute(
      'aria-current',
      'page'
    )
    await expect(window.getByRole('combobox', { name: /^语言$/ })).toHaveValue('zh')
    expect(await window.evaluate(() => document.documentElement.lang)).toBe(
      'zh-CN'
    )
    expect(
      await window.evaluate(() =>
        globalThis.localStorage.getItem('mde.appLanguagePreference')
      )
    ).toBe('zh')

    await window.evaluate(() => {
      globalThis.location.reload()
    })

    await expect(window.getByRole('button', { name: /打开设置/ })).toBeEnabled()
    await expect(window.getByRole('heading', { name: /^打开工作区$/ })).toBeVisible()
    expect(await window.evaluate(() => document.documentElement.lang)).toBe(
      'zh-CN'
    )
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('keeps editor contents visible when switching the app language', async () => {
  const workspacePath = await createFixtureWorkspace()
  const readmePath = join(workspacePath, 'README.md')
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /README\.md Markdown file/i }).click()

    const editor = window.getByTestId('markdown-block-editor')
    await expect(editor).toContainText('Root markdown file.')

    await focusTextEndInEditor(window, 'Root markdown file.')
    await window.keyboard.press('Enter')
    await window.keyboard.insertText('Language switch draft remains')
    await expect(editor).toContainText('Language switch draft remains')

    await window.getByRole('button', { name: /^open settings$/i }).click()
    await expect(window.getByRole('dialog', { name: /^Settings$/ })).toBeVisible()
    await window.getByRole('button', { name: /^Preference$/ }).click()
    await window.getByRole('combobox', { name: /^Language$/ }).selectOption('zh')

    await expect(window.getByRole('dialog', { name: /^设置$/ })).toBeVisible()
    await expect(editor).toContainText('Root markdown file.')
    await expect(editor).toContainText('Language switch draft remains')
    await expect
      .poll(async () => readFile(readmePath, 'utf8'), { timeout: 5_000 })
      .toContain('Root markdown file.')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('selects the current system theme family without leaving follow-system mode', async () => {
  const { app, startupDiagnostics, window } = await launchElectronApp()

  try {
    await window.evaluate(() => {
      globalThis.localStorage.setItem(
        'mde.themePreference',
        JSON.stringify({
          lastDarkThemeId: 'carbon',
          lastLightThemeId: 'manuscript',
          mode: 'system'
        })
      )
      globalThis.location.reload()
    })

    const appShell = window.locator('.app-shell')

    await window.getByRole('button', { name: /close workspace popup/i }).click()
    await window.getByRole('button', { name: /change theme/i }).click()
    await expect(window.getByRole('dialog', { name: /settings/i })).toBeVisible()
    await expect(
      window.getByRole('switch', { name: /follow system appearance/i })
    ).toBeChecked()
    await expect(window.getByRole('radiogroup', { name: /theme colorways/i }))
      .toBeVisible()
    await expect(window.locator('.theme-colorway-grid')).toHaveAttribute(
      'data-column-count',
      '2'
    )
    await expect(window.locator('.theme-column-heading')).toHaveCount(0)
    await expect(window.getByRole('radio', { name: /blue hour/i }))
      .toHaveCount(0)
    await expect(window.getByRole('radio', { name: /glacier/i })).toBeVisible()

    await window.getByRole('radio', { name: /binder/i }).click()

    await expect(appShell).toHaveAttribute('data-theme', 'binder')
    await expect(appShell).toHaveAttribute('data-theme-family', 'light')
    await expect(
      window.getByRole('switch', { name: /follow system appearance/i })
    ).toBeChecked()
    expect(
      await window.evaluate(() =>
        globalThis.localStorage.getItem('mde.themePreference')
      )
    ).toBe(
      JSON.stringify({
        lastDarkThemeId: 'carbon',
        lastLightThemeId: 'binder',
        mode: 'system'
      })
    )
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('follows system appearance using the remembered light and dark themes', async () => {
  const { app, startupDiagnostics, window } = await launchElectronApp()

  try {
    await window.emulateMedia({ colorScheme: 'dark' })
    await window.evaluate(() => {
      globalThis.localStorage.setItem(
        'mde.themePreference',
        JSON.stringify({
          lastDarkThemeId: 'moss',
          lastLightThemeId: 'porcelain',
          mode: 'system'
        })
      )
      globalThis.location.reload()
    })

    const appShell = window.locator('.app-shell')

    await window.waitForFunction(
      () => document.querySelector('.app-shell')?.getAttribute('data-theme') === 'moss'
    )
    await expect(appShell).toHaveAttribute('data-theme', 'moss')

    await window.emulateMedia({ colorScheme: 'light' })
    await expect(appShell).toHaveAttribute('data-theme', 'porcelain')

    await window.emulateMedia({ colorScheme: 'dark' })
    await expect(appShell).toHaveAttribute('data-theme', 'moss')
    expect(
      await window.evaluate(() =>
        globalThis.localStorage.getItem('mde.themePreference')
      )
    ).toBe(
      JSON.stringify({
        lastDarkThemeId: 'moss',
        lastLightThemeId: 'porcelain',
        mode: 'system'
      })
    )
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('exposes update checks through the preload API in development builds', async () => {
  const { app, startupDiagnostics, window } = await launchElectronApp()

  try {
    const updateResult = await window.evaluate(async () => {
      const updateWindow = globalThis as unknown as Window & {
        updateApi?: {
          checkForUpdates: () => Promise<{
            message?: string
            updateAvailable: boolean
          }>
        }
      }

      if (!updateWindow.updateApi) {
        throw new Error('Update API missing')
      }

      return updateWindow.updateApi.checkForUpdates()
    })

    expect(updateResult).toMatchObject({
      message: 'Update checks are disabled.',
      updateAvailable: false
    })
    await expect(
      window.getByRole('dialog', { name: /mde update/i })
    ).toHaveCount(0)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('falls back to the public release feed when GitHub REST update checks are rate limited', async () => {
  test.skip(process.platform !== 'darwin', 'macOS manual update flow only')

  const updateServer = await startUpdateFallbackServer()
  const expectedUpdateArch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const { app, startupDiagnostics, window } = await launchElectronApp({
    env: {
      MDE_TEST_FORCE_AUTO_UPDATE: '1',
      MDE_TEST_APP_VERSION: '1.2.18',
      MDE_TEST_RELEASE_API_URL: `${updateServer.url}/api/releases`,
      MDE_TEST_RELEASE_FEED_URL: `${updateServer.url}/releases.atom`
    }
  })

  try {
    const updateResult = await window.evaluate(async () => {
      const updateWindow = globalThis as unknown as Window & {
        updateApi?: {
          checkForUpdates: () => Promise<{
            update?: {
              assetName?: string
              latestVersion: string
              releaseUrl: string
            }
            updateAvailable: boolean
          }>
        }
      }

      if (!updateWindow.updateApi) {
        throw new Error('Update API missing')
      }

      return updateWindow.updateApi.checkForUpdates()
    })

    if (!updateResult.updateAvailable) {
      throw new Error(
        `Expected update fallback to find a release: ${JSON.stringify({
          requests: updateServer.requests,
          updateResult
        })}`
      )
    }

    expect(updateResult).toMatchObject({
      update: {
        assetName: `MDE-1.2.19-mac-${expectedUpdateArch}.dmg`,
        latestVersion: '1.2.19',
        releaseUrl: 'https://github.com/flowforever/mde/releases/tag/v1.2.19'
      },
      updateAvailable: true
    })
    expect(updateServer.requests).toContain('/api/releases')
    expect(updateServer.requests).toContain('/releases.atom')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
    await updateServer.close()
  }
})

test('searches and removes many recent workspace items from the manager popup', async () => {
  const { app, startupDiagnostics, window } = await launchElectronApp()

  try {
    await window.evaluate(() => {
      globalThis.localStorage.setItem(
        'mde.recentWorkspaces',
        JSON.stringify([
          ...Array.from({ length: 18 }, (_, index) => ({
            name: `Workspace ${index + 1}`,
            rootPath: `/workspaces/${index + 1}`,
            type: 'workspace'
          })),
          {
            filePath: '/notes/API.md',
            name: 'API.md',
            openedFilePath: 'API.md',
            rootPath: '/notes',
            type: 'file'
          }
        ])
      )
      globalThis.location.reload()
    })

    const resourceList = window.locator('.workspace-resource-list')

    await expect(resourceList).toBeVisible()
    expect(
      await resourceList.evaluate((element) => ({
        canScroll: element.scrollHeight > element.clientHeight,
        overflowY: globalThis.getComputedStyle(element).overflowY
      }))
    ).toMatchObject({
      canScroll: true,
      overflowY: 'auto'
    })
    await expect(
      window.getByRole('button', {
        name: /^open workspace Workspace 1 in new window$/i
      })
    ).toBeVisible()
    const openInNewWindowButton = window.getByRole('button', {
      name: /^open workspace Workspace 1 in new window$/i
    })
    const deleteWorkspaceButton = window.getByRole('button', {
      name: /^remove recent workspace Workspace 1$/i
    })
    const [openButtonBox, deleteButtonBox] = await Promise.all([
      openInNewWindowButton.boundingBox(),
      deleteWorkspaceButton.boundingBox()
    ])

    expect(openButtonBox?.height).toBe(deleteButtonBox?.height)
    expect(openButtonBox?.width).toBe(deleteButtonBox?.width)

    await window
      .getByRole('searchbox', { name: /search workspaces and files/i })
      .fill('api')
    await expect(
      window.getByRole('button', { name: /switch to file API\.md/i })
    ).toBeVisible()
    await expect(
      window.getByRole('button', { name: /switch to workspace Workspace 1/i })
    ).toHaveCount(0)

    await window.getByRole('button', { name: /remove recent file API\.md/i }).click()
    await expect(
      window.getByRole('button', { name: /switch to file API\.md/i })
    ).toHaveCount(0)
    expect(
      await window.evaluate(() =>
        globalThis.localStorage.getItem('mde.recentWorkspaces')
      )
    ).not.toContain('API.md')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('opens a workspace and expands the docs folder', async () => {
  const workspacePath = await createFixtureWorkspace()

  await mkdir(join(workspacePath, '.vscode'), { recursive: true })
  await writeFile(join(workspacePath, '.vscode', 'settings.md'), '# Settings')
  await writeFile(join(workspacePath, '.draft.md'), '# Draft')

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await openNewWorkspace(window)

    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })
    await expect(window).toHaveTitle(await realpath(workspacePath))
    await expect(
      window.getByRole('button', { name: /docs folder/i })
    ).toBeVisible()
    await expect(
      window.getByRole('button', { name: /\.vscode folder/i })
    ).toBeHidden()
    await expect(
      window.getByRole('button', { name: /\.draft\.md Markdown file/i })
    ).toBeHidden()

    await window.getByRole('button', { name: /show hidden entries/i }).click()

    await expect(
      window.getByRole('button', { name: /\.vscode folder/i })
    ).toBeVisible()
    await expect(
      window.getByRole('button', { name: /\.draft\.md Markdown file/i })
    ).toBeVisible()
    await window.getByRole('button', { name: /hide hidden entries/i }).click()

    await window.getByRole('button', { name: /expand docs/i }).click()

    await expect(
      window.getByRole('button', { name: /intro\.md Markdown file/i })
    ).toBeVisible()
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('starts each Electron launch with isolated persisted workspace state', async () => {
  const workspacePath = await createFixtureWorkspace()
  const firstLaunch = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await openNewWorkspace(firstLaunch.window)
    await expect(
      firstLaunch.window.getByRole('button', {
        name: /README\.md Markdown file/i
      })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })
    expect(firstLaunch.startupDiagnostics.errors).toEqual([])
  } finally {
    await firstLaunch.app.close()
  }

  const secondLaunch = await launchElectronApp()

  try {
    await expect(
      secondLaunch.window.getByRole('button', { name: /^open workspace$/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })
    await expect(
      secondLaunch.window.getByRole('dialog', {
        name: /workspace manager/i
      })
    ).toBeVisible()
    await expect(
      secondLaunch.window.getByRole('button', {
        name: /README\.md Markdown file/i
      })
    ).toHaveCount(0)
    expect(secondLaunch.startupDiagnostics.errors).toEqual([])
  } finally {
    await secondLaunch.app.close()
  }
})

test('opens a workspace from a command line path', async () => {
  const workspacePath = await createFixtureWorkspace()
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [workspacePath]
  })

  try {
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })
    await expect(
      window.getByRole('button', { name: /manage workspaces/i })
    ).toBeVisible()
    await expect(window).toHaveTitle(await realpath(workspacePath))
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('shows and clears the external resource drop target feedback', async () => {
  const workspacePath = await createFixtureWorkspace()
  const introPath = join(workspacePath, 'docs', 'intro.md')
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await openNewWorkspace(window)

    expect(await dispatchResourceDragEvent(window, 'dragenter', introPath)).toBe(
      true
    )
    expect(await dispatchResourceDragEvent(window, 'dragover', introPath)).toBe(
      true
    )
    await expect(
      window.getByRole('status', { name: /drop files or folders to open/i })
    ).toBeVisible()

    await window.keyboard.press('Escape')
    await expect(
      window.getByRole('status', { name: /drop files or folders to open/i })
    ).toHaveCount(0)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('opens a dropped workspace Markdown file in the current window', async () => {
  const workspacePath = await createFixtureWorkspace()
  const introPath = join(workspacePath, 'docs', 'intro.md')
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await openNewWorkspace(window)
    await expect(window).toHaveTitle(await realpath(workspacePath))
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })
    await dispatchResourceDragEvent(window, 'dragenter', introPath)
    await dispatchResourceDragEvent(window, 'drop', introPath)

    await expect(window).toHaveTitle(
      `intro.md - ${await realpath(workspacePath)}`
    )
    await expect(
      window.getByRole('button', { name: /docs folder/i })
    ).toHaveAttribute('aria-expanded', 'true')
    await expect(
      window.getByRole('button', { name: /intro\.md Markdown file/i })
    ).toHaveAttribute('aria-current', 'page')
    await expect(window.locator('.bn-editor')).toContainText(
      'Nested markdown file.'
    )
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('opens dropped resources in the current empty window', async () => {
  const workspacePath = await createFixtureWorkspace()
  const fileParentPath = await mkdtemp(join(tmpdir(), 'mde-drop-file-'))
  const filePath = join(fileParentPath, 'drop-file.md')

  await writeFile(filePath, '# Dropped file')

  const directoryLaunch = await launchElectronApp()

  try {
    await directoryLaunch.window
      .getByRole('button', { name: /close workspace popup/i })
      .click()
    await dispatchResourceDragEvent(directoryLaunch.window, 'drop', workspacePath)

    await expect(directoryLaunch.window).toHaveTitle(
      await realpath(workspacePath)
    )
    await expect(
      directoryLaunch.window.getByRole('button', {
        name: /README\.md Markdown file/i
      })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })
    expect(directoryLaunch.startupDiagnostics.errors).toEqual([])
  } finally {
    await directoryLaunch.app.close()
  }

  const fileLaunch = await launchElectronApp()

  try {
    await fileLaunch.window
      .getByRole('button', { name: /close workspace popup/i })
      .click()
    await dispatchResourceDragEvent(fileLaunch.window, 'drop', filePath)

    await expect(fileLaunch.window).toHaveTitle(
      `drop-file.md - ${await realpath(fileParentPath)}`
    )
    await expect(fileLaunch.window.locator('.bn-editor')).toContainText(
      'Dropped file'
    )
    expect(fileLaunch.startupDiagnostics.errors).toEqual([])
  } finally {
    await fileLaunch.app.close()
  }
})

test('opens an external dropped Markdown file in a new window', async () => {
  const workspacePath = await createFixtureWorkspace()
  const externalParentPath = await mkdtemp(join(tmpdir(), 'mde-external-drop-'))
  const externalFilePath = join(externalParentPath, 'external.md')

  await writeFile(externalFilePath, '# External drop')

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await openNewWorkspace(window)

    const newWindowPromise = app.waitForEvent('window')

    await dispatchResourceDragEvent(window, 'drop', externalFilePath)

    const newWindow = await newWindowPromise

    await newWindow.waitForLoadState('domcontentloaded', { timeout: 20_000 })
    await newWindow.locator('.app-shell').waitFor({
      state: 'visible',
      timeout: E2E_UI_READY_TIMEOUT_MS
    })
    await expect(window).toHaveTitle(await realpath(workspacePath))
    await expect(newWindow).toHaveTitle(
      `external.md - ${await realpath(externalParentPath)}`
    )
    await expect(newWindow.locator('.bn-editor')).toContainText('External drop')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('keeps the expanded explorer tree on its own scrollbar', async () => {
  const workspacePath = await createFixtureWorkspace()

  await mkdir(join(workspacePath, 'many'))
  await Promise.all(
    Array.from({ length: 80 }, (_, index) =>
      writeFile(
        join(workspacePath, 'many', `note-${String(index + 1).padStart(2, '0')}.md`),
        `# Note ${index + 1}`
      )
    )
  )

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await window.setViewportSize({ width: 900, height: 600 })
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /expand many/i }).click()

    const explorerTree = window.locator('.explorer-tree-root')

    await expect(
      window.getByRole('button', { name: /note-80\.md Markdown file/i })
    ).toBeAttached()
    expect(
      await explorerTree.evaluate((element) => ({
        canScroll: element.scrollHeight > element.clientHeight,
        overflowY: globalThis.getComputedStyle(element).overflowY
      }))
    ).toMatchObject({
      canScroll: true,
      overflowY: 'auto'
    })

    await explorerTree.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })

    expect(await explorerTree.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    await expect(
      window.getByRole('button', { name: /note-80\.md Markdown file/i })
    ).toBeInViewport()
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('resizes and toggles the explorer sidebar', async () => {
  const workspacePath = await createFixtureWorkspace()
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await window.setViewportSize({ width: 900, height: 600 })
    await openNewWorkspace(window)

    const explorerPane = window.locator('.explorer-pane')
    const resizeHandle = window.getByRole('separator', {
      name: /resize explorer sidebar/i
    })
    const initialWidth = await explorerPane.evaluate(
      (element) => element.getBoundingClientRect().width
    )

    await resizeHandle.hover()
    await window.mouse.down()
    await window.mouse.move(360, 100)
    await window.mouse.up()

    expect(
      await explorerPane.evaluate((element) => element.getBoundingClientRect().width)
    ).toBeGreaterThan(initialWidth + 48)

    await window
      .getByRole('button', { name: /collapse explorer sidebar/i })
      .click()
    await expect(
      window.getByRole('button', { name: /manage workspaces/i })
    ).toHaveCount(0)
    await expect(resizeHandle).toHaveCount(0)
    expect(
      await explorerPane.evaluate((element) => element.getBoundingClientRect().width)
    ).toBeLessThanOrEqual(56)
    expect(
      await explorerPane.evaluate(
        (element) => globalThis.getComputedStyle(element).borderRightWidth
      )
    ).toBe('1px')

    await window.getByRole('button', { name: /expand explorer sidebar/i }).click()
    await expect(
      window.getByRole('button', { name: /manage workspaces/i })
    ).toBeVisible()
    await expect(
      window.getByRole('separator', { name: /resize explorer sidebar/i })
    ).toBeVisible()
    expect(
      await explorerPane.evaluate((element) => element.getBoundingClientRect().width)
    ).toBeGreaterThan(initialWidth + 48)
    expect(
      await explorerPane.evaluate(
        (element) => globalThis.getComputedStyle(element).borderRightWidth
      )
    ).toBe('0px')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('loads README markdown into the block editor surface', async () => {
  const workspacePath = await createFixtureWorkspace()
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /README\.md Markdown file/i }).click()

    const editor = window.getByTestId('markdown-block-editor')

    await expect(editor).toBeVisible()
    await expect(editor).toContainText('Fixture Workspace')
    await expect(editor).toContainText('Root markdown file.')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('exposes internal component ids on key app regions', async () => {
  const workspacePath = await createFixtureWorkspace()
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /README\.md Markdown file/i }).click()

    await expect(
      window.locator(`[data-component-id="${COMPONENT_IDS.app.shell}"]`)
    ).toBeVisible()
    await expect(
      window.locator(`[data-component-id="${COMPONENT_IDS.explorer.pane}"]`)
    ).toBeVisible()
    await expect(
      window.locator(`[data-component-id="${COMPONENT_IDS.editor.pane}"]`)
    ).toBeVisible()
    await expect(
      window.locator(
        `[data-component-id="${COMPONENT_IDS.explorer.newMarkdownFileButton}"]`
      )
    ).toBeVisible()
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('hides editor block hover controls when the pointer moves over the explorer', async () => {
  const workspacePath = await createFixtureWorkspace()
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await window.setViewportSize({ width: 1440, height: 900 })
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /README\.md Markdown file/i }).click()
    await expect(window.getByTestId('markdown-block-editor')).toContainText(
      'Root markdown file.'
    )

    await focusTextEndInEditor(window, 'Root markdown file.')

    await window.evaluate(() => {
      const content = document.querySelector<HTMLElement>('.markdown-editor-content')

      if (!content) {
        throw new Error('Missing editor content for hover regression test')
      }

      const probe = document.createElement('div')
      probe.className = 'bn-side-menu'
      probe.dataset.testid = 'editor-side-menu-hover-probe'
      content.append(probe)
    })

    const editorContentBox = await window
      .locator('.markdown-editor-content')
      .boundingBox()

    if (!editorContentBox) {
      throw new Error('Missing editor content bounds for hover regression test')
    }

    const probeOpacity = async (): Promise<number> =>
      window.evaluate(() => {
        const probe = document.querySelector<HTMLElement>(
          '[data-testid="editor-side-menu-hover-probe"]'
        )

        if (!probe) {
          throw new Error('Missing editor side menu hover probe')
        }

        return Number.parseFloat(getComputedStyle(probe).opacity)
      })

    await window.mouse.move(
      editorContentBox.x + Math.min(editorContentBox.width / 2, 120),
      editorContentBox.y + Math.min(editorContentBox.height / 2, 120)
    )
    await window.waitForTimeout(100)
    expect(await probeOpacity()).toBeGreaterThan(0.5)

    const explorerBox = await window.locator('.explorer-pane').boundingBox()

    if (!explorerBox) {
      throw new Error('Missing explorer bounds for hover regression test')
    }

    await window.mouse.move(
      explorerBox.x + explorerBox.width / 2,
      explorerBox.y + explorerBox.height * 0.58
    )
    await window.waitForTimeout(150)

    expect(await probeOpacity()).toBeLessThanOrEqual(0.05)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('selects only editor content when select all is pressed inside the editor', async () => {
  const workspacePath = await createFixtureWorkspace()
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /README\.md Markdown file/i }).click()

    const editableDocument = window
      .getByTestId('blocknote-view')
      .locator('[contenteditable="true"]')
      .first()

    await expect(editableDocument).toBeVisible()
    await editableDocument.click()
    await window.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')

    const selectionText = await window.evaluate(() => getSelection()?.toString() ?? '')

    expect(selectionText).toContain('Fixture Workspace')
    expect(selectionText).toContain('Root markdown file.')
    expect(selectionText).not.toContain('Recent Files')
    expect(selectionText).not.toContain('Explorer')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('renders and preserves YAML frontmatter outside the editor body', async () => {
  const workspacePath = await createFixtureWorkspace()
  const readmePath = join(workspacePath, 'README.md')
  const invalidPath = join(workspacePath, 'invalid.md')

  await writeFile(
    readmePath,
    [
      '---',
      'name: auto-pick-tasks',
      'description: Use ready tasks',
      '---',
      '# Auto Pick Tasks',
      '',
      'Body paragraph.'
    ].join('\n')
  )
  await writeFile(
    invalidPath,
    ['---', 'name: [unterminated', '---', '# Invalid Body', '', 'Safe body.'].join(
      '\n'
    )
  )

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /README\.md Markdown file/i }).click()

    const editor = window.getByTestId('markdown-block-editor')
    const editorSurface = editor.locator('.markdown-editor-surface')

    await expect(
      window.getByRole('button', { name: /name: auto-pick-tasks/i })
    ).toBeVisible()
    await expect(editorSurface).toContainText('Auto Pick Tasks')
    await expect(editorSurface).not.toContainText('name: auto-pick-tasks')
    await expect(editor).not.toContainText('2 fields')
    await expect
      .poll(async () =>
        editor.evaluate((element) => {
          const frontmatterRect = element
            .querySelector('.frontmatter-panel')
            ?.getBoundingClientRect()
          const contentRect = element
            .querySelector('.markdown-editor-content')
            ?.getBoundingClientRect()

          if (!frontmatterRect || !contentRect) {
            return Number.NaN
          }

          return Math.abs(frontmatterRect.left - contentRect.left)
        })
      )
      .toBeLessThanOrEqual(1)
    await expect
      .poll(async () =>
        editor.evaluate((element) => {
          const summaryTextRect = element
            .querySelector('.frontmatter-summary-text')
            ?.getBoundingClientRect()
          const firstBodyBlockRect = element
            .querySelector('.markdown-editor-surface .bn-block-content')
            ?.getBoundingClientRect()

          if (!summaryTextRect || !firstBodyBlockRect) {
            return Number.NaN
          }

          return Math.abs(summaryTextRect.left - firstBodyBlockRect.left)
        })
      )
      .toBeLessThanOrEqual(1)

    await window.getByRole('button', { name: /name: auto-pick-tasks/i }).click()
    await expect(window.locator('.frontmatter-field-list')).toContainText('name')
    await expect(window.locator('.frontmatter-field-list')).toContainText(
      'Use ready tasks'
    )

    await window.getByRole('button', { name: /^Source$/i }).click()
    await window
      .getByRole('textbox', { name: /raw frontmatter yaml/i })
      .fill('name: updated-frontmatter\ndescription: Updated metadata')
    await window.getByRole('button', { name: /apply frontmatter/i }).click()
    await window.keyboard.press(process.platform === 'darwin' ? 'Meta+S' : 'Control+S')

    await expect.poll(async () => readFile(readmePath, 'utf8')).toContain(
      'name: updated-frontmatter'
    )

    await focusTextEndInEditor(window, 'Body paragraph.')
    await window.keyboard.insertText(' Edited body.')

    await expect
      .poll(async () => readFile(readmePath, 'utf8'), { timeout: 10_000 })
      .toContain('Body paragraph. Edited body.')
    await expect.poll(async () => readFile(readmePath, 'utf8')).toMatch(
      /^---\nname: updated-frontmatter\ndescription: Updated metadata\n---\n# Auto Pick Tasks/
    )

    await window
      .getByRole('button', { name: /invalid\.md Markdown file/i })
      .click()
    await expect(
      window.getByRole('button', { name: /name: \[unterminated/i })
    ).toContainText(/invalid YAML/i)
    await expect(window.getByText(/frontmatter parse failed/i)).toBeVisible()
    await expect(
      window.getByRole('textbox', { name: /raw frontmatter yaml/i })
    ).toHaveValue('name: [unterminated')

    await expect(editorSurface).toContainText('Safe body.')
    await focusTextEndInEditor(window, 'Safe body.')
    await window.keyboard.insertText(' Still editable.')
    await window.keyboard.press(process.platform === 'darwin' ? 'Meta+S' : 'Control+S')
    await expect
      .poll(async () => readFile(invalidPath, 'utf8'), { timeout: 10_000 })
      .toContain('name: [unterminated')
    await expect
      .poll(async () => readFile(invalidPath, 'utf8'), { timeout: 10_000 })
      .toContain('Safe body. Still editable.')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('renders Markdown body with compact document typography', async () => {
  const workspacePath = await createFixtureWorkspace()
  const renderStylePath = join(workspacePath, 'render-style.md')

  await writeFile(
    renderStylePath,
    [
      '---',
      'owner: docs',
      'status: review',
      '---',
      '# Render Style Fixture',
      '',
      'Technical paragraph with frontmatter, workspace, Codex, Claude Code, and release notes terms.',
      '',
      '## Document Density',
      '',
      'Body copy should remain readable without turning each block into a large note card.',
      '',
      '### Nested Signal',
      '',
      '- First compact list item',
      '- Second compact list item',
      '',
      '> A short quote should read like Markdown context, not oversized annotation text.',
      '',
      '```ts',
      'const workspace = "mde";',
      '```'
    ].join('\n')
  )

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await window.setViewportSize({ width: 1440, height: 900 })
    await openNewWorkspace(window)
    await window
      .getByRole('button', { name: /render-style\.md Markdown file/i })
      .click()

    const editor = window.getByTestId('markdown-block-editor')
    const editorSurface = editor.locator('.markdown-editor-surface')

    await expect(
      window.getByRole('button', { name: /owner: docs/i })
    ).toBeVisible()
    await expect(editor).not.toContainText('2 fields')
    await expect(editorSurface).toContainText('Render Style Fixture')
    await expect(editorSurface).toContainText('Document Density')
    await expect(editorSurface).toContainText('A short quote should read like Markdown context')

    const styles = await window.evaluate(() => {
      const readElement = (selector: string): HTMLElement => {
        const element = document.querySelector<HTMLElement>(selector)

        if (!element) {
          const availableElements = Array.from(
            document.querySelectorAll<HTMLElement>(
              '.markdown-editor-surface [data-content-type], .markdown-editor-surface .bn-block-content'
            )
          )
            .slice(0, 24)
            .map((availableElement) => {
              const contentType = availableElement.getAttribute('data-content-type')
              const level = availableElement.getAttribute('data-level')
              const className = availableElement.className
              const text = availableElement.textContent?.trim().slice(0, 42) ?? ''

              return `${className} ${contentType ?? ''} ${level ?? ''} ${text}`.trim()
            })
            .join('\n')

          throw new Error(
            `Missing editor render element: ${selector}\nAvailable:\n${availableElements}`
          )
        }

        return element
      }
      const readStyle = (selector: string) => {
        const element = readElement(selector)
        const style = getComputedStyle(element)

        return {
          backgroundColor: style.backgroundColor,
          borderBottomWidth: Number.parseFloat(style.borderBottomWidth),
          borderLeftWidth: Number.parseFloat(style.borderLeftWidth),
          color: style.color,
          fontSize: Number.parseFloat(style.fontSize),
          lineHeight: Number.parseFloat(style.lineHeight),
          paddingBottom: Number.parseFloat(style.paddingBottom),
          paddingLeft: Number.parseFloat(style.paddingLeft),
          paddingTop: Number.parseFloat(style.paddingTop)
        }
      }
      const content = readElement('.markdown-editor-content')
      const sideMenus = Array.from(
        document.querySelectorAll<HTMLElement>('.markdown-editor-content .bn-side-menu')
      ).map((element) => {
        const style = getComputedStyle(element)

        return {
          display: style.display,
          opacity: Number.parseFloat(style.opacity),
          visibility: style.visibility
        }
      })

      return {
        body: readStyle(
          '.markdown-editor-surface .bn-block-content[data-content-type="paragraph"]'
        ),
        code: readStyle(
          '.markdown-editor-surface .bn-block-content[data-content-type="codeBlock"] > pre'
        ),
        h1: readStyle(
          '.markdown-editor-surface .bn-block-content[data-content-type="heading"]:not([data-level])'
        ),
        h2: readStyle(
          '.markdown-editor-surface .bn-block-content[data-content-type="heading"][data-level="2"]'
        ),
        h3: readStyle(
          '.markdown-editor-surface .bn-block-content[data-content-type="heading"][data-level="3"]'
        ),
        list: readStyle(
          '.markdown-editor-surface .bn-block-content[data-content-type="bulletListItem"]'
        ),
        quote: readStyle('.markdown-editor-surface [data-content-type="quote"] blockquote'),
        sideMenus,
        spellcheck: content.spellcheck
      }
    })

    expect(styles.spellcheck).toBe(false)
    expect(styles.body.fontSize).toBeGreaterThanOrEqual(16)
    expect(styles.body.fontSize).toBeLessThanOrEqual(17.5)
    expect(styles.body.lineHeight).toBeGreaterThanOrEqual(25)
    expect(styles.body.lineHeight).toBeLessThanOrEqual(30)
    expect(styles.h1.fontSize).toBeGreaterThanOrEqual(38)
    expect(styles.h1.fontSize).toBeLessThanOrEqual(46)
    expect(styles.h1.lineHeight / styles.h1.fontSize).toBeLessThanOrEqual(1.22)
    expect(styles.h1.borderBottomWidth).toBe(0)
    expect(styles.h2.fontSize).toBeGreaterThanOrEqual(26)
    expect(styles.h2.fontSize).toBeLessThanOrEqual(30)
    expect(styles.h2.borderBottomWidth).toBe(0)
    expect(styles.h3.fontSize).toBeGreaterThanOrEqual(21)
    expect(styles.h3.fontSize).toBeLessThanOrEqual(24)
    expect(styles.h3.borderBottomWidth).toBe(0)
    expect(styles.list.paddingTop).toBeLessThanOrEqual(4)
    expect(styles.quote.borderLeftWidth).toBeGreaterThanOrEqual(3)
    expect(styles.quote.fontSize).toBeGreaterThanOrEqual(16)
    expect(styles.quote.fontSize).toBeLessThanOrEqual(17.5)
    expect(styles.quote.paddingLeft).toBeGreaterThanOrEqual(12)
    expect(styles.code.paddingTop).toBeGreaterThanOrEqual(14)
    expect(
      styles.sideMenus.every(
        (sideMenu) =>
          sideMenu.display === 'none' ||
          sideMenu.visibility === 'hidden' ||
          sideMenu.opacity <= 0.05
      )
    ).toBe(true)

    await expect(editor.locator('.markdown-editor-surface .shiki').first()).toBeVisible({
      timeout: 15_000
    })

    const codeLanguageSelector = await window.evaluate(() => {
      const selector = document.querySelector<HTMLSelectElement>(
        '.markdown-editor-surface .bn-block-content[data-content-type="codeBlock"] > div > select'
      )

      if (!selector) {
        throw new Error('Missing code block language selector')
      }

      const rect = selector.getBoundingClientRect()
      const styles = getComputedStyle(selector)

      return {
        color: styles.color,
        height: rect.height,
        opacity: Number.parseFloat(styles.opacity),
        text: selector.options[selector.selectedIndex]?.textContent?.trim() ?? '',
        width: rect.width
      }
    })

    expect(codeLanguageSelector.text.length).toBeGreaterThan(0)
    expect(codeLanguageSelector.opacity).toBeGreaterThanOrEqual(0.95)
    expect(codeLanguageSelector.width).toBeGreaterThan(54)
    expect(codeLanguageSelector.height).toBeGreaterThan(22)

    await revealEditorOverflowActions(window)
    await window.getByRole('button', { name: /editor line spacing/i }).click()
    await window.getByRole('menuitemradio', { name: /relaxed/i }).click()

    const relaxedLineHeight = await window.evaluate(() => {
      const paragraph = document.querySelector<HTMLElement>(
        '.markdown-editor-surface .bn-block-content[data-content-type="paragraph"]'
      )

      if (!paragraph) {
        throw new Error('Missing paragraph after changing line spacing')
      }

      return Number.parseFloat(getComputedStyle(paragraph).lineHeight)
    })

    expect(relaxedLineHeight).toBeGreaterThan(styles.body.lineHeight)
    expect(
      await window.evaluate(() => localStorage.getItem('mde.editorLineSpacing'))
    ).toBe('relaxed')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('keeps loaded markdown intact when undo is pressed before editing', async () => {
  const workspacePath = await createFixtureWorkspace()
  const readmePath = join(workspacePath, 'README.md')
  const introPath = join(workspacePath, 'docs', 'intro.md')
  const originalMarkdown = await readFile(readmePath, 'utf8')
  const originalIntroMarkdown = await readFile(introPath, 'utf8')
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /README\.md Markdown file/i }).click()

    const editor = window.getByTestId('markdown-block-editor')
    const editableDocument = window
      .getByTestId('blocknote-view')
      .locator('[contenteditable="true"]')
      .first()

    await expect(editor).toContainText('Fixture Workspace')
    await expect(editableDocument).toBeVisible()
    await editableDocument.click()
    await window.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z')

    await expect(editor).toContainText('Fixture Workspace')
    await expect(editor).toContainText('Root markdown file.')
    await expect(window.getByText(/unsaved changes/i)).toHaveCount(0)
    await expect.poll(async () => readFile(readmePath, 'utf8')).toBe(originalMarkdown)

    await window.getByRole('button', { name: /expand docs/i }).click()
    await window
      .getByRole('button', { name: /intro\.md Markdown file/i })
      .click()

    await expect(editor).toContainText('Intro')
    await expect(editor).toContainText('Nested markdown file.')
    await editableDocument.click()
    await window.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z')

    await expect(editor).toContainText('Intro')
    await expect(editor).toContainText('Nested markdown file.')
    await expect(window.getByText(/unsaved changes/i)).toHaveCount(0)
    await expect
      .poll(async () => readFile(introPath, 'utf8'))
      .toBe(originalIntroMarkdown)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('toggles the editor between centered and full-width layouts', async () => {
  const workspacePath = await createFixtureWorkspace()
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await window.setViewportSize({ width: 1600, height: 900 })
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /README\.md Markdown file/i }).click()

    const editor = window.getByTestId('markdown-block-editor')
    const actionBar = window.locator('.editor-action-bar')
    const historyButton = window.getByRole('button', {
      name: /^version history$/i
    })
    const fullWidthButton = window.getByRole('button', {
      name: /use full-width editor view/i
    })

    await expect(editor).toBeVisible()
    await expect(historyButton).toBeVisible()
    await expect(actionBar).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    const actionBarWidth = await actionBar.evaluate(
      (element) => element.getBoundingClientRect().width
    )
    const centeredWidth = await editor.evaluate(
      (element) => element.getBoundingClientRect().width
    )

    expect(actionBarWidth).toBeLessThan(220)
    expect(actionBarWidth).toBeLessThan(centeredWidth)
    await revealEditorOverflowActions(window)
    await fullWidthButton.click()
    await expect(
      window.getByRole('button', { name: /use centered editor view/i })
    ).toBeVisible()
    const fullWidth = await editor.evaluate(
      (element) => element.getBoundingClientRect().width
    )

    expect(fullWidth).toBeGreaterThan(centeredWidth + 120)

    await window
      .getByRole('button', { name: /use centered editor view/i })
      .click()
    const recenteredWidth = await editor.evaluate(
      (element) => element.getBoundingClientRect().width
    )

    expect(Math.abs(recenteredWidth - centeredWidth)).toBeLessThanOrEqual(1)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('searches within the current Markdown editor', async () => {
  const workspacePath = await createFixtureWorkspace()
  const searchShortcut = process.platform === 'darwin' ? 'Meta+F' : 'Control+F'
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /README\.md Markdown file/i }).click()
    await expect(window.getByTestId('markdown-block-editor')).toContainText(
      'Root markdown file.'
    )

    await window.keyboard.press(searchShortcut)
    const searchBox = window.getByRole('searchbox', {
      name: /search current markdown/i
    })

    await expect(searchBox).toBeFocused()
    await expect(searchBox).toHaveAttribute('type', 'text')
    await searchBox.fill('markdown')
    await window.keyboard.press('Enter')

    await expect(window.locator('.editor-search-count')).toContainText('1/1')
    await expect
      .poll(() =>
        window.evaluate(() => {
          const cssApi = globalThis.CSS as
            | (typeof CSS & {
                highlights?: {
                  get: (name: string) => { size: number } | undefined
                  has: (name: string) => boolean
                }
              })
            | undefined

          return {
            activeSize: cssApi?.highlights?.get('mde-editor-search-active')?.size ?? 0,
            hasMatches: cssApi?.highlights?.has('mde-editor-search-match') ?? false
          }
        })
      )
      .toEqual({
        activeSize: 1,
        hasMatches: true
      })

    await window.keyboard.press('Escape')
    await expect(searchBox).toHaveCount(0)
    await window.keyboard.press(searchShortcut)
    const reopenedSearchBox = window.getByRole('searchbox', {
      name: /search current markdown/i
    })

    await expect(reopenedSearchBox).toBeFocused()
    await window
      .getByRole('button', { name: /pin editor search history item markdown/i })
      .click()
    await expect
      .poll(() =>
        window.evaluate(() => {
          const cssApi = globalThis.CSS as
            | (typeof CSS & {
                highlights?: {
                  get: (name: string) => { size: number } | undefined
                }
              })
            | undefined

          return cssApi?.highlights?.get('mde-editor-search-pin-0')?.size ?? 0
        })
      )
      .toBeGreaterThan(0)
    await window
      .getByRole('button', { name: /delete pinned editor search keyword markdown/i })
      .click()
    await expect
      .poll(() =>
        window.evaluate(() => {
          const cssApi = globalThis.CSS as
            | (typeof CSS & {
                highlights?: {
                  get: (name: string) => { size: number } | undefined
                }
              })
            | undefined

          return cssApi?.highlights?.get('mde-editor-search-pin-0')?.size ?? 0
        })
      )
      .toBe(0)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('searches the workspace and opens a matched file with editor highlights', async () => {
  const workspacePath = await createFixtureWorkspace()
  const searchShortcut =
    process.platform === 'darwin' ? 'Meta+Shift+F' : 'Control+Shift+F'
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await openNewWorkspace(window)
    await window.keyboard.press(searchShortcut)
    const searchBox = window.getByRole('searchbox', {
      name: /search workspace contents/i
    })

    await expect(searchBox).toBeFocused()
    await expect(searchBox).toHaveAttribute('type', 'text')
    await searchBox.fill('nested')
    await expect(
      window.locator('.global-search-result-match').filter({ hasText: /Nested/i })
        .first()
    ).toBeVisible()
    await window
      .getByRole('button', { name: /open search result docs\/intro\.md line 3/i })
      .click()

    await expect(window.getByTestId('markdown-block-editor')).toContainText(
      'Nested markdown file.'
    )
    await expect(window).toHaveTitle(`intro.md - ${await realpath(workspacePath)}`)
    await expect(
      window.getByRole('searchbox', { name: /search current markdown/i })
    ).toHaveValue('nested')
    await expect(window.locator('.editor-search-count')).toContainText('1/1')
    await window.keyboard.press(searchShortcut)
    const reopenedWorkspaceSearch = window.getByRole('searchbox', {
      name: /search workspace contents/i
    })

    await expect(reopenedWorkspaceSearch).toBeFocused()
    await expect(
      window.getByRole('listbox', { name: /workspace search history/i })
    ).toHaveClass(/global-search-history-tags/)
    await window.setViewportSize({ width: 390, height: 820 })
    const historyOverflow = await window
      .getByRole('listbox', { name: /workspace search history/i })
      .evaluate((historyElement) => {
        const historyBounds = historyElement.getBoundingClientRect()
        const overflowingTag = Array.from(
          historyElement.querySelectorAll('.global-search-history-tag')
        ).some((tagElement) => {
          const tagBounds = tagElement.getBoundingClientRect()

          return (
            tagBounds.left < historyBounds.left ||
            tagBounds.right > historyBounds.right
          )
        })

        return {
          historyWidth: historyElement.scrollWidth,
          visibleWidth: historyElement.clientWidth,
          overflowingTag
        }
      })

    expect(historyOverflow.overflowingTag).toBe(false)
    expect(historyOverflow.historyWidth).toBeLessThanOrEqual(
      historyOverflow.visibleWidth + 1
    )
    await window
      .getByRole('button', { name: /use workspace search history item nested/i })
      .click()
    await expect(reopenedWorkspaceSearch).toHaveValue('nested')
    await expect(reopenedWorkspaceSearch).toBeFocused()
    await expect(
      window.getByRole('button', {
        name: /open search result docs\/intro\.md line 3/i
      })
    ).toBeVisible()
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('renders consecutive Mermaid flowcharts inline with complete thumbnail previews', async () => {
  const workspacePath = await createFixtureWorkspace()
  const diagramPath = join(workspacePath, 'docs', 'diagram.md')

  await writeFile(
    diagramPath,
    [
      '## End-to-End Flow',
      '',
      '```text',
      'init',
      '  -> confirm project + branch/base',
      '  -> if multi-project and one clean slice exists: choose one project for this run',
      '  -> if no clean single-project slice: stop and split ticket',
      '  -> pre-setup',
      '  -> prepare research seed when dependency/scope clues already exist',
      '  -> brainstorm (feature) OR debug (bug)',
      '  -> spec-auto-review',
      '  -> spec-approval (manual gate)',
      '  -> write-plan',
      '  -> plan-auto-review',
      '  -> plan-approval (manual gate)',
      '  -> dev',
      '  -> code-auto-review  \\',
      '  -> post-dev-review    > subagent-first review steps (same review_baseline_sha; serial fallback only when subagents are unavailable and must be recorded)',
      '  -> code-review       /',
      '  -> finish (human release gate + post-deploy validation when environment is reachable)',
      '```',
      '',
      '```mermaid',
      ...AUTO_SUPERPOWER_FLOWCHART,
      '```',
      '',
      '```mermaid',
      ...AUTO_SUPERPOWER_FLOWCHART,
      '```',
      '',
      '## Steps Table',
      '',
      '| Step | ID | Mode | Primary Executor |'
    ].join('\n')
  )

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /expand docs/i }).click()
    await window
      .getByRole('button', { name: /diagram\.md Markdown file/i })
      .click()

    await expect(window.getByText(/End-to-End Flow/i)).toBeVisible({
      timeout: 15_000
    })

    const previews = window.getByTestId(/mermaid-flowchart-preview-\d+/)

    await expect(previews).toHaveCount(2, { timeout: 15_000 })
    await expect(window.getByTestId('mermaid-flowchart-preview-0').locator('svg')).toBeVisible({
      timeout: 15_000
    })
    await expect(window.getByTestId('mermaid-flowchart-preview-1').locator('svg')).toBeVisible({
      timeout: 15_000
    })

    const flowchartPlacements = await window.evaluate(() => {
      const codeBlocks = Array.from(
        document.querySelectorAll<HTMLElement>(
          '.markdown-editor-surface .bn-block-content[data-content-type="codeBlock"][data-language="mermaid"]'
        )
      )
      const trailingBlock = Array.from(
        document.querySelectorAll<HTMLElement>(
          '.markdown-editor-surface .bn-block-content'
        )
      ).find((element) =>
        element.textContent?.includes('Steps Table')
      )
      const flowchartCards = codeBlocks.map((_block, index) =>
        document
          .querySelector<HTMLElement>(`[data-testid="mermaid-flowchart-preview-${index}"]`)
          ?.closest<HTMLElement>('.mermaid-flowchart-card')
      )

      if (
        codeBlocks.length !== 2 ||
        !trailingBlock ||
        flowchartCards.some((flowchartCard) => !flowchartCard)
      ) {
        throw new Error('Missing flowchart source or preview')
      }

      return codeBlocks.map((codeBlock, index) => {
        const sourceContent = codeBlock.querySelector<HTMLElement>('pre') ?? codeBlock
        const flowchartCard = flowchartCards[index]
        const nextBlock = codeBlocks[index + 1] ?? trailingBlock

        if (!flowchartCard || !nextBlock) {
          throw new Error('Missing flowchart neighbor nodes')
        }

        return {
          nextBlockTop: nextBlock.getBoundingClientRect().top,
          sourceBottom: sourceContent.getBoundingClientRect().bottom,
          previewBottom: flowchartCard.getBoundingClientRect().bottom,
          previewTop: flowchartCard.getBoundingClientRect().top
        }
      })
    })

    for (const flowchartPlacement of flowchartPlacements) {
      expect(flowchartPlacement.previewTop).toBeGreaterThan(
        flowchartPlacement.sourceBottom
      )
      expect(flowchartPlacement.previewBottom).toBeLessThan(
        flowchartPlacement.nextBlockTop
      )
    }

    const thumbnailBounds = await window.evaluate(() => {
      const shell = document
        .querySelector<HTMLElement>('[data-testid="mermaid-flowchart-preview-0"]')
        ?.closest<HTMLElement>('.mermaid-flowchart-preview-shell')
      const svg = document.querySelector<SVGElement>(
        '[data-testid="mermaid-flowchart-preview-0"] svg'
      )

      if (!shell || !svg) {
        throw new Error('Missing flowchart thumbnail bounds')
      }

      const shellBounds = shell.getBoundingClientRect()
      const svgBounds = svg.getBoundingClientRect()

      return {
        shellBottom: shellBounds.bottom,
        shellLeft: shellBounds.left,
        shellRight: shellBounds.right,
        shellTop: shellBounds.top,
        svgBottom: svgBounds.bottom,
        svgLeft: svgBounds.left,
        svgRight: svgBounds.right,
        svgTop: svgBounds.top
      }
    })

    expect(thumbnailBounds.svgLeft).toBeGreaterThanOrEqual(
      thumbnailBounds.shellLeft
    )
    expect(thumbnailBounds.svgRight).toBeLessThanOrEqual(
      thumbnailBounds.shellRight + 1
    )
    expect(thumbnailBounds.svgTop).toBeGreaterThanOrEqual(
      thumbnailBounds.shellTop
    )
    expect(thumbnailBounds.svgBottom).toBeLessThanOrEqual(
      thumbnailBounds.shellBottom + 1
    )
    await expect(
      window.locator('.mermaid-flowchart-preview-viewport')
    ).toHaveCount(0)

    await window.getByRole('button', { name: /open flowchart preview 1/i }).click()
    await expect(
      window.getByRole('dialog', { name: /flowchart preview/i })
    ).toBeVisible()
    const previewViewport = window.getByTestId('mermaid-flowchart-dialog-viewport')
    const dialogPreview = window.getByTestId('mermaid-flowchart-dialog-preview')

    await previewViewport.evaluate((element) => {
      element.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaY: -120
        })
      )
    })
    await expect(dialogPreview).toHaveCSS('--flowchart-preview-scale', '1')
    await expect(dialogPreview).toHaveCSS('--flowchart-preview-pan-y', '120px')
    await window.getByRole('button', { name: /reset view/i }).click()

    await previewViewport.evaluate((element) => {
      element.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaY: -120
        })
      )
    })
    await expect(dialogPreview).toHaveCSS('--flowchart-preview-scale', '1.25')
    await expect(dialogPreview).toHaveCSS('--flowchart-preview-pan-y', '0px')

    const viewportBox = await previewViewport.boundingBox()

    if (!viewportBox) {
      throw new Error('Missing flowchart preview viewport bounds')
    }

    await window.getByRole('button', { name: /reset view/i }).click()

    const dragStartX = viewportBox.x + 24
    const dragStartY = viewportBox.y + 24

    await window.mouse.move(dragStartX, dragStartY)
    await window.mouse.down()
    await window.mouse.move(dragStartX + 48, dragStartY + 32)
    await window.mouse.up()
    await expect(dialogPreview).toHaveCSS('--flowchart-preview-pan-x', '48px')
    await expect(dialogPreview).toHaveCSS('--flowchart-preview-pan-y', '32px')
    await window.getByRole('button', { name: /reset view/i }).click()
    await expect(dialogPreview).toHaveCSS('--flowchart-preview-scale', '1')
    await expect(dialogPreview).toHaveCSS('--flowchart-preview-pan-x', '0px')
    await expect(dialogPreview).toHaveCSS('--flowchart-preview-pan-y', '0px')
    await expect(
      dialogPreview.locator('text, tspan, .nodeLabel').first()
    ).toHaveCSS('user-select', 'text')
    const dialog = window.getByRole('dialog', { name: /flowchart preview/i })
    const dialogSurface = window.locator('.mermaid-flowchart-dialog')

    await window.getByRole('button', { name: /use full-page preview/i }).click()
    await expect(dialog).toHaveAttribute('data-view-mode', 'full')
    await expect(dialogSurface).toHaveAttribute('data-view-mode', 'full')
    const fullDialogBounds = await dialogSurface.evaluate((element) => {
      const bounds = element.getBoundingClientRect()

      return {
        height: bounds.height,
        width: bounds.width
      }
    })
    const appViewport = await window.evaluate(() => ({
      height: globalThis.innerHeight,
      width: globalThis.innerWidth
    }))

    expect(Math.round(fullDialogBounds.width)).toBeGreaterThanOrEqual(
      appViewport.width - 2
    )
    expect(Math.round(fullDialogBounds.height)).toBeGreaterThanOrEqual(
      appViewport.height - 2
    )
    await window.getByRole('button', { name: /use centered preview/i }).click()
    await expect(dialog).toHaveAttribute('data-view-mode', 'centered')
    await expect(dialogSurface).toHaveAttribute('data-view-mode', 'centered')
    await window.getByRole('button', { name: /close flowchart preview/i }).click()

    await expect(window.getByLabel(/mermaid source 1/i)).toHaveCount(0)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('saves pasted images beside the Markdown file', async () => {
  const workspacePath = await createFixtureWorkspace()
  const diagramPath = join(workspacePath, 'docs', 'diagram.md')

  await writeFile(
    diagramPath,
    [
      '## Diagram Notes',
      '',
      'Paste an image into this document.'
    ].join('\n')
  )

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /expand docs/i }).click()
    await window
      .getByRole('button', { name: /diagram\.md Markdown file/i })
      .click()

    const editableDocument = window
      .getByTestId('blocknote-view')
      .locator('[contenteditable="true"]')
      .first()
    const pngBytes = [
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0,
      1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68,
      65, 84, 120, 156, 99, 248, 255, 255, 63, 0, 5, 254, 2, 254, 167, 53,
      129, 132, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130
    ]

    await editableDocument.click()
    await editableDocument.evaluate((element, bytes) => {
      const file = new File([new Uint8Array(bytes)], 'clipboard.png', {
        type: 'image/png'
      })
      const dataTransfer = new DataTransfer()

      dataTransfer.items.add(file)
      element.dispatchEvent(
        new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dataTransfer
        })
      )
    }, pngBytes)

    await expect
      .poll(
        async () =>
          readdir(join(workspacePath, 'docs', '.mde', 'assets')).catch(() => []),
        { timeout: 10_000 }
      )
      .toContainEqual(expect.stringMatching(/^image-.+\.png$/))
    await expect
      .poll(async () => readFile(diagramPath, 'utf8'), { timeout: 10_000 })
      .toContain('.mde/assets/image-')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('repairs moved .mde image assets when opening Markdown', async () => {
  const workspacePath = await createFixtureWorkspace()
  const movedPath = join(workspacePath, 'docs', 'moved-image.md')
  const pngBytes = Buffer.from([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0,
    1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68,
    65, 84, 120, 156, 99, 248, 255, 255, 63, 0, 5, 254, 2, 254, 167, 53,
    129, 132, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130
  ])

  await mkdir(join(workspacePath, 'archive', '.mde', 'assets'), {
    recursive: true
  })
  await writeFile(
    movedPath,
    ['# Moved image', '', '![Moved asset](.mde/assets/moved.png)'].join('\n')
  )
  await writeFile(
    join(workspacePath, 'archive', '.mde', 'assets', 'moved.png'),
    pngBytes
  )

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await setAppLanguagePreference(window, 'en')
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /expand docs/i }).click()
    await window
      .getByRole('button', { name: /moved-image\.md Markdown file/i })
      .click()

    await expect(window.locator('.editor-notice')).toContainText(
      'Restored 1 missing image asset.'
    )
    await expect
      .poll(
        async () =>
          readFile(join(workspacePath, 'docs', '.mde', 'assets', 'moved.png')),
        { timeout: 10_000 }
      )
      .toEqual(pngBytes)
    await expect(window.locator('.markdown-editor-surface img').first()).toBeVisible()
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('preserves consecutive blank lines after saving and reopening markdown', async () => {
  const workspacePath = await createFixtureWorkspace()
  const blankLinesPath = join(workspacePath, 'docs', 'blank-lines.md')

  await writeFile(
    blankLinesPath,
    ['First paragraph', '', '', 'Second paragraph'].join('\n')
  )

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /expand docs/i }).click()
    await window
      .getByRole('button', { name: /blank-lines\.md Markdown file/i })
      .click()

    const editableDocument = window
      .getByTestId('blocknote-view')
      .locator('[contenteditable="true"]')
      .first()

    await expect(editableDocument).toBeVisible()
    await editableDocument.click()
    await window.keyboard.press('End')
    await window.keyboard.press('Enter')
    await window.keyboard.insertText('Third paragraph')

    await expect
      .poll(async () => readFile(blankLinesPath, 'utf8'), { timeout: 10_000 })
      .toContain('Third paragraph')
    expect(await readFile(blankLinesPath, 'utf8')).toContain(
      'First paragraph\n\n\nSecond paragraph'
    )

    await window
      .getByRole('button', { name: /README\.md Markdown file/i })
      .click()
    await window
      .getByRole('button', { name: /blank-lines\.md Markdown file/i })
      .click()
    await expect(window.getByText('Third paragraph')).toBeVisible()
    expect(await readFile(blankLinesPath, 'utf8')).toContain(
      'First paragraph\n\n\nSecond paragraph'
    )
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('summarizes and translates the current Markdown file with an installed AI CLI', async () => {
  const workspacePath = await createFixtureWorkspace()
  const fakeBinPath = await mkdtemp(join(tmpdir(), 'mde-fake-ai-bin-'))
  const fakeCodexPath = join(fakeBinPath, 'codex')

  await writeFile(
    fakeCodexPath,
    [
      '#!/bin/sh',
      'input="$(cat)"',
      'for arg in "$@"; do',
      '  if [ "$arg" = "--ask-for-approval" ]; then',
      '    echo "error: unexpected argument \'--ask-for-approval\' found" >&2',
      '    exit 2',
      '  fi',
      'done',
      'case "$input" in',
      '  *"Make it shorter"*) printf "%s\\n" "## Summary" "" "- Shorter summary from fake CLI." ;;',
      '  *Translate*) printf "%s\\n" "# English" "" "Translated from fake CLI." ;;',
      '  *) printf "%s\\n" "## Summary" ""; i=1; while [ "$i" -le 80 ]; do printf "%s\\n" "- Summary from fake CLI line $i."; i=$((i + 1)); done ;;',
      'esac'
    ].join('\n')
  )
  await chmod(fakeCodexPath, 0o755)

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`],
    env: {
      PATH: `${fakeBinPath}:${process.env.PATH ?? ''}`
    }
  })

  try {
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /README\.md Markdown file/i }).click()
    await expect(window.getByTestId('markdown-block-editor')).toBeVisible()

    const actionBar = window.locator('.editor-action-bar')
    const readEditorActionLabels = async (): Promise<string[]> =>
      actionBar.getByRole('button').evaluateAll((buttons) =>
        buttons.map(
          (button) =>
            button.getAttribute('aria-label') ?? button.textContent?.trim() ?? ''
        )
      )

    await expect(
      window.getByRole('button', { name: /show all editor actions/i })
    ).toBeVisible()
    expect(await readEditorActionLabels()).toEqual([
      'Show all editor actions',
      'Version history',
      'Summarize Markdown',
      'Translate Markdown',
      'Search current Markdown'
    ])
    await expect(
      window.getByRole('button', { name: /use full-width editor view/i })
    ).toHaveCount(0)
    await expect(
      window.getByRole('button', { name: /editor line spacing/i })
    ).toHaveCount(0)

    await window.getByRole('button', { name: /show all editor actions/i }).click()

    expect(await readEditorActionLabels()).toEqual([
      'Collapse editor actions',
      'Editor line spacing',
      'Use full-width editor view',
      'Version history',
      'Summarize Markdown',
      'Translate Markdown',
      'Search current Markdown'
    ])
    expect(
      await window
        .getByRole('button', { name: /use full-width editor view/i })
        .getAttribute('aria-pressed')
    ).toBeNull()

    await window.getByRole('button', { name: /collapse editor actions/i }).click()

    await window.getByRole('button', { name: /summarize markdown/i }).click()

    const aiResult = window.getByRole('region', { name: /ai result/i })

    await expect(aiResult).toContainText('Summary from fake CLI', {
      timeout: E2E_AI_RESULT_TIMEOUT_MS
    })
    await window.getByRole('button', { name: /README\.md Markdown file/i }).click()
    await expect(aiResult).toContainText('Summary from fake CLI')
    await expect(aiResult.locator('[contenteditable="false"]').first())
      .toBeVisible()
    await expect(
      window.getByRole('textbox', { name: /refine summary instruction/i })
    ).toBeVisible()
    const refineBar = window.locator('.ai-summary-refine-bar')
    const resultScroll = aiResult.locator('.ai-result-editor-scroll')
    const editorPane = window.locator('.editor-pane')
    const initialRefineBarTop = await refineBar.evaluate((element) =>
      Math.round(element.getBoundingClientRect().top)
    )

    await resultScroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })

    expect(await resultScroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    expect(await editorPane.evaluate((element) => element.scrollTop)).toBe(0)
    expect(
      await refineBar.evaluate((element) =>
        Math.round(element.getBoundingClientRect().top)
      )
    ).toBe(initialRefineBarTop)
    await expect(
      window.getByRole('textbox', { name: /refine summary instruction/i })
    ).toBeInViewport()
    await expect(
      readFile(
        join(workspacePath, '.mde', 'translations', 'README-summary.md'),
        'utf8'
      )
    ).resolves.toContain('Summary from fake CLI')

    await window
      .getByRole('textbox', { name: /refine summary instruction/i })
      .fill('Make it shorter')
    await window.getByRole('button', { name: /regenerate summary/i }).click()

    await expect(aiResult).toContainText('Shorter summary from fake CLI', {
      timeout: E2E_AI_RESULT_TIMEOUT_MS
    })
    await expect(
      readFile(
        join(workspacePath, '.mde', 'translations', 'README-summary.md'),
        'utf8'
      )
    ).resolves.toContain('Shorter summary from fake CLI')

    await window.getByRole('button', { name: /translate markdown/i }).click()
    await window.getByRole('menuitem', { name: /English/i }).click()

    await expect(aiResult).toContainText('Translated from fake CLI', {
      timeout: E2E_AI_RESULT_TIMEOUT_MS
    })
    await expect(
      window.getByRole('textbox', { name: /refine summary instruction/i })
    ).toHaveCount(0)
    await expect(
      readFile(
        join(workspacePath, '.mde', 'translations', 'README.English.md'),
        'utf8'
      )
    ).resolves.toContain('Translated from fake CLI')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('opens a standalone markdown file and remembers it in the workspace manager', async () => {
  const workspacePath = await createFixtureWorkspace()
  const standaloneFilePath = join(workspacePath, 'standalone.md')

  await writeFile(standaloneFilePath, '# Standalone File\n\nOpened alone.')

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-file=${standaloneFilePath}`]
  })

  try {
    await openMarkdownFile(window)

    await expect(
      window.getByRole('button', { name: /standalone\.md Markdown file/i })
    ).toBeVisible()
    await expect(window.getByTestId('markdown-block-editor')).toContainText(
      'Standalone File'
    )
    await expect(window).toHaveTitle(`standalone.md - ${await realpath(workspacePath)}`)

    await window.getByRole('button', { name: /manage workspaces/i }).click()
    await expect(
      window.getByRole('button', { name: /switch to file standalone\.md/i })
    ).toBeVisible()
    expect(
      await window.evaluate(() =>
        globalThis.localStorage.getItem('mde.recentWorkspaces')
      )
    ).toContain('"type":"file"')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('opens a standalone markdown file from a command line path', async () => {
  const workspacePath = await createFixtureWorkspace()
  const standaloneFilePath = join(workspacePath, 'cli-file.md')

  await writeFile(standaloneFilePath, '# CLI File\n\nOpened from mde.')

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [standaloneFilePath]
  })

  try {
    await expect(
      window.getByRole('button', { name: /cli-file\.md Markdown file/i })
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })
    await expect(window.getByTestId('markdown-block-editor')).toContainText(
      'CLI File'
    )
    await expect(window).toHaveTitle(`cli-file.md - ${await realpath(workspacePath)}`)
    await expect(
      window.getByRole('button', { name: /manage workspaces/i })
    ).toHaveText(/cli-file\.md/i)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('scrolls to the end of a long markdown document', async () => {
  const workspacePath = await createFixtureWorkspace()
  const longDocumentPath = join(workspacePath, 'long.md')
  const finalLine = 'End of long editable document'

  await writeFile(
    longDocumentPath,
    [
      '# Long Document',
      '',
      ...Array.from({ length: 90 }, (_, index) => `Paragraph ${index + 1}`),
      finalLine
    ].join('\n\n')
  )

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await window.setViewportSize({ width: 900, height: 600 })
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /long\.md Markdown file/i }).click()

    const editorPane = window.locator('.editor-pane')
    const finalParagraph = window.getByText(finalLine)

    await expect(finalParagraph).toBeAttached()
    await editorPane.hover()
    await window.mouse.wheel(0, 20_000)

    await expect(finalParagraph).toBeInViewport()
    expect(
      await finalParagraph.evaluate((element) => {
        const rect = element.getBoundingClientRect()

        return globalThis.innerHeight - rect.bottom
      })
    ).toBeGreaterThanOrEqual(96)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('scrolls to the last block after editing a long document', async () => {
  const workspacePath = await createFixtureWorkspace()
  const finalLine = 'Typed paragraph 45'
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await window.setViewportSize({ width: 900, height: 600 })
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /README\.md Markdown file/i }).click()

    const editorPane = window.locator('.editor-pane')
    const editableDocument = window
      .getByTestId('blocknote-view')
      .locator('[contenteditable="true"]')
      .first()

    await editableDocument.click()
    await window.keyboard.press('End')

    for (let index = 1; index <= 45; index += 1) {
      await window.keyboard.press('Enter')
      await window.keyboard.insertText(`Typed paragraph ${index}`)
    }

    const finalParagraph = window.getByText(finalLine)

    await expect(finalParagraph).toBeAttached()
    await editorPane.hover()
    await window.mouse.wheel(0, 20_000)

    await expect(finalParagraph).toBeInViewport()
    expect(
      await finalParagraph.evaluate((element) => {
        const rect = element.getBoundingClientRect()

        return globalThis.innerHeight - rect.bottom
      })
    ).toBeGreaterThanOrEqual(96)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('edits and auto-saves markdown, then creates a new file', async () => {
  const workspacePath = await createFixtureWorkspace()
  const readmePath = join(workspacePath, 'README.md')
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await window.setViewportSize({ width: 1280, height: 720 })
    await openNewWorkspace(window)
    const readmeRow = window.getByRole('button', {
      name: /README\.md Markdown file/i
    })

    await readmeRow.click()

    const toolbarButtons = [
      window.getByRole('button', { name: /new markdown file/i }),
      window.getByRole('button', { name: /new folder/i }),
      window.getByRole('button', { name: /show hidden entries/i }),
      window.getByRole('button', { name: /refresh explorer/i })
    ]
    const toolbarButtonTops = await Promise.all(
      toolbarButtons.map((button) =>
        button.evaluate((element) => Math.round(element.getBoundingClientRect().top))
      )
    )
    const toolbarButtonHeights = await Promise.all(
      toolbarButtons.map((button) =>
        button.evaluate((element) =>
          Math.round(element.getBoundingClientRect().height)
        )
      )
    )
    const settingsButton = window.getByRole('button', {
      name: /^open settings$/i
    })
    const themeButton = window.getByRole('button', {
      name: /^change theme$/i
    })
    const footerButtonMetrics = await Promise.all(
      [settingsButton, themeButton].map((button) =>
        button.evaluate((element) => {
          const rect = element.getBoundingClientRect()
          const style = globalThis.getComputedStyle(element)

          return {
            centerY: Math.round(rect.top + rect.height / 2),
            height: Math.round(rect.height),
            padding: {
              bottom: style.paddingBottom,
              left: style.paddingLeft,
              right: style.paddingRight,
              top: style.paddingTop
            }
          }
        })
      )
    )
    const borderWidths = await window.evaluate(() => {
      const explorerPane = document.querySelector('.explorer-pane')
      const resizeHandle = document.querySelector('.explorer-panel-resize-handle')
      const recentFiles = document.querySelector('.explorer-recent-files-section')

      if (!explorerPane || !resizeHandle || !recentFiles) {
        throw new Error('Unable to find explorer border targets')
      }

      return {
        explorerRight: globalThis.getComputedStyle(explorerPane).borderRightWidth,
        recentTop: globalThis.getComputedStyle(recentFiles).borderTopWidth,
        resizeTop: globalThis.getComputedStyle(resizeHandle).borderTopWidth
      }
    })

    expect(new Set(toolbarButtonTops).size).toBe(1)
    expect(new Set(toolbarButtonHeights).size).toBe(1)
    footerButtonMetrics.forEach((metric) => {
      expect(metric.height).toBe(toolbarButtonHeights[0])
    })
    expect(footerButtonMetrics[1].padding).toEqual({
      bottom: '4px',
      left: '4px',
      right: '4px',
      top: '4px'
    })
    expect(new Set(footerButtonMetrics.map((metric) => metric.centerY)).size)
      .toBe(1)
    expect(borderWidths).toEqual({
      explorerRight: '0px',
      recentTop: '0px',
      resizeTop: '1px'
    })
    await expect(
      window.getByRole('button', { name: /rename selected README\.md/i })
    ).toHaveCount(0)
    await expect(
      window.getByRole('button', { name: /delete selected README\.md/i })
    ).toHaveCount(0)
    await expect(readmeRow).toHaveAttribute('aria-current', 'page')
    await expect(readmeRow).toHaveClass(/is-active/)
    await expect(window.locator('.app-shell')).toBeVisible()
    await expect(
      window.getByRole('complementary', { name: /^Explorer$/i })
    ).toBeVisible()
    await expect(window.getByRole('region', { name: /^Editor$/i })).toBeVisible()
    await expect(
      window.getByRole('button', { name: /save README\.md/i })
    ).toHaveCount(0)
    await expect(
      window.getByRole('button', { name: /open recent file README\.md/i })
    ).toBeVisible()
    expect(
      await window.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth
      )
    ).toBe(true)

    const editableDocument = window
      .getByTestId('blocknote-view')
      .locator('[contenteditable="true"]')
      .first()

    await expect(editableDocument).toBeVisible()
    await editableDocument.click()
    await window.keyboard.press('End')
    await window.keyboard.press('Enter')
    await window.keyboard.insertText('Autosaved after idle')

    await expect
      .poll(async () => readFile(readmePath, 'utf8'), { timeout: 10_000 })
      .toContain('Autosaved after idle')
    await expect(window.getByText(/unsaved changes/i)).toBeHidden()

    await editableDocument.click()
    await window.keyboard.press('End')
    await window.keyboard.press('Enter')
    await window.keyboard.insertText('Autosaved on blur')
    await window.getByRole('button', { name: /manage workspaces/i }).click()

    await expect
      .poll(async () => readFile(readmePath, 'utf8'), { timeout: 10_000 })
      .toContain('Autosaved on blur')
    await expect(window.getByText(/unsaved changes/i)).toBeHidden()
    await window.getByRole('button', { name: /close workspace popup/i }).click()

    await window.getByRole('button', { name: /new markdown file/i }).click()
    await window.getByLabel(/new markdown file name/i).fill('notes.md')
    await window.keyboard.press('Enter')

    await expect(
      window.getByRole('button', { name: /notes\.md Markdown file/i })
    ).toBeVisible()
    await expect(readFile(join(workspacePath, 'notes.md'), 'utf8')).resolves.toBe('')

    const docsRow = window.getByRole('button', { name: /docs folder/i })

    await docsRow.click()
    await expect(docsRow).toHaveAttribute('aria-current', 'page')
    await window.getByRole('button', { name: /new markdown file/i }).click()
    await expect(window.getByLabel(/new markdown file name/i)).toHaveValue(
      'Untitled.md'
    )
    await window.getByLabel(/new markdown file name/i).fill('inside-docs')
    await window.keyboard.press('Enter')

    await expect(
      window.getByRole('button', { name: /inside-docs\.md Markdown file/i })
    ).toBeVisible()
    await expect(
      readFile(join(workspacePath, 'docs', 'inside-docs.md'), 'utf8')
    ).resolves.toBe('')

    await docsRow.click()
    await expect(docsRow).not.toHaveAttribute('aria-current', 'page')
    await expect(docsRow).toHaveAttribute('aria-expanded', 'false')
    await window.getByRole('button', { name: /new folder/i }).click()
    await expect(window.getByLabel(/new folder name/i)).toHaveValue('notes')
    await window.getByLabel(/new folder name/i).fill('drafts')
    await window.keyboard.press('Enter')

    await expect(
      window.getByRole('button', { name: /drafts folder/i })
    ).toBeVisible()
    await expect(stat(join(workspacePath, 'drafts'))).resolves.toMatchObject({})

    await window.getByRole('button', { name: /drafts folder/i }).click({
      button: 'right'
    })
    await expect(window.getByRole('menu', { name: /drafts actions/i })).toBeVisible()
    await expect(
      window.getByRole('menuitem', { name: /new markdown file/i })
    ).toBeVisible()
    await expect(window.getByRole('menuitem', { name: /new folder/i })).toBeVisible()
    await expect(
      window.locator('.explorer-context-menu [role="menuitem"] svg')
    ).toHaveCount(9)
    await window.locator('.explorer-header').click()
    await expect(window.getByRole('menu', { name: /drafts actions/i })).toHaveCount(0)
    await window.getByRole('button', { name: /drafts folder/i }).click({
      button: 'right'
    })
    await window.getByRole('menuitem', { name: /^hide$/i }).click()
    await expect(
      window.getByRole('button', { name: /drafts folder/i })
    ).toBeHidden()
    await expect(stat(join(workspacePath, 'drafts'))).resolves.toMatchObject({})
    await window.getByRole('button', { name: /show hidden entries/i }).click()
    await expect(
      window.getByRole('button', { name: /drafts folder/i })
    ).toBeVisible()
    await window.getByRole('button', { name: /drafts folder/i }).click({
      button: 'right'
    })
    await window.getByRole('menuitem', { name: /^show$/i }).click()
    await expect(
      window.getByRole('button', { name: /drafts folder/i })
    ).toBeVisible()
    await expect(
      window.getByRole('button', { name: /show hidden entries/i })
    ).toBeDisabled()

    await window.getByRole('button', { name: /drafts folder/i }).click({
      button: 'right'
    })
    await window.getByRole('menuitem', { name: /^hide$/i }).click()
    await expect(
      window.getByRole('button', { name: /drafts folder/i })
    ).toBeHidden()
    await window.getByRole('button', { name: /show hidden entries/i }).click()
    await expect(
      window.getByRole('button', { name: /drafts folder/i })
    ).toBeVisible()
    await window.getByRole('button', { name: /hide hidden entries/i }).click()
    await expect(
      window.getByRole('button', { name: /drafts folder/i })
    ).toBeHidden()

    await window.reload()
    await expect(
      window.getByRole('button', { name: /manage workspaces/i })
    ).toBeVisible()
    await expect(
      window.getByRole('button', { name: /rename selected inside-docs\.md/i })
    ).toHaveCount(0)

    await expect(
      window.getByRole('button', { name: /drafts folder/i })
    ).toBeHidden()
    await window.getByRole('button', { name: /show hidden entries/i }).click()
    await expect(
      window.getByRole('button', { name: /drafts folder/i })
    ).toBeVisible()
    await window.getByRole('button', { name: /hide hidden entries/i }).click()
    await expect(
      window.getByRole('button', { name: /drafts folder/i })
    ).toBeHidden()

    const notesRow = window.getByRole('button', {
      name: /notes\.md Markdown file/i
    })

    await notesRow.click({ button: 'right' })
    await window.getByRole('menuitem', { name: /^rename$/i }).click()
    await window.getByLabel(/rename notes\.md/i).fill('renamed')
    await window.keyboard.press('Enter')

    await expect(
      window.getByRole('button', { name: /renamed\.md Markdown file/i })
    ).toBeVisible()
    await expect(stat(join(workspacePath, 'renamed.md'))).resolves.toMatchObject({})
    await expect(stat(join(workspacePath, 'notes.md'))).rejects.toMatchObject({
      code: 'ENOENT'
    })

    await window
      .getByRole('button', { name: /renamed\.md Markdown file/i })
      .click({ button: 'right' })
    await window.getByRole('menuitem', { name: /^delete$/i }).click()
    const deleteConfirmationBox = await window
      .locator('.explorer-delete-confirmation')
      .boundingBox()
    const renamedRowBox = await window
      .getByRole('button', { name: /renamed\.md Markdown file/i })
      .boundingBox()

    expect(deleteConfirmationBox).not.toBeNull()
    expect(renamedRowBox).not.toBeNull()
    expect(
      Math.abs((deleteConfirmationBox?.y ?? 0) - (renamedRowBox?.y ?? 0))
    ).toBeLessThan(96)
    await window.getByRole('button', { name: /confirm delete/i }).click()

    await expect(
      window.getByRole('button', { name: /renamed\.md Markdown file/i })
    ).toBeHidden()
    await expect(stat(join(workspacePath, 'renamed.md'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('recovers a deleted Markdown document from the explorer history section', async () => {
  const workspacePath = await createFixtureWorkspace()
  const recoverablePath = join(workspacePath, 'recoverable.md')
  const originalMarkdown = '# Recoverable\n\nRestore this document.'

  await writeFile(recoverablePath, originalMarkdown)

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await openNewWorkspace(window)
    await window
      .getByRole('button', { name: /recoverable\.md Markdown file/i })
      .click()
    await window
      .getByRole('button', { name: /recoverable\.md Markdown file/i })
      .click({ button: 'right' })
    await window.getByRole('menuitem', { name: /^delete$/i }).click()
    await window.getByRole('button', { name: /confirm delete/i }).click()

    await expect(
      window.getByRole('button', { name: /recoverable\.md Markdown file/i })
    ).toBeHidden()
    await expect(stat(recoverablePath)).rejects.toMatchObject({
      code: 'ENOENT'
    })

    await window
      .getByRole('button', { name: /recover deleted documents/i })
      .click()
    const deletedDocumentButton = window.getByRole('button', {
      name: /preview deleted document recoverable\.md/i
    })
    await expect(
      window.getByRole('button', { name: /^deleted documents/i })
    ).toBeVisible()
    await expect(deletedDocumentButton).toBeVisible()
    await deletedDocumentButton.click()

    await expect(window.getByText(/read-only version preview/i)).toBeVisible()
    await expect(window.getByText(/Recoverable/)).toBeVisible()
    await expect(
      window
        .getByTestId('blocknote-view')
        .locator('[contenteditable="false"]')
        .first()
    ).toBeVisible()

    await window.getByRole('button', { name: /^version history$/i }).click()
    await expect(
      window.getByRole('complementary', { name: /^version history$/i })
    ).toHaveCount(0)
    await expect(
      window.getByRole('button', { name: /^deleted documents/i })
    ).toHaveCount(0)

    await window.getByRole('button', { name: /^version history$/i }).click()
    await expect(
      window.getByRole('button', { name: /^deleted documents/i })
    ).toBeVisible()
    await expect(
      window.getByRole('complementary', { name: /^version history$/i })
    ).toBeVisible()

    await window
      .getByRole('button', { name: /restore this version/i })
      .click()

    await expect(
      window.getByRole('button', { name: /recoverable\.md Markdown file/i })
    ).toBeVisible()
    await expect
      .poll(async () => readFile(recoverablePath, 'utf8'), {
        timeout: 10_000
      })
      .toBe(originalMarkdown)
    await expect(window.getByText(/read-only version preview/i)).toHaveCount(0)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('copies explorer Markdown files with image assets from the context menu', async () => {
  const workspacePath = await createFixtureWorkspace()
  const imageBytes = Buffer.from([137, 80, 78, 71])

  await mkdir(join(workspacePath, 'docs', '.mde', 'assets'), {
    recursive: true
  })
  await mkdir(join(workspacePath, 'archive'))
  await writeFile(
    join(workspacePath, 'docs', 'copy-source.md'),
    '# Copy Source\n\n![Hero](.mde/assets/hero.png)'
  )
  await writeFile(
    join(workspacePath, 'docs', '.mde', 'assets', 'hero.png'),
    imageBytes
  )

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /docs folder/i }).click()
    const sourceRow = window.getByRole('button', {
      name: /copy-source\.md Markdown file/i
    })
    const archiveRow = window.getByRole('button', { name: /archive folder/i })

    await sourceRow.click({ button: 'right' })
    await window.getByRole('menuitem', { name: /^copy$/i }).click()
    await archiveRow.click({ button: 'right' })
    await window.getByRole('menuitem', { name: /^paste$/i }).click()

    await expect
      .poll(
        async () =>
          readTextFileOrNull(join(workspacePath, 'archive', 'copy-source.md')),
        { timeout: 10_000 }
      )
      .toBe('# Copy Source\n\n![Hero](.mde/assets/hero.png)')
    await expect(
      readFile(join(workspacePath, 'archive', '.mde', 'assets', 'hero.png'))
    ).resolves.toEqual(imageBytes)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('previews and restores an earlier current-file version from history', async () => {
  const workspacePath = await createFixtureWorkspace()
  const readmePath = join(workspacePath, 'README.md')
  const originalMarkdown = await readFile(readmePath, 'utf8')
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /README\.md Markdown file/i }).click()

    const editableDocument = window
      .getByTestId('blocknote-view')
      .locator('[contenteditable="true"]')
      .first()

    await editableDocument.click()
    await window.keyboard.press('End')
    await window.keyboard.press('Enter')
    await window.keyboard.insertText('Version history e2e edit')
    await expect
      .poll(async () => readFile(readmePath, 'utf8'), { timeout: 10_000 })
      .toContain('Version history e2e edit')

    await window.getByRole('button', { name: /^version history$/i }).click()
    await expect(
      window.getByRole('complementary', { name: /^version history$/i })
    ).toBeVisible()
    await window.getByRole('button', { name: /^version history$/i }).click()
    await expect(
      window.getByRole('complementary', { name: /^version history$/i })
    ).toHaveCount(0)
    await window.getByRole('button', { name: /^version history$/i }).click()
    await expect(
      window.getByRole('complementary', { name: /^version history$/i })
    ).toBeVisible()
    await window
      .getByRole('button', { name: /preview manual save before/i })
      .click()

    await expect(window.getByText(/read-only version preview/i)).toBeVisible()
    await expect(
      window
        .getByTestId('blocknote-view')
        .locator('[contenteditable="false"]')
        .first()
    ).toBeVisible()

    await window
      .getByRole('button', { name: /restore this version/i })
      .click()

    await expect
      .poll(async () => readFile(readmePath, 'utf8'), { timeout: 10_000 })
      .toBe(originalMarkdown)
    await expect(window.getByText(/read-only version preview/i)).toHaveCount(0)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('keeps the editing position after idle autosave', async () => {
  const workspacePath = await createFixtureWorkspace()
  const readmePath = join(workspacePath, 'README.md')
  await writeFile(
    readmePath,
    [
      '# Cursor Autosave',
      '',
      'First paragraph.',
      '',
      'Middle anchor paragraph.',
      '',
      'Last paragraph.'
    ].join('\n')
  )
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /README\.md Markdown file/i }).click()

    const editableDocument = window
      .getByTestId('blocknote-view')
      .locator('[contenteditable="true"]')
      .first()

    await expect(editableDocument).toBeVisible()
    await focusTextEndInEditor(window, 'Middle anchor paragraph.')
    await window.keyboard.press('Enter')
    await window.keyboard.insertText('Autosave middle A')

    await expect
      .poll(async () => readFile(readmePath, 'utf8'), { timeout: 10_000 })
      .toContain('Autosave middle A')
    await expect(window.getByText(/unsaved changes/i)).toBeHidden()
    await expect
      .poll(
        async () =>
          window.evaluate(() => {
            const selection = globalThis.getSelection()
            const selectedNodeText = selection?.anchorNode?.textContent ?? ''

            return selectedNodeText.includes('Autosave middle A')
          }),
        { timeout: 10_000 }
      )
      .toBe(true)

    await window.keyboard.insertText(' and still in the middle')

    await expect
      .poll(async () => readFile(readmePath, 'utf8'), { timeout: 10_000 })
      .toContain('Autosave middle A and still in the middle')

    const savedMarkdown = await readFile(readmePath, 'utf8')
    const firstIndex = savedMarkdown.indexOf('First paragraph.')
    const insertedIndex = savedMarkdown.indexOf(
      'Autosave middle A and still in the middle'
    )
    const lastIndex = savedMarkdown.indexOf('Last paragraph.')

    expect(firstIndex).toBeGreaterThanOrEqual(0)
    expect(insertedIndex).toBeGreaterThan(firstIndex)
    expect(insertedIndex).toBeLessThan(lastIndex)
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('inserts a Markdown link from the editor slash command picker', async () => {
  const workspacePath = await createFixtureWorkspace()
  const readmePath = join(workspacePath, 'README.md')
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await openNewWorkspace(window)
    await window.getByRole('button', { name: /README\.md Markdown file/i }).click()

    const editableDocument = window
      .getByTestId('blocknote-view')
      .locator('[contenteditable="true"]')
      .first()

    await expect(editableDocument).toBeVisible()
    await editableDocument.click()
    await window.keyboard.press('End')
    await window.keyboard.press('Enter')
    await window.keyboard.insertText('/')
    await window.getByText(/^Link$/).click()

    const linkDialog = window.getByRole('dialog', { name: /insert link/i })

    await expect(linkDialog).toBeVisible()
    await linkDialog.getByLabel(/link target/i).fill('doc/intro')
    await linkDialog
      .getByRole('option', { name: /docs\/intro\.md/i })
      .click()

    await expect(linkDialog).toHaveCount(0)
    await expect
      .poll(async () => readFile(readmePath, 'utf8'), { timeout: 10_000 })
      .toContain('[intro.md](docs/intro.md)')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('creates an editor link document from the visible current directory picker', async () => {
  const workspacePath = await createFixtureWorkspace()
  const workspaceRoot = await realpath(workspacePath)
  const deepPath = join(workspacePath, 'docs', 'nested', 'deep.md')

  await mkdir(join(workspacePath, '.mde'), { recursive: true })
  await writeFile(join(workspacePath, '.mde', 'hidden.md'), '# Hidden')
  await mkdir(join(workspacePath, 'private'), { recursive: true })
  await writeFile(join(workspacePath, 'private', 'secret.md'), '# Secret')
  await mkdir(join(workspacePath, 'other', 'child'), { recursive: true })
  await writeFile(join(workspacePath, 'other', 'child', 'leaf.md'), '# Leaf')

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${workspacePath}`]
  })

  try {
    await window.evaluate((rootPath) => {
      globalThis.localStorage.setItem(
        'mde.hiddenExplorerEntries',
        JSON.stringify({
          [rootPath]: ['private']
        })
      )
      globalThis.localStorage.removeItem('mde.defaultHiddenExplorerWorkspaces')
    }, workspaceRoot)
    await window.reload({ waitUntil: 'domcontentloaded' })
    await window.locator('.app-shell').waitFor({ state: 'visible' })

    await openNewWorkspace(window)
    await window.getByRole('button', { name: /expand docs/i }).click()
    await window.getByRole('button', { name: /expand nested/i }).click()
    await window
      .getByRole('button', { name: /deep\.md Markdown file/i })
      .click()

    const editableDocument = window
      .getByTestId('blocknote-view')
      .locator('[contenteditable="true"]')
      .first()

    await expect(editableDocument).toBeVisible()
    await editableDocument.click()
    await window.keyboard.press('End')
    await window.keyboard.press('Enter')
    await window.keyboard.insertText('/')
    await window.getByText(/^Link$/).click()

    const linkDialog = window.getByRole('dialog', { name: /insert link/i })

    await expect(linkDialog).toBeVisible()
    await linkDialog.getByRole('tab', { name: /new document/i }).click()

    const directoryTree = linkDialog.getByRole('tree', {
      name: /directory tree/i
    })

    await expect(
      directoryTree.getByRole('treeitem', { name: /^docs$/ })
    ).toHaveAttribute('aria-expanded', 'true')
    await expect(
      directoryTree.getByRole('treeitem', { name: /^nested$/ })
    ).toHaveAttribute('aria-selected', 'true')
    await expect(
      directoryTree.getByRole('treeitem', { name: /^other$/ })
    ).toBeVisible()
    await expect(
      directoryTree.getByRole('treeitem', { name: /^child$/ })
    ).toHaveCount(0)
    await expect(
      directoryTree.getByRole('treeitem', { name: /^\.mde$/ })
    ).toHaveCount(0)
    await expect(
      directoryTree.getByRole('treeitem', { name: /^private$/ })
    ).toHaveCount(0)

    await linkDialog
      .getByRole('textbox', { name: /new document name/i })
      .fill('linked-note')
    await linkDialog
      .getByRole('button', { name: /create and insert/i })
      .click()

    await expect(linkDialog).toHaveCount(0)
    await expect
      .poll(
        async () =>
          stat(join(workspacePath, 'docs', 'nested', 'linked-note.md')).then(
            (entry) => entry.isFile()
          ),
        { timeout: 10_000 }
      )
      .toBe(true)
    await expect
      .poll(async () => readFile(deepPath, 'utf8'), { timeout: 10_000 })
      .toContain('[linked-note.md](linked-note.md)')
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})

test('remembers and switches recent workspaces from the workspace menu', async () => {
  const firstWorkspacePath = await createFixtureWorkspace()
  const secondWorkspacePath = await createFixtureWorkspace()

  await writeFile(join(secondWorkspacePath, 'SECOND.md'), '# Second workspace')

  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${firstWorkspacePath}`]
  })

  try {
    await window.setViewportSize({ width: 900, height: 600 })
    await openNewWorkspace(window)

    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible()

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
    await expect(
      window.getByRole('button', { name: /README\.md Markdown file/i })
    ).toBeVisible()

    await ensureWorkspaceDialogOpen(window)
    await window
      .getByRole('button', { name: /switch to workspace Second Workspace/i })
      .click()

    await expect(
      window.getByRole('button', { name: /SECOND\.md Markdown file/i })
    ).toBeVisible()
    await expect(window).toHaveTitle(await realpath(secondWorkspacePath))
    expect(startupDiagnostics.errors).toEqual([])
  } finally {
    await app.close()
  }
})
