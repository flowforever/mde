import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstat, mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, sep } from 'node:path'
import { promisify } from 'node:util'

import type {
  AiGenerationOptions,
  AiGenerationResult,
  AiTool,
  AiToolId
} from '../../shared/ai'
import { assertPathInsideWorkspace, resolveWorkspacePath } from './pathSafety'

const execFileAsync = promisify(execFile)
const AI_CLI_TIMEOUT_MS = 180_000

interface SupportedAiTool {
  readonly command: string
  readonly id: AiToolId
  readonly name: string
}

interface AiCacheMetadata {
  readonly createdAt: string
  readonly instruction?: string
  readonly kind: AiGenerationResult['kind']
  readonly language?: string
  readonly modelName?: string
  readonly sourceHash: string
  readonly sourcePath: string
  readonly toolId: AiToolId
}

interface RunPromptOptions {
  readonly modelName?: string
  readonly prompt: string
  readonly tool: AiTool
  readonly workspacePath: string
}

interface CreateAiServiceOptions {
  readonly locateCommand?: (tool: SupportedAiTool) => Promise<string | null>
  readonly now?: () => Date
  readonly runPrompt?: (options: RunPromptOptions) => Promise<string>
}

export interface AiService {
  readonly detectTools: () => Promise<readonly AiTool[]>
  readonly summarizeMarkdown: (
    workspacePath: string,
    markdownFilePath: string,
    markdown: string,
    instruction?: string,
    options?: AiGenerationOptions
  ) => Promise<AiGenerationResult>
  readonly translateMarkdown: (
    workspacePath: string,
    markdownFilePath: string,
    markdown: string,
    language: string,
    options?: AiGenerationOptions
  ) => Promise<AiGenerationResult>
}

const supportedTools: readonly SupportedAiTool[] = Object.freeze([
  { command: 'codex', id: 'codex', name: 'Codex' },
  { command: 'claude', id: 'claude', name: 'Claude Code' }
])

const predefinedLanguageSlugs = new Map([
  ['\u4e2d\u6587', 'Chinese'],
  ['English', 'English']
])

const isMarkdownPath = (filePath: string): boolean =>
  extname(filePath).toLowerCase() === '.md'

const toWorkspaceRelativePath = (
  workspacePath: string,
  absolutePath: string
): string => relative(workspacePath, absolutePath).split(sep).join('/')

const hashMarkdown = (markdown: string): string =>
  createHash('sha256').update(markdown).digest('hex')

const isErrorWithCode = (
  error: unknown,
  code: string
): error is NodeJS.ErrnoException =>
  error instanceof Error && (error as NodeJS.ErrnoException).code === code

const trimTrailingLineBreaks = (value: string): string =>
  value.replace(/\s+$/u, '')

const normalizeSummaryInstruction = (instruction?: string): string =>
  instruction?.trim() ?? ''

const normalizeModelName = (modelName?: string): string => modelName?.trim() ?? ''

const assertMarkdownFilePath = (filePath: string): void => {
  if (filePath.trim().length === 0 || filePath === '.') {
    throw new Error('Markdown file path is required')
  }

  if (!isMarkdownPath(filePath)) {
    throw new Error('Only Markdown files can be summarized or translated')
  }
}

const resolveSourceMarkdownFile = async (
  workspacePath: string,
  markdownFilePath: string
): Promise<string> => {
  assertMarkdownFilePath(markdownFilePath)

  const realWorkspacePath = await realpath(workspacePath)
  const absoluteFilePath = resolveWorkspacePath(
    realWorkspacePath,
    markdownFilePath
  )
  const realFilePath = await realpath(absoluteFilePath)

  assertPathInsideWorkspace(realWorkspacePath, realFilePath)

  if (!isMarkdownPath(realFilePath)) {
    throw new Error('Only Markdown files can be summarized or translated')
  }

  const fileStats = await stat(realFilePath)

  if (!fileStats.isFile()) {
    throw new Error('Markdown path must be a file')
  }

  if (fileStats.nlink > 1) {
    throw new Error('Hard-linked Markdown files are unsupported')
  }

  return realFilePath
}

