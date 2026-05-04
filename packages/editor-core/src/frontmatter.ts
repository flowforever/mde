import { load as parseYaml } from 'js-yaml'

export interface MarkdownFrontmatterBlock {
  readonly fieldCount: number
  readonly fields: readonly MarkdownFrontmatterField[]
  readonly isValid: boolean
  readonly parseErrorMessage?: string
  readonly raw: string
  readonly summary: string
}

export interface MarkdownFrontmatterField {
  readonly key: string
  readonly value: string
}

export interface ParsedMarkdownFrontmatter {
  readonly body: string
  readonly bodyStartOffset: number
  readonly bodyStartLineNumber: number
  readonly frontmatter: MarkdownFrontmatterBlock | null
  readonly leadingBom: '' | '\uFEFF'
  readonly lineEnding: '\n' | '\r\n'
}

const YAML_MARKER_PATTERN = /^---[ \t]*$/u
const UTF8_BOM = '\uFEFF'

const detectLineEnding = (markdown: string): '\n' | '\r\n' =>
  markdown.includes('\r\n') ? '\r\n' : '\n'

const getLineEnd = (
  contents: string,
  startIndex: number
): { readonly endIndex: number; readonly lineEndingLength: number } => {
  const nextLineFeedIndex = contents.indexOf('\n', startIndex)

  if (nextLineFeedIndex === -1) {
    return {
      endIndex: contents.length,
      lineEndingLength: 0
    }
  }

  return {
    endIndex:
      nextLineFeedIndex > startIndex && contents[nextLineFeedIndex - 1] === '\r'
        ? nextLineFeedIndex - 1
        : nextLineFeedIndex,
    lineEndingLength:
      nextLineFeedIndex > startIndex && contents[nextLineFeedIndex - 1] === '\r'
        ? 2
        : 1
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const countFields = (parsedYaml: unknown, raw: string): number => {
  if (isRecord(parsedYaml)) {
    return Object.keys(parsedYaml).length
  }

  return raw
    .split(/\r?\n/u)
    .filter((line) => /^[A-Za-z0-9_-]+[ \t]*:/u.test(line)).length
}

const formatFrontmatterFieldValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return ''
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch {
    return Object.prototype.toString.call(value)
  }
}

const RAW_FIELD_PATTERN = /^([A-Za-z0-9_-]+)[ \t]*:[ \t]*(.*)$/u

const createFieldsFromRaw = (raw: string): readonly MarkdownFrontmatterField[] =>
  raw
    .split(/\r?\n/u)
    .map((line) => RAW_FIELD_PATTERN.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) =>
      Object.freeze({
        key: match[1],
        value: match[2]
      })
    )

const createFrontmatterFields = (
  parsedYaml: unknown,
  raw: string
): readonly MarkdownFrontmatterField[] => {
  if (!isRecord(parsedYaml)) {
    return createFieldsFromRaw(raw)
  }

  return Object.entries(parsedYaml).map(([key, value]) =>
    Object.freeze({
      key,
      value: formatFrontmatterFieldValue(value)
    })
  )
}

const createSummary = (raw: string): string => {
  const summary = raw
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .slice(0, 2)
    .join('   ')

  return summary.length > 96 ? `${summary.slice(0, 95)}...` : summary
}

const parseFrontmatterBlock = (raw: string): MarkdownFrontmatterBlock => {
  try {
    const parsedYaml = raw.trim().length > 0 ? parseYaml(raw) : {}

    return Object.freeze({
      fields: createFrontmatterFields(parsedYaml, raw),
      fieldCount: countFields(parsedYaml, raw),
      isValid: true,
      raw,
      summary: createSummary(raw)
    })
  } catch (error) {
    return Object.freeze({
      fields: createFieldsFromRaw(raw),
      fieldCount: countFields(null, raw),
      isValid: false,
      parseErrorMessage:
        error instanceof Error ? error.message : 'Unable to parse frontmatter',
      raw,
      summary: createSummary(raw)
    })
  }
}

