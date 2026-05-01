import type { TreeNode } from "../../../shared/fileTree";
import type { RecentWorkspace } from "../workspaces/recentWorkspaces";

export interface MarkdownPathSuggestion {
  readonly path: string;
  readonly relativePath: string;
}

export type EditorLinkTarget =
  | {
      readonly kind: "external";
      readonly url: string;
    }
  | {
      readonly filePath: string;
      readonly kind: "workspace-file";
    }
  | {
      readonly filePath: string;
      readonly kind: "workspace-file-new-window";
      readonly workspaceRoot: string;
    }
  | {
      readonly kind: "new-window-path";
      readonly resourcePath: string;
    }
  | {
      readonly kind: "none";
    };

export const normalizeWorkspacePath = (filePath: string): string =>
  filePath.replace(/\\/g, "/").replace(/^\/+/u, "").replace(/\/+$/u, "");

const normalizeNativePath = (filePath: string): string =>
  filePath.replace(/\\/g, "/").replace(/\/+$/u, "");

const getPathWithoutHashOrQuery = (href: string): string => {
  const hashIndex = href.indexOf("#");
  const queryIndex = href.indexOf("?");
  const cutoffIndexes = [hashIndex, queryIndex].filter((index) => index >= 0);
  const cutoffIndex =
    cutoffIndexes.length > 0 ? Math.min(...cutoffIndexes) : href.length;

  return href.slice(0, cutoffIndex).trim();
};

const getParentPath = (filePath: string): string => {
  const normalizedPath = normalizeWorkspacePath(filePath);
  const separatorIndex = normalizedPath.lastIndexOf("/");

  return separatorIndex === -1 ? "" : normalizedPath.slice(0, separatorIndex);
};

const getFileName = (filePath: string): string => {
  const normalizedPath = normalizeWorkspacePath(filePath);
  const separatorIndex = normalizedPath.lastIndexOf("/");

  return separatorIndex === -1
    ? normalizedPath
    : normalizedPath.slice(separatorIndex + 1);
};

const splitWorkspacePath = (filePath: string): readonly string[] =>
  normalizeWorkspacePath(filePath)
    .split("/")
    .filter((segment) => segment.length > 0);

const isMarkdownPath = (filePath: string): boolean =>
  getPathWithoutHashOrQuery(filePath).toLocaleLowerCase().endsWith(".md");

