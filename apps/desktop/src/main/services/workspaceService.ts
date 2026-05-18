import { readdir, realpath, stat } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, sep } from 'node:path'

import type { TreeNode } from '@mde/editor-host/file-tree'
import type { Workspace, WorkspacePathInfo } from '../../shared/workspace'
import { assertPathInsideWorkspace, resolveWorkspacePath } from './pathSafety'

const ignoredEntryNames = new Set([
  '.DS_Store',
  '.git',
  'dist',
  'node_modules',
  'out',
  'release'
])

const shouldIgnoreEntry = (entryName: string, directoryPath: string): boolean =>
  ignoredEntryNames.has(entryName) ||
  (entryName === '.mde' && directoryPath.length > 0)

export interface WorkspaceService {
  readonly inspectPath: (resourcePath: string) => Promise<WorkspacePathInfo>
  readonly openPath: (
    resourcePath: string,
    options?: OpenMarkdownFileOptions
  ) => Promise<Workspace>
  readonly openMarkdownFile: (
    filePath: string,
    options?: OpenMarkdownFileOptions
  ) => Promise<Workspace>
  readonly openWorkspace: (workspacePath: string) => Promise<Workspace>
  readonly listDirectory: (
    workspacePath: string,
    directoryPath: string
  ) => Promise<readonly TreeNode[]>
}

export interface OpenMarkdownFileOptions {
  readonly candidateWorkspaceRoots?: readonly string[]
}

const isMarkdownFile = (name: string): boolean => name.toLowerCase().endsWith('.md')

const assertMarkdownFilePath = (filePath: string): void => {
  if (extname(filePath).toLowerCase() !== '.md') {
    throw new Error('Only Markdown files can be opened')
  }
}

const compareNodes = (left: TreeNode, right: TreeNode): number => {
  if (left.type !== right.type) {
    return left.type === 'directory' ? -1 : 1
  }

  return left.name.localeCompare(right.name, undefined, {
    sensitivity: 'base'
  })
}

const freezeNodes = (nodes: readonly TreeNode[]): readonly TreeNode[] =>
  Object.freeze(
    nodes.map((node) =>
      node.type === 'directory'
        ? Object.freeze({
            ...node,
            children: freezeNodes(node.children)
          })
        : Object.freeze({ ...node })
    )
  )

const toWorkspaceRelativePath = (
  workspacePath: string,
  filePath: string
): string => relative(workspacePath, filePath).split(sep).join('/')

const isSameOrInsidePath = (resourcePath: string, rootPath: string): boolean =>
  resourcePath === rootPath || resourcePath.startsWith(`${rootPath}${sep}`)

const findGitWorkspaceRoot = async (
  directoryPath: string
): Promise<string | null> => {
  let currentDirectoryPath = directoryPath

  while (true) {
    const gitPath = join(currentDirectoryPath, '.git')
    const gitStats = await stat(gitPath).catch(() => null)

    if (gitStats) {
      return currentDirectoryPath
    }

    const parentDirectoryPath = dirname(currentDirectoryPath)

    if (parentDirectoryPath === currentDirectoryPath) {
      return null
    }

    currentDirectoryPath = parentDirectoryPath
  }
}

const findCandidateWorkspaceRoot = async (
  canonicalFilePath: string,
  candidateWorkspaceRoots: readonly string[] = []
): Promise<string | null> => {
  const canonicalRoots = await Promise.all(
    candidateWorkspaceRoots.map(async (workspaceRoot): Promise<string | null> => {
      try {
        const canonicalWorkspaceRoot = await realpath(workspaceRoot)
        const workspaceStats = await stat(canonicalWorkspaceRoot)

        return workspaceStats.isDirectory() &&
          isSameOrInsidePath(canonicalFilePath, canonicalWorkspaceRoot)
          ? canonicalWorkspaceRoot
          : null
      } catch {
        return null
      }
    })
  )

  return canonicalRoots
    .filter((workspaceRoot): workspaceRoot is string => workspaceRoot !== null)
    .sort((leftRoot, rightRoot) => rightRoot.length - leftRoot.length)[0] ?? null
}

