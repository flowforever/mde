import { lstat, realpath } from 'node:fs/promises'
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path'

export type WorkspaceTaskKind = 'bugs' | 'requirements' | 'tasks'

interface EvidencePathInput {
  readonly appDataPath: string
  readonly targetPath: string
  readonly workspaceRoot?: string
}

const isErrorWithCode = (
  error: unknown,
  code: string
): error is NodeJS.ErrnoException =>
  error instanceof Error && (error as NodeJS.ErrnoException).code === code

const assertPathInsideRoot = (
  rootPath: string,
  targetPath: string,
  message: string
): string => {
  const resolvedRootPath = resolve(rootPath)
  const resolvedTargetPath = resolve(targetPath)
  const relativePath = relative(resolvedRootPath, resolvedTargetPath)
  const isInsideRoot =
    relativePath === '' ||
    (!isAbsolute(relativePath) &&
      relativePath !== '..' &&
      !relativePath.startsWith(`..${sep}`))

  if (!isInsideRoot) {
    throw new Error(message)
  }

  return resolvedTargetPath
}

const resolveRealPathInsideRoot = async (
  rootPath: string,
  targetPath: string,
  message: string
): Promise<{
  readonly resolvedTargetPath: string
  readonly realRootPath: string
  readonly realTargetPath: string
}> => {
  const resolvedRootPath = resolve(rootPath)
  const resolvedTargetPath = assertPathInsideRoot(rootPath, targetPath, message)
  const relativeTargetPath = relative(resolvedRootPath, resolvedTargetPath)
  const realRootPath = await realpath(rootPath)
  const realTargetPath =
    relativeTargetPath === ''
      ? realRootPath
      : resolve(realRootPath, relativeTargetPath)

  assertPathInsideRoot(realRootPath, realTargetPath, message)

  return Object.freeze({
    resolvedTargetPath,
    realRootPath,
    realTargetPath
  })
}

const assertNoSymlinkPathComponents = async (
  rootPath: string,
  targetPath: string,
  options: {
    readonly allowMissing: boolean
    readonly message: string
  }
): Promise<string> => {
  try {
    const rootStats = await lstat(rootPath)

    if (rootStats.isSymbolicLink()) {
      throw new Error('Symlink paths are unsupported for automation storage')
    }
  } catch (error) {
    if (!isErrorWithCode(error, 'ENOENT') || !options.allowMissing) {
      throw error
    }
  }

  const { realRootPath, realTargetPath, resolvedTargetPath } =
    await resolveRealPathInsideRoot(
      rootPath,
      targetPath,
      options.message
    )
  const relativeTargetPath = relative(realRootPath, realTargetPath)
  const segments =
    relativeTargetPath === ''
      ? []
      : relativeTargetPath.split(sep).filter((segment) => segment.length > 0)
  let currentPath = realRootPath

  for (const segment of segments) {
    currentPath = join(currentPath, segment)

    try {
      const stats = await lstat(currentPath)

      if (stats.isSymbolicLink()) {
        throw new Error('Symlink paths are unsupported for automation storage')
      }
    } catch (error) {
      if (isErrorWithCode(error, 'ENOENT') && options.allowMissing) {
        break
      }

      throw error
    }
  }

  return resolvedTargetPath
}

const assertMarkdownPath = (targetPath: string): void => {
  if (extname(targetPath).toLowerCase() !== '.md') {
    throw new Error('Automation paths must use Markdown files')
  }
}

export const getUserAutomationFlowRoot = (homePath: string): string =>
  join(resolve(homePath), '.mde', 'automation-flows')

export const getWorkspaceAutomationFlowRoot = (workspaceRoot: string): string =>
  join(resolve(workspaceRoot), '.mde', 'automation-flows')

export const getWorkspaceTaskRoot = (
  workspaceRoot: string,
  kind: WorkspaceTaskKind
): string => join(resolve(workspaceRoot), '.mde', 'docs', kind)

export const getAutomationStorageRoot = (appDataPath: string): string =>
  join(resolve(appDataPath), 'automation')

export const assertUserAutomationFlowPath = async (
  homePath: string,
  targetPath: string
): Promise<string> => {
  assertMarkdownPath(targetPath)

  return assertNoSymlinkPathComponents(
    getUserAutomationFlowRoot(homePath),
    targetPath,
    {
      allowMissing: true,
      message: 'Automation flow path is outside the user automation root'
    }
  )
}

export const assertWorkspaceAutomationFlowPath = async (
  workspaceRoot: string,
  targetPath: string
): Promise<string> => {
  assertMarkdownPath(targetPath)

  return assertNoSymlinkPathComponents(
    getWorkspaceAutomationFlowRoot(workspaceRoot),
    targetPath,
    {
      allowMissing: true,
      message: 'Automation flow path is outside the workspace automation root'
    }
  )
}

export const assertWorkspaceTaskDocumentPath = async (
  workspaceRoot: string,
  targetPath: string
): Promise<string> => {
  assertMarkdownPath(targetPath)

  const taskRoots = [
    getWorkspaceTaskRoot(workspaceRoot, 'bugs'),
    getWorkspaceTaskRoot(workspaceRoot, 'requirements'),
    getWorkspaceTaskRoot(workspaceRoot, 'tasks')
  ]

  for (const taskRoot of taskRoots) {
    try {
      assertPathInsideRoot(
        taskRoot,
        targetPath,
        'Path is outside automation task document roots'
      )

      return await assertNoSymlinkPathComponents(taskRoot, targetPath, {
        allowMissing: true,
        message: 'Path is outside automation task document roots'
      })
    } catch (error) {
      if (
        error instanceof Error &&
        /outside automation task document roots/iu.test(error.message)
      ) {
        continue
      }

      throw error
    }
  }

  throw new Error('Path is outside automation task document roots')
}

export const assertAutomationStoragePath = async (
  appDataPath: string,
  targetPath: string
): Promise<string> =>
  assertNoSymlinkPathComponents(getAutomationStorageRoot(appDataPath), targetPath, {
    allowMissing: true,
    message: 'Automation storage path is outside app automation storage'
  })

export const assertAutomationEvidencePath = async ({
  appDataPath,
  targetPath,
  workspaceRoot
}: EvidencePathInput): Promise<string> => {
  try {
    return await assertAutomationStoragePath(appDataPath, targetPath)
  } catch (storageError) {
    if (workspaceRoot === undefined) {
      throw new Error('Evidence path is outside allowed automation storage')
    }

    try {
      return await assertNoSymlinkPathComponents(workspaceRoot, targetPath, {
        allowMissing: true,
        message: 'Evidence path is outside the run workspace'
      })
    } catch {
      if (storageError instanceof Error && /symlink/iu.test(storageError.message)) {
        throw storageError
      }

      throw new Error('Evidence path is outside allowed automation storage')
    }
  }
}