export const isHttpUrl = (href: string): boolean => {
  try {
    const url = new URL(href);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const isFileUrl = (href: string): boolean => {
  try {
    return new URL(href).protocol === "file:";
  } catch {
    return false;
  }
};

const isAbsoluteNativePath = (filePath: string): boolean =>
  filePath.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(filePath);

const decodeHrefPath = (href: string): string => {
  try {
    return decodeURIComponent(href);
  } catch {
    return href;
  }
};

const normalizeWorkspaceLinkPath = (
  currentFilePath: string,
  href: string,
): string | null => {
  const targetPath = decodeHrefPath(getPathWithoutHashOrQuery(href));

  if (
    targetPath.length === 0 ||
    targetPath.startsWith("#") ||
    isAbsoluteNativePath(targetPath)
  ) {
    return null;
  }

  const segments = [...splitWorkspacePath(getParentPath(currentFilePath))];

  for (const segment of targetPath.replace(/\\/g, "/").split("/")) {
    if (segment.length === 0 || segment === ".") {
      continue;
    }

    if (segment === "..") {
      if (segments.length === 0) {
        return null;
      }

      segments.pop();
      continue;
    }

    segments.push(segment);
  }

  const normalizedPath = segments.join("/");

  return isMarkdownPath(normalizedPath) ? normalizedPath : null;
};

const normalizeAbsoluteNativePath = (filePath: string): string => {
  const normalizedPath = normalizeNativePath(filePath);
  const hasLeadingSlash = normalizedPath.startsWith("/");
  const driveMatch = /^[A-Za-z]:/u.exec(normalizedPath);
  const prefix = driveMatch ? driveMatch[0] : hasLeadingSlash ? "" : "";
  const pathWithoutPrefix = driveMatch
    ? normalizedPath.slice(prefix.length)
    : normalizedPath;
  const segments: string[] = [];

  for (const segment of pathWithoutPrefix.split("/")) {
    if (segment.length === 0 || segment === ".") {
      continue;
    }

    if (segment === "..") {
      segments.pop();
      continue;
    }

    segments.push(segment);
  }

  if (driveMatch) {
    return `${prefix}/${segments.join("/")}`;
  }

  return `${hasLeadingSlash ? "/" : ""}${segments.join("/")}`;
};

const resolveNativeLinkPath = ({
  currentFilePath,
  currentWorkspaceRoot,
  href,
}: {
  readonly currentFilePath: string;
  readonly currentWorkspaceRoot: string;
  readonly href: string;
}): string | null => {
  const rawPath = decodeHrefPath(getPathWithoutHashOrQuery(href));

  if (rawPath.length === 0 || rawPath.startsWith("#")) {
    return null;
  }

  if (isFileUrl(rawPath)) {
    try {
      return normalizeAbsoluteNativePath(new URL(rawPath).pathname);
    } catch {
      return null;
    }
  }

  if (isAbsoluteNativePath(rawPath)) {
    return normalizeAbsoluteNativePath(rawPath);
  }

  const currentDirectoryPath = getParentPath(currentFilePath);

  return normalizeAbsoluteNativePath(
    [currentWorkspaceRoot, currentDirectoryPath, rawPath]
      .filter((segment) => segment.length > 0)
      .join("/"),
  );
};

const getRelativeWorkspacePath = (
  resourcePath: string,
  workspaceRoot: string,
): string | null => {
  const normalizedResourcePath = normalizeNativePath(resourcePath);
  const normalizedWorkspaceRoot = normalizeNativePath(workspaceRoot);

  if (normalizedResourcePath === normalizedWorkspaceRoot) {
    return "";
  }

  if (!normalizedResourcePath.startsWith(`${normalizedWorkspaceRoot}/`)) {
    return null;
  }

  return normalizedResourcePath.slice(normalizedWorkspaceRoot.length + 1);
};

export const collectMarkdownFilePaths = (
  nodes: readonly TreeNode[],
): readonly string[] =>
  nodes.flatMap((node) => {
    if (node.type === "directory") {
      return collectMarkdownFilePaths(node.children);
    }

    return isMarkdownPath(node.path) ? [node.path] : [];
  });

export const createRelativeMarkdownLink = (
  currentFilePath: string,
  targetFilePath: string,
): string => {
  const currentDirectorySegments = splitWorkspacePath(
    getParentPath(currentFilePath),
  );
  const targetSegments = splitWorkspacePath(targetFilePath);
  const targetDirectorySegments = targetSegments.slice(0, -1);
  const targetFileName = targetSegments.at(-1) ?? getFileName(targetFilePath);
  let commonSegmentCount = 0;

  while (
    commonSegmentCount < currentDirectorySegments.length &&
    commonSegmentCount < targetDirectorySegments.length &&
    currentDirectorySegments[commonSegmentCount] ===
      targetDirectorySegments[commonSegmentCount]
  ) {
    commonSegmentCount += 1;
  }

  const parentSegments = currentDirectorySegments
    .slice(commonSegmentCount)
    .map(() => "..");
  const childSegments = targetDirectorySegments.slice(commonSegmentCount);
  const relativeSegments = [...parentSegments, ...childSegments, targetFileName];

  return relativeSegments.join("/");
};

const queryMatchesPath = (query: string, filePath: string): boolean => {
  const queryParts = query
    .trim()
    .toLocaleLowerCase()
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (queryParts.length === 0) {
    return true;
  }

  const pathParts = filePath.toLocaleLowerCase().split("/");
  let pathIndex = 0;

  for (const queryPart of queryParts) {
    const matchingIndex = pathParts.findIndex(
      (pathPart, index) => index >= pathIndex && pathPart.includes(queryPart),
    );

    if (matchingIndex === -1) {
      return false;
    }

    pathIndex = matchingIndex + 1;
  }

  return true;
};

export const createMarkdownPathSuggestions = (
  query: string,
  paths: readonly string[],
  options: { readonly currentFilePath: string },
): readonly MarkdownPathSuggestion[] =>
  paths
    .filter((filePath) => queryMatchesPath(query, filePath))
    .map((filePath) => ({
      path: filePath,
      relativePath: createRelativeMarkdownLink(
        options.currentFilePath,
        filePath,
      ),
    }))
    .sort((leftSuggestion, rightSuggestion) => {
      const lowerQuery = query.trim().toLocaleLowerCase();
      const leftName = getFileName(leftSuggestion.path).toLocaleLowerCase();
      const rightName = getFileName(rightSuggestion.path).toLocaleLowerCase();
      const leftStartsWithQuery = lowerQuery.length > 0 && leftName.startsWith(lowerQuery);
      const rightStartsWithQuery =
        lowerQuery.length > 0 && rightName.startsWith(lowerQuery);

      if (leftStartsWithQuery !== rightStartsWithQuery) {
        return leftStartsWithQuery ? -1 : 1;
      }

      return leftSuggestion.path.localeCompare(rightSuggestion.path, undefined, {
        sensitivity: "base",
      });
    })
    .slice(0, 20);

export const findContainingWorkspace = (
  nativeFilePath: string,
  recentWorkspaces: readonly RecentWorkspace[],
): { readonly filePath: string; readonly workspaceRoot: string } | null => {
  const normalizedNativePath = normalizeNativePath(nativeFilePath);
  const matchingWorkspace = recentWorkspaces
    .filter((workspace) => workspace.type !== "file")
    .map((workspace) => ({
      rootPath: normalizeNativePath(workspace.rootPath),
      workspace,
    }))
    .filter(
      ({ rootPath }) =>
        normalizedNativePath === rootPath ||
        normalizedNativePath.startsWith(`${rootPath}/`),
    )
    .sort(
      (leftWorkspace, rightWorkspace) =>
        rightWorkspace.rootPath.length - leftWorkspace.rootPath.length,
    )[0];

  if (!matchingWorkspace) {
    return null;
  }

  return {
    filePath: normalizedNativePath.slice(matchingWorkspace.rootPath.length + 1),
    workspaceRoot: matchingWorkspace.workspace.rootPath,
  };
};

export const isSupportedEditorLinkHref = (href: string): boolean => {
  const normalizedHref = href.trim();

  if (normalizedHref.length === 0) {
    return false;
  }

  if (/^javascript:/iu.test(normalizedHref)) {
    return false;
  }

  return isHttpUrl(normalizedHref) || isFileUrl(normalizedHref) || isMarkdownPath(normalizedHref);
};

export const resolveEditorLinkTarget = ({
  currentFilePath,
  currentWorkspaceRoot,
  href,
  recentWorkspaces,
}: {
  readonly currentFilePath: string;
  readonly currentWorkspaceRoot: string;
  readonly href: string;
  readonly recentWorkspaces: readonly RecentWorkspace[];
}): EditorLinkTarget => {
  const normalizedHref = href.trim();

  if (normalizedHref.length === 0 || normalizedHref.startsWith("#")) {
    return { kind: "none" };
  }

  if (isHttpUrl(normalizedHref)) {
    return {
      kind: "external",
      url: normalizedHref,
    };
  }

  const relativeWorkspacePath = normalizeWorkspaceLinkPath(
    currentFilePath,
    normalizedHref,
  );

  if (relativeWorkspacePath) {
    return {
      filePath: relativeWorkspacePath,
      kind: "workspace-file",
    };
  }

  const nativePath = resolveNativeLinkPath({
    currentFilePath,
    currentWorkspaceRoot,
    href: normalizedHref,
  });

  if (!nativePath || !isMarkdownPath(nativePath)) {
    return { kind: "none" };
  }

  const sameWorkspacePath = getRelativeWorkspacePath(
    nativePath,
    currentWorkspaceRoot,
  );

  if (sameWorkspacePath !== null) {
    return {
      filePath: sameWorkspacePath,
      kind: "workspace-file",
    };
  }

  const containingWorkspace = findContainingWorkspace(
    nativePath,
    recentWorkspaces,
  );

  if (containingWorkspace) {
    return {
      filePath: containingWorkspace.filePath,
      kind: "workspace-file-new-window",
      workspaceRoot: containingWorkspace.workspaceRoot,
    };
  }

  return {
    kind: "new-window-path",
    resourcePath: nativePath,
  };
};
