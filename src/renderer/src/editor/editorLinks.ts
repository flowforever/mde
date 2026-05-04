import {
  decodeHrefPath,
  getParentPath,
  getPathWithoutHashOrQuery,
  isAbsoluteNativePath,
  isFileUrl,
  isHttpUrl,
  isMarkdownPath,
  isSupportedMarkdownLinkHref,
  normalizeNativePath,
  normalizeWorkspaceLinkPath,
} from "../../../shared/editorCore/links";
import type { RecentWorkspace } from "../workspaces/recentWorkspaces";

export {
  collectMarkdownFilePaths,
  createMarkdownPathSuggestions,
  createRelativeMarkdownLink,
  normalizeWorkspacePath,
} from "../../../shared/editorCore/links";
export type { MarkdownPathSuggestion } from "../../../shared/editorCore/links";

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

export const isSupportedEditorLinkHref = isSupportedMarkdownLinkHref;

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
