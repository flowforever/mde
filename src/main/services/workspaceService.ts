import { readdir, realpath, stat } from 'node:fs/promises'
import { basename, dirname, extname } from 'node:path'

import type { TreeNode } from '../../shared/fileTree'
import type { Workspace } from '../../shared/workspace'
import { assertPathInsideWorkspace, resolveWorkspacePath } from './pathSafety'

const ignoredEntryNames = new Set([
  '.DS_Store',
  '.git',
  'dist',
  'node_modules',
  'out',
  'release'
])

export interface WorkspaceService {
  readonly openPath: (resourcePath: string) => Promise<Workspace>
  readonly openMarkdownFile: (filePath: string) => Promise<Workspace>
  readonly openWorkspace: (workspacePath: string) => Promise<Workspace>
  readonly listDirectory: (
    workspacePath: string,
    directoryPath: string
  ) => Promise<readonly TreeNode[]>
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

export const createWorkspaceService = (): WorkspaceService => {
  const readTree = async (
    workspacePath: string,
    directoryPath: string
  ): Promise<readonly TreeNode[]> => {
    const absoluteDirectoryPath = resolveWorkspacePath(workspacePath, directoryPath)
    const entries = await readdir(absoluteDirectoryPath, { withFileTypes: true })
    const nodes = await Promise.all(
      entries.map(async (entry): Promise<TreeNode | null> => {
        if (ignoredEntryNames.has(entry.name)) {
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
    async openPath(resourcePath) {
      const resourceStats = await stat(resourcePath)

      if (resourceStats.isDirectory()) {
        return this.openWorkspace(resourcePath)
      }

      if (resourceStats.isFile()) {
        return this.openMarkdownFile(resourcePath)
      }

      throw new Error('Launch path must be a workspace folder or Markdown file')
    },
    async openMarkdownFile(filePath) {
      assertMarkdownFilePath(filePath)

      const canonicalFilePath = await realpath(filePath)

      assertMarkdownFilePath(canonicalFilePath)

      const fileStats = await stat(canonicalFilePath)

      if (!fileStats.isFile()) {
        throw new Error('Markdown path must be a file')
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
