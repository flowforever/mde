import type { Workspace, WorkspacePathInfo } from "../../../shared/workspace";

export type DropOpenWorkspace = Pick<Workspace, "rootPath" | "type">;

export type DropOpenPlan =
  | {
      readonly filePath: string;
      readonly kind: "load-workspace-file";
      readonly refreshDirectoryPaths: readonly string[];
    }
  | {
      readonly directoryPath: string;
      readonly kind: "refresh-workspace-directory";
      readonly refreshDirectoryPaths: readonly string[];
    }
  | { readonly kind: "refresh-workspace-root" }
  | { readonly kind: "open-current-window"; readonly resourcePath: string }
  | { readonly kind: "open-new-window"; readonly resourcePath: string }
  | { readonly kind: "unsupported"; readonly resourcePath: string };

interface DataTransferFileLike {
  readonly name?: string;
  readonly path?: string;
}

export interface DataTransferLike {
  readonly files: ArrayLike<DataTransferFileLike>;
  readonly getData: (format: string) => string;
  readonly types: ArrayLike<string>;
}

const getParentPath = (entryPath: string): string => {
  const separatorIndex = entryPath.lastIndexOf("/");

  return separatorIndex === -1 ? "" : entryPath.slice(0, separatorIndex);
};

export const normalizeNativePath = (filePath: string): string =>
  filePath.replace(/\\/g, "/").replace(/\/+$/u, "");

export const getRelativeWorkspacePath = (
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

export const hasDroppedResourceTransfer = (
  dataTransfer: DataTransferLike,
): boolean =>
  Array.from(dataTransfer.files).length > 0 ||
  Array.from(dataTransfer.types).includes("Files") ||
  dataTransfer.getData("text/uri-list").includes("file://");

const decodeFileUriPath = (fileUri: string): string | null => {
  if (!fileUri.startsWith("file://")) {
    return null;
  }

  try {
    const url = new URL(fileUri);
    const decodedPath = decodeURIComponent(url.pathname);
    const platformPath = /^\/[A-Za-z]:\//u.test(decodedPath)
      ? decodedPath.slice(1)
      : decodedPath;

    return url.hostname ? `//${url.hostname}${platformPath}` : platformPath;
  } catch {
    return null;
  }
};

export const getDroppedResourcePath = (
  dataTransfer: DataTransferLike,
): string | null => {
  const [firstFile] = Array.from(dataTransfer.files);
  const nativeFilePath = firstFile?.path;

  if (nativeFilePath) {
    return nativeFilePath;
  }

  const uriList = dataTransfer.getData("text/uri-list");
  const fileUriPath = uriList
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map(decodeFileUriPath)
    .find((path) => path !== null);

  return fileUriPath ?? null;
};

export const createDropOpenPlan = ({
  currentWorkspace,
  droppedPath,
}: {
  readonly currentWorkspace: DropOpenWorkspace | null;
  readonly droppedPath: WorkspacePathInfo;
}): DropOpenPlan => {
  if (droppedPath.kind === "unsupported-file" || droppedPath.kind === "other") {
    return {
      kind: "unsupported",
      resourcePath: droppedPath.path,
    };
  }

  if (currentWorkspace?.type === "workspace") {
    const relativePath = getRelativeWorkspacePath(
      droppedPath.path,
      currentWorkspace.rootPath,
    );

    if (relativePath === "") {
      return { kind: "refresh-workspace-root" };
    }

    if (relativePath !== null && droppedPath.kind === "markdown-file") {
      return {
        filePath: relativePath,
        kind: "load-workspace-file",
        refreshDirectoryPaths: [getParentPath(relativePath)],
      };
    }

    if (relativePath !== null && droppedPath.kind === "directory") {
      return {
        directoryPath: relativePath,
        kind: "refresh-workspace-directory",
        refreshDirectoryPaths: [relativePath],
      };
    }
  }

  if (currentWorkspace) {
    return {
      kind: "open-new-window",
      resourcePath: droppedPath.path,
    };
  }

  return {
    kind: "open-current-window",
    resourcePath: droppedPath.path,
  };
};
