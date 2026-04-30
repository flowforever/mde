import type * as Electron from 'electron'

import { AI_CHANNELS } from '../main/ipc/channels'
import type { AiApi, AiGenerationResult, AiToolDetectionResult } from '../shared/ai'

type IpcRenderer = Pick<typeof Electron.ipcRenderer, 'invoke'>

export const createAiApi = (ipcRenderer: IpcRenderer): AiApi => ({
  detectTools: () =>
    ipcRenderer.invoke(AI_CHANNELS.detectTools) as Promise<AiToolDetectionResult>,
  summarizeMarkdown: (
    markdownFilePath,
    markdown,
    workspaceRoot,
    instruction,
    options
  ) =>
    ipcRenderer.invoke(
      AI_CHANNELS.summarizeMarkdown,
      markdownFilePath,
      markdown,
      workspaceRoot,
      instruction,
      options
    ) as Promise<AiGenerationResult>,
  translateMarkdown: (markdownFilePath, markdown, language, workspaceRoot, options) =>
    ipcRenderer.invoke(
      AI_CHANNELS.translateMarkdown,
      markdownFilePath,
      markdown,
      language,
      workspaceRoot,
      options
    ) as Promise<AiGenerationResult>
})
