import type { AppText } from '../i18n/appLanguage'

export interface AutomationFlowEditorHostAdapter {
  readonly createLinkedMarkdown?: (filePath: string) => Promise<string>
  readonly markdownFilePaths: readonly string[]
  readonly openLink?: (href: string) => void
  readonly uploadImage: (file: File) => Promise<string>
  readonly workspaceRoot: string
  readonly workspaceTree: readonly never[]
}

const USER_GLOBAL_AUTOMATION_FLOW_WORKSPACE_ROOT =
  'mde://automation-flows/user-global'

const normalizePath = (path: string): string => path.replace(/\\/gu, '/')

const isWorkspaceDocument = (
  documentPath: string,
  workspaceRoot?: string
): boolean =>
  workspaceRoot !== undefined &&
  normalizePath(documentPath).startsWith(`${normalizePath(workspaceRoot)}/`)

export const createAutomationFlowEditorHostAdapter = ({
  documentPath,
  text,
  workspaceRoot
}: {
  readonly documentPath: string
  readonly text: AppText
  readonly workspaceRoot?: string
}): AutomationFlowEditorHostAdapter =>
  Object.freeze({
    markdownFilePaths: Object.freeze([documentPath]),
    uploadImage: () =>
      Promise.reject(new Error(text('automation.editorAssetsUnavailable'))),
    workspaceRoot: isWorkspaceDocument(documentPath, workspaceRoot)
      ? workspaceRoot!
      : USER_GLOBAL_AUTOMATION_FLOW_WORKSPACE_ROOT,
    workspaceTree: Object.freeze([])
  })