const ensureChildDirectory = async (
  parentPath: string,
  childName: string
): Promise<string> => {
  const childPath = join(parentPath, childName)

  try {
    const entryStats = await lstat(childPath)

    if (entryStats.isSymbolicLink()) {
      throw new Error('Symlink paths are unsupported for AI result files')
    }

    if (!entryStats.isDirectory()) {
      throw new Error('AI result path must be a directory')
    }
  } catch (error) {
    if (!isErrorWithCode(error, 'ENOENT')) {
      throw error
    }

    await mkdir(childPath)
  }

  const finalStats = await lstat(childPath)

  if (finalStats.isSymbolicLink()) {
    throw new Error('Symlink paths are unsupported for AI result files')
  }

  if (!finalStats.isDirectory()) {
    throw new Error('AI result path must be a directory')
  }

  return childPath
}

const ensureTranslationsDirectory = async (
  workspacePath: string,
  markdownFilePath: string
): Promise<string> => {
  const sourceFilePath = await resolveSourceMarkdownFile(
    workspacePath,
    markdownFilePath
  )
  const sourceDirectoryPath = dirname(sourceFilePath)
  const mdeDirectoryPath = await ensureChildDirectory(sourceDirectoryPath, '.mde')
  const translationsDirectoryPath = await ensureChildDirectory(
    mdeDirectoryPath,
    'translations'
  )

  assertPathInsideWorkspace(await realpath(workspacePath), translationsDirectoryPath)

  return translationsDirectoryPath
}

const sanitizeLanguageSlug = (language: string): string => {
  const trimmedLanguage = language.trim()
  const predefinedSlug = predefinedLanguageSlugs.get(trimmedLanguage)

  if (predefinedSlug) {
    return predefinedSlug
  }

  const slug = trimmedLanguage
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/gu, '')

  if (slug.length === 0) {
    throw new Error('Translation language is required')
  }

  return slug
}

const createResultFileNames = (
  markdownFilePath: string,
  kind: AiGenerationResult['kind'],
  language?: string
): { readonly metaFileName: string; readonly resultFileName: string } => {
  const baseName = basename(markdownFilePath, extname(markdownFilePath))
  const resultStem =
    kind === 'summary'
      ? `${baseName}-summary`
      : `${baseName}.${sanitizeLanguageSlug(language ?? '')}`

  return {
    metaFileName: `${resultStem}.meta.json`,
    resultFileName: `${resultStem}.md`
  }
}

const readCacheMetadata = async (
  metadataPath: string
): Promise<AiCacheMetadata | null> => {
  try {
    const candidate = JSON.parse(await readFile(metadataPath, 'utf8')) as Partial<
      AiCacheMetadata
    >

    if (
      typeof candidate.sourceHash === 'string' &&
      typeof candidate.sourcePath === 'string' &&
      typeof candidate.toolId === 'string' &&
      (candidate.kind === 'summary' || candidate.kind === 'translation')
    ) {
      return candidate as AiCacheMetadata
    }
  } catch (error) {
    if (!isErrorWithCode(error, 'ENOENT')) {
      return null
    }
  }

  return null
}

const getCachedResult = async ({
  kind,
  language,
  markdown,
  markdownFilePath,
  metadataPath,
  resultPath,
  selectedModelName,
  selectedToolId,
  summaryInstruction,
  tools
}: {
  readonly kind: AiGenerationResult['kind']
  readonly language?: string
  readonly markdown: string
  readonly markdownFilePath: string
  readonly metadataPath: string
  readonly resultPath: string
  readonly selectedModelName?: string
  readonly selectedToolId?: AiToolId
  readonly summaryInstruction?: string
  readonly tools: readonly AiTool[]
}): Promise<AiGenerationResult | null> => {
  const metadata = await readCacheMetadata(metadataPath)

  if (metadata?.kind !== kind) {
    return null
  }

  if (
    metadata.sourcePath !== markdownFilePath ||
    metadata.sourceHash !== hashMarkdown(markdown)
  ) {
    return null
  }

  if (kind === 'translation' && metadata.language !== language) {
    return null
  }

  if (selectedToolId && metadata.toolId !== selectedToolId) {
    return null
  }

  if ((metadata.modelName ?? '') !== normalizeModelName(selectedModelName)) {
    return null
  }

  if (
    kind === 'summary' &&
    (metadata.instruction ?? '') !== normalizeSummaryInstruction(summaryInstruction)
  ) {
    return null
  }

  const cachedTool =
    tools.find((tool) => tool.id === metadata.toolId) ??
    ({
      commandPath: '',
      id: metadata.toolId,
      name: metadata.toolId === 'codex' ? 'Codex' : 'Claude Code'
    } satisfies AiTool)

  try {
    return {
      cached: true,
      contents: await readFile(resultPath, 'utf8'),
      kind,
      language,
      path: '',
      tool: cachedTool
    }
  } catch (error) {
    if (!isErrorWithCode(error, 'ENOENT')) {
      throw error
    }
  }

  return null
}

