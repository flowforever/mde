import { isAttachmentInsideSessionCache } from './attachments'
import type {
  AgentChatAttachment,
  AgentChatContextManifest,
  AgentChatPermissionMode,
  AgentChatSessionPurpose
} from './types'

export type AgentChatCodexUserInputItem =
  | { readonly text: string; readonly text_elements: []; readonly type: 'text' }
  | { readonly path: string; readonly type: 'localImage' }

const assertPermissionMode = (
  value: AgentChatPermissionMode
): AgentChatPermissionMode => {
  if (value !== 'max-permission') {
    throw new Error('Unsupported Agent Chat permission mode')
  }
  return value
}

const assertSessionPurpose = (
  value: AgentChatSessionPurpose
): AgentChatSessionPurpose => {
  if (
    value !== 'document-chat' &&
    value !== 'automation-task' &&
    value !== 'debug'
  ) {
    throw new Error('Unsupported Agent Chat session purpose')
  }
  return value
}

export const validateAgentChatContextManifest = (
  manifest: AgentChatContextManifest
): AgentChatContextManifest => {
  const modelName = manifest.modelName?.trim()
  const currentDocumentPath = manifest.currentDocumentPath?.trim()

  if (!manifest.workspaceRoot.trim()) {
    throw new Error('Agent Chat context requires a workspace root')
  }

  return Object.freeze({
    ...(currentDocumentPath ? { currentDocumentPath } : {}),
    currentDocumentSnapshot: manifest.currentDocumentSnapshot,
    ...(modelName ? { modelName } : {}),
    permissionMode: assertPermissionMode(manifest.permissionMode),
    selectedBlockIds: Object.freeze([...manifest.selectedBlockIds]),
    selectedText: manifest.selectedText,
    sessionPurpose: assertSessionPurpose(manifest.sessionPurpose),
    workspaceRoot: manifest.workspaceRoot
  })
}

export const buildCodexUserInputItems = (input: {
  readonly attachments: readonly AgentChatAttachment[]
  readonly content: string
  readonly contextManifest: AgentChatContextManifest
  readonly sessionId: string
  readonly workspaceRoot: string
}): readonly AgentChatCodexUserInputItem[] => {
  const content = input.content.trim()
  const contextSections = [
    input.contextManifest.currentDocumentPath
      ? `Current document path:\n${input.contextManifest.currentDocumentPath}`
      : '',
    input.contextManifest.selectedBlockIds.length > 0
      ? `Selected block ids:\n${input.contextManifest.selectedBlockIds.join('\n')}`
      : '',
    input.contextManifest.selectedText.trim()
      ? `Selected text:\n${input.contextManifest.selectedText.trim()}`
      : '',
    input.contextManifest.currentDocumentSnapshot.trim()
      ? `Current Markdown snapshot:\n${input.contextManifest.currentDocumentSnapshot}`
      : '',
    content ? `User message:\n${content}` : ''
  ].filter((section) => section.length > 0)
  const text = contextSections.join('\n\n').trim()
  const textItems: readonly AgentChatCodexUserInputItem[] = text
    ? [Object.freeze({ text, text_elements: [] as [], type: 'text' })]
    : []
  const imageItems = input.attachments
    .filter((attachment) => attachment.mimeType.startsWith('image/'))
    .filter((attachment) =>
      isAttachmentInsideSessionCache({
        candidatePath: attachment.safePath,
        sessionId: input.sessionId,
        workspaceRoot: input.workspaceRoot
      })
    )
    .map((attachment) =>
      Object.freeze({
        path: attachment.safePath,
        type: 'localImage' as const
      })
    )

  return Object.freeze([...textItems, ...imageItems])
}
