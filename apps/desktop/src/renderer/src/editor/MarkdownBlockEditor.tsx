import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BlockNoteSchema,
  createCodeBlockSpec,
  defaultBlockSpecs,
  type Block,
} from "@blocknote/core";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import { BlockNoteView } from "@blocknote/mantine";
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
  RotateCcw,
  X,
} from "lucide-react";
import {
  chooseMarkdownContentsToSave,
  collectExpandedLinkDirectoryOptions,
  createEditorCodeHighlighter,
  createInitialLinkDialogState,
  createSearchRanges,
  EDITOR_COMPONENT_IDS as COMPONENT_IDS,
  ensureMarkdownExtension,
  getEditorLinkEntryName,
  exportBlocksToMarkdown,
  FrontmatterPanel,
  importMarkdownToBlocks,
  isEditorSearchMutationRelevant,
  joinWorkspacePath,
  MermaidFlowchartPanel,
  PASSTHROUGH_MARKDOWN_ASSET_RESOLVER,
  moveLinkDialogSuggestionSelection,
  normalizeImportedCodeBlockLanguages,
  prepareMarkdownForEditor,
  prepareMarkdownForStorage,
  replaceEditorDocumentWithoutUndoHistory,
  selectLinkDialogDirectory,
  setLinkDialogError,
  setLinkDialogMode,
  shouldClearLocalChangesAfterUnchangedSave,
  shouldImportMarkdownIntoEditor,
  shouldRetryUnchangedSave,
  SUPPORTED_CODE_LANGUAGES,
  type EditorLineSpacing,
  type EditorText,
  type LinkDialogState,
  type LinkDirectoryOption,
  updateLinkDialogHref,
  updateLinkDialogNewDocumentName,
} from "@mde/editor-react";
import type { MarkdownAssetResolver } from "@mde/editor-core/assets";
import {
  collectMarkdownFilePaths,
  createMarkdownPathSuggestions,
  createRelativeMarkdownLink,
  isSupportedMarkdownLinkHref as isSupportedEditorLinkHref,
} from "@mde/editor-core/links";

import { replaceMermaidBlocksFromSource } from "@mde/editor-core/flowcharts";
import {
  composeMarkdownWithFrontmatter,
  splitMarkdownFrontmatter,
} from "@mde/editor-core/frontmatter";
import type { TreeNode } from "@mde/editor-host/file-tree";

type CreateVisibleLinkWorkspaceTree = (
  nodes: readonly TreeNode[],
  workspaceRoot: string,
) => readonly TreeNode[];

const defaultCreateVisibleLinkWorkspaceTree: CreateVisibleLinkWorkspaceTree = (
  nodes,
) => nodes;

interface MarkdownBlockEditorProps {
  readonly activeSearchMatchIndex?: number;
  readonly colorScheme: "dark" | "light";
  readonly createVisibleLinkWorkspaceTree?: CreateVisibleLinkWorkspaceTree;
  readonly draftMarkdown: string;
  readonly errorMessage: string | null;
  readonly historyPreview?: {
    readonly createdAtLabel: string;
    readonly eventLabel: string;
    readonly sourcePath?: string;
  } | null;
  readonly isDirty: boolean;
  readonly isReadOnly?: boolean;
  readonly isSaving: boolean;
  readonly lineSpacing?: EditorLineSpacing;
  readonly markdown: string;
  readonly markdownAssetResolver?: MarkdownAssetResolver;
  readonly markdownFilePaths?: readonly string[];
  readonly onCreateLinkedMarkdown?: (filePath: string) => Promise<string>;
  readonly onExitHistoryPreview?: () => void;
  readonly onImageUpload: (file: File) => Promise<string>;
  readonly onOpenLink?: (href: string) => void;
  readonly onMarkdownChange: (contents: string) => void;
  readonly onRestoreHistoryPreview?: () => void;
  readonly onSaveRequest: (contents: string) => void | Promise<void>;
  readonly onSearchStateChange?: (state: {
    readonly activeMatchIndex: number;
    readonly matchCount: number;
  }) => void;
  readonly path: string;
  readonly pinnedSearchQueries?: readonly string[];
  readonly searchQuery?: string;
  readonly text: EditorText;
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

const SEARCH_MATCH_HIGHLIGHT_NAME = "mde-editor-search-match";
const SEARCH_ACTIVE_HIGHLIGHT_NAME = "mde-editor-search-active";
const SEARCH_PIN_HIGHLIGHT_NAMES = [
  "mde-editor-search-pin-0",
  "mde-editor-search-pin-1",
  "mde-editor-search-pin-2",
  "mde-editor-search-pin-3",
  "mde-editor-search-pin-4",
  "mde-editor-search-pin-5",
];
const LINK_SUGGESTION_LIMIT = 20;
const BLUR_SAVE_SETTLE_DELAY_MS = 50;
const BLUR_SAVE_RETRY_DELAY_MS = 100;
const BLUR_SAVE_UNCHANGED_RETRY_LIMIT = 20;
const createEditorCodeBlockSpec = (): ReturnType<typeof createCodeBlockSpec> => {
  const baseCodeBlockSpec = createCodeBlockSpec({
    createHighlighter: createEditorCodeHighlighter,
    defaultLanguage: "text",
    supportedLanguages: SUPPORTED_CODE_LANGUAGES,
  });

  return {
    ...baseCodeBlockSpec,
    implementation: {
      ...baseCodeBlockSpec.implementation,
      render: (block, editor) => {
        const rendered = baseCodeBlockSpec.implementation.render.call(
          {},
          block,
          editor,
        );

        if (block.props.language !== "mermaid") {
          return rendered;
        }

        const previewTarget = document.createElement("div");
        previewTarget.className = "mermaid-flowchart-inline-target";
        previewTarget.contentEditable = "false";
        previewTarget.dataset.mermaidFlowchartTarget = "true";
        rendered.dom.appendChild(previewTarget);

        return {
          ...rendered,
          ignoreMutation: (mutation) =>
            previewTarget.contains(mutation.target) ||
            rendered.ignoreMutation?.(mutation) === true,
        };
      },
    },
  };
};

const editorSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    codeBlock: createEditorCodeBlockSpec(),
  },
});