const defaultLocateCommand = async (
  tool: SupportedAiTool
): Promise<string | null> => {
  try {
    const { stdout } = await execFileAsync('which', [tool.command], {
      timeout: 3000
    })
    const commandPath = stdout.trim().split('\n')[0]?.trim()

    if (commandPath) {
      return commandPath
    }
  } catch {
    // Fall back to the user's shell below. GUI-launched apps often have a
    // sparse PATH, while test/dev launches usually pass the intended PATH.
  }

  try {
    const { stdout } = await execFileAsync(
      '/bin/zsh',
      ['-lc', `command -v ${tool.command}`],
      { timeout: 3000 }
    )
    const commandPath = stdout.trim().split('\n')[0]?.trim()

    return commandPath || null
  } catch {
    return null
  }
}

const getToolArgs = (
  tool: AiTool,
  workspacePath: string,
  modelName?: string
): readonly string[] => {
  const normalizedModelName = normalizeModelName(modelName)
  const modelArgs = normalizedModelName
    ? ['--model', normalizedModelName]
    : []

  return tool.id === 'codex'
    ? [
        'exec',
        ...modelArgs,
        '--ephemeral',
        '--ignore-rules',
        '--sandbox',
        'read-only',
        '--ask-for-approval',
        'never',
        '-C',
        workspacePath,
        '-'
      ]
    : [
        ...modelArgs,
        '--print',
        '--output-format',
        'text',
        '--input-format',
        'text',
        '--permission-mode',
        'dontAsk',
        '--tools',
        '',
        '--no-session-persistence',
        '--disable-slash-commands'
      ]
}

const defaultRunPrompt = ({
  modelName,
  prompt,
  tool,
  workspacePath
}: RunPromptOptions): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = spawn(tool.commandPath, getToolArgs(tool, workspacePath, modelName), {
      cwd: workspacePath,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    let isSettled = false
    const settle = (): boolean => {
      if (isSettled) {
        return false
      }

      isSettled = true
      clearTimeout(timeoutId)

      return true
    }
    const fail = (error: Error): void => {
      if (settle()) {
        reject(error)
      }
    }
    const succeed = (output: string): void => {
      if (settle()) {
        resolve(output)
      }
    }
    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM')
      fail(new Error('AI CLI timed out'))
    }, AI_CLI_TIMEOUT_MS)

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => {
      fail(error)
    })
    child.on('close', (code) => {
      if (code !== 0) {
        fail(
          new Error(
            trimTrailingLineBreaks(stderr) ||
              `${tool.name} exited with code ${code ?? 'unknown'}`
          )
        )
        return
      }

      const output = trimTrailingLineBreaks(stdout)

      if (output.length === 0) {
        fail(new Error(`${tool.name} returned an empty response`))
        return
      }

      succeed(output)
    })
    child.stdin.end(prompt)
  })

const createTranslatePrompt = (markdown: string, language: string): string =>
  [
    'Return only Markdown. Translate the following Markdown document.',
    `Target language: ${language.trim()}.`,
    'Preserve headings, lists, links, code fences, tables, and image references.',
    'Do not add commentary, wrappers, or explanations.',
    '<markdown>',
    markdown,
    '</markdown>'
  ].join('\n')

const createSummaryPrompt = (markdown: string, instruction?: string): string => {
  const normalizedInstruction = normalizeSummaryInstruction(instruction)
  const promptLines = [
    'Return only Markdown. Summarize the following Markdown document.',
    'Use the document main language unless the document is clearly bilingual.',
    'Keep the summary concise and preserve important proper nouns and decisions.',
    'Do not add commentary, wrappers, or explanations.'
  ]

  if (normalizedInstruction.length > 0) {
    promptLines.push(
      'Follow this additional user instruction for the regenerated summary:',
      normalizedInstruction
    )
  }

  return [
    ...promptLines,
    '<markdown>',
    markdown,
    '</markdown>'
  ].join('\n')
}

