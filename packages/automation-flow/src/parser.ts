import { load as parseYaml } from 'js-yaml'
import type { z } from 'zod'

import {
  createDefaultEngineNotAllowedDiagnostic,
  createInvalidFieldDiagnostic,
  createInvalidFrontmatterDiagnostic,
  createMissingFrontmatterDiagnostic,
  createMissingRequiredFieldDiagnostic,
  createMissingRequiredSectionDiagnostic
} from './diagnostics'
import { automationFlowSchema } from './schema'
import type {
  AutomationFlowDiagnostic,
  AutomationFlowParseResult,
  AutomationFlowSections
} from './types'

export interface ParseAutomationFlowMarkdownOptions {
  readonly sourceFile?: string
}

interface FrontmatterParseResult {
  readonly body: string
  readonly diagnostics: readonly AutomationFlowDiagnostic[]
  readonly frontmatter: Record<string, unknown> | null
}

const FRONTMATTER_DELIMITER_PATTERN = /^---[ \t]*$/u

const REQUIRED_SECTIONS = Object.freeze([
  ['pickRules', 'Pick Rules'],
  ['executionStandard', 'Execution Standard'],
  ['acceptanceStandard', 'Acceptance Standard'],
  ['verificationExpectations', 'Verification Expectations'],
  ['reportPattern', 'Report Pattern']
] as const)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const splitLines = (markdown: string): readonly string[] => markdown.split(/\r?\n/u)

const parseFrontmatter = (
  markdown: string,
  sourceFile?: string
): FrontmatterParseResult => {
  const lines = splitLines(markdown)

  if (!FRONTMATTER_DELIMITER_PATTERN.test(lines[0] ?? '')) {
    return {
      body: markdown,
      diagnostics: [createMissingFrontmatterDiagnostic(sourceFile)],
      frontmatter: null
    }
  }

  const closingDelimiterIndex = lines
    .slice(1)
    .findIndex((line) => FRONTMATTER_DELIMITER_PATTERN.test(line))

  if (closingDelimiterIndex === -1) {
    return {
      body: markdown,
      diagnostics: [
        createInvalidFrontmatterDiagnostic(
          sourceFile,
          'Missing closing frontmatter delimiter.'
        )
      ],
      frontmatter: null
    }
  }

  const frontmatterEndIndex = closingDelimiterIndex + 1
  const rawFrontmatter = lines.slice(1, frontmatterEndIndex).join('\n')
  const body = lines.slice(frontmatterEndIndex + 1).join('\n')

  try {
    const parsedFrontmatter =
      rawFrontmatter.trim().length > 0 ? parseYaml(rawFrontmatter) : {}

    if (!isRecord(parsedFrontmatter)) {
      return {
        body,
        diagnostics: [
          createInvalidFrontmatterDiagnostic(
            sourceFile,
            'Frontmatter must be a YAML mapping.'
          )
        ],
        frontmatter: null
      }
    }

    return {
      body,
      diagnostics: [],
      frontmatter: parsedFrontmatter
    }
  } catch (error) {
    return {
      body,
      diagnostics: [
        createInvalidFrontmatterDiagnostic(
          sourceFile,
          error instanceof Error ? error.message : 'Unable to parse YAML.'
        )
      ],
      frontmatter: null
    }
  }
}