const clearSearchHighlights = (): void => {
  const registry = (globalThis as HighlightRuntime).CSS?.highlights;

  registry?.delete(SEARCH_MATCH_HIGHLIGHT_NAME);
  registry?.delete(SEARCH_ACTIVE_HIGHLIGHT_NAME);
  SEARCH_PIN_HIGHLIGHT_NAMES.forEach((highlightName) => {
    registry?.delete(highlightName);
  });
};

export const MarkdownBlockEditor = forwardRef<
  MarkdownBlockEditorHandle,
  MarkdownBlockEditorProps
>(function MarkdownBlockEditor(
  {
    activeSearchMatchIndex = -1,
    colorScheme,
    createVisibleLinkWorkspaceTree = defaultCreateVisibleLinkWorkspaceTree,
    errorMessage,
    draftMarkdown,
    historyPreview = null,
    isDirty,
    isReadOnly = false,
    isSaving,
    lineSpacing = "standard",
    markdownFilePaths = [],
    markdownAssetResolver = PASSTHROUGH_MARKDOWN_ASSET_RESOLVER,
    markdown,
    onCreateLinkedMarkdown,
    onExitHistoryPreview = () => undefined,
    onImageUpload,
    onOpenLink = () => undefined,
    onMarkdownChange,
    onRestoreHistoryPreview = () => undefined,
    onSaveRequest,
    onSearchStateChange = () => undefined,
    path,
    pinnedSearchQueries = [],
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
      schema: editorSchema,
      uploadFile: onImageUpload,
    },
    [onImageUpload],
  );
  const isHydratingRef = useRef(false);
  const hasLocalChangesRef = useRef(false);
  const pendingSaveAfterCurrentRef = useRef(false);
  const pendingBlurSaveTimeoutRef = useRef<number | null>(null);
  const latestDraftMarkdownRef = useRef(draftMarkdown);
  const lastSerializedEditorMarkdownRef = useRef<string | null>(null);
  const textRef = useRef(text);
  const previousTextRef = useRef(text);
  const documentIdentity = useMemo(
    () => `${workspaceRoot}:${path}`,
    [path, workspaceRoot],
  );
  const activeDocumentIdentityRef = useRef(documentIdentity);
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
  useEffect(() => {
    textRef.current = text;
  }, [text]);
  const persistedMarkdownDocument = useMemo(
    () => splitMarkdownFrontmatter(markdown),
    [markdown],
  );
  const draftMarkdownDocument = useMemo(
    () => splitMarkdownFrontmatter(draftMarkdown),
    [draftMarkdown],
  );
  const editorMarkdown = useMemo(
    () =>
      prepareMarkdownForEditor(
        persistedMarkdownDocument.body,
        markdownAssetResolver,
      ),
    [markdownAssetResolver, persistedMarkdownDocument.body],
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
    const exportedMarkdown = await exportBlocksToMarkdown(editor, editor.document);
    const portableMarkdown = prepareMarkdownForStorage(
      exportedMarkdown,
      markdownAssetResolver,
    );
    const bodyMarkdown = replaceMermaidBlocksFromSource(
      portableMarkdown,
      draftMarkdownDocument.body,
    );

    return composeMarkdownWithFrontmatter(draftMarkdownDocument, bodyMarkdown);
  }, [draftMarkdownDocument, editor, markdownAssetResolver]);

  const saveMarkdown = useCallback(async (options: {
    readonly preserveLocalChangesWhenUnchanged?: boolean;
    readonly retryUnchangedCount?: number;
  } = {}): Promise<void> => {
    if (isReadOnly || !hasLocalChangesRef.current) {
      return;
    }

    if (isSaving) {
      pendingSaveAfterCurrentRef.current = true;
      return;
    }

    try {
      const contents = await serializeMarkdown();
      const latestDraftMarkdown = latestDraftMarkdownRef.current;
      const contentsToSave = chooseMarkdownContentsToSave({
        currentMarkdown: markdown,
        lastSerializedEditorMarkdown: lastSerializedEditorMarkdownRef.current,
        latestDraftMarkdown,
        serializedMarkdown: contents,
      });

      if (contentsToSave === markdown) {
        if (
          shouldRetryUnchangedSave({
            contentsToSave,
            currentMarkdown: markdown,
            preserveLocalChangesWhenUnchanged:
              options.preserveLocalChangesWhenUnchanged,
            retryUnchangedCount: options.retryUnchangedCount,
          })
        ) {
          window.setTimeout(() => {
            void saveMarkdown({
              preserveLocalChangesWhenUnchanged: true,
              retryUnchangedCount: (options.retryUnchangedCount ?? 0) - 1,
            });
          }, BLUR_SAVE_RETRY_DELAY_MS);
          return;
        }

        if (
          shouldClearLocalChangesAfterUnchangedSave({
            preserveLocalChangesWhenUnchanged:
              options.preserveLocalChangesWhenUnchanged,
          })
        ) {
          hasLocalChangesRef.current = false;
        }
        return;
      }

      setSerializationErrorMessage(null);
      await onSaveRequest(contentsToSave);
      lastSerializedEditorMarkdownRef.current = contentsToSave;
      pendingSaveAfterCurrentRef.current = false;
      hasLocalChangesRef.current = false;
    } catch (error) {
      setSerializationErrorMessage(
        getErrorMessage(error, text("errors.markdownSerializeFailed")),
      );
    }
  }, [isReadOnly, isSaving, markdown, onSaveRequest, serializeMarkdown, text]);

  useEffect(() => {
    if (isSaving || !pendingSaveAfterCurrentRef.current) {
      return;
    }

    pendingSaveAfterCurrentRef.current = false;
    void saveMarkdown();
  }, [isSaving, saveMarkdown]);

  const closeLinkDialog = useCallback((): void => {
    setLinkDialogState(null);
    window.setTimeout(() => {
      editor.focus();
    }, 0);
  }, [editor]);

  useEffect(() => {
    if (!linkDialogState) {
      return undefined;
    }

    const closeLinkDialogOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      closeLinkDialog();
    };

    window.addEventListener("keydown", closeLinkDialogOnEscape);

    return () => {
      window.removeEventListener("keydown", closeLinkDialogOnEscape);
    };
  }, [closeLinkDialog, linkDialogState]);

  const openLinkDialog = useCallback((): void => {
    const visibleWorkspaceTree = createVisibleLinkWorkspaceTree(
      workspaceTree,
      workspaceRoot,
    );

    setLinkDialogState(
      createInitialLinkDialogState({
        currentFilePath: path,
        defaultNewDocumentName: text("editor.linkNewDocumentDefaultName"),
        visibleWorkspaceTree,
      }),
    );
  }, [
    createVisibleLinkWorkspaceTree,
    path,
    text,
    workspaceRoot,
    workspaceTree,
  ]);

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
          : (displayText ?? getEditorLinkEntryName(normalizedHref));

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
      setLinkDialogState(
        setLinkDialogError(
          linkDialogState,
          text("editor.linkNewDocumentNameRequired"),
        ),
      );
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

      insertEditorLink(relativeHref, getEditorLinkEntryName(targetFilePath));
    } catch (error) {
      setLinkDialogState(
        setLinkDialogError(
          linkDialogState,
          getErrorMessage(error, text("errors.createMarkdownFileFailed")),
        ),
      );
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
        getEditorLinkEntryName(selectedSuggestion.path),
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
        setLinkDialogState(
          moveLinkDialogSuggestionSelection(
            linkDialogState,
            1,
            linkSuggestions.length,
          ),
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setLinkDialogState(
          moveLinkDialogSuggestionSelection(
            linkDialogState,
            -1,
            linkSuggestions.length,
          ),
        );
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

  const hydrateEditorFromMarkdown = useCallback(
    async (isCurrent: () => boolean): Promise<void> => {
      try {
        const blocks = normalizeImportedCodeBlockLanguages(
          await importMarkdownToBlocks(editor, editorMarkdown),
        );

        if (!isCurrent()) {
          return;
        }

        isHydratingRef.current = true;
        replaceEditorDocumentWithoutUndoHistory(editor, blocks as Block[]);
        lastSerializedEditorMarkdownRef.current = markdown;
        setParseErrorMessage(null);
        window.setTimeout(() => {
          if (isCurrent()) {
            isHydratingRef.current = false;
          }
        }, 0);
      } catch (error) {
        if (isCurrent()) {
          isHydratingRef.current = false;
          setParseErrorMessage(
            getErrorMessage(
              error,
              textRef.current("errors.markdownParseFailed"),
            ),
          );
        }
      }
    },
    [editor, editorMarkdown, markdown],
  );

  useImperativeHandle(
    ref,
    () => ({
      getMarkdown: serializeMarkdown,
    }),
    [serializeMarkdown],
  );

  useEffect(() => {
    if (activeDocumentIdentityRef.current === documentIdentity) {
      return;
    }

    activeDocumentIdentityRef.current = documentIdentity;
    pendingSaveAfterCurrentRef.current = false;
    hasLocalChangesRef.current = false;
    lastSerializedEditorMarkdownRef.current = null;
  }, [documentIdentity]);

  useEffect(() => {
    let isCurrent = true;

    const loadMarkdown = async (): Promise<void> => {
      if (
        !shouldImportMarkdownIntoEditor({
          hasLocalChanges: hasLocalChangesRef.current,
          lastSerializedEditorMarkdown: lastSerializedEditorMarkdownRef.current,
          markdown,
        })
      ) {
        setParseErrorMessage(null);
        return;
      }

      await hydrateEditorFromMarkdown(() => isCurrent);
    };

    void loadMarkdown();

    return () => {
      isCurrent = false;
      isHydratingRef.current = false;
    };
  }, [documentIdentity, hydrateEditorFromMarkdown, markdown]);

  useEffect(() => {
    if (previousTextRef.current === text) {
      return undefined;
    }

    previousTextRef.current = text;
    let isCurrent = true;

    void hydrateEditorFromMarkdown(() => isCurrent);

    return () => {
      isCurrent = false;
      isHydratingRef.current = false;
    };
  }, [hydrateEditorFromMarkdown, text]);

  useEffect(() => {
    latestDraftMarkdownRef.current = draftMarkdown;
  }, [draftMarkdown]);

  useEffect(() => {
    if (isDirty || draftMarkdown !== markdown) {
      return;
    }

    pendingSaveAfterCurrentRef.current = false;
    hasLocalChangesRef.current = false;
  }, [draftMarkdown, isDirty, markdown]);

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

    const observer = new MutationObserver((mutations) => {
      if (!isEditorSearchMutationRelevant(mutations)) {
        return;
      }

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

    if (!Highlight || !registry) {
      return clearSearchHighlights;
    }

    pinnedSearchQueries
      .map((query) => query.trim())
      .filter((query) => query.length > 0)
      .slice(0, SEARCH_PIN_HIGHLIGHT_NAMES.length)
      .forEach((query, index) => {
        const pinnedRanges = surfaceElement
          ? createSearchRanges(surfaceElement, query)
          : [];

        if (pinnedRanges.length > 0) {
          registry.set(
            SEARCH_PIN_HIGHLIGHT_NAMES[index],
            new Highlight(...pinnedRanges),
          );
        }
      });

    if (searchQuery.trim().length === 0) {
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
    pinnedSearchQueries,
    searchQuery,
    searchRevision,
  ]);

  useEffect(() => {
    if (isReadOnly) {
      return;
    }

    const scheduleSaveAfterLeavingEditor = (): void => {
      if (pendingBlurSaveTimeoutRef.current !== null) {
        window.clearTimeout(pendingBlurSaveTimeoutRef.current);
      }

      pendingBlurSaveTimeoutRef.current = window.setTimeout(() => {
        pendingBlurSaveTimeoutRef.current = null;
        void saveMarkdown({
          preserveLocalChangesWhenUnchanged: true,
          retryUnchangedCount: BLUR_SAVE_UNCHANGED_RETRY_LIMIT,
        });
      }, BLUR_SAVE_SETTLE_DELAY_MS);
    };
    const handlePointerDown = (event: PointerEvent): void => {
      const shellElement = shellRef.current;
      const eventTarget = event.target;

      if (
        !shellElement ||
        !(eventTarget instanceof Node) ||
        shellElement.contains(eventTarget)
      ) {
        return;
      }

      scheduleSaveAfterLeavingEditor();
    };
    const handleFocusOut = (event: FocusEvent): void => {
      const shellElement = shellRef.current;
      const nextFocusedElement = event.relatedTarget;

      if (
        !shellElement ||
        (nextFocusedElement instanceof Node &&
          shellElement.contains(nextFocusedElement))
      ) {
        return;
      }

      scheduleSaveAfterLeavingEditor();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("focusout", handleFocusOut, true);

    return () => {
      if (pendingBlurSaveTimeoutRef.current !== null) {
        window.clearTimeout(pendingBlurSaveTimeoutRef.current);
        pendingBlurSaveTimeoutRef.current = null;
      }

      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("focusout", handleFocusOut, true);
    };
  }, [isReadOnly, saveMarkdown]);
  const markEditorInput = useCallback((): void => {
    if (isReadOnly || isHydratingRef.current) {
      return;
    }

    hasLocalChangesRef.current = true;
  }, [isReadOnly]);
  const selectAllEditorContent = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>): void => {
      if (
        event.key.toLocaleLowerCase() !== "a" ||
        !(event.metaKey || event.ctrlKey) ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }

      const eventTarget = event.target;

      if (
        eventTarget instanceof HTMLInputElement ||
        eventTarget instanceof HTMLTextAreaElement ||
        eventTarget instanceof HTMLSelectElement
      ) {
        return;
      }

      event.preventDefault();
      editor._tiptapEditor.commands.selectAll();
    },
    [editor],
  );

  useEffect(() => {
    if (isReadOnly || !isDirty || isSaving) {
      return;
    }

    const activeElement = document.activeElement;

    if (
      activeElement instanceof Node &&
      shellRef.current?.contains(activeElement)
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveMarkdown();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [draftMarkdown, isDirty, isReadOnly, isSaving, saveMarkdown]);

  return (
    <div
      className="markdown-editor-shell"
      data-component-id={COMPONENT_IDS.editor.markdownEditorShell}
      data-testid="markdown-block-editor"
      ref={shellRef}
    >
      <div
        className="markdown-editor-titlebar"
        data-component-id={COMPONENT_IDS.editor.titlebar}
      >
        <div className="markdown-editor-file-state">
          <span
            className="markdown-editor-path"
            data-component-id={COMPONENT_IDS.editor.documentPathLabel}
          >
            {path}
          </span>
          {isSaving ? (
            <span
              aria-live="polite"
              className="markdown-editor-save-state"
              data-component-id={COMPONENT_IDS.editor.saveStateIndicator}
              role="status"
            >
              {text("editor.saving")}
            </span>
          ) : isDirty ? (
            <span
              aria-live="polite"
              className="markdown-editor-dirty-state"
              data-component-id={COMPONENT_IDS.editor.saveStateIndicator}
              role="status"
            >
              {text("editor.unsavedChanges")}
            </span>
          ) : null}
        </div>
        <div className="markdown-editor-titlebar-actions">
          {historyPreview ? (
            <>
              <button
                className="markdown-editor-secondary-button"
                data-component-id={COMPONENT_IDS.editor.exitHistoryPreviewButton}
                onClick={onExitHistoryPreview}
                type="button"
              >
                {text("history.exitPreview")}
              </button>
              <button
                className="markdown-editor-primary-button"
                data-component-id={COMPONENT_IDS.editor.restoreThisVersionButton}
                onClick={onRestoreHistoryPreview}
                type="button"
              >
                <RotateCcw aria-hidden="true" size={15} />
                {text("history.restoreThisVersion")}
              </button>
            </>
          ) : null}
        </div>
      </div>
      {historyPreview ? (
        <section
          aria-live="polite"
          className="markdown-editor-history-preview-banner"
          data-component-id={COMPONENT_IDS.editor.historyPreviewBanner}
          role="status"
        >
          <strong>{text("history.readOnlyPreview")}</strong>
          <span>
            {historyPreview.eventLabel} · {historyPreview.createdAtLabel}
            {historyPreview.sourcePath ? ` · ${historyPreview.sourcePath}` : ""}
          </span>
        </section>
      ) : null}
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
      {draftMarkdownDocument.frontmatter ? (
        <FrontmatterPanel
          frontmatter={draftMarkdownDocument.frontmatter}
          isReadOnly={isReadOnly}
          key={draftMarkdownDocument.frontmatter.raw}
          onApply={applyFrontmatterChange}
          text={text}
        />
      ) : null}
      <div
        className="markdown-editor-content"
        data-component-id={COMPONENT_IDS.editor.markdownEditingSurface}
        data-read-only={isReadOnly ? "true" : "false"}
        data-testid="markdown-editor-content"
        onInputCapture={markEditorInput}
        onKeyDownCapture={selectAllEditorContent}
        spellCheck={false}
      >
        <BlockNoteView
          className="markdown-editor-surface"
          data-line-spacing={lineSpacing}
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
                  markdownAssetResolver,
                );
                const bodyMarkdown = replaceMermaidBlocksFromSource(
                  portableContents,
                  draftMarkdownDocument.body,
                );
                const nextMarkdown = composeMarkdownWithFrontmatter(
                  draftMarkdownDocument,
                  bodyMarkdown,
                );

                setSerializationErrorMessage(null);
                lastSerializedEditorMarkdownRef.current = nextMarkdown;
                onMarkdownChange(nextMarkdown);
              })
              .catch((error: unknown) => {
                setSerializationErrorMessage(
                  getErrorMessage(
                    error,
                    text("errors.markdownSerializeFailed"),
                  ),
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
      </div>
      <MermaidFlowchartPanel
        colorScheme={colorScheme}
        markdown={draftMarkdownDocument.body}
        text={text}
      />
      {linkDialogState ? (
        <div
          aria-label={text("editor.linkDialogTitle")}
          aria-modal="true"
          className="editor-link-dialog-backdrop"
          data-component-id={COMPONENT_IDS.link.pickerDialog}
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
                data-component-id={COMPONENT_IDS.link.pickerCloseButton}
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
                data-component-id={COMPONENT_IDS.link.existingLinkTab}
                onClick={() => {
                  setLinkDialogState(setLinkDialogMode(linkDialogState, "insert"));
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
                data-component-id={COMPONENT_IDS.link.newDocumentTab}
                onClick={() => {
                  setLinkDialogState(
                    setLinkDialogMode(linkDialogState, "new-document"),
                  );
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
                    data-component-id={COMPONENT_IDS.link.targetField}
                    onChange={(event) => {
                      setLinkDialogState(
                        updateLinkDialogHref(
                          linkDialogState,
                          event.target.value,
                        ),
                      );
                    }}
                    onKeyDown={handleLinkInputKeyDown}
                    placeholder={text("editor.linkTargetPlaceholder")}
                    value={linkDialogState.hrefInput}
                  />
                </label>
                <div
                  aria-label={text("editor.linkSuggestions")}
                  className="editor-link-suggestion-list"
                  data-component-id={COMPONENT_IDS.link.suggestionsList}
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
                        data-component-id={COMPONENT_IDS.link.suggestionRow}
                        key={suggestion.path}
                        onClick={() => {
                          insertEditorLink(
                            suggestion.relativePath,
                            getEditorLinkEntryName(suggestion.path),
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
                  data-component-id={COMPONENT_IDS.link.directoryTree}
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
                      data-component-id={COMPONENT_IDS.link.directoryRow}
                      key={directory.path || "__root__"}
                      onClick={() => {
                        setLinkDialogState(
                          selectLinkDialogDirectory(linkDialogState, directory),
                        );
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
                    data-component-id={COMPONENT_IDS.link.newDocumentNameField}
                    onChange={(event) => {
                      setLinkDialogState(
                        updateLinkDialogNewDocumentName(
                          linkDialogState,
                          event.target.value,
                        ),
                      );
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
                <button
                  className="editor-link-primary-button"
                  data-component-id={COMPONENT_IDS.link.createAndInsertButton}
                  type="submit"
                >
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
