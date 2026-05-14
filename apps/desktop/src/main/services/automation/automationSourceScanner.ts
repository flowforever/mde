import { readdir, readFile } from 'node:fs/promises'
import { basename, extname, join, relative } from 'node:path'

import type {
  AutomationFlowSourceItem,
  AutomationSourceStatus
} from '@mde/automation-flow'
import {
  createUserPromptSourceItemId,
  createWorkspaceMarkdownSourceItemId
} from '@mde/automation-flow'

import type { AutomationDiagnostic } from '../../../shared/automation'
import { getWorkspaceTaskRoot, type WorkspaceTaskKind } from './automationPathSafety'

interface WorkspaceSourceScanInput {
  readonly workspaceRoot: string
}

interface UserPromptSourceScanInput {
  readonly userPromptRoot: string
}

export interface AutomationSourceScanResult {
  readonly diagnostics: readonly AutomationDiagnostic[]
  readonly sourceItems: readonly AutomationFlowSourceItem[]
}

const workspaceTaskKinds = Object.freeze([
  'bugs',
  'requirements',
  'tasks'
] as const satisfies readonly WorkspaceTaskKind[])

const normalizePath = (path: string): string => path.replace(/\\/gu, '/')

const listMarkdownFiles = async (
  rootPath: string
): Promise<readonly string[]> => {
  try {
    const entries = await readdir(rootPath, { withFileTypes: true })
    const files: string[] = []

    for (const entry of entries) {
      const entryPath = join(rootPath, entry.name)

      if (entry.isDirectory()) {
        if (entry.name !== 'done' && entry.name !== 'archived') {
          files.push(...(await listMarkdownFiles(entryPath)))
        }
        continue
      }

      if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') {
        files.push(entryPath)
      }
    }

    return Object.freeze(files.sort())
  } catch {
    return Object.freeze([])
  }
}

const createSourceDiagnostic = (
  sourceFile: string,
  technicalMessage: string
): AutomationDiagnostic =>
  Object.freeze({
    code: 'automationSource.invalidFrontmatter',
    diagnosticId: `source:${sourceFile}:invalid-frontmatter`,
    message: 'Invalid automation source frontmatter.',
    messageKey: 'automationSource.diagnostics.invalidFrontmatter',
    severity: 'error',
    sourceFile,
    technicalMessage
  })

const getFirstHeading = (markdown: string, fallbackPath: string): string => {
  const heading = /^#\s+(.+)$/mu.exec(markdown)

  return heading?.[1].trim() ?? basename(fallbackPath, extname(fallbackPath))
}

const parseAutomationStatus = (
  rawFrontmatter: string
): AutomationSourceStatus | undefined => {
  const nestedStatus = /(?:^|\n)automation:\s*(?:\n[ \t]+[^\n]*)*?\n[ \t]+status:\s*([a-z-]+)/iu.exec(
    rawFrontmatter
  )
  const flatStatus = /(?:^|\n)automation\.status:\s*([a-z-]+)/iu.exec(
    rawFrontmatter
  )
  const status = (nestedStatus?.[1] ?? flatStatus?.[1])?.toLowerCase()

  return status === 'ready' || status === 'draft' || status === 'disabled'
    ? status
    : undefined
}

const parseTags = (markdown: string): readonly string[] | undefined => {
  const tagLine = /^tags:\s*(.+)$/imu.exec(markdown)

  if (tagLine === null) {
    return undefined
  }

  return Object.freeze(
    tagLine[1]
      .split(/[,\s]+/u)
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
  )
}

