import { isAbsolute, relative, resolve, sep } from 'node:path'

export const assertPathInsideWorkspace = (
  workspacePath: string,
  targetPath: string
): string => {
  const resolvedWorkspacePath = resolve(workspacePath)
  const resolvedTargetPath = resolve(targetPath)
  const relativePath = relative(resolvedWorkspacePath, resolvedTargetPath)

  const isInsideWorkspace =
    relativePath === '' ||
    (!isAbsolute(relativePath) &&
      relativePath !== '..' &&
      !relativePath.startsWith(`..${sep}`))

  if (isInsideWorkspace) {
    return resolvedTargetPath
  }

  throw new Error('Path is outside workspace')
}

export const resolveWorkspacePath = (
  workspacePath: string,
  relativePath: string
): string => assertPathInsideWorkspace(workspacePath, resolve(workspacePath, relativePath))
