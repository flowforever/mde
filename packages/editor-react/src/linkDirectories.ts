import type { TreeNode } from "@mde/editor-host/file-tree";

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

const getAncestorDirectoryPaths = (entryPath: string): readonly string[] => {
  const segments = entryPath.split("/").filter((segment) => segment.length > 0);

  return segments
    .slice(0, -1)
    .map((_segment, index) => segments.slice(0, index + 1).join("/"));
};

const findDirectoryPath = (
  nodes: readonly TreeNode[],
  targetPath: string | null,
): string | null => {
  if (!targetPath) {
    return null;
  }

  for (const node of nodes) {
    if (node.type !== "directory") {
      continue;
    }

    if (node.path === targetPath) {
      return node.path;
    }

    const childDirectoryPath = findDirectoryPath(node.children, targetPath);

    if (childDirectoryPath) {
      return childDirectoryPath;
    }
  }

  return null;
};

const getDirectoryChildren = (node: TreeNode): readonly TreeNode[] =>
  node.type === "directory"
    ? node.children.filter((child) => child.type === "directory")
    : [];

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
