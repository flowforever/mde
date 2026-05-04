import { useEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  FormEvent,
  KeyboardEvent,
  MouseEvent,
} from "react";

import type { TreeNode } from "../../../shared/fileTree";
import type { ExplorerInlineEditor, ExplorerTreeProps } from "./explorerTypes";
import { COMPONENT_IDS } from "../componentIds";

interface ExplorerTreeNodeProps extends ExplorerTreeProps {
  readonly depth: number;
  readonly node: TreeNode;
}

interface ExplorerTreeRootProps extends ExplorerTreeProps {
  readonly nodes: readonly TreeNode[];
}

const getRowAccessibleName = (
  node: TreeNode,
  text: ExplorerTreeProps["text"],
): string =>
  node.type === "directory"
    ? text("explorer.directoryAccessibleName", { name: node.name })
    : text("explorer.markdownFileAccessibleName", { name: node.name });

const getEntryName = (entryPath: string): string => {
  const separatorIndex = entryPath.lastIndexOf("/");

  return separatorIndex === -1
    ? entryPath
    : entryPath.slice(separatorIndex + 1);
};

const getInlineEditorLabel = (
  editor: ExplorerInlineEditor,
  text: ExplorerTreeProps["text"],
): string => {
  if (editor.type === "create-file") {
    return text("explorer.newMarkdownFileName");
  }

  if (editor.type === "create-folder") {
    return text("explorer.newFolderName");
  }

  return text("explorer.renameEntryName", {
    name: editor.targetEntryPath
      ? getEntryName(editor.targetEntryPath)
      : editor.value,
  });
};

interface ExplorerInlineEditorRowProps {
  readonly depth: number;
  readonly editor: ExplorerInlineEditor;
  readonly onCancel?: () => void;
  readonly onChange?: (value: string) => void;
  readonly onSubmit?: () => void;
  readonly text: ExplorerTreeProps["text"];
}

const ExplorerInlineEditorRow = ({
  depth,
  editor,
  onCancel,
  onChange,
  onSubmit,
  text,
}: ExplorerInlineEditorRowProps): React.JSX.Element => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rowStyle = { "--depth": depth } as CSSProperties;
  const label = getInlineEditorLabel(editor, text);
  const submitInlineEditor = (event: FormEvent): void => {
    event.preventDefault();
    onSubmit?.();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    onCancel?.();
  };

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editor.targetDirectoryPath, editor.targetEntryPath, editor.type]);

  return (
    <form
      className="explorer-tree-row explorer-inline-entry-form"
      data-component-id={COMPONENT_IDS.explorer.inlineNameField}
      onSubmit={submitInlineEditor}
      style={rowStyle}
    >
      <span className="explorer-file-spacer" aria-hidden="true" />
      <input
        aria-label={label}
        onChange={(event) => {
          onChange?.(event.target.value);
        }}
        onKeyDown={handleKeyDown}
        ref={inputRef}
        value={editor.value}
      />
    </form>
  );
};

