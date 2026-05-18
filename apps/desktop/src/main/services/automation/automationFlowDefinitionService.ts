import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

import {
  getBuiltInAutomationFlowTemplate,
  parseAutomationFlowMarkdown,
  renderAutomationFlowTemplate,
  type AutomationFlowLifecycle,
  type AutomationFlowParseResult,
  type AutomationFlowScope,
  type AutomationFlowTemplateId,
  type AgentEngineId
} from '@mde/automation-flow'

import {
  assertUserAutomationFlowPath,
  assertWorkspaceAutomationFlowPath,
  getUserAutomationFlowRoot,
  getWorkspaceAutomationFlowRoot
} from './automationPathSafety'

interface AutomationFlowDefinitionServiceOptions {
  readonly homePath: string
  readonly onDidChange?: () => void
  readonly workspaceRoot?: string
}

interface CreateFromTemplateInput {
  readonly defaultEngine: AgentEngineId
  readonly flowId: string
  readonly scope: AutomationFlowScope
  readonly templateId: AutomationFlowTemplateId
}

interface EditableAutomationFlowDocument {
  readonly markdown: string
  readonly path: string
  readonly validation: AutomationFlowParseResult
}

export interface AutomationFlowDefinitionService {
  readonly archiveDefinition: (
    filePath: string
  ) => Promise<EditableAutomationFlowDocument>
  readonly createFromTemplate: (
    input: CreateFromTemplateInput
  ) => Promise<EditableAutomationFlowDocument>
  readonly loadEditableDocument: (
    filePath: string
  ) => Promise<EditableAutomationFlowDocument>
  readonly deleteDefinition: (filePath: string) => Promise<void>
  readonly renameDefinition: (
    filePath: string,
    name: string
  ) => Promise<EditableAutomationFlowDocument>
  readonly restoreDefinition: (
    filePath: string
  ) => Promise<EditableAutomationFlowDocument>
  readonly saveDefinition: (
    filePath: string,
    markdown: string
  ) => Promise<EditableAutomationFlowDocument>
  readonly setLifecycle: (
    filePath: string,
    lifecycle: AutomationFlowLifecycle
  ) => Promise<EditableAutomationFlowDocument>
}

const toDefinitionFileName = (flowId: string): string =>
  `${flowId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')}.md`

const replaceLifecycle = (
  markdown: string,
  lifecycle: AutomationFlowLifecycle
): string => {
  if (/^lifecycle:\s*.+$/mu.test(markdown)) {
    return markdown.replace(/^lifecycle:\s*.+$/mu, `lifecycle: ${lifecycle}`)
  }

  return markdown.replace(
    /^status:\s*.+$/mu,
    (line) => `${line}\nlifecycle: ${lifecycle}`
  )
}

const yamlScalar = (value: string): string =>
  /^[A-Za-z0-9][A-Za-z0-9 ._-]*$/u.test(value)
    ? value
    : JSON.stringify(value)

const replaceName = (markdown: string, name: string): string => {
  const nextNameLine = `name: ${yamlScalar(name)}`

  if (/^name:\s*.*$/mu.test(markdown)) {
    return markdown.replace(/^name:\s*.*$/mu, nextNameLine)
  }

  if (/^id:\s*.*$/mu.test(markdown)) {
    return markdown.replace(/^id:\s*.*$/mu, (line) => `${line}\n${nextNameLine}`)
  }

  return markdown.replace(/^---[ \t]*$/u, `---\n${nextNameLine}`)
}

const noop = (): void => undefined

export const createAutomationFlowDefinitionService = ({
  homePath,
  onDidChange = noop,
  workspaceRoot
}: AutomationFlowDefinitionServiceOptions): AutomationFlowDefinitionService => {
  const assertDefinitionPath = async (filePath: string): Promise<string> => {
    try {
      return await assertUserAutomationFlowPath(homePath, filePath)
    } catch (userError) {
      if (workspaceRoot !== undefined) {
        try {
          return await assertWorkspaceAutomationFlowPath(workspaceRoot, filePath)
        } catch {
          throw userError instanceof Error && /outside/iu.test(userError.message)
            ? new Error('Automation flow path is outside allowed definition roots')
            : userError
        }
      }

      throw userError
    }
  }

  const readDefinition = async (
    filePath: string
  ): Promise<EditableAutomationFlowDocument> => {
    const safePath = await assertDefinitionPath(filePath)
    const markdown = await readFile(safePath, 'utf8')

    return Object.freeze({
      markdown,
      path: safePath,
      validation: parseAutomationFlowMarkdown(markdown, {
        sourceFile: safePath
      })
    })
  }

  const writeDefinition = async (
    filePath: string,
    markdown: string
  ): Promise<EditableAutomationFlowDocument> => {
    const safePath = await assertDefinitionPath(filePath)

    await mkdir(dirname(safePath), { recursive: true })
    await writeFile(safePath, markdown, 'utf8')
    onDidChange()

    return readDefinition(safePath)
  }

  const service: AutomationFlowDefinitionService = {
    async archiveDefinition(filePath: string) {
      const safePath = await assertDefinitionPath(filePath)
      const archivedPath = join(dirname(safePath), 'archived', basename(safePath))

      await mkdir(dirname(archivedPath), { recursive: true })
      await rename(safePath, archivedPath)
      onDidChange()

      return readDefinition(archivedPath)
    },
    async createFromTemplate(input: CreateFromTemplateInput) {
      const template = getBuiltInAutomationFlowTemplate(input.templateId)
      if (input.scope === 'workspace' && workspaceRoot === undefined) {
        throw new Error('Workspace root is required')
      }

      const rootPath =
        input.scope === 'workspace'
          ? getWorkspaceAutomationFlowRoot(workspaceRoot!)
          : getUserAutomationFlowRoot(homePath)
      const filePath = join(rootPath, toDefinitionFileName(input.flowId))
      const markdown = renderAutomationFlowTemplate(template, {
        defaultEngine: input.defaultEngine,
        flowId: input.flowId,
        scope: input.scope
      })

      await mkdir(rootPath, { recursive: true })

      return writeDefinition(filePath, markdown)
    },
    async deleteDefinition(filePath: string) {
      const editable = await readDefinition(filePath)
      const flowId =
        editable.validation.ok
          ? editable.validation.automationFlow.id
          : basename(editable.path, '.md')
      const executorRoot = join(dirname(editable.path), flowId)

      await rm(editable.path)
      await rm(executorRoot, { force: true, recursive: true })
      onDidChange()
    },
    loadEditableDocument: readDefinition,
    async renameDefinition(filePath: string, name: string) {
      const editable = await readDefinition(filePath)

      return writeDefinition(filePath, replaceName(editable.markdown, name))
    },
    async restoreDefinition(filePath: string) {
      const safePath = await assertDefinitionPath(filePath)
      const restoredPath = join(dirname(dirname(safePath)), basename(safePath))

      await rename(safePath, restoredPath)
      onDidChange()

      return readDefinition(restoredPath)
    },
    saveDefinition: writeDefinition,
    async setLifecycle(
      filePath: string,
      lifecycle: AutomationFlowLifecycle
    ) {
      const editable = await readDefinition(filePath)

      return writeDefinition(filePath, replaceLifecycle(editable.markdown, lifecycle))
    }
  }

  return Object.freeze(service)
}
