import type { TreeNode } from "@mde/editor-host/file-tree";

export interface WorkspacePathSearchResult {
  readonly name: string;
  readonly path: string;
}

const normalizePathSearchQuery = (query: string): string =>
  query.trim().replace(/^@+/, "").trim().toLocaleLowerCase();

const isFuzzySubsequence = (candidate: string, query: string): boolean => {
  if (query.length === 0) {
    return true;
  }

  let queryIndex = 0;

  for (const character of candidate) {
    if (character === query[queryIndex]) {
      queryIndex += 1;
    }

    if (queryIndex === query.length) {
      return true;
    }
  }

  return false;
};

const pathMatchesQuery = (path: string, name: string, query: string): boolean => {
  const normalizedPath = path.toLocaleLowerCase();
  const normalizedName = name.toLocaleLowerCase();

  if (`${normalizedName} ${normalizedPath}`.includes(query)) {
    return true;
  }

  const querySegments = query.split("/").filter(Boolean);

  if (querySegments.length === 0) {
    return false;
  }

  const pathSegments = normalizedPath.split("/");
  let pathSegmentIndex = 0;

  for (const querySegment of querySegments) {
    let hasMatch = false;

    while (pathSegmentIndex < pathSegments.length) {
      const pathSegment = pathSegments[pathSegmentIndex];
      pathSegmentIndex += 1;

      if (
        pathSegment.includes(querySegment) ||
        isFuzzySubsequence(pathSegment, querySegment)
      ) {
        hasMatch = true;
        break;
      }
    }

    if (!hasMatch) {
      return false;
    }
  }

  return true;
};

const collectFileNodes = (
  nodes: readonly TreeNode[],
): readonly WorkspacePathSearchResult[] =>
  nodes.flatMap((node) =>
    node.type === "directory"
      ? collectFileNodes(node.children)
      : [
          {
            name: node.name,
            path: node.path,
          },
        ],
  );

export const searchWorkspacePaths = (
  nodes: readonly TreeNode[],
  query: string,
  limit = 48,
): readonly WorkspacePathSearchResult[] => {
  const normalizedQuery = normalizePathSearchQuery(query);

  if (normalizedQuery.length === 0 || limit <= 0) {
    return [];
  }

  return collectFileNodes(nodes)
    .filter((result) =>
      pathMatchesQuery(result.path, result.name, normalizedQuery),
    )
    .slice(0, limit);
};
