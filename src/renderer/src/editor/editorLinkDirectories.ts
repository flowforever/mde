import type { TreeNode } from "../../../shared/fileTree";
import {
  collectDefaultHiddenEntryPaths,
  filterHiddenNodes,
  findDirectoryPath,
  getAncestorDirectoryPaths,
} from "../explorer/explorerTreeVisibility";
import {
  readDefaultHiddenExplorerWorkspaces,
  readHiddenExplorerEntries,
} from "../explorer/hiddenExplorerEntries";

interface CreateVisibleEditorLinkTreeOptions {
  readonly storage?: Pick<Storage, "getItem">;
}

export interface LinkDirectoryOption {
  readonly depth: number;
  readonly hasChildDirectories: boolean;
  readonly isExpanded: boolean;
  readonly name: string;
  readonly path: string;
}

export interface InitialLinkDirectoryState {
  readonly expandedDirectoryPaths: ReadonlySet<string>;
  readonly selectedDirectoryPath: string;
}

const getParentPath = (entryPath: string): string => {
  const separatorIndex = entryPath.lastIndexOf("/");

  return separatorIndex === -1 ? "" : entryPath.slice(0, separatorIndex);
};

const getDirectoryChildren = (node: TreeNode): readonly TreeNode[] =>
  node.type === "directory"
    ? node.children.filter((child) => child.type === "directory")
    : [];

export const createVisibleEditorLinkTree = (
  nodes: readonly TreeNode[],
  workspaceRoot: string,
  options: CreateVisibleEditorLinkTreeOptions = {},
): readonly TreeNode[] => {
  if (workspaceRoot.length === 0) {
    return nodes;
  }

  const hiddenEntryPaths =
    readHiddenExplorerEntries(options.storage).get(workspaceRoot) ??
    new Set<string>();
  const defaultHiddenWorkspaceRoots = readDefaultHiddenExplorerWorkspaces(
    options.storage,
  );
  const defaultHiddenEntryPaths = defaultHiddenWorkspaceRoots.has(workspaceRoot)
    ? []
    : collectDefaultHiddenEntryPaths(nodes);
  const effectiveHiddenEntryPaths =
    defaultHiddenEntryPaths.length > 0
      ? new Set([...hiddenEntryPaths, ...defaultHiddenEntryPaths])
      : hiddenEntryPaths;

  return effectiveHiddenEntryPaths.size > 0
    ? filterHiddenNodes(nodes, effectiveHiddenEntryPaths)
    : nodes;
};

export const createInitialLinkDirectoryState = (
  visibleTree: readonly TreeNode[],
  currentFilePath: string,
): InitialLinkDirectoryState => {
  const currentDirectoryPath = getParentPath(currentFilePath);
  const selectedDirectoryPath =
    findDirectoryPath(visibleTree, currentDirectoryPath) ?? "";
  const expandedDirectoryPaths =
    selectedDirectoryPath.length > 0
      ? new Set(
          getAncestorDirectoryPaths(currentFilePath).filter(
            (directoryPath) =>
              findDirectoryPath(visibleTree, directoryPath) !== null,
          ),
        )
      : new Set<string>();

  return {
    expandedDirectoryPaths,
    selectedDirectoryPath,
  };
};

export const collectExpandedLinkDirectoryOptions = (
  nodes: readonly TreeNode[],
  expandedDirectoryPaths: ReadonlySet<string>,
  depth = 0,
): readonly LinkDirectoryOption[] =>
  nodes.flatMap((node) => {
    if (node.type !== "directory") {
      return [];
    }

    const directoryChildren = getDirectoryChildren(node);
    const isExpanded = expandedDirectoryPaths.has(node.path);

    return [
      {
        depth,
        hasChildDirectories: directoryChildren.length > 0,
        isExpanded,
        name: node.name,
        path: node.path,
      },
      ...(isExpanded
        ? collectExpandedLinkDirectoryOptions(
            directoryChildren,
            expandedDirectoryPaths,
            depth + 1,
          )
        : []),
    ];
  });