const parseSourceMarkdown = (
  markdown: string,
  sourceFile: string
): {
  readonly automationStatus?: AutomationSourceStatus
  readonly diagnostics: readonly AutomationDiagnostic[]
  readonly tags?: readonly string[]
  readonly title: string
} => {
  const lines = markdown.split(/\r?\n/u)
  const title = getFirstHeading(markdown, sourceFile)

  if ((lines[0] ?? '').trim() !== '---') {
    return Object.freeze({
      diagnostics: Object.freeze([]),
      tags: parseTags(markdown),
      title
    })
  }

  const closingDelimiterIndex = lines
    .slice(1)
    .findIndex((line) => line.trim() === '---')

  if (closingDelimiterIndex === -1) {
    return Object.freeze({
      diagnostics: Object.freeze([
        createSourceDiagnostic(sourceFile, 'Missing closing frontmatter delimiter.')
      ]),
      title
    })
  }

  const rawFrontmatter = lines.slice(1, closingDelimiterIndex + 1).join('\n')

  if (rawFrontmatter.includes('[') && !rawFrontmatter.includes(']')) {
    return Object.freeze({
      diagnostics: Object.freeze([
        createSourceDiagnostic(sourceFile, 'Unable to parse source frontmatter.')
      ]),
      title
    })
  }

  return Object.freeze({
    automationStatus: parseAutomationStatus(rawFrontmatter),
    diagnostics: Object.freeze([]),
    tags: parseTags(markdown),
    title
  })
}

export const scanWorkspaceMarkdownSources = async ({
  workspaceRoot
}: WorkspaceSourceScanInput): Promise<AutomationSourceScanResult> => {
  const files = (
    await Promise.all(
      workspaceTaskKinds.map((kind) =>
        listMarkdownFiles(getWorkspaceTaskRoot(workspaceRoot, kind))
      )
    )
  ).flat()
  const parsed = await Promise.all(
    files.map(async (filePath) => {
      const markdown = await readFile(filePath, 'utf8')
      const source = parseSourceMarkdown(markdown, filePath)
      const relativePath = normalizePath(relative(workspaceRoot, filePath))

      return Object.freeze({
        diagnostics: source.diagnostics,
        sourceItem:
          source.diagnostics.length > 0
            ? null
            : Object.freeze({
                automationStatus: source.automationStatus,
                relativePath,
                sourceItemId: createWorkspaceMarkdownSourceItemId({
                  relativePath,
                  workspaceId: workspaceRoot
                }),
                sourcePath: filePath,
                sourceType: 'workspace-markdown',
                tags: source.tags,
                title: source.title,
                workspaceId: workspaceRoot
              } satisfies AutomationFlowSourceItem)
      })
    })
  )

  return Object.freeze({
    diagnostics: Object.freeze(parsed.flatMap((entry) => entry.diagnostics)),
    sourceItems: Object.freeze(
      parsed.flatMap((entry) =>
        entry.sourceItem === null ? [] : [entry.sourceItem]
      )
    )
  })
}

export const scanUserPromptSources = async ({
  userPromptRoot
}: UserPromptSourceScanInput): Promise<AutomationSourceScanResult> => {
  const files = await listMarkdownFiles(userPromptRoot)
  const parsed = await Promise.all(
    files.map(async (filePath) => {
      const markdown = await readFile(filePath, 'utf8')
      const source = parseSourceMarkdown(markdown, filePath)
      const relativePath = normalizePath(relative(userPromptRoot, filePath))

      return Object.freeze({
        diagnostics: source.diagnostics,
        sourceItem:
          source.diagnostics.length > 0 || source.automationStatus !== 'ready'
            ? null
            : Object.freeze({
                automationStatus: source.automationStatus,
                relativePath,
                sourceItemId: createUserPromptSourceItemId({
                  relativePath,
                  userPromptRoot
                }),
                sourcePath: filePath,
                sourceType: 'user-prompt',
                tags: source.tags,
                title: source.title
              } satisfies AutomationFlowSourceItem)
      })
    })
  )

  return Object.freeze({
    diagnostics: Object.freeze(parsed.flatMap((entry) => entry.diagnostics)),
    sourceItems: Object.freeze(
      parsed.flatMap((entry) =>
        entry.sourceItem === null ? [] : [entry.sourceItem]
      )
    )
  })
}
