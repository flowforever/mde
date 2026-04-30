import type { IpcMain, IpcMainInvokeEvent } from 'electron'

import type { AiGenerationOptions, AiToolId } from '../../shared/ai'
import type { AiService } from '../services/aiService'
import { AI_CHANNELS } from './channels'

interface RegisterAiHandlersOptions {
  readonly aiService: AiService
  readonly getActiveWorkspaceRoot: (
    event?: Pick<IpcMainInvokeEvent, 'sender'> | null
  ) => string | null
  readonly ipcMain: Pick<IpcMain, 'handle'>
}

const assertStringInput = (value: unknown, name: string): string => {
  if (typeof value !== 'string') {
    throw new Error(`${name} must be a string`)
  }

  return value
}

const assertOptionalStringInput = (
  value: unknown,
  name: string
): string | undefined => {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string') {
    throw new Error(`${name} must be a string`)
  }

  return value
}

const isAiToolId = (value: unknown): value is AiToolId =>
  value === 'codex' || value === 'claude'

const assertOptionalAiGenerationOptions = (
  value: unknown
): AiGenerationOptions | undefined => {
  if (value === undefined) {
    return undefined
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('AI generation options must be an object')
  }

  const candidate = value as Record<string, unknown>

  if (
    candidate.toolId !== undefined &&
    !isAiToolId(candidate.toolId)
  ) {
    throw new Error('AI tool id must be codex or claude')
  }

  if (
    candidate.modelName !== undefined &&
    typeof candidate.modelName !== 'string'
  ) {
    throw new Error('AI model name must be a string')
  }

  return {
    ...(candidate.modelName ? { modelName: candidate.modelName } : {}),
    ...(candidate.toolId ? { toolId: candidate.toolId } : {})
  }
}

const getRequiredWorkspaceRoot = (
  event: Pick<IpcMainInvokeEvent, 'sender'>,
  getActiveWorkspaceRoot: (
    event?: Pick<IpcMainInvokeEvent, 'sender'> | null
  ) => string | null,
  expectedWorkspaceRoot: string
): string => {
  const activeWorkspaceRoot = getActiveWorkspaceRoot(event)

  if (!activeWorkspaceRoot) {
    throw new Error('Open a workspace before using AI actions')
  }

  if (activeWorkspaceRoot !== expectedWorkspaceRoot) {
    throw new Error('Workspace changed before AI operation completed')
  }

  return activeWorkspaceRoot
}

export const registerAiHandlers = ({
  aiService,
  getActiveWorkspaceRoot,
  ipcMain
}: RegisterAiHandlersOptions): void => {
  ipcMain.handle(AI_CHANNELS.detectTools, async () => ({
    tools: await aiService.detectTools()
  }))

  ipcMain.handle(
    AI_CHANNELS.summarizeMarkdown,
    async (
      event,
      markdownFilePath,
      markdown,
      workspaceRoot,
      instruction,
      options
    ) =>
      aiService.summarizeMarkdown(
        getRequiredWorkspaceRoot(
          event,
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        assertStringInput(markdownFilePath, 'Markdown file path'),
        assertStringInput(markdown, 'Markdown'),
        assertOptionalStringInput(instruction, 'Summary instruction'),
        assertOptionalAiGenerationOptions(options)
      )
  )

  ipcMain.handle(
    AI_CHANNELS.translateMarkdown,
    async (event, markdownFilePath, markdown, language, workspaceRoot, options) =>
      aiService.translateMarkdown(
        getRequiredWorkspaceRoot(
          event,
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        assertStringInput(markdownFilePath, 'Markdown file path'),
        assertStringInput(markdown, 'Markdown'),
        assertStringInput(language, 'Language'),
        assertOptionalAiGenerationOptions(options)
      )
  )
}