const parseHeading = (
  line: string
): { readonly level: number; readonly title: string } | null => {
  const match = /^(#{1,6})[ \t]+(.+?)[ \t#]*$/u.exec(line.trim())

  if (match === null) {
    return null
  }

  return {
    level: match[1].length,
    title: match[2].trim()
  }
}

const extractRequiredSections = (
  markdownBody: string,
  sourceFile?: string
): {
  readonly diagnostics: readonly AutomationFlowDiagnostic[]
  readonly sections: Partial<AutomationFlowSections>
} => {
  const titleToKey = new Map(
    REQUIRED_SECTIONS.map(([key, title]) => [title.toLowerCase(), key])
  )
  const sections: Partial<Record<keyof AutomationFlowSections, string>> = {}
  const lines = splitLines(markdownBody)
  let activeSection:
    | {
        readonly key: keyof AutomationFlowSections
        readonly level: number
        readonly lines: string[]
      }
    | null = null

  const flushActiveSection = (): void => {
    if (activeSection === null) {
      return
    }

    sections[activeSection.key] = activeSection.lines.join('\n').trim()
    activeSection = null
  }

  for (const line of lines) {
    const heading = parseHeading(line)

    if (heading !== null) {
      const requiredSectionKey = titleToKey.get(heading.title.toLowerCase())

      if (requiredSectionKey !== undefined) {
        flushActiveSection()
        activeSection = {
          key: requiredSectionKey,
          level: heading.level,
          lines: []
        }
        continue
      }

      if (
        activeSection !== null &&
        heading.level <= activeSection.level
      ) {
        flushActiveSection()
      }
    }

    activeSection?.lines.push(line)
  }

  flushActiveSection()

  const diagnostics = REQUIRED_SECTIONS.flatMap(([key, sectionName]) => {
    return (sections[key]?.trim().length ?? 0) > 0
      ? []
      : [createMissingRequiredSectionDiagnostic(sectionName, sourceFile)]
  })

  return {
    diagnostics,
    sections
  }
}

const issuePathToField = (issue: z.core.$ZodIssue): string =>
  issue.path.map(String).join('.')

const hasOwnPath = (
  value: Record<string, unknown>,
  path: readonly PropertyKey[]
): boolean => {
  let current: unknown = value

  for (const pathSegment of path) {
    if (typeof pathSegment === 'symbol') {
      return false
    }

    if (Array.isArray(current)) {
      const index =
        typeof pathSegment === 'number' ? pathSegment : Number(pathSegment)

      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return false
      }

      current = current[index]
      continue
    }

    const fieldName = String(pathSegment)

    if (!isRecord(current) || !Object.hasOwn(current, fieldName)) {
      return false
    }

    current = current[fieldName]
  }

  return true
}

const createDiagnosticFromZodIssue = (
  issue: z.core.$ZodIssue,
  sourceFile: string | undefined,
  frontmatter: Record<string, unknown>
): AutomationFlowDiagnostic => {
  const field = issuePathToField(issue)

  if (issue.code === 'custom' && field === 'defaultEngine') {
    return createDefaultEngineNotAllowedDiagnostic(
      typeof issue.input === 'string' ? issue.input : 'unknown',
      sourceFile
    )
  }

  if (issue.code === 'invalid_type' && !hasOwnPath(frontmatter, issue.path)) {
    return createMissingRequiredFieldDiagnostic(field, sourceFile, issue.message)
  }

  return createInvalidFieldDiagnostic(field, sourceFile, issue.message)
}

export const parseAutomationFlowMarkdown = (
  markdown: string,
  options: ParseAutomationFlowMarkdownOptions = {}
): AutomationFlowParseResult => {
  const frontmatterResult = parseFrontmatter(markdown, options.sourceFile)
  const frontmatter = frontmatterResult.frontmatter

  if (frontmatter === null) {
    return Object.freeze({
      diagnostics: frontmatterResult.diagnostics,
      ok: false
    })
  }

  const sectionResult = extractRequiredSections(
    frontmatterResult.body,
    options.sourceFile
  )

  if (sectionResult.diagnostics.length > 0) {
    return Object.freeze({
      diagnostics: sectionResult.diagnostics,
      ok: false
    })
  }

  const validation = automationFlowSchema.safeParse({
    ...frontmatter,
    sections: sectionResult.sections
  })

  if (!validation.success) {
    return Object.freeze({
      diagnostics: validation.error.issues.map((issue) =>
        createDiagnosticFromZodIssue(
          issue,
          options.sourceFile,
          frontmatter
        )
      ),
      ok: false
    })
  }

  return Object.freeze({
    automationFlow: Object.freeze({
      ...validation.data,
      sourceFile: options.sourceFile
    }),
    diagnostics: [],
    ok: true
  })
}
