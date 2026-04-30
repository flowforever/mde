import type { IpcMain } from 'electron'

import type { AiService } from '../services/aiService'
import { AI_CHANNELS } from './channels'

interface RegisterAiHandlersOptions {
  readonly aiService: AiService
  readonly getActiveWorkspaceRoot: () => string | null
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

const getRequiredWorkspaceRoot = (
  getActiveWorkspaceRoot: () => string | null,
  expectedWorkspaceRoot: string
): string => {
  const activeWorkspaceRoot = getActiveWorkspaceRoot()

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
    async (_event, markdownFilePath, markdown, workspaceRoot, instruction) =>
      aiService.summarizeMarkdown(
        getRequiredWorkspaceRoot(
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        assertStringInput(markdownFilePath, 'Markdown file path'),
        assertStringInput(markdown, 'Markdown'),
        assertOptionalStringInput(instruction, 'Summary instruction')
      )
  )

  ipcMain.handle(
    AI_CHANNELS.translateMarkdown,
    async (_event, markdownFilePath, markdown, language, workspaceRoot) =>
      aiService.translateMarkdown(
        getRequiredWorkspaceRoot(
          getActiveWorkspaceRoot,
          assertStringInput(workspaceRoot, 'Workspace root')
        ),
        assertStringInput(markdownFilePath, 'Markdown file path'),
        assertStringInput(markdown, 'Markdown'),
        assertStringInput(language, 'Language')
      )
  )
}
