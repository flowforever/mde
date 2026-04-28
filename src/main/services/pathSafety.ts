import { relative, resolve } from 'node:path'

export const assertPathInsideWorkspace = (
  workspacePath: string,
  targetPath: string
): string => {
  const resolvedWorkspacePath = resolve(workspacePath)
  const resolvedTargetPath = resolve(targetPath)
  const relativePath = relative(resolvedWorkspacePath, resolvedTargetPath)

  if (
    relativePath === '' ||
    (!relativePath.startsWith('..') && !resolve(relativePath).startsWith('..'))
  ) {
    return resolvedTargetPath
  }

  throw new Error('Path is outside workspace')
}

export const resolveWorkspacePath = (
  workspacePath: string,
  relativePath: string
): string => assertPathInsideWorkspace(workspacePath, resolve(workspacePath, relativePath))