const ExplorerTreeNode = ({
  depth,
  inlineEditor,
  node,
  onInlineEditorCancel,
  onInlineEditorChange,
  onInlineEditorSubmit,
  onOpenEntryMenu,
  onDirectoryExpandedChange,
  onSelectEntry,
  onSelectFile,
  expandedDirectoryPaths,
  locateFilePath,
  locateFileRequestId,
  selectedEntryPath,
  selectedFilePath,
  text,
}: ExplorerTreeNodeProps): React.JSX.Element => {
  const rowButtonRef = useRef<HTMLButtonElement | null>(null);
  const isExpanded = expandedDirectoryPaths?.has(node.path) ?? false;
  const isRenamingEntry =
    inlineEditor?.type === "rename" &&
    inlineEditor.targetEntryPath === node.path;
  const isSelected =
    selectedEntryPath === node.path ||
    (node.type === "file" && selectedFilePath === node.path);
  const rowStyle = { "--depth": depth } as CSSProperties;
  const toggleExpanded = (): void => {
    onDirectoryExpandedChange?.(node.path, !isExpanded);
  };
  const openContextMenu = (event: MouseEvent): void => {
    if (!onOpenEntryMenu) {
      return;
    }

    event.preventDefault();
    onOpenEntryMenu({
      clientX: event.clientX,
      clientY: event.clientY,
      entry: node,
    });
  };

  useEffect(() => {
    if (node.type !== "file" || locateFilePath !== node.path) {
      return;
    }

    if (typeof rowButtonRef.current?.scrollIntoView !== "function") {
      return;
    }

    rowButtonRef.current.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [locateFilePath, locateFileRequestId, node.path, node.type]);

  if (node.type === "directory") {
    const isCreatingInsideDirectory =
      inlineEditor?.type !== "rename" &&
      inlineEditor?.targetDirectoryPath === node.path;
    const isShowingChildren = isExpanded || isCreatingInsideDirectory;

    return (
      <li>
        {isRenamingEntry && inlineEditor ? (
          <ExplorerInlineEditorRow
            depth={depth}
            editor={inlineEditor}
            onCancel={onInlineEditorCancel}
            onChange={onInlineEditorChange}
            onSubmit={onInlineEditorSubmit}
            text={text}
          />
        ) : (
          <div className="explorer-tree-row" style={rowStyle}>
            <button
              aria-expanded={isShowingChildren}
              aria-label={text(
                isShowingChildren
                  ? "explorer.collapseDirectory"
                  : "explorer.expandDirectory",
                { name: node.name },
              )}
              className="explorer-disclosure-button"
              data-component-id={COMPONENT_IDS.explorer.directoryDisclosureButton}
              onClick={toggleExpanded}
              type="button"
            >
              {isShowingChildren ? "v" : ">"}
            </button>
            <button
              aria-expanded={isShowingChildren}
              aria-current={isSelected ? "page" : undefined}
              aria-label={getRowAccessibleName(node, text)}
              className={
                isSelected
                  ? "explorer-row-button is-active"
                  : "explorer-row-button"
              }
              data-component-id={COMPONENT_IDS.explorer.treeRow}
              onContextMenu={openContextMenu}
              onClick={() => {
                if (!isExpanded) {
                  onSelectEntry(node.path);
                } else if (selectedEntryPath === node.path) {
                  onSelectEntry(null);
                }
                toggleExpanded();
              }}
              type="button"
            >
              {node.name}
            </button>
          </div>
        )}
        {isShowingChildren ? (
          <ul className="explorer-tree" role="group">
            {isCreatingInsideDirectory && inlineEditor ? (
              <li>
                <ExplorerInlineEditorRow
                  depth={depth + 1}
                  editor={inlineEditor}
                  onCancel={onInlineEditorCancel}
                  onChange={onInlineEditorChange}
                  onSubmit={onInlineEditorSubmit}
                  text={text}
                />
              </li>
            ) : null}
            {node.children.map((childNode) => (
              <ExplorerTreeNode
                depth={depth + 1}
                inlineEditor={inlineEditor}
                key={childNode.path}
                node={childNode}
                onInlineEditorCancel={onInlineEditorCancel}
                onInlineEditorChange={onInlineEditorChange}
                onInlineEditorSubmit={onInlineEditorSubmit}
                onDirectoryExpandedChange={onDirectoryExpandedChange}
                onOpenEntryMenu={onOpenEntryMenu}
                onSelectEntry={onSelectEntry}
                onSelectFile={onSelectFile}
                expandedDirectoryPaths={expandedDirectoryPaths}
                locateFilePath={locateFilePath}
                locateFileRequestId={locateFileRequestId}
                selectedEntryPath={selectedEntryPath}
                selectedFilePath={selectedFilePath}
                text={text}
              />
            ))}
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <li>
      {isRenamingEntry && inlineEditor ? (
        <ExplorerInlineEditorRow
          depth={depth}
          editor={inlineEditor}
          onCancel={onInlineEditorCancel}
          onChange={onInlineEditorChange}
          onSubmit={onInlineEditorSubmit}
          text={text}
        />
      ) : (
        <div className="explorer-tree-row" style={rowStyle}>
          <span className="explorer-file-spacer" aria-hidden="true" />
          <button
            aria-current={isSelected ? "page" : undefined}
            aria-label={getRowAccessibleName(node, text)}
            className={
              isSelected
                ? "explorer-row-button is-active"
                : "explorer-row-button"
            }
            data-component-id={COMPONENT_IDS.explorer.treeRow}
            onContextMenu={openContextMenu}
            onClick={() => {
              onSelectEntry(node.path);
              onSelectFile(node.path);
            }}
            ref={rowButtonRef}
            type="button"
          >
            {node.name}
          </button>
        </div>
      )}
    </li>
  );
};

export const ExplorerTree = ({
  expandedDirectoryPaths,
  inlineEditor,
  locateFilePath,
  locateFileRequestId,
  nodes,
  onDirectoryExpandedChange,
  onInlineEditorCancel,
  onInlineEditorChange,
  onInlineEditorSubmit,
  onOpenEntryMenu,
  onSelectEntry,
  onSelectFile,
  selectedEntryPath,
  selectedFilePath,
  text,
}: ExplorerTreeRootProps): React.JSX.Element => {
  const [
    uncontrolledExpandedDirectoryPaths,
    setUncontrolledExpandedDirectoryPaths,
  ] = useState<ReadonlySet<string>>(() => new Set());
  const effectiveExpandedDirectoryPaths =
    expandedDirectoryPaths ?? uncontrolledExpandedDirectoryPaths;
  const changeDirectoryExpansion = (
    directoryPath: string,
    isExpanded: boolean,
  ): void => {
    if (!expandedDirectoryPaths) {
      setUncontrolledExpandedDirectoryPaths((currentPaths) => {
        const nextPaths = new Set(currentPaths);

        if (isExpanded) {
          nextPaths.add(directoryPath);
        } else {
          nextPaths.delete(directoryPath);
        }

        return nextPaths;
      });
    }

    onDirectoryExpandedChange?.(directoryPath, isExpanded);
  };

  return (
    <ul
      className="explorer-tree explorer-tree-root"
      data-component-id={COMPONENT_IDS.explorer.tree}
    >
      {inlineEditor &&
      inlineEditor.type !== "rename" &&
      inlineEditor.targetDirectoryPath === null ? (
        <li>
          <ExplorerInlineEditorRow
            depth={0}
            editor={inlineEditor}
            onCancel={onInlineEditorCancel}
            onChange={onInlineEditorChange}
            onSubmit={onInlineEditorSubmit}
            text={text}
          />
        </li>
      ) : null}
      {nodes.map((node) => (
        <ExplorerTreeNode
          depth={0}
          expandedDirectoryPaths={effectiveExpandedDirectoryPaths}
          inlineEditor={inlineEditor}
          key={node.path}
          locateFilePath={locateFilePath}
          locateFileRequestId={locateFileRequestId}
          node={node}
          onDirectoryExpandedChange={changeDirectoryExpansion}
          onInlineEditorCancel={onInlineEditorCancel}
          onInlineEditorChange={onInlineEditorChange}
          onInlineEditorSubmit={onInlineEditorSubmit}
          onOpenEntryMenu={onOpenEntryMenu}
          onSelectEntry={onSelectEntry}
          onSelectFile={onSelectFile}
          selectedEntryPath={selectedEntryPath}
          selectedFilePath={selectedFilePath}
          text={text}
        />
      ))}
    </ul>
  );
};
