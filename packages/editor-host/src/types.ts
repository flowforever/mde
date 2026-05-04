import type { TreeNode } from './fileTree'

export type { TreeNode } from './fileTree'

export type EditorHostErrorCode =
  | 'unsupported'
  | 'cancelled'
  | 'read-only'
  | 'permission-denied'
  | 'not-found'
  | 'outside-workspace'
  | 'conflict'
  | 'validation'
  | 'unknown'

export interface EditorHostError {
  readonly code: EditorHostErrorCode
  readonly message?: string
  readonly retryable?: boolean
}

export type EditorHostResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly error: EditorHostError; readonly ok: false }

export interface EditorDocumentRef {
  readonly path: string
  readonly workspaceRoot?: string
}

export type EditorSaveReason = 'manual' | 'idle-autosave' | 'blur-autosave'

export interface EditorHostCapabilities {
  readonly canCreateLinkedDocument: boolean
  readonly canOpenLinks: boolean
  readonly canUploadImages: boolean
  readonly hasWorkspaceTree: boolean
}

export interface EditorHost {
  readonly capabilities: EditorHostCapabilities

  readonly saveDocument: (input: {
    readonly document: EditorDocumentRef
    readonly markdown: string
    readonly reason: EditorSaveReason
  }) => Promise<
    EditorHostResult<{
      readonly normalizedMarkdown?: string
      readonly savedAt?: string
    }>
  >

  readonly uploadImage?: (input: {
    readonly bytes: ArrayBuffer
    readonly document: EditorDocumentRef
    readonly fileName: string
    readonly mimeType: string
  }) => Promise<
    EditorHostResult<{
      readonly src: string
    }>
  >

  readonly createLinkedDocument?: (input: {
    readonly document: EditorDocumentRef
    readonly requestedPath: string
  }) => Promise<
    EditorHostResult<{
      readonly path: string
    }>
  >

  readonly openLink?: (input: {
    readonly document: EditorDocumentRef
    readonly href: string
  }) => Promise<EditorHostResult<void>>

  readonly getWorkspaceTree?: (
    document: EditorDocumentRef
  ) => Promise<
    EditorHostResult<{
      readonly rootPath: string
      readonly tree: readonly TreeNode[]
    }>
  >
}
