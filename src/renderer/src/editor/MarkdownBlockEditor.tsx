import {
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Block } from "@blocknote/core";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import {
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import {
  ChevronDown,
  ChevronRight,
  FilePlus2,
  Link as LinkIcon,
  X,
} from "lucide-react";

import { replaceMermaidBlocksFromSource } from "./flowchartMarkdown";
import { MermaidFlowchartPanel } from "./MermaidFlowchartPanel";
import { replaceEditorDocumentWithoutUndoHistory } from "./editorHydration";
import {
  collectMarkdownFilePaths,
  createMarkdownPathSuggestions,
  createRelativeMarkdownLink,
  isSupportedEditorLinkHref,
} from "./editorLinks";
import {
  collectExpandedLinkDirectoryOptions,
  createInitialLinkDirectoryState,
  createVisibleEditorLinkTree,
  type LinkDirectoryOption,
} from "./editorLinkDirectories";
import {
  exportBlocksToMarkdown,
  importMarkdownToBlocks,
  prepareMarkdownForEditor,
  prepareMarkdownForStorage,
} from "./markdownTransforms";
import { FrontmatterPanel } from "./FrontmatterPanel";
import {
  composeMarkdownWithFrontmatter,
  splitMarkdownFrontmatter,
} from "./frontmatter";
import type { TreeNode } from "../../../shared/fileTree";
import type { AppText } from "../i18n/appLanguage";

interface MarkdownBlockEditorProps {
  readonly activeSearchMatchIndex?: number;
  readonly colorScheme: "dark" | "light";
  readonly draftMarkdown: string;
  readonly errorMessage: string | null;
  readonly isDirty: boolean;
  readonly isReadOnly?: boolean;
  readonly isSaving: boolean;
  readonly markdown: string;
  readonly markdownFilePaths?: readonly string[];
  readonly onCreateLinkedMarkdown?: (filePath: string) => Promise<string>;
  readonly onImageUpload: (file: File) => Promise<string>;
  readonly onOpenLink?: (href: string) => void;
  readonly onMarkdownChange: (contents: string) => void;
  readonly onSaveRequest: (contents: string) => void | Promise<void>;
  readonly onSearchStateChange?: (state: {
    readonly activeMatchIndex: number;
    readonly matchCount: number;
  }) => void;
  readonly path: string;
  readonly searchQuery?: string;
  readonly text: AppText;
  readonly workspaceTree?: readonly TreeNode[];
  readonly workspaceRoot: string;
}

export interface MarkdownBlockEditorHandle {
  readonly getMarkdown: () => Promise<string>;
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

interface HighlightRegistry {
  readonly delete: (name: string) => void;
  readonly set: (name: string, highlight: unknown) => void;
}

interface HighlightRuntime {
  readonly CSS?: {
    readonly highlights?: HighlightRegistry;
  };
  readonly Highlight?: new (...ranges: Range[]) => unknown;
}

interface LinkDialogState {
  readonly errorMessage: string | null;
  readonly expandedDirectoryPaths: ReadonlySet<string>;
  readonly hrefInput: string;
  readonly mode: "insert" | "new-document";
  readonly newDocumentDirectoryPath: string;
  readonly newDocumentName: string;
  readonly selectedSuggestionIndex: number;
  readonly visibleWorkspaceTree: readonly TreeNode[];
}

const SEARCH_MATCH_HIGHLIGHT_NAME = "mde-editor-search-match";
const SEARCH_ACTIVE_HIGHLIGHT_NAME = "mde-editor-search-active";
const LINK_SUGGESTION_LIMIT = 20;

const joinWorkspacePath = (parentPath: string, entryName: string): string =>
  parentPath ? `${parentPath}/${entryName}` : entryName;

const ensureMarkdownExtension = (filePath: string): string =>
  filePath.toLocaleLowerCase().endsWith(".md") ? filePath : `${filePath}.md`;

const getEntryName = (entryPath: string): string => {
  const separatorIndex = entryPath.lastIndexOf("/");

  return separatorIndex === -1
    ? entryPath
    : entryPath.slice(separatorIndex + 1);
};

const createInitialLinkDialogState = (
  currentFilePath: string,
  text: AppText,
  visibleWorkspaceTree: readonly TreeNode[],
): LinkDialogState => {
  const initialDirectoryState = createInitialLinkDirectoryState(
    visibleWorkspaceTree,
    currentFilePath,
  );

  return {
    errorMessage: null,
    expandedDirectoryPaths: initialDirectoryState.expandedDirectoryPaths,
    hrefInput: "",
    mode: "insert",
    newDocumentDirectoryPath: initialDirectoryState.selectedDirectoryPath,
    newDocumentName: text("editor.linkNewDocumentDefaultName"),
    selectedSuggestionIndex: 0,
    visibleWorkspaceTree,
  };
};

const createSearchRanges = (
  container: HTMLElement,
  query: string,
): readonly Range[] => {
  const normalizedQuery = query.trim();

  if (normalizedQuery.length === 0) {
    return [];
  }

  const lowerQuery = normalizedQuery.toLocaleLowerCase();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const ranges: Range[] = [];
  let node = walker.nextNode();

  while (node) {
    const text = node.textContent ?? "";
    const lowerText = text.toLocaleLowerCase();
    let index = lowerText.indexOf(lowerQuery);

    while (index !== -1) {
      const range = document.createRange();

      range.setStart(node, index);
      range.setEnd(node, index + normalizedQuery.length);
      ranges.push(range);
      index = lowerText.indexOf(lowerQuery, index + normalizedQuery.length);
    }

    node = walker.nextNode();
  }

  return ranges;
};

const clearSearchHighlights = (): void => {
  const registry = (globalThis as HighlightRuntime).CSS?.highlights;

  registry?.delete(SEARCH_MATCH_HIGHLIGHT_NAME);
  registry?.delete(SEARCH_ACTIVE_HIGHLIGHT_NAME);
};

export const MarkdownBlockEditor = forwardRef<
  MarkdownBlockEditorHandle,
  MarkdownBlockEditorProps
>(function MarkdownBlockEditor(
  {
    activeSearchMatchIndex = -1,
    colorScheme,
    errorMessage,
    draftMarkdown,
    isDirty,
    isReadOnly = false,
    isSaving,
    markdownFilePaths = [],
    markdown,
    onCreateLinkedMarkdown,
    onImageUpload,
    onOpenLink = () => undefined,
    onMarkdownChange,
    onSaveRequest,
    onSearchStateChange = () => undefined,
    path,
    searchQuery = "",
    text,
    workspaceTree = [],
    workspaceRoot,
  },
  ref,
): React.JSX.Element {
  const onOpenLinkRef = useRef(onOpenLink);
  const editor = useCreateBlockNote(
    {
      links: {
        isValidLink: isSupportedEditorLinkHref,
        onClick: (event) => {
          const eventTarget = event.target;
          const anchorElement =
            eventTarget instanceof Element
              ? eventTarget.closest<HTMLAnchorElement>("a[href]")
              : null;
          const href = anchorElement?.getAttribute("href");

          if (!href) {
            return false;
          }

          event.preventDefault();
          onOpenLinkRef.current(href);

          return true;
        },
      },
      uploadFile: onImageUpload,
    },
    [onImageUpload],
  );
  const isHydratingRef = useRef(false);
  const hasLocalChangesRef = useRef(false);
  const latestDraftMarkdownRef = useRef(draftMarkdown);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [parseErrorMessage, setParseErrorMessage] = useState<string | null>(
    null,
  );
  const [serializationErrorMessage, setSerializationErrorMessage] = useState<
    string | null
  >(null);
  const [linkDialogState, setLinkDialogState] =
    useState<LinkDialogState | null>(null);
  const [searchRevision, setSearchRevision] = useState(0);
  useEffect(() => {
    onOpenLinkRef.current = onOpenLink;
  }, [onOpenLink]);
  const assetContext = useMemo(
    () => ({
      markdownFilePath: path,
      workspaceRoot,
    }),
    [path, workspaceRoot],
  );
  const persistedMarkdownDocument = useMemo(
    () => splitMarkdownFrontmatter(markdown),
    [markdown],
  );
  const draftMarkdownDocument = useMemo(
    () => splitMarkdownFrontmatter(draftMarkdown),
    [draftMarkdown],
  );
  const editorMarkdown = useMemo(
    () => prepareMarkdownForEditor(persistedMarkdownDocument.body, assetContext),
    [assetContext, persistedMarkdownDocument.body],
  );
  const directoryOptions = useMemo<readonly LinkDirectoryOption[]>(() => {
    if (!linkDialogState) {
      return [];
    }

    return [
      {
        depth: 0,
        hasChildDirectories: linkDialogState.visibleWorkspaceTree.some(
          (node) => node.type === "directory",
        ),
        isExpanded: true,
        name: text("editor.linkRootDirectory"),
        path: "",
      },
      ...collectExpandedLinkDirectoryOptions(
        linkDialogState.visibleWorkspaceTree,
        linkDialogState.expandedDirectoryPaths,
        1,
      ),
    ];
  }, [linkDialogState, text]);
  const linkSuggestions = useMemo(
    () => {
      if (!linkDialogState) {
        return [];
      }

      const visibleMarkdownFilePaths =
        workspaceTree.length > 0
          ? collectMarkdownFilePaths(linkDialogState.visibleWorkspaceTree)
          : markdownFilePaths;

      return createMarkdownPathSuggestions(
        linkDialogState.hrefInput,
        visibleMarkdownFilePaths,
        {
          currentFilePath: path,
        },
      ).slice(0, LINK_SUGGESTION_LIMIT);
    },
    [linkDialogState, markdownFilePaths, path, workspaceTree.length],
  );

  const serializeMarkdown = useCallback(async (): Promise<string> => {
    const exportedMarkdown = await exportBlocksToMarkdown(
      editor,
      editor.document,
    );
    const portableMarkdown = prepareMarkdownForStorage(
      exportedMarkdown,
      assetContext,
    );
    const bodyMarkdown = replaceMermaidBlocksFromSource(
      portableMarkdown,
      draftMarkdownDocument.body,
    );

    return composeMarkdownWithFrontmatter(draftMarkdownDocument, bodyMarkdown);
  }, [assetContext, draftMarkdownDocument, editor]);

  const saveMarkdown = useCallback(async (): Promise<void> => {
    if (isReadOnly || isSaving || !hasLocalChangesRef.current) {
      return;
    }

    try {
      const contents = await serializeMarkdown();

      if (contents === markdown) {
        hasLocalChangesRef.current = false;
        return;
      }

      setSerializationErrorMessage(null);
      await onSaveRequest(contents);
      hasLocalChangesRef.current = false;
    } catch (error) {
      setSerializationErrorMessage(
        getErrorMessage(error, text("errors.markdownSerializeFailed")),
      );
    }
  }, [isReadOnly, isSaving, markdown, onSaveRequest, serializeMarkdown, text]);

  const closeLinkDialog = useCallback((): void => {
    setLinkDialogState(null);
    window.setTimeout(() => {
      editor.focus();
    }, 0);
  }, [editor]);

  const openLinkDialog = useCallback((): void => {
    const visibleWorkspaceTree = createVisibleEditorLinkTree(
      workspaceTree,
      workspaceRoot,
    );

    setLinkDialogState(
      createInitialLinkDialogState(path, text, visibleWorkspaceTree),
    );
  }, [path, text, workspaceRoot, workspaceTree]);

  const applyFrontmatterChange = useCallback(
    (raw: string): void => {
      const nextMarkdown = composeMarkdownWithFrontmatter(
        draftMarkdownDocument,
        draftMarkdownDocument.body,
        raw,
      );

      hasLocalChangesRef.current = true;
      onMarkdownChange(nextMarkdown);
    },
    [draftMarkdownDocument, onMarkdownChange],
  );

  const insertEditorLink = useCallback(
    (href: string, displayText?: string): void => {
      const normalizedHref = href.trim();

      if (normalizedHref.length === 0) {
        return;
      }

      const selectedText = editor.getSelectedText().trim();
      const linkText =
        selectedText.length > 0
          ? selectedText
          : (displayText ?? getEntryName(normalizedHref));

      hasLocalChangesRef.current = true;
      editor.createLink(normalizedHref, linkText);
      closeLinkDialog();
      window.setTimeout(() => {
        void saveMarkdown();
      }, 0);
    },
    [closeLinkDialog, editor, saveMarkdown],
  );

  const createLinkedMarkdown = useCallback(async (): Promise<void> => {
    if (!linkDialogState || !onCreateLinkedMarkdown) {
      return;
    }

    const trimmedName = linkDialogState.newDocumentName.trim();

    if (trimmedName.length === 0) {
      setLinkDialogState({
        ...linkDialogState,
        errorMessage: text("editor.linkNewDocumentNameRequired"),
      });
      return;
    }

    try {
      const targetFilePath = await onCreateLinkedMarkdown(
        joinWorkspacePath(
          linkDialogState.newDocumentDirectoryPath,
          ensureMarkdownExtension(trimmedName),
        ),
      );
      const relativeHref = createRelativeMarkdownLink(path, targetFilePath);

      insertEditorLink(relativeHref, getEntryName(targetFilePath));
    } catch (error) {
      setLinkDialogState({
        ...linkDialogState,
        errorMessage: getErrorMessage(
          error,
          text("errors.createMarkdownFileFailed"),
        ),
      });
    }
  }, [insertEditorLink, linkDialogState, onCreateLinkedMarkdown, path, text]);

  const submitLinkDialog = useCallback((): void => {
    if (!linkDialogState) {
      return;
    }

    if (linkDialogState.mode === "new-document") {
      void createLinkedMarkdown();
      return;
    }

    const selectedSuggestion =
      linkSuggestions[linkDialogState.selectedSuggestionIndex] ??
      linkSuggestions[0];

    if (selectedSuggestion) {
      insertEditorLink(
        selectedSuggestion.relativePath,
        getEntryName(selectedSuggestion.path),
      );
      return;
    }

    insertEditorLink(linkDialogState.hrefInput, linkDialogState.hrefInput);
  }, [
    createLinkedMarkdown,
    insertEditorLink,
    linkDialogState,
    linkSuggestions,
  ]);

  const handleLinkInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>): void => {
      if (!linkDialogState) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeLinkDialog();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setLinkDialogState({
          ...linkDialogState,
          selectedSuggestionIndex:
            linkSuggestions.length === 0
              ? 0
              : (linkDialogState.selectedSuggestionIndex + 1) %
                linkSuggestions.length,
        });
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setLinkDialogState({
          ...linkDialogState,
          selectedSuggestionIndex:
            linkSuggestions.length === 0
              ? 0
              : (linkDialogState.selectedSuggestionIndex -
                  1 +
                  linkSuggestions.length) %
                linkSuggestions.length,
        });
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        submitLinkDialog();
      }
    },
    [closeLinkDialog, linkDialogState, linkSuggestions, submitLinkDialog],
  );

  const linkSlashMenuItems = useCallback(
    (query: string): Promise<DefaultReactSuggestionItem[]> => {
      const defaultItems = getDefaultReactSlashMenuItems(editor);
      const linkItem: DefaultReactSuggestionItem = {
        aliases: ["href", "url", "markdown"],
        icon: <LinkIcon aria-hidden="true" size={18} />,
        onItemClick: openLinkDialog,
        subtext: text("editor.linkSlashDescription"),
        title: text("editor.linkSlashTitle"),
      };

      return Promise.resolve(
        filterSuggestionItems([linkItem, ...defaultItems], query),
      );
    },
    [editor, openLinkDialog, text],
  );

  useImperativeHandle(
    ref,
    () => ({
      getMarkdown: serializeMarkdown,
    }),
    [serializeMarkdown],
  );

  useEffect(() => {
    let isCurrent = true;

    const loadMarkdown = async (): Promise<void> => {
      try {
        if (
          hasLocalChangesRef.current &&
          markdown === latestDraftMarkdownRef.current
        ) {
          return;
        }

        const blocks = await importMarkdownToBlocks(editor, editorMarkdown);

        if (!isCurrent) {
          return;
        }

        isHydratingRef.current = true;
        replaceEditorDocumentWithoutUndoHistory(editor, blocks as Block[]);
        setParseErrorMessage(null);
        window.setTimeout(() => {
          if (isCurrent) {
            isHydratingRef.current = false;
          }
        }, 0);
      } catch (error) {
        if (isCurrent) {
          isHydratingRef.current = false;
          setParseErrorMessage(
            getErrorMessage(error, text("errors.markdownParseFailed")),
          );
        }
      }
    };

    void loadMarkdown();

    return () => {
      isCurrent = false;
      isHydratingRef.current = false;
    };
  }, [editor, editorMarkdown, markdown, text]);

  useEffect(() => {
    latestDraftMarkdownRef.current = draftMarkdown;
  }, [draftMarkdown]);

  useEffect(() => {
    hasLocalChangesRef.current = false;
  }, [markdown, path, workspaceRoot]);

  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      return;
    }

    const surfaceElement = shellRef.current?.querySelector<HTMLElement>(
      ".markdown-editor-surface",
    );

    if (!surfaceElement) {
      return;
    }

    const observer = new MutationObserver(() => {
      setSearchRevision((currentRevision) => currentRevision + 1);
    });

    observer.observe(surfaceElement, {
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [searchQuery]);

  useEffect(() => {
    const surfaceElement =
      shellRef.current?.querySelector<HTMLElement>(
        ".markdown-editor-surface",
      ) ?? null;
    const ranges = surfaceElement
      ? createSearchRanges(surfaceElement, searchQuery)
      : [];
    const activeMatchIndex =
      ranges.length === 0
        ? -1
        : Math.min(Math.max(activeSearchMatchIndex, 0), ranges.length - 1);
    const runtime = globalThis as HighlightRuntime;
    const Highlight = runtime.Highlight;
    const registry = runtime.CSS?.highlights;

    onSearchStateChange({
      activeMatchIndex,
      matchCount: ranges.length,
    });
    clearSearchHighlights();

    if (!Highlight || !registry || searchQuery.trim().length === 0) {
      return clearSearchHighlights;
    }

    const activeRange =
      activeMatchIndex >= 0 && activeMatchIndex < ranges.length
        ? ranges[activeMatchIndex]
        : null;
    const inactiveRanges = activeRange
      ? ranges.filter((range) => range !== activeRange)
      : ranges;

    registry.set(SEARCH_MATCH_HIGHLIGHT_NAME, new Highlight(...inactiveRanges));

    if (ranges.length > 0 && activeMatchIndex >= 0) {
      registry.set(
        SEARCH_ACTIVE_HIGHLIGHT_NAME,
        activeRange ? new Highlight(activeRange) : new Highlight(),
      );
      const activeElement = activeRange?.startContainer.parentElement;

      if (typeof activeElement?.scrollIntoView === "function") {
        activeElement.scrollIntoView({
          block: "center",
          inline: "nearest",
        });
      }
    }

    return clearSearchHighlights;
  }, [
    activeSearchMatchIndex,
    onSearchStateChange,
    searchQuery,
    searchRevision,
  ]);

  const saveMarkdownOnBlur = useCallback(
    (event: ReactFocusEvent<HTMLDivElement>): void => {
      const nextFocusedElement = event.relatedTarget;

      if (
        nextFocusedElement instanceof Node &&
        event.currentTarget.contains(nextFocusedElement)
      ) {
        return;
      }

      void saveMarkdown();
    },
    [saveMarkdown],
  );

  return (
    <div
      className="markdown-editor-shell"
      data-testid="markdown-block-editor"
      onBlur={saveMarkdownOnBlur}
      ref={shellRef}
    >
      <div className="markdown-editor-titlebar">
        <div className="markdown-editor-file-state">
          <span className="markdown-editor-path">{path}</span>
          {isSaving ? (
            <span
              aria-live="polite"
              className="markdown-editor-save-state"
              role="status"
            >
              {text("editor.saving")}
            </span>
          ) : isDirty ? (
            <span
              aria-live="polite"
              className="markdown-editor-dirty-state"
              role="status"
            >
              {text("editor.unsavedChanges")}
            </span>
          ) : null}
        </div>
      </div>
      {parseErrorMessage ? (
        <p className="markdown-editor-error" role="alert">
          {parseErrorMessage}
        </p>
      ) : null}
      {serializationErrorMessage ? (
        <p className="markdown-editor-error" role="alert">
          {serializationErrorMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="markdown-editor-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {!isReadOnly ? (
        <MermaidFlowchartPanel
          colorScheme={colorScheme}
          markdown={draftMarkdownDocument.body}
          onMarkdownChange={(bodyMarkdown) => {
            hasLocalChangesRef.current = true;
            onMarkdownChange(
              composeMarkdownWithFrontmatter(
                draftMarkdownDocument,
                bodyMarkdown,
              ),
            );
          }}
          text={text}
        />
      ) : null}
      {draftMarkdownDocument.frontmatter ? (
        <FrontmatterPanel
          frontmatter={draftMarkdownDocument.frontmatter}
          isReadOnly={isReadOnly}
          onApply={applyFrontmatterChange}
          text={text}
        />
      ) : null}
      <BlockNoteView
        className="markdown-editor-surface"
        data-testid="blocknote-view"
        editable={!isReadOnly}
        editor={editor}
        onChange={(changedEditor) => {
          if (isReadOnly || isHydratingRef.current) {
            return;
          }

          hasLocalChangesRef.current = true;
          void exportBlocksToMarkdown(changedEditor, changedEditor.document)
            .then((contents) => {
              const portableContents = prepareMarkdownForStorage(
                contents,
                assetContext,
              );
              const bodyMarkdown = replaceMermaidBlocksFromSource(
                portableContents,
                draftMarkdownDocument.body,
              );

              setSerializationErrorMessage(null);
              onMarkdownChange(
                composeMarkdownWithFrontmatter(
                  draftMarkdownDocument,
                  bodyMarkdown,
                ),
              );
            })
            .catch((error: unknown) => {
              setSerializationErrorMessage(
                getErrorMessage(error, text("errors.markdownSerializeFailed")),
              );
            });
        }}
        slashMenu={false}
        theme={colorScheme}
      >
        {!isReadOnly ? (
          <SuggestionMenuController
            getItems={linkSlashMenuItems}
            triggerCharacter="/"
          />
        ) : null}
      </BlockNoteView>
      {linkDialogState ? (
        <div
          aria-label={text("editor.linkDialogTitle")}
          aria-modal="true"
          className="editor-link-dialog-backdrop"
          role="dialog"
        >
          <section className="editor-link-dialog">
            <div className="editor-link-dialog-header">
              <div>
                <p className="editor-link-dialog-kicker">
                  {text("editor.linkDialogKicker")}
                </p>
                <h2>{text("editor.linkDialogTitle")}</h2>
              </div>
              <button
                aria-label={text("editor.linkDialogClose")}
                className="editor-link-icon-button"
                onClick={closeLinkDialog}
                type="button"
              >
                <X aria-hidden="true" size={16} />
              </button>
            </div>
            <div className="editor-link-mode-tabs" role="tablist">
              <button
                aria-selected={linkDialogState.mode === "insert"}
                className={
                  linkDialogState.mode === "insert" ? "is-active" : ""
                }
                onClick={() => {
                  setLinkDialogState({
                    ...linkDialogState,
                    errorMessage: null,
                    mode: "insert",
                  });
                }}
                role="tab"
                type="button"
              >
                {text("editor.linkExistingDocument")}
              </button>
              <button
                aria-selected={linkDialogState.mode === "new-document"}
                className={
                  linkDialogState.mode === "new-document" ? "is-active" : ""
                }
                onClick={() => {
                  setLinkDialogState({
                    ...linkDialogState,
                    errorMessage: null,
                    mode: "new-document",
                  });
                }}
                role="tab"
                type="button"
              >
                <FilePlus2 aria-hidden="true" size={14} />
                {text("editor.linkNewDocument")}
              </button>
            </div>
            {linkDialogState.mode === "insert" ? (
              <div className="editor-link-picker-panel">
                <label className="editor-link-field">
                  <span>{text("editor.linkTarget")}</span>
                  <input
                    aria-label={text("editor.linkTarget")}
                    autoFocus
                    onChange={(event) => {
                      setLinkDialogState({
                        ...linkDialogState,
                        hrefInput: event.target.value,
                        selectedSuggestionIndex: 0,
                      });
                    }}
                    onKeyDown={handleLinkInputKeyDown}
                    placeholder={text("editor.linkTargetPlaceholder")}
                    value={linkDialogState.hrefInput}
                  />
                </label>
                <div
                  aria-label={text("editor.linkSuggestions")}
                  className="editor-link-suggestion-list"
                  role="listbox"
                >
                  {linkSuggestions.length > 0 ? (
                    linkSuggestions.map((suggestion, index) => (
                      <button
                        aria-selected={
                          index === linkDialogState.selectedSuggestionIndex
                        }
                        className={
                          index === linkDialogState.selectedSuggestionIndex
                            ? "editor-link-suggestion is-active"
                            : "editor-link-suggestion"
                        }
                        key={suggestion.path}
                        onClick={() => {
                          insertEditorLink(
                            suggestion.relativePath,
                            getEntryName(suggestion.path),
                          );
                        }}
                        role="option"
                        type="button"
                      >
                        <span>{suggestion.path}</span>
                        <small>{suggestion.relativePath}</small>
                      </button>
                    ))
                  ) : (
                    <p className="editor-link-empty">
                      {text("editor.linkNoSuggestions")}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <form
                className="editor-link-new-document-panel"
                onSubmit={(event) => {
                  event.preventDefault();
                  void createLinkedMarkdown();
                }}
              >
                <div
                  aria-label={text("editor.linkDirectoryTree")}
                  className="editor-link-directory-tree"
                  role="tree"
                >
                  {directoryOptions.map((directory) => (
                    <button
                      aria-expanded={
                        directory.hasChildDirectories
                          ? directory.isExpanded
                          : undefined
                      }
                      aria-selected={
                        directory.path ===
                        linkDialogState.newDocumentDirectoryPath
                      }
                      className={
                        directory.path ===
                        linkDialogState.newDocumentDirectoryPath
                          ? "editor-link-directory is-active"
                          : "editor-link-directory"
                      }
                      key={directory.path || "__root__"}
                      onClick={() => {
                        const expandedDirectoryPaths = new Set(
                          linkDialogState.expandedDirectoryPaths,
                        );

                        if (
                          directory.path.length > 0 &&
                          directory.hasChildDirectories
                        ) {
                          if (directory.isExpanded) {
                            expandedDirectoryPaths.delete(directory.path);
                          } else {
                            expandedDirectoryPaths.add(directory.path);
                          }
                        }

                        setLinkDialogState({
                          ...linkDialogState,
                          errorMessage: null,
                          expandedDirectoryPaths,
                          newDocumentDirectoryPath: directory.path,
                        });
                      }}
                      onDoubleClick={() => {
                        const input = document.querySelector<HTMLInputElement>(
                          ".editor-link-new-document-name input",
                        );

                        input?.focus();
                        input?.select();
                      }}
                      role="treeitem"
                      style={
                        { "--depth": directory.depth } as CSSProperties
                      }
                      type="button"
                    >
                      <span className="editor-link-directory-icon">
                        {directory.hasChildDirectories ? (
                          directory.isExpanded ? (
                            <ChevronDown aria-hidden="true" size={14} />
                          ) : (
                            <ChevronRight aria-hidden="true" size={14} />
                          )
                        ) : null}
                      </span>
                      <span className="editor-link-directory-name">
                        {directory.name}
                      </span>
                    </button>
                  ))}
                </div>
                <label className="editor-link-field editor-link-new-document-name">
                  <span>{text("editor.linkNewDocumentName")}</span>
                  <input
                    aria-label={text("editor.linkNewDocumentName")}
                    onChange={(event) => {
                      setLinkDialogState({
                        ...linkDialogState,
                        errorMessage: null,
                        newDocumentName: event.target.value,
                      });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        closeLinkDialog();
                      }
                    }}
                    value={linkDialogState.newDocumentName}
                  />
                </label>
                <button className="editor-link-primary-button" type="submit">
                  {text("editor.linkCreateAndInsert")}
                </button>
              </form>
            )}
            {linkDialogState.errorMessage ? (
              <p className="editor-link-error" role="alert">
                {linkDialogState.errorMessage}
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
});
