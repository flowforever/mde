import {
  type FocusEvent as ReactFocusEvent,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Block } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";

import { replaceMermaidBlocksFromSource } from "./flowchartMarkdown";
import { MermaidFlowchartPanel } from "./MermaidFlowchartPanel";
import { replaceEditorDocumentWithoutUndoHistory } from "./editorHydration";
import {
  exportBlocksToMarkdown,
  importMarkdownToBlocks,
  prepareMarkdownForEditor,
  prepareMarkdownForStorage,
} from "./markdownTransforms";
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
  readonly onImageUpload: (file: File) => Promise<string>;
  readonly onMarkdownChange: (contents: string) => void;
  readonly onSaveRequest: (contents: string) => void | Promise<void>;
  readonly onSearchStateChange?: (state: {
    readonly activeMatchIndex: number;
    readonly matchCount: number;
  }) => void;
  readonly path: string;
  readonly searchQuery?: string;
  readonly text: AppText;
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
    markdown,
    onImageUpload,
    onMarkdownChange,
    onSaveRequest,
    onSearchStateChange = () => undefined,
    path,
    searchQuery = "",
    text,
    workspaceRoot,
  },
  ref,
): React.JSX.Element {
  const editor = useCreateBlockNote(
    {
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
  const [searchRevision, setSearchRevision] = useState(0);
  const assetContext = useMemo(
    () => ({
      markdownFilePath: path,
      workspaceRoot,
    }),
    [path, workspaceRoot],
  );
  const editorMarkdown = useMemo(
    () => prepareMarkdownForEditor(markdown, assetContext),
    [assetContext, markdown],
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

    return replaceMermaidBlocksFromSource(portableMarkdown, draftMarkdown);
  }, [assetContext, draftMarkdown, editor]);

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
          markdown={draftMarkdown}
          onMarkdownChange={onMarkdownChange}
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

              setSerializationErrorMessage(null);
              onMarkdownChange(
                replaceMermaidBlocksFromSource(portableContents, draftMarkdown),
              );
            })
            .catch((error: unknown) => {
              setSerializationErrorMessage(
                getErrorMessage(error, text("errors.markdownSerializeFailed")),
              );
            });
        }}
        theme={colorScheme}
      />
    </div>
  );
});
