import { readdir, realpath, stat } from 'node:fs/promises'
import { basename, dirname, extname } from 'node:path'

import type { TreeNode } from '@mde/editor-host/file-tree'
import type { Workspace, WorkspacePathInfo } from '../../shared/workspace'
import { assertPathInsideWorkspace, resolveWorkspacePath } from './pathSafety'

const ignoredEntryNames = new Set([
  '.DS_Store',
  '.git',
  '.mde',
  'dist',
  'node_modules',
  'out',
  'release'
])

export interface WorkspaceService {
  readonly inspectPath: (resourcePath: string) => Promise<WorkspacePathInfo>
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
  const getDirectoryMarkdownStatus = async (
    workspacePath: string,
    directoryPath: string
  ): Promise<{
    readonly hasEntries: boolean
    readonly hasMarkdownFile: boolean
  }> => {
    const absoluteDirectoryPath = resolveWorkspacePath(workspacePath, directoryPath)

    try {
      const entries = await readdir(absoluteDirectoryPath, { withFileTypes: true })
      const visibleEntries = entries.filter(
        (entry) => !ignoredEntryNames.has(entry.name)
      )

      for (const entry of visibleEntries) {
        if (entry.isFile() && isMarkdownFile(entry.name)) {
          return {
            hasEntries: true,
            hasMarkdownFile: true
          }
        }
      }

      for (const entry of visibleEntries) {
        if (!entry.isDirectory()) {
          continue
        }

        const nodePath = directoryPath ? `${directoryPath}/${entry.name}` : entry.name
        const childStatus = await getDirectoryMarkdownStatus(workspacePath, nodePath)

        if (childStatus.hasMarkdownFile) {
          return {
            hasEntries: true,
            hasMarkdownFile: true
          }
        }
      }

      return {
        hasEntries: visibleEntries.length > 0,
        hasMarkdownFile: false
      }
    } catch {
      return {
        hasEntries: true,
        hasMarkdownFile: false
      }
    }
  }

  const readDirectory = async (
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
          const markdownStatus = await getDirectoryMarkdownStatus(
            workspacePath,
            nodePath
          )

          return {
            children: [],
            ...(markdownStatus.hasEntries && !markdownStatus.hasMarkdownFile
              ? { isDefaultHidden: true }
              : {}),
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
        tree: await readDirectory(canonicalWorkspacePath, ''),
        type: 'workspace'
      })
    },
    listDirectory(workspacePath, directoryPath) {
      return readDirectory(workspacePath, directoryPath)
    }
  }
}
