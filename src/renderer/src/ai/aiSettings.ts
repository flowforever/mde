import type { AiGenerationOptions, AiTool, AiToolId } from '../../../shared/ai'

export const AI_CLI_SETTINGS_STORAGE_KEY = 'mde.aiCliSettings'

export interface AiCliSettings {
  readonly modelNames: Partial<Record<AiToolId, string>>
  readonly selectedToolId: AiToolId | null
}

const AI_TOOL_IDS: readonly AiToolId[] = ['codex', 'claude']

const DEFAULT_AI_CLI_SETTINGS: AiCliSettings = {
  modelNames: {},
  selectedToolId: null
}

const isAiToolId = (value: unknown): value is AiToolId =>
  typeof value === 'string' && AI_TOOL_IDS.includes(value as AiToolId)

export const readAiCliSettings = (
  storage: Storage = globalThis.localStorage
): AiCliSettings => {
  try {
    const storedValue = storage.getItem(AI_CLI_SETTINGS_STORAGE_KEY)

    if (!storedValue) {
      return DEFAULT_AI_CLI_SETTINGS
    }

    const parsedValue = JSON.parse(storedValue) as Record<string, unknown>
    const modelNamesValue = parsedValue.modelNames
    const modelNames =
      modelNamesValue && typeof modelNamesValue === 'object'
        ? Object.fromEntries(
            Object.entries(modelNamesValue as Record<string, unknown>)
              .filter(([toolId, modelName]) =>
                isAiToolId(toolId) && typeof modelName === 'string'
              )
              .map(([toolId, modelName]) => [toolId, modelName])
          )
        : {}

    return {
      modelNames,
      selectedToolId: isAiToolId(parsedValue.selectedToolId)
        ? parsedValue.selectedToolId
        : null
    }
  } catch {
    return DEFAULT_AI_CLI_SETTINGS
  }
}

export const writeAiCliSettings = (
  storage: Storage,
  settings: AiCliSettings
): void => {
  storage.setItem(AI_CLI_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}

export const getEffectiveAiToolId = (
  settings: AiCliSettings,
  installedTools: readonly AiTool[]
): AiToolId | null => {
  if (
    settings.selectedToolId &&
    installedTools.some((tool) => tool.id === settings.selectedToolId)
  ) {
    return settings.selectedToolId
  }

  return installedTools[0]?.id ?? null
}

export const resolveAiGenerationOptions = (
  settings: AiCliSettings,
  installedTools: readonly AiTool[]
): AiGenerationOptions | undefined => {
  if (
    !settings.selectedToolId ||
    !installedTools.some((tool) => tool.id === settings.selectedToolId)
  ) {
    return undefined
  }

  const modelName = settings.modelNames[settings.selectedToolId]?.trim()

  return {
    ...(modelName ? { modelName } : {}),
    toolId: settings.selectedToolId
  }
}
