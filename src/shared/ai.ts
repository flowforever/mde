export type AiToolId = 'claude' | 'codex'

export interface AiTool {
  readonly commandPath: string
  readonly id: AiToolId
  readonly name: string
}

export interface AiToolDetectionResult {
  readonly tools: readonly AiTool[]
}

export interface AiGenerationResult {
  readonly cached: boolean
  readonly contents: string
  readonly kind: 'summary' | 'translation'
  readonly language?: string
  readonly path: string
  readonly tool: AiTool
}

export interface AiApi {
  readonly detectTools: () => Promise<AiToolDetectionResult>
  readonly summarizeMarkdown: (
    markdownFilePath: string,
    markdown: string,
    workspaceRoot: string,
    instruction?: string
  ) => Promise<AiGenerationResult>
  readonly translateMarkdown: (
    markdownFilePath: string,
    markdown: string,
    language: string,
    workspaceRoot: string
  ) => Promise<AiGenerationResult>
}
