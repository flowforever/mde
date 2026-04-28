import { readdir, stat } from 'node:fs/promises'
import { basename } from 'node:path'

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
  readonly openWorkspace: (workspacePath: string) => Promise<Workspace>
  readonly listDirectory: (
    workspacePath: string,
    directoryPath: string
  ) => Promise<readonly TreeNode[]>
}

const isMarkdownFile = (name: string): boolean => name.toLowerCase().endsWith('.md')

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
    async openWorkspace(workspacePath) {
      const safeWorkspacePath = assertPathInsideWorkspace(workspacePath, workspacePath)
      const workspaceStats = await stat(safeWorkspacePath)

      if (!workspaceStats.isDirectory()) {
        throw new Error('Workspace path must be a directory')
      }

      return Object.freeze({
        name: basename(safeWorkspacePath),
        rootPath: safeWorkspacePath,
        tree: await readTree(safeWorkspacePath, '')
      })
    },
    listDirectory(workspacePath, directoryPath) {
      return readTree(workspacePath, directoryPath)
    }
  }
}
