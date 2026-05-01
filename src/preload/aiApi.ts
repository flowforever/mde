import type * as Electron from "electron";

import { AI_CHANNELS } from "../main/ipc/channels";
import type {
  AiApi,
  AiGenerationResult,
  AiLanguagePackGenerationResult,
  AiToolDetectionResult,
} from "../shared/ai";

type IpcRenderer = Pick<typeof Electron.ipcRenderer, "invoke">;

export const createAiApi = (ipcRenderer: IpcRenderer): AiApi => ({
  detectTools: () =>
    ipcRenderer.invoke(
      AI_CHANNELS.detectTools,
    ) as Promise<AiToolDetectionResult>,
  generateAppLanguagePack: (language, entries, options) =>
    ipcRenderer.invoke(
      AI_CHANNELS.generateAppLanguagePack,
      language,
      entries,
      options,
    ) as Promise<AiLanguagePackGenerationResult>,
  summarizeMarkdown: (
    markdownFilePath,
    markdown,
    workspaceRoot,
    instruction,
    options,
  ) =>
    ipcRenderer.invoke(
      AI_CHANNELS.summarizeMarkdown,
      markdownFilePath,
      markdown,
      workspaceRoot,
      instruction,
      options,
    ) as Promise<AiGenerationResult>,
  translateMarkdown: (
    markdownFilePath,
    markdown,
    language,
    workspaceRoot,
    options,
  ) =>
    ipcRenderer.invoke(
      AI_CHANNELS.translateMarkdown,
      markdownFilePath,
      markdown,
      language,
      workspaceRoot,
      options,
    ) as Promise<AiGenerationResult>,
});
