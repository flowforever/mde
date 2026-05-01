export type AiToolId = "claude" | "codex";

export interface AiTool {
  readonly commandPath: string;
  readonly id: AiToolId;
  readonly name: string;
}

export interface AiToolDetectionResult {
  readonly tools: readonly AiTool[];
}

export interface AiGenerationResult {
  readonly cached: boolean;
  readonly contents: string;
  readonly kind: "summary" | "translation";
  readonly language?: string;
  readonly path: string;
  readonly tool: AiTool;
}

export interface AiGenerationOptions {
  readonly modelName?: string;
  readonly toolId?: AiToolId;
}

export interface AiLanguagePackEntry {
  readonly key: string;
  readonly text: string;
}

export interface AiLanguagePackGenerationResult {
  readonly entries: readonly AiLanguagePackEntry[];
  readonly language: string;
  readonly tool: AiTool;
}

export interface AiApi {
  readonly detectTools: () => Promise<AiToolDetectionResult>;
  readonly generateAppLanguagePack?: (
    language: string,
    entries: readonly AiLanguagePackEntry[],
    options?: AiGenerationOptions,
  ) => Promise<AiLanguagePackGenerationResult>;
  readonly summarizeMarkdown: (
    markdownFilePath: string,
    markdown: string,
    workspaceRoot: string,
    instruction?: string,
    options?: AiGenerationOptions,
  ) => Promise<AiGenerationResult>;
  readonly translateMarkdown: (
    markdownFilePath: string,
    markdown: string,
    language: string,
    workspaceRoot: string,
    options?: AiGenerationOptions,
  ) => Promise<AiGenerationResult>;
}
