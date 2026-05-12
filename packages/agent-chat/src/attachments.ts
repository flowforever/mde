import { isAbsolute, join, relative, resolve } from 'node:path'

export interface AttachmentCachePathInput {
  readonly fileName: string
  readonly sessionId: string
  readonly workspaceRoot: string
}

export interface AttachmentPathGuardInput {
  readonly candidatePath: string
  readonly sessionId: string
  readonly workspaceRoot: string
}

export const sanitizeAttachmentFileName = (fileName: string): string => {
  const baseName = fileName.split(/[\\/]/).filter(Boolean).at(-1)?.trim() ?? ''
  return baseName.length > 0 ? baseName : 'attachment.bin'
}

export const createAttachmentCachePath = (
  input: AttachmentCachePathInput
): string =>
  join(
    input.workspaceRoot,
    '.mde',
    'agent-chat',
    input.sessionId,
    'attachments',
    sanitizeAttachmentFileName(input.fileName)
  )

export const isAttachmentInsideSessionCache = (
  input: AttachmentPathGuardInput
): boolean => {
  const sessionCacheRoot = resolve(
    input.workspaceRoot,
    '.mde',
    'agent-chat',
    input.sessionId,
    'attachments'
  )
  const candidatePath = resolve(input.candidatePath)
  const relativePath = relative(sessionCacheRoot, candidatePath)

  return (
    relativePath.length > 0 &&
    !relativePath.startsWith('..') &&
    !isAbsolute(relativePath)
  )
}
