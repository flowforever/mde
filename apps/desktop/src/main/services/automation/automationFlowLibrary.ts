import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'

import {
  parseAutomationFlowMarkdown,
  type AutomationFlowDiagnostic,
  type ParsedAutomationFlow
} from '@mde/automation-flow'

import {
  getUserAutomationFlowRoot,
  getWorkspaceAutomationFlowRoot
} from './automationPathSafety'

interface LoadAutomationFlowLibraryInput {
  readonly homePath: string
  readonly workspaceRoot?: string
}

export interface AutomationFlowLibrary {
  readonly automationFlows: readonly ParsedAutomationFlow[]
  readonly diagnostics: readonly AutomationFlowDiagnostic[]
}

const normalizePath = (path: string): string => path.replace(/\\/gu, '/')

const listFlowDefinitionFiles = async (
  rootPath: string
): Promise<readonly string[]> => {
  try {
    const entries = await readdir(rootPath, { withFileTypes: true })
    const files = entries
      .filter(
        (entry) =>
          entry.isFile() && extname(entry.name).toLowerCase() === '.md'
      )
      .map((entry) => join(rootPath, entry.name))

    return Object.freeze(files.sort())
  } catch {
    return Object.freeze([])
  }
}

const loadAutomationFlowsFromRoot = async (
  rootPath: string
): Promise<AutomationFlowLibrary> => {
  const files = await listFlowDefinitionFiles(rootPath)
  const parsed = await Promise.all(
    files.map(async (filePath) => {
      const markdown = await readFile(filePath, 'utf8')
      return parseAutomationFlowMarkdown(markdown, {
        sourceFile: filePath
      })
    })
  )

  return Object.freeze({
    automationFlows: Object.freeze(
      parsed.flatMap((result) => (result.ok ? [result.automationFlow] : []))
    ),
    diagnostics: Object.freeze(parsed.flatMap((result) => result.diagnostics))
  })
}

export const loadAutomationFlowLibrary = async ({
  homePath,
  workspaceRoot
}: LoadAutomationFlowLibraryInput): Promise<AutomationFlowLibrary> => {
  const roots = [
    getUserAutomationFlowRoot(homePath),
    ...(workspaceRoot === undefined
      ? []
      : [getWorkspaceAutomationFlowRoot(workspaceRoot)])
  ]
  const libraries = await Promise.all(roots.map(loadAutomationFlowsFromRoot))

  return Object.freeze({
    automationFlows: Object.freeze(
      libraries
        .flatMap((library) => library.automationFlows)
        .sort((left, right) =>
          normalizePath(left.sourceFile ?? '').localeCompare(
            normalizePath(right.sourceFile ?? '')
          )
        )
    ),
    diagnostics: Object.freeze(
      libraries
        .flatMap((library) => library.diagnostics)
        .sort((left, right) =>
          normalizePath(left.sourceFile ?? '').localeCompare(
            normalizePath(right.sourceFile ?? '')
          )
        )
    )
  })
}

export const getAutomationFlowRelativePath = (
  rootPath: string,
  filePath: string
): string => normalizePath(relative(rootPath, filePath))
