import type { IpcMain, IpcMainInvokeEvent } from "electron";

import type {
  AiGenerationOptions,
  AiLanguagePackEntry,
  AiToolId,
} from "../../shared/ai";
import type { AiService } from "../services/aiService";
import { AI_CHANNELS } from "./channels";

interface RegisterAiHandlersOptions {
  readonly aiService: AiService;
  readonly getActiveWorkspaceRoot: (
    event?: Pick<IpcMainInvokeEvent, "sender"> | null,
  ) => string | null;
  readonly ipcMain: Pick<IpcMain, "handle">;
}

const assertStringInput = (value: unknown, name: string): string => {
  if (typeof value !== "string") {
    throw new Error(`${name} must be a string`);
  }

  return value;
};

const assertOptionalStringInput = (
  value: unknown,
  name: string,
): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${name} must be a string`);
  }

  return value;
};

const isAiToolId = (value: unknown): value is AiToolId =>
  value === "codex" || value === "claude";

const assertOptionalAiGenerationOptions = (
  value: unknown,
): AiGenerationOptions | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI generation options must be an object");
  }

  const candidate = value as Record<string, unknown>;

  if (candidate.toolId !== undefined && !isAiToolId(candidate.toolId)) {
    throw new Error("AI tool id must be codex or claude");
  }

  if (
    candidate.modelName !== undefined &&
    typeof candidate.modelName !== "string"
  ) {
    throw new Error("AI model name must be a string");
  }

  return {
    ...(candidate.modelName ? { modelName: candidate.modelName } : {}),
    ...(candidate.toolId ? { toolId: candidate.toolId } : {}),
  };
};

const assertLanguagePackEntries = (
  value: unknown,
): readonly AiLanguagePackEntry[] => {
  if (!Array.isArray(value)) {
    throw new Error("Language pack entries must be an array");
  }

  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Language pack entry must be an object");
    }

    const candidate = entry as Record<string, unknown>;

    if (
      typeof candidate.key !== "string" ||
      typeof candidate.text !== "string"
    ) {
      throw new Error("Language pack entry key and text must be strings");
    }

    return {
      key: candidate.key,
      text: candidate.text,
    };
  });
};

const getRequiredWorkspaceRoot = (
  event: Pick<IpcMainInvokeEvent, "sender">,
  getActiveWorkspaceRoot: (
    event?: Pick<IpcMainInvokeEvent, "sender"> | null,
  ) => string | null,
  expectedWorkspaceRoot: string,
): string => {
  const activeWorkspaceRoot = getActiveWorkspaceRoot(event);

  if (!activeWorkspaceRoot) {
    throw new Error("Open a workspace before using AI actions");
  }

  if (activeWorkspaceRoot !== expectedWorkspaceRoot) {
    throw new Error("Workspace changed before AI operation completed");
  }

  return activeWorkspaceRoot;
};

export const registerAiHandlers = ({
  aiService,
  getActiveWorkspaceRoot,
  ipcMain,
}: RegisterAiHandlersOptions): void => {
  ipcMain.handle(AI_CHANNELS.detectTools, async () => ({
    tools: await aiService.detectTools(),
  }));

  ipcMain.handle(
    AI_CHANNELS.generateAppLanguagePack,
    async (_event, language, entries, options) =>
      aiService.generateAppLanguagePack(
        assertStringInput(language, "Language"),
        assertLanguagePackEntries(entries),
        assertOptionalAiGenerationOptions(options),
      ),
  );

  ipcMain.handle(
    AI_CHANNELS.summarizeMarkdown,
    async (
      event,
      markdownFilePath,
      markdown,
      workspaceRoot,
      instruction,
      options,
    ) =>
      aiService.summarizeMarkdown(
        getRequiredWorkspaceRoot(
          event,
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, "Workspace root"),
        ),
        assertStringInput(markdownFilePath, "Markdown file path"),
        assertStringInput(markdown, "Markdown"),
        assertOptionalStringInput(instruction, "Summary instruction"),
        assertOptionalAiGenerationOptions(options),
      ),
  );

  ipcMain.handle(
    AI_CHANNELS.translateMarkdown,
    async (
      event,
      markdownFilePath,
      markdown,
      language,
      workspaceRoot,
      options,
    ) =>
      aiService.translateMarkdown(
        getRequiredWorkspaceRoot(
          event,
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, "Workspace root"),
        ),
        assertStringInput(markdownFilePath, "Markdown file path"),
        assertStringInput(markdown, "Markdown"),
        assertStringInput(language, "Language"),
        assertOptionalAiGenerationOptions(options),
      ),
  );
};
