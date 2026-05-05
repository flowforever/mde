import type {
  EditorDocumentRef,
  EditorHost,
  EditorHostCapabilities,
  EditorHostError,
  EditorHostResult,
  EditorSaveReason
} from '@mde/editor-host/types'
import type { TreeNode } from '@mde/editor-host/file-tree'

interface DesktopEditorHostOperationInput {
  readonly document: EditorDocumentRef
}

export interface DesktopEditorHostSaveInput
  extends DesktopEditorHostOperationInput {
  readonly markdown: string
  readonly reason: EditorSaveReason
}

export interface DesktopEditorHostUploadImageInput
  extends DesktopEditorHostOperationInput {
  readonly bytes: ArrayBuffer
  readonly fileName: string
  readonly mimeType: string
}

export interface DesktopEditorHostCreateLinkedDocumentInput
  extends DesktopEditorHostOperationInput {
  readonly requestedPath: string
}

export interface DesktopEditorHostOpenLinkInput
  extends DesktopEditorHostOperationInput {
  readonly href: string
}

export type DesktopEditorHostWorkspaceTreeInput =
  DesktopEditorHostOperationInput

export interface DesktopEditorHostWorkspaceTree {
  readonly rootPath: string
  readonly tree: readonly TreeNode[]
}

export interface DesktopEditorHostOperations {
  readonly createLinkedDocument?: (
    input: DesktopEditorHostCreateLinkedDocumentInput
  ) => Promise<{ readonly path: string }> | { readonly path: string }
  readonly getWorkspaceTree?: (
    input: DesktopEditorHostWorkspaceTreeInput
  ) => Promise<DesktopEditorHostWorkspaceTree> | DesktopEditorHostWorkspaceTree
  readonly openLink?: (
    input: DesktopEditorHostOpenLinkInput
  ) => Promise<void> | void
  readonly saveDocument?: (
    input: DesktopEditorHostSaveInput
  ) =>
    | Promise<{
        readonly normalizedMarkdown?: string
        readonly savedAt?: string
      } | void>
    | {
        readonly normalizedMarkdown?: string
        readonly savedAt?: string
      }
    | void
  readonly uploadImage?: (
    input: DesktopEditorHostUploadImageInput
  ) => Promise<{ readonly src: string }> | { readonly src: string }
}

const ok = <T>(value: T): EditorHostResult<T> =>
  Object.freeze({
    ok: true,
    value
  })

const error = (hostError: EditorHostError): EditorHostResult<never> =>
  Object.freeze({
    error: Object.freeze(hostError),
    ok: false
  })

const unsupported = (): EditorHostResult<never> =>
  error({
    code: 'unsupported',
    retryable: false
  })

const unknownError = (caught: unknown): EditorHostResult<never> =>
  error({
    code: 'unknown',
    message: caught instanceof Error ? caught.message : undefined,
    retryable: false
  })

const runDesktopOperation = async <T>(
  operation: (() => Promise<T> | T) | undefined
): Promise<EditorHostResult<T>> => {
  if (!operation) {
    return unsupported()
  }

  try {
    return ok(await operation())
  } catch (caught) {
    return unknownError(caught)
  }
}

const createCapabilities = (
  operations: DesktopEditorHostOperations
): EditorHostCapabilities =>
  Object.freeze({
    canCreateLinkedDocument: Boolean(operations.createLinkedDocument),
    canOpenLinks: Boolean(operations.openLink),
    canUploadImages: Boolean(operations.uploadImage),
    hasWorkspaceTree: Boolean(operations.getWorkspaceTree)
  })

export const createDesktopEditorHost = (
  operations: DesktopEditorHostOperations
): EditorHost => {
  const createLinkedDocument = operations.createLinkedDocument
  const getWorkspaceTree = operations.getWorkspaceTree
  const openLink = operations.openLink
  const saveDocument = operations.saveDocument
  const uploadImage = operations.uploadImage

  return Object.freeze({
    capabilities: createCapabilities(operations),
    createLinkedDocument: (input: DesktopEditorHostCreateLinkedDocumentInput) =>
      runDesktopOperation(
        createLinkedDocument ? () => createLinkedDocument(input) : undefined
      ),
    getWorkspaceTree: (document: EditorDocumentRef) =>
      runDesktopOperation(
        getWorkspaceTree
          ? () =>
              getWorkspaceTree({
                document
              })
          : undefined
      ),
    openLink: (input: DesktopEditorHostOpenLinkInput) =>
      runDesktopOperation(
        openLink
          ? async () => {
              await openLink(input)
            }
          : undefined
      ),
    saveDocument: (input: DesktopEditorHostSaveInput) =>
      runDesktopOperation(
        saveDocument
          ? async () => {
              const result = await saveDocument(input)

              return result ?? {}
            }
          : undefined
      ),
    uploadImage: (input: DesktopEditorHostUploadImageInput) =>
      runDesktopOperation(
        uploadImage ? () => uploadImage(input) : undefined
      )
  })
}