export const createWorkspaceService = (): WorkspaceService => {
  const readTree = async (
    workspacePath: string,
    directoryPath: string
  ): Promise<readonly TreeNode[]> => {
    const absoluteDirectoryPath = resolveWorkspacePath(workspacePath, directoryPath)
    const entries = await readdir(absoluteDirectoryPath, { withFileTypes: true })
    const nodes = await Promise.all(
      entries.map(async (entry): Promise<TreeNode | null> => {
        if (shouldIgnoreEntry(entry.name, directoryPath)) {
          return null
        }

        const nodePath = directoryPath ? `${directoryPath}/${entry.name}` : entry.name
        const absoluteNodePath = resolveWorkspacePath(workspacePath, nodePath)

        if (entry.isDirectory()) {
          return {
            children: await readTree(workspacePath, nodePath),
            name: entry.name,
            path: nodePath,
            type: 'directory'
          }
        }

        if (entry.isFile() && isMarkdownFile(entry.name)) {
          assertPathInsideWorkspace(workspacePath, absoluteNodePath)

          return {
            name: entry.name,
            path: nodePath,
            type: 'file'
          }
        }

        return null
      })
    )

    return freezeNodes(
      nodes.filter((node): node is TreeNode => node !== null).sort(compareNodes)
    )
  }

  return {
    async inspectPath(resourcePath) {
      const canonicalPath = await realpath(resourcePath)
      const resourceStats = await stat(canonicalPath)

      if (resourceStats.isDirectory()) {
        return Object.freeze({
          kind: 'directory',
          path: canonicalPath
        })
      }

      if (!resourceStats.isFile()) {
        return Object.freeze({
          kind: 'other',
          path: canonicalPath
        })
      }

      return Object.freeze({
        kind:
          extname(canonicalPath).toLowerCase() === '.md'
            ? 'markdown-file'
            : 'unsupported-file',
        path: canonicalPath
      })
    },
    async openPath(resourcePath, options) {
      const resourceStats = await stat(resourcePath)

      if (resourceStats.isDirectory()) {
        return this.openWorkspace(resourcePath)
      }

      if (resourceStats.isFile()) {
        return this.openMarkdownFile(resourcePath, options)
      }

      throw new Error('Launch path must be a workspace folder or Markdown file')
    },
    async openMarkdownFile(filePath, options = {}) {
      assertMarkdownFilePath(filePath)

      const canonicalFilePath = await realpath(filePath)

      assertMarkdownFilePath(canonicalFilePath)

      const fileStats = await stat(canonicalFilePath)

      if (!fileStats.isFile()) {
        throw new Error('Markdown path must be a file')
      }

      const matchedWorkspaceRoot =
        await findCandidateWorkspaceRoot(
          canonicalFilePath,
          options.candidateWorkspaceRoots
        )
      const gitWorkspaceRoot =
        matchedWorkspaceRoot ?? (await findGitWorkspaceRoot(dirname(canonicalFilePath)))

      if (gitWorkspaceRoot) {
        const workspace = await this.openWorkspace(gitWorkspaceRoot)

        return Object.freeze({
          ...workspace,
          openedFilePath: toWorkspaceRelativePath(
            workspace.rootPath,
            canonicalFilePath
          )
        })
      }

      const rootPath = await realpath(dirname(canonicalFilePath))
      const openedFilePath = basename(canonicalFilePath)

      return Object.freeze({
        filePath: canonicalFilePath,
        name: openedFilePath,
        openedFilePath,
        rootPath,
        tree: freezeNodes([
          {
            name: openedFilePath,
            path: openedFilePath,
            type: 'file'
          }
        ]),
        type: 'file'
      })
    },
    async openWorkspace(workspacePath) {
      const safeWorkspacePath = assertPathInsideWorkspace(workspacePath, workspacePath)
      const canonicalWorkspacePath = await realpath(safeWorkspacePath)
      const workspaceStats = await stat(canonicalWorkspacePath)

      if (!workspaceStats.isDirectory()) {
        throw new Error('Workspace path must be a directory')
      }

      return Object.freeze({
        name: basename(canonicalWorkspacePath),
        rootPath: canonicalWorkspacePath,
        tree: await readTree(canonicalWorkspacePath, ''),
        type: 'workspace'
      })
    },
    listDirectory(workspacePath, directoryPath) {
      return readTree(workspacePath, directoryPath)
    }
  }
}