const selectToolsForGeneration = (
  tools: readonly AiTool[],
  selectedToolId?: AiToolId
): readonly AiTool[] => {
  if (!selectedToolId) {
    return tools
  }

  const selectedTool = tools.find((tool) => tool.id === selectedToolId)

  if (!selectedTool) {
    throw new Error('Selected AI CLI is not installed')
  }

  return [selectedTool]
}

export const createAiService = ({
  locateCommand = defaultLocateCommand,
  now = () => new Date(),
  runPrompt = defaultRunPrompt
}: CreateAiServiceOptions = {}): AiService => {
  const detectTools = async (): Promise<readonly AiTool[]> => {
    const detectedTools = await Promise.all(
      supportedTools.map(async (tool) => {
        const commandPath = await locateCommand(tool)

        return commandPath
          ? ({
              commandPath,
              id: tool.id,
              name: tool.name
            } satisfies AiTool)
          : null
      })
    )

    return detectedTools.filter((tool): tool is AiTool => tool !== null)
  }

  const generateMarkdown = async ({
    kind,
    instruction,
    language,
    markdown,
    markdownFilePath,
    prompt,
    options,
    workspacePath
  }: {
    readonly kind: AiGenerationResult['kind']
    readonly instruction?: string
    readonly language?: string
    readonly markdown: string
    readonly markdownFilePath: string
    readonly options?: AiGenerationOptions
    readonly prompt: string
    readonly workspacePath: string
  }): Promise<AiGenerationResult> => {
    const realWorkspacePath = await realpath(workspacePath)
    const translationsDirectoryPath = await ensureTranslationsDirectory(
      realWorkspacePath,
      markdownFilePath
    )
    const { metaFileName, resultFileName } = createResultFileNames(
      markdownFilePath,
      kind,
      language
    )
    const resultPath = join(translationsDirectoryPath, resultFileName)
    const metadataPath = join(translationsDirectoryPath, metaFileName)
    const resultWorkspacePath = toWorkspaceRelativePath(realWorkspacePath, resultPath)
    const normalizedInstruction =
      kind === 'summary' ? normalizeSummaryInstruction(instruction) : ''
    const selectedModelName = normalizeModelName(options?.modelName)
    const tools = await detectTools()
    const cachedResult = await getCachedResult({
      kind,
      language,
      markdown,
      markdownFilePath,
      metadataPath,
      resultPath,
      selectedModelName,
      selectedToolId: options?.toolId,
      summaryInstruction: normalizedInstruction,
      tools
    })

    if (cachedResult) {
      return {
        ...cachedResult,
        path: resultWorkspacePath
      }
    }

    if (tools.length === 0) {
      throw new Error('Install Codex or Claude Code CLI to use AI actions')
    }

    const failures: string[] = []
    const generationTools = selectToolsForGeneration(tools, options?.toolId)

    for (const tool of generationTools) {
      try {
        const contents = await runPrompt({
          ...(selectedModelName ? { modelName: selectedModelName } : {}),
          prompt,
          tool,
          workspacePath: realWorkspacePath
        })
        const metadata: AiCacheMetadata = {
          createdAt: now().toISOString(),
          ...(normalizedInstruction.length > 0
            ? { instruction: normalizedInstruction }
            : {}),
          kind,
          language,
          ...(selectedModelName ? { modelName: selectedModelName } : {}),
          sourceHash: hashMarkdown(markdown),
          sourcePath: markdownFilePath,
          toolId: tool.id
        }

        await writeFile(resultPath, contents, 'utf8')
        await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8')

        return {
          cached: false,
          contents,
          kind,
          language,
          path: resultWorkspacePath,
          tool
        }
      } catch (error) {
        failures.push(`${tool.name}: ${error instanceof Error ? error.message : 'failed'}`)
      }
    }

    throw new Error(`Unable to generate AI result. ${failures.join('; ')}`)
  }

  return {
    detectTools,
    summarizeMarkdown: (
      workspacePath,
      markdownFilePath,
      markdown,
      instruction,
      options
    ) =>
      generateMarkdown({
        kind: 'summary',
        instruction,
        markdown,
        markdownFilePath,
        options,
        prompt: createSummaryPrompt(markdown, instruction),
        workspacePath
      }),
    translateMarkdown: (
      workspacePath,
      markdownFilePath,
      markdown,
      language,
      options
    ) =>
      generateMarkdown({
        kind: 'translation',
        language: language.trim(),
        markdown,
        markdownFilePath,
        options,
        prompt: createTranslatePrompt(markdown, language),
        workspacePath
      })
  }
}
