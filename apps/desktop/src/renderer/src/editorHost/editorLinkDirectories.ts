import type { TreeNode } from "@mde/editor-host/file-tree";
import {
  collectDefaultHiddenEntryPaths,
  filterHiddenNodes,
} from "../explorer/explorerTreeVisibility";
import {
  readDefaultHiddenExplorerWorkspaces,
  readHiddenExplorerEntries,
} from "../explorer/hiddenExplorerEntries";

interface CreateVisibleEditorLinkTreeOptions {
  readonly storage?: Pick<Storage, "getItem">;
}

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