const countLinesBeforeOffset = (contents: string, offset: number): number =>
  contents.slice(0, offset).split('\n').length

const removeDelimiterSeparatorLineEnding = (
  raw: string,
  lineEnding: '\n' | '\r\n'
): string => {
  if (raw.endsWith(lineEnding)) {
    return raw.slice(0, -lineEnding.length)
  }

  if (lineEnding === '\r\n' && raw.endsWith('\n')) {
    return raw.slice(0, -1)
  }

  return raw
}

export const splitMarkdownFrontmatter = (
  markdown: string
): ParsedMarkdownFrontmatter => {
  const leadingBom = markdown.startsWith(UTF8_BOM) ? UTF8_BOM : ''
  const lineEnding = detectLineEnding(markdown)
  const contentStartIndex = leadingBom.length
  const firstLine = getLineEnd(markdown, contentStartIndex)
  const firstLineText = markdown.slice(contentStartIndex, firstLine.endIndex)

  if (
    !YAML_MARKER_PATTERN.test(firstLineText) ||
    firstLine.lineEndingLength === 0
  ) {
    return Object.freeze({
      body: markdown.slice(contentStartIndex),
      bodyStartOffset: contentStartIndex,
      bodyStartLineNumber: 1,
      frontmatter: null,
      leadingBom,
      lineEnding
    })
  }

  const rawStartIndex = firstLine.endIndex + firstLine.lineEndingLength
  let lineStartIndex = rawStartIndex

  while (lineStartIndex <= markdown.length) {
    const line = getLineEnd(markdown, lineStartIndex)
    const lineText = markdown.slice(lineStartIndex, line.endIndex)

    if (YAML_MARKER_PATTERN.test(lineText)) {
      const bodyStartOffset = line.endIndex + line.lineEndingLength
      const raw = removeDelimiterSeparatorLineEnding(
        markdown.slice(rawStartIndex, lineStartIndex),
        lineEnding
      )

      return Object.freeze({
        body: markdown.slice(bodyStartOffset),
        bodyStartOffset,
        bodyStartLineNumber: countLinesBeforeOffset(markdown, bodyStartOffset),
        frontmatter: parseFrontmatterBlock(raw),
        leadingBom,
        lineEnding
      })
    }

    if (line.lineEndingLength === 0) {
      break
    }

    lineStartIndex = line.endIndex + line.lineEndingLength
  }

  return Object.freeze({
    body: markdown.slice(contentStartIndex),
    bodyStartOffset: contentStartIndex,
    bodyStartLineNumber: 1,
    frontmatter: null,
    leadingBom,
    lineEnding
  })
}

const ensureTrailingLineEnding = (
  raw: string,
  lineEnding: '\n' | '\r\n'
): string =>
  raw.length === 0 || raw.endsWith('\n') || raw.endsWith('\r')
    ? raw
    : `${raw}${lineEnding}`

export const composeMarkdownWithFrontmatter = (
  parsedMarkdown: Pick<
    ParsedMarkdownFrontmatter,
    'frontmatter' | 'leadingBom' | 'lineEnding'
  >,
  body: string,
  frontmatterRaw = parsedMarkdown.frontmatter?.raw
): string => {
  const leadingBom = parsedMarkdown.leadingBom

  if (frontmatterRaw === undefined || frontmatterRaw.trim().length === 0) {
    return `${leadingBom}${body}`
  }

  const raw = ensureTrailingLineEnding(
    frontmatterRaw,
    parsedMarkdown.lineEnding
  )

  return `${leadingBom}---${parsedMarkdown.lineEnding}${raw}---${
    body.length > 0 ? `${parsedMarkdown.lineEnding}${body}` : ''
  }`
}

export const getMarkdownBody = (markdown: string): string =>
  splitMarkdownFrontmatter(markdown).body
