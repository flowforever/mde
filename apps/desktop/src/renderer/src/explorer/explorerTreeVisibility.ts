import type { TreeNode } from "../../../shared/fileTree";

export const getAncestorDirectoryPaths = (
  entryPath: string,
): readonly string[] => {
  const segments = entryPath.split("/").filter((segment) => segment.length > 0);

  return segments
    .slice(0, -1)
    .map((_segment, index) => segments.slice(0, index + 1).join("/"));
};

export const findDirectoryPath = (
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

export const collectDefaultHiddenEntryPaths = (
  nodes: readonly TreeNode[],
): readonly string[] =>
  nodes.reduce<readonly string[]>((entryPaths, node) => {
    const childEntryPaths =
      node.type === "directory"
        ? collectDefaultHiddenEntryPaths(node.children)
        : [];
    const nodeEntryPaths = node.name.startsWith(".") ? [node.path] : [];

    return [...entryPaths, ...nodeEntryPaths, ...childEntryPaths];
  }, []);

export const filterHiddenNodes = (
  nodes: readonly TreeNode[],
  hiddenEntryPaths: ReadonlySet<string>,
): readonly TreeNode[] =>
  nodes.reduce<readonly TreeNode[]>((visibleNodes, node) => {
    if (hiddenEntryPaths.has(node.path)) {
      return visibleNodes;
    }

    if (node.type === "file") {
      return [...visibleNodes, node];
    }

    return [
      ...visibleNodes,
      {
        ...node,
        children: filterHiddenNodes(node.children, hiddenEntryPaths),
      },
    ];
  }, []);
