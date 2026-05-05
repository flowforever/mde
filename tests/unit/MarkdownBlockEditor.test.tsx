import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEventHandler, KeyboardEventHandler, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { COMPONENT_IDS } from "../../apps/desktop/src/renderer/src/componentIds";
import { createVisibleEditorLinkTree } from "../../apps/desktop/src/renderer/src/editorHost/editorLinkDirectories";
import {
  createSearchRanges,
  isEditorSearchMutationRelevant,
  MarkdownBlockEditor,
} from "@mde/editor-react";
import {
  BUILT_IN_APP_LANGUAGE_PACKS,
  createAppText,
  type AppText,
} from "../../apps/desktop/src/renderer/src/i18n/appLanguage";

const text: AppText = createAppText(BUILT_IN_APP_LANGUAGE_PACKS.en);
const zhText: AppText = createAppText(BUILT_IN_APP_LANGUAGE_PACKS.zh);

interface MockHighlightRegistry {
  readonly delete: ReturnType<typeof vi.fn>;
  readonly set: ReturnType<typeof vi.fn>;
}

const mockBlockNoteState = vi.hoisted(() => ({
  lastEditor: undefined as
    | {
        blocksToMarkdownLossy: ReturnType<typeof vi.fn>;
        createLink: ReturnType<typeof vi.fn>;
        document: { content: string; id: string; type: string }[];
        focus: ReturnType<typeof vi.fn>;
        getSelectedText: ReturnType<typeof vi.fn>;
        replaceBlocks: ReturnType<typeof vi.fn>;
        transaction: { setMeta: ReturnType<typeof vi.fn> };
        transact: ReturnType<typeof vi.fn>;
        tryParseMarkdownToBlocks: ReturnType<typeof vi.fn>;
        _tiptapEditor: {
          commands: {
            selectAll: ReturnType<typeof vi.fn>;
          };
        };
      }
    | undefined,
  lastOptions: undefined as
    | {
        links?: {
          isValidLink?: (href: string) => boolean;
          onClick?: (event: MouseEvent) => boolean | void;
        };
        schema?: unknown;
        uploadFile?: (file: File, blockId?: string) => Promise<string>;
      }
    | undefined,
}));
const mockMermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn().mockResolvedValue({
    svg: '<svg role="img"><text>Rendered flowchart</text></svg>',
  }),
}));

vi.mock("@blocknote/react", () => ({
  SuggestionMenuController: ({
    getItems,
  }: {
    readonly getItems: (
      query: string,
    ) => Promise<
      readonly {
        readonly onItemClick?: () => void;
        readonly title: string;
      }[]
    >;
  }) => (
    <button
      onClick={() => {
        void getItems("").then((items) => {
          items[0]?.onItemClick?.();
        });
      }}
      type="button"
    >
      Open link picker
    </button>
  ),
  getDefaultReactSlashMenuItems: () => [],
  useCreateBlockNote: (options?: {
    links?: {
      isValidLink?: (href: string) => boolean;
      onClick?: (event: MouseEvent) => boolean | void;
    };
    uploadFile?: (file: File, blockId?: string) => Promise<string>;
    schema?: unknown;
  }) => {
    mockBlockNoteState.lastOptions = options;

    if (!mockBlockNoteState.lastEditor) {
      const blocks = [{ content: "", id: "initial", type: "paragraph" }];
      const transaction = { setMeta: vi.fn() };

      mockBlockNoteState.lastEditor = {
        blocksToMarkdownLossy: vi.fn().mockResolvedValue(""),
        createLink: vi.fn(),
        document: blocks,
        focus: vi.fn(),
        getSelectedText: vi.fn().mockReturnValue(""),
        replaceBlocks: vi.fn(),
        transaction,
        transact: vi.fn((callback: (transaction: unknown) => unknown) =>
          callback(transaction),
        ),
        tryParseMarkdownToBlocks: vi.fn().mockResolvedValue(blocks),
        _tiptapEditor: {
          commands: {
            selectAll: vi.fn(),
          },
        },
      };
    }

    return mockBlockNoteState.lastEditor;
  },
}));

vi.mock("@blocknote/mantine", () => ({
  BlockNoteView: ({
    children,
    className,
    "data-testid": testId,
    editable,
    editor,
    onChange,
    onInputCapture,
    onKeyDownCapture,
    theme,
    "data-line-spacing": lineSpacing,
  }: {
    readonly children?: ReactNode;
    readonly className?: string;
    readonly "data-testid"?: string;
    readonly editable?: boolean;
    readonly editor: unknown;
    readonly onChange: (editor: unknown) => void;
    readonly onInputCapture?: FormEventHandler<HTMLDivElement>;
    readonly onKeyDownCapture?: KeyboardEventHandler<HTMLDivElement>;
    readonly theme: "dark" | "light";
    readonly "data-line-spacing"?: string;
  }) => (
    <div
      className={className}
      data-line-spacing={lineSpacing}
      data-testid={testId}
      data-theme={theme}
      onInputCapture={onInputCapture}
      onKeyDownCapture={onKeyDownCapture}
      tabIndex={0}
    >
      <div
        contentEditable={editable !== false}
        data-testid="mock-contenteditable"
        suppressContentEditableWarning
        tabIndex={0}
      />
      <button
        onClick={() => {
          onChange(editor);
        }}
        type="button"
      >
        Trigger editor change
      </button>
      {children}
    </div>
  ),
}));

vi.mock("mermaid", () => ({
  default: mockMermaid,
}));

describe("MarkdownBlockEditor accessibility", () => {
  const waitForEditorHydration = async (): Promise<void> => {
    await waitFor(() => {
      expect(mockBlockNoteState.lastEditor?.replaceBlocks).toHaveBeenCalled();
    });
    await act(async () => {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 0);
      });
    });
  };

  const installHighlightMock = (): MockHighlightRegistry => {
    const registry = {
      delete: vi.fn(),
      set: vi.fn(),
    };

    Object.defineProperty(window, "Highlight", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window.CSS, "highlights", {
      configurable: true,
      value: registry,
    });

    return registry;
  };

  afterEach(() => {
    cleanup();
    mockBlockNoteState.lastEditor = undefined;
    mockBlockNoteState.lastOptions = undefined;
    mockMermaid.initialize.mockClear();
    mockMermaid.render.mockClear();
    localStorage.clear();
    Reflect.deleteProperty(window, "Highlight");
    Reflect.deleteProperty(window.CSS, "highlights");
  });

  it("does not render a manual save control", () => {
    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Fixture Workspace"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="# Fixture Workspace"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    expect(
      screen.queryByRole("button", { name: /save README\.md/i }),
    ).not.toBeInTheDocument();
  });

  it("restores the current draft when app language text changes", async () => {
    const user = userEvent.setup();
    const onMarkdownChange = vi.fn();
    const savedMarkdown = "# Fixture Workspace\n\nRoot markdown file.";
    const draftMarkdown =
      "# Fixture Workspace\n\nRoot markdown file.\n\nLanguage switch draft.";
    const { rerender } = render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown={savedMarkdown}
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown={savedMarkdown}
        onImageUpload={vi.fn()}
        onMarkdownChange={onMarkdownChange}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    await waitFor(() => {
      expect(
        mockBlockNoteState.lastEditor?.tryParseMarkdownToBlocks,
      ).toHaveBeenCalledTimes(1);
    });

    mockBlockNoteState.lastEditor?.blocksToMarkdownLossy.mockResolvedValue(
      draftMarkdown,
    );
    await user.click(
      screen.getByRole("button", { name: /trigger editor change/i }),
    );

    await waitFor(() => {
      expect(onMarkdownChange).toHaveBeenCalledWith(draftMarkdown);
    });

    rerender(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown={draftMarkdown}
        errorMessage={null}
        isDirty
        isSaving={false}
        markdown={draftMarkdown}
        onImageUpload={vi.fn()}
        onMarkdownChange={onMarkdownChange}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={zhText}
        workspaceRoot="/workspace"
      />,
    );

    await waitFor(() => {
      expect(
        mockBlockNoteState.lastEditor?.tryParseMarkdownToBlocks,
      ).toHaveBeenCalledTimes(2);
    });

    expect(
      mockBlockNoteState.lastEditor?.tryParseMarkdownToBlocks,
    ).toHaveBeenLastCalledWith(draftMarkdown);
  });

  it("renders YAML frontmatter as metadata and parses only the Markdown body", async () => {
    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown={[
          "---",
          "name: auto-pick-tasks",
          "description: Use ready tasks",
          "---",
          "# Auto Pick Tasks",
          "",
          "Body text.",
        ].join("\n")}
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown={[
          "---",
          "name: auto-pick-tasks",
          "description: Use ready tasks",
          "---",
          "# Auto Pick Tasks",
          "",
          "Body text.",
        ].join("\n")}
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="skills/auto-pick-tasks/SKILL.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    await waitFor(() => {
      expect(
        mockBlockNoteState.lastEditor?.tryParseMarkdownToBlocks,
      ).toHaveBeenCalledWith("# Auto Pick Tasks\n\nBody text.");
    });
    expect(
      screen.getByRole("button", { name: /name: auto-pick-tasks/i }),
    ).toBeVisible();
    expect(screen.getByText(/name: auto-pick-tasks/i)).toBeVisible();
    expect(screen.queryByText(/2 fields/i)).not.toBeInTheDocument();
  });

  it("edits raw YAML frontmatter without rewriting the Markdown body", async () => {
    const user = userEvent.setup();
    const onMarkdownChange = vi.fn();

    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown={[
          "---",
          "name: metadata",
          "description: editable",
          "---",
          "# Body",
          "",
          "Body text.",
        ].join("\n")}
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown={[
          "---",
          "name: metadata",
          "description: editable",
          "---",
          "# Body",
          "",
          "Body text.",
        ].join("\n")}
        onImageUpload={vi.fn()}
        onMarkdownChange={onMarkdownChange}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: /name: metadata/i }),
    );
    await user.click(screen.getByRole("button", { name: /^Source$/i }));
    await user.clear(
      screen.getByRole("textbox", { name: /raw frontmatter yaml/i }),
    );
    await user.type(
      screen.getByRole("textbox", { name: /raw frontmatter yaml/i }),
      "name: new",
    );
    await user.click(
      screen.getByRole("button", { name: /apply frontmatter/i }),
    );

    expect(onMarkdownChange).toHaveBeenLastCalledWith(
      "---\nname: new\n---\n# Body\n\nBody text.",
    );
  });

  it("renders read-only markdown without propagating editor changes", async () => {
    const user = userEvent.setup();
    const onMarkdownChange = vi.fn();
    const onSaveRequest = vi.fn();

    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="## Summary"
        errorMessage={null}
        isDirty={false}
        isReadOnly
        isSaving={false}
        markdown="## Summary"
        onImageUpload={vi.fn()}
        onMarkdownChange={onMarkdownChange}
        onSaveRequest={onSaveRequest}
        path=".mde/translations/README-summary.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    expect(screen.getByTestId("mock-contenteditable")).toHaveAttribute(
      "contenteditable",
      "false",
    );

    await user.click(
      screen.getByRole("button", { name: /trigger editor change/i }),
    );

    expect(onMarkdownChange).not.toHaveBeenCalled();
    expect(onSaveRequest).not.toHaveBeenCalled();
  });

  it("marks the markdown body render mode and disables browser spellcheck", () => {
    const { rerender } = render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Technical frontmatter workspace notes"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="# Technical frontmatter workspace notes"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    expect(screen.getByTestId("markdown-editor-content")).toHaveAttribute(
      "data-read-only",
      "false",
    );
    expect(screen.getByTestId("markdown-editor-content")).toHaveAttribute(
      "spellcheck",
      "false",
    );

    rerender(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Cached AI result"
        errorMessage={null}
        isDirty={false}
        isReadOnly
        isSaving={false}
        markdown="# Cached AI result"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path=".mde/translations/README-summary.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    expect(screen.getByTestId("markdown-editor-content")).toHaveAttribute(
      "data-read-only",
      "true",
    );
    expect(screen.getByTestId("markdown-editor-content")).toHaveAttribute(
      "spellcheck",
      "false",
    );
  });

  it("applies the selected line spacing mode to the BlockNote surface", () => {
    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Technical frontmatter workspace notes"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        lineSpacing="relaxed"
        markdown="# Technical frontmatter workspace notes"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    expect(screen.getByTestId("blocknote-view")).toHaveAttribute(
      "data-line-spacing",
      "relaxed",
    );
  });

  it("keeps select-all scoped to the editor when the editor has focus", () => {
    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Selectable"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="# Selectable"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    const content = screen.getByTestId("markdown-editor-content");
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "a",
      metaKey: true,
    });

    content.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(
      mockBlockNoteState.lastEditor?._tiptapEditor.commands.selectAll,
    ).toHaveBeenCalledTimes(1);
  });

  it("shows restore actions and read-only preview state in the editor", async () => {
    const user = userEvent.setup();
    const onExitHistoryPreview = vi.fn();
    const onRestoreHistoryPreview = vi.fn();

    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Previous"
        errorMessage={null}
        historyPreview={{
          createdAtLabel: "Today 16:42",
          eventLabel: "Manual save before",
          sourcePath: "README.md",
        }}
        isDirty={false}
        isReadOnly
        isSaving={false}
        markdown="# Previous"
        onExitHistoryPreview={onExitHistoryPreview}
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onRestoreHistoryPreview={onRestoreHistoryPreview}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    await user.click(screen.getByRole("button", { name: /exit preview/i }));
    await user.click(
      screen.getByRole("button", { name: /restore this version/i }),
    );

    expect(screen.getByText(/read-only version preview/i)).toBeVisible();
    expect(screen.getByText(/manual save before/i)).toBeVisible();
    expect(screen.getByText(/today 16:42/i)).toBeVisible();
    expect(screen.getByTestId("mock-contenteditable")).toHaveAttribute(
      "contenteditable",
      "false",
    );
    expect(onExitHistoryPreview).toHaveBeenCalledTimes(1);
    expect(onRestoreHistoryPreview).toHaveBeenCalledTimes(1);
  });

  it("shows visible dirty state text for unsaved changes", () => {
    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Fixture Workspace"
        errorMessage={null}
        isDirty
        isSaving={false}
        markdown="# Fixture Workspace"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    expect(screen.getByText(/unsaved changes/i)).toBeVisible();
  });

  it("serializes markdown when the dirty editor loses focus", async () => {
    const user = userEvent.setup();
    const onSaveRequest = vi.fn();

    render(
      <>
        <MarkdownBlockEditor
          colorScheme="light"
          draftMarkdown="# Saved by previous request"
          errorMessage={null}
          isDirty
          isSaving={false}
          markdown="# Saved by previous request"
          onImageUpload={vi.fn()}
          onMarkdownChange={vi.fn()}
          onSaveRequest={onSaveRequest}
          path="README.md"
          text={text}
          workspaceRoot="/workspace"
        />
        <button type="button">Outside editor</button>
      </>,
    );

    await waitForEditorHydration();
    await user.click(
      screen.getByRole("button", { name: /trigger editor change/i }),
    );
    await user.click(screen.getByRole("button", { name: /outside editor/i }));

    await waitFor(() => {
      expect(onSaveRequest).toHaveBeenCalledWith("", "blur-autosave");
    });
  });

  it("saves block editor changes on blur even after the draft has updated", async () => {
    const user = userEvent.setup();
    const onSaveRequest = vi.fn();
    const { rerender } = render(
      <>
        <MarkdownBlockEditor
          colorScheme="light"
          draftMarkdown="# Fixture Workspace"
          errorMessage={null}
          isDirty
          isSaving={false}
          markdown="# Fixture Workspace"
          onImageUpload={vi.fn()}
          onMarkdownChange={vi.fn()}
          onSaveRequest={onSaveRequest}
          path="README.md"
          text={text}
          workspaceRoot="/workspace"
        />
        <button type="button">Outside editor</button>
      </>,
    );

    await user.click(
      screen.getByRole("button", { name: /trigger editor change/i }),
    );

    rerender(
      <>
        <MarkdownBlockEditor
          colorScheme="light"
          draftMarkdown=""
          errorMessage={null}
          isDirty
          isSaving={false}
          markdown="# Fixture Workspace"
          onImageUpload={vi.fn()}
          onMarkdownChange={vi.fn()}
          onSaveRequest={onSaveRequest}
          path="README.md"
          text={text}
          workspaceRoot="/workspace"
        />
        <button type="button">Outside editor</button>
      </>,
    );

    await user.click(screen.getByRole("button", { name: /outside editor/i }));

    await waitFor(() => {
      expect(onSaveRequest).toHaveBeenCalledWith("", "blur-autosave");
    });
  });

  it("saves the latest draft when blur serialization still matches persisted markdown", async () => {
    const user = userEvent.setup();
    const onSaveRequest = vi.fn();
    const { rerender } = render(
      <>
        <MarkdownBlockEditor
          colorScheme="light"
          draftMarkdown="# Saved"
          errorMessage={null}
          isDirty
          isSaving={false}
          markdown="# Saved"
          onImageUpload={vi.fn()}
          onMarkdownChange={vi.fn()}
          onSaveRequest={onSaveRequest}
          path="README.md"
          text={text}
          workspaceRoot="/workspace"
        />
        <button type="button">Outside editor</button>
      </>,
    );

    mockBlockNoteState.lastEditor?.blocksToMarkdownLossy.mockResolvedValue(
      "# Saved",
    );

    await user.click(
      screen.getByRole("button", { name: /trigger editor change/i }),
    );

    rerender(
      <>
        <MarkdownBlockEditor
          colorScheme="light"
          draftMarkdown={["# Saved", "", "Blur draft"].join("\n")}
          errorMessage={null}
          isDirty
          isSaving={false}
          markdown="# Saved"
          onImageUpload={vi.fn()}
          onMarkdownChange={vi.fn()}
          onSaveRequest={onSaveRequest}
          path="README.md"
          text={text}
          workspaceRoot="/workspace"
        />
        <button type="button">Outside editor</button>
      </>,
    );

    await user.click(screen.getByRole("button", { name: /outside editor/i }));

    await waitFor(() => {
      expect(onSaveRequest).toHaveBeenCalledWith(
        ["# Saved", "", "Blur draft"].join("\n"),
        "blur-autosave",
      );
    });
  });

  it("does not save empty markdown when blur serialization is transiently empty", async () => {
    const user = userEvent.setup();
    const onSaveRequest = vi.fn();
    const savedMarkdown = "# Saved";
    const draftMarkdown = ["# Saved", "", "Language switch draft"].join("\n");
    const { rerender } = render(
      <>
        <MarkdownBlockEditor
          colorScheme="light"
          draftMarkdown={savedMarkdown}
          errorMessage={null}
          isDirty={false}
          isSaving={false}
          markdown={savedMarkdown}
          onImageUpload={vi.fn()}
          onMarkdownChange={vi.fn()}
          onSaveRequest={onSaveRequest}
          path="README.md"
          text={text}
          workspaceRoot="/workspace"
        />
        <button type="button">Outside editor</button>
      </>,
    );

    await waitForEditorHydration();
    mockBlockNoteState.lastEditor?.blocksToMarkdownLossy.mockResolvedValue(
      draftMarkdown,
    );
    await user.click(
      screen.getByRole("button", { name: /trigger editor change/i }),
    );

    rerender(
      <>
        <MarkdownBlockEditor
          colorScheme="light"
          draftMarkdown={draftMarkdown}
          errorMessage={null}
          isDirty
          isSaving={false}
          markdown={draftMarkdown}
          onImageUpload={vi.fn()}
          onMarkdownChange={vi.fn()}
          onSaveRequest={onSaveRequest}
          path="README.md"
          text={zhText}
          workspaceRoot="/workspace"
        />
        <button type="button">Outside editor</button>
      </>,
    );
    mockBlockNoteState.lastEditor?.blocksToMarkdownLossy.mockResolvedValue("");

    await user.click(screen.getByRole("button", { name: /outside editor/i }));

    await act(async () => {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 250);
      });
    });
    expect(onSaveRequest).not.toHaveBeenCalledWith("", "blur-autosave");
  });

  it("saves editor input on blur before the BlockNote change callback settles", async () => {
    const user = userEvent.setup();
    const onSaveRequest = vi.fn();

    render(
      <>
        <MarkdownBlockEditor
          colorScheme="light"
          draftMarkdown="# Saved"
          errorMessage={null}
          isDirty={false}
          isSaving={false}
          markdown="# Saved"
          onImageUpload={vi.fn()}
          onMarkdownChange={vi.fn()}
          onSaveRequest={onSaveRequest}
          path="README.md"
          text={text}
          workspaceRoot="/workspace"
        />
        <button type="button">Outside editor</button>
      </>,
    );

    mockBlockNoteState.lastEditor?.blocksToMarkdownLossy.mockResolvedValue(
      ["# Saved", "", "Blur input"].join("\n"),
    );

    await user.click(screen.getByTestId("mock-contenteditable"));
    fireEvent.input(screen.getByTestId("mock-contenteditable"));
    await user.click(screen.getByRole("button", { name: /outside editor/i }));

    await waitFor(() => {
      expect(onSaveRequest).toHaveBeenCalledWith(
        ["# Saved", "", "Blur input"].join("\n"),
        "blur-autosave",
      );
    });
  });

  it("saves the latest dirty draft when focus already left the editor", async () => {
    const user = userEvent.setup();
    const onSaveRequest = vi.fn();
    const { rerender } = render(
      <>
        <MarkdownBlockEditor
          colorScheme="light"
          draftMarkdown="# Saved"
          errorMessage={null}
          isDirty={false}
          isSaving={false}
          markdown="# Saved"
          onImageUpload={vi.fn()}
          onMarkdownChange={vi.fn()}
          onSaveRequest={onSaveRequest}
          path="README.md"
          text={text}
          workspaceRoot="/workspace"
        />
        <button type="button">Outside editor</button>
      </>,
    );

    mockBlockNoteState.lastEditor?.blocksToMarkdownLossy.mockResolvedValue(
      "# Saved",
    );

    await user.click(
      screen.getByRole("button", { name: /trigger editor change/i }),
    );
    await user.click(screen.getByRole("button", { name: /outside editor/i }));

    rerender(
      <>
        <MarkdownBlockEditor
          colorScheme="light"
          draftMarkdown={["# Saved", "", "Late dirty draft"].join("\n")}
          errorMessage={null}
          isDirty
          isSaving={false}
          markdown="# Saved"
          onImageUpload={vi.fn()}
          onMarkdownChange={vi.fn()}
          onSaveRequest={onSaveRequest}
          path="README.md"
          text={text}
          workspaceRoot="/workspace"
        />
        <button type="button">Outside editor</button>
      </>,
    );

    await waitFor(() => {
      expect(onSaveRequest).toHaveBeenCalledWith(
        ["# Saved", "", "Late dirty draft"].join("\n"),
        "blur-autosave",
      );
    });
  });

  it("queues a blur save while a previous save is still running", async () => {
    const user = userEvent.setup();
    const onSaveRequest = vi.fn();
    const { rerender } = render(
      <>
        <MarkdownBlockEditor
          colorScheme="light"
          draftMarkdown="# Fixture Workspace"
          errorMessage={null}
          isDirty
          isSaving
          markdown="# Fixture Workspace"
          onImageUpload={vi.fn()}
          onMarkdownChange={vi.fn()}
          onSaveRequest={onSaveRequest}
          path="README.md"
          text={text}
          workspaceRoot="/workspace"
        />
        <button type="button">Outside editor</button>
      </>,
    );

    await waitForEditorHydration();
    await user.click(
      screen.getByRole("button", { name: /trigger editor change/i }),
    );
    await user.click(screen.getByRole("button", { name: /outside editor/i }));

    expect(onSaveRequest).not.toHaveBeenCalled();

    rerender(
      <>
        <MarkdownBlockEditor
          colorScheme="light"
          draftMarkdown="# Fixture Workspace"
          errorMessage={null}
          isDirty
          isSaving={false}
          markdown="# Fixture Workspace"
          onImageUpload={vi.fn()}
          onMarkdownChange={vi.fn()}
          onSaveRequest={onSaveRequest}
          path="README.md"
          text={text}
          workspaceRoot="/workspace"
        />
        <button type="button">Outside editor</button>
      </>,
    );

    await waitFor(() => {
      expect(onSaveRequest).toHaveBeenCalledWith("", "blur-autosave");
    });
  });

  it("reports serialized markdown after editor changes", async () => {
    const user = userEvent.setup();
    const onMarkdownChange = vi.fn();

    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Fixture Workspace"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="# Fixture Workspace"
        onImageUpload={vi.fn()}
        onMarkdownChange={onMarkdownChange}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /trigger editor change/i }),
    );

    expect(onMarkdownChange).toHaveBeenCalledWith("");
  });

  it("reports current search matches and publishes highlight ranges", async () => {
    const highlightRegistry = installHighlightMock();
    const onSearchStateChange = vi.fn();

    render(
      <MarkdownBlockEditor
        activeSearchMatchIndex={1}
        colorScheme="light"
        draftMarkdown="Alpha beta gamma\nalpha ALPHA"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="Alpha beta gamma\nalpha ALPHA"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        onSearchStateChange={onSearchStateChange}
        path="README.md"
        pinnedSearchQueries={["beta", "gamma"]}
        searchQuery="alpha"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    act(() => {
      screen.getByTestId("mock-contenteditable").textContent =
        "Alpha beta gamma\nalpha ALPHA";
    });

    await waitFor(() => {
      expect(onSearchStateChange).toHaveBeenLastCalledWith({
        activeMatchIndex: 1,
        matchCount: 3,
      });
    });
    expect(highlightRegistry.set).toHaveBeenCalledWith(
      "mde-editor-search-match",
      expect.anything(),
    );
    expect(highlightRegistry.set).toHaveBeenCalledWith(
      "mde-editor-search-active",
      expect.anything(),
    );
    expect(highlightRegistry.set).toHaveBeenCalledWith(
      "mde-editor-search-pin-0",
      expect.anything(),
    );
    expect(highlightRegistry.set).toHaveBeenCalledWith(
      "mde-editor-search-pin-1",
      expect.anything(),
    );
  });

  it("counts search matches from rendered editor text instead of raw markdown syntax", async () => {
    installHighlightMock();
    const onSearchStateChange = vi.fn();

    render(
      <MarkdownBlockEditor
        activeSearchMatchIndex={0}
        colorScheme="light"
        draftMarkdown="[Link title](https://example.com)"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="[Link title](https://example.com)"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        onSearchStateChange={onSearchStateChange}
        path="README.md"
        searchQuery="https"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    act(() => {
      screen.getByTestId("mock-contenteditable").textContent = "Link title";
    });

    await waitFor(() => {
      expect(onSearchStateChange).toHaveBeenLastCalledWith({
        activeMatchIndex: -1,
        matchCount: 0,
      });
    });
  });

  it("excludes derived Mermaid preview content from editor search tracking", () => {
    const surface = document.createElement("div");

    surface.className = "markdown-editor-surface";
    surface.innerHTML = [
      "<p>theme source text</p>",
      '<div class="mermaid-flowchart-inline-target">',
      '  <div class="mermaid-flowchart-inline-card">',
      '    <section class="mermaid-flowchart-card">',
      '      <span class="mermaid-flowchart-svg"><svg><text>theme preview text</text></svg></span>',
      "    </section>",
      "  </div>",
      "</div>",
    ].join("");
    document.body.append(surface);

    const ranges = createSearchRanges(surface, "theme");
    const previewText = surface.querySelector("text");
    const previewSvgContainer = surface.querySelector(".mermaid-flowchart-svg");
    const sourceText = surface.querySelector("p")?.firstChild;
    const inlineTarget = surface.querySelector(".mermaid-flowchart-inline-target");
    const previewCard = surface.querySelector(".mermaid-flowchart-inline-card");
    const detachedRenderedSvg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );

    expect(ranges).toHaveLength(1);
    expect(ranges[0].startContainer).toBe(sourceText);
    expect(previewText).not.toBeNull();
    expect(previewSvgContainer).not.toBeNull();
    expect(sourceText).not.toBeNull();
    expect(inlineTarget).not.toBeNull();
    expect(previewCard).not.toBeNull();
    expect(
      isEditorSearchMutationRelevant([
        {
          addedNodes: previewCard ? ([previewCard] as unknown as NodeList) : [],
          removedNodes: [] as unknown as NodeList,
          target: inlineTarget ?? surface,
          type: "childList",
        } as unknown as MutationRecord,
      ]),
    ).toBe(false);
    expect(
      isEditorSearchMutationRelevant([
        {
          addedNodes: [] as unknown as NodeList,
          removedNodes: [detachedRenderedSvg] as unknown as NodeList,
          target: previewSvgContainer ?? surface,
          type: "childList",
        } as unknown as MutationRecord,
      ]),
    ).toBe(false);
    expect(
      isEditorSearchMutationRelevant([
        {
          addedNodes: [] as unknown as NodeList,
          removedNodes: [] as unknown as NodeList,
          target: previewText ?? surface,
          type: "characterData",
        } as unknown as MutationRecord,
      ]),
    ).toBe(false);
    expect(
      isEditorSearchMutationRelevant([
        {
          addedNodes: [] as unknown as NodeList,
          removedNodes: [] as unknown as NodeList,
          target: sourceText ?? surface,
          type: "characterData",
        } as unknown as MutationRecord,
      ]),
    ).toBe(true);

    surface.remove();
  });

  it("keeps imported markdown replacement out of the undo history", async () => {
    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Fixture Workspace"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="# Fixture Workspace"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    await waitFor(() => {
      expect(mockBlockNoteState.lastEditor?.replaceBlocks).toHaveBeenCalled();
    });

    expect(mockBlockNoteState.lastEditor?.transact).toHaveBeenCalled();
    expect(
      mockBlockNoteState.lastEditor?.transaction.setMeta,
    ).toHaveBeenCalledWith("addToHistory", false);
  });

  it("does not rehydrate the editor after a local autosave updates persisted markdown", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Original"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="# Original"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    await waitFor(() => {
      expect(
        mockBlockNoteState.lastEditor?.replaceBlocks,
      ).toHaveBeenCalledTimes(1);
    });

    await user.click(
      screen.getByRole("button", { name: /trigger editor change/i }),
    );

    const editedMarkdown = ["# Original", "", "  indented middle line"].join(
      "\n",
    );

    rerender(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown={editedMarkdown}
        errorMessage={null}
        isDirty
        isSaving={false}
        markdown="# Original"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    rerender(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown={editedMarkdown}
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown={editedMarkdown}
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockBlockNoteState.lastEditor?.replaceBlocks).toHaveBeenCalledTimes(
      1,
    );
  });

  it("does not rehydrate the editor after a completed save is reflected as persisted markdown", async () => {
    const user = userEvent.setup();
    const editedMarkdown = ["# Original", "", "Autosaved middle line"].join(
      "\n",
    );
    const onSaveRequest = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <>
        <MarkdownBlockEditor
          colorScheme="light"
          draftMarkdown="# Original"
          errorMessage={null}
          isDirty={false}
          isSaving={false}
          markdown="# Original"
          onImageUpload={vi.fn()}
          onMarkdownChange={vi.fn()}
          onSaveRequest={onSaveRequest}
          path="README.md"
          text={text}
          workspaceRoot="/workspace"
        />
        <button type="button">Outside editor</button>
      </>,
    );

    await waitFor(() => {
      expect(
        mockBlockNoteState.lastEditor?.replaceBlocks,
      ).toHaveBeenCalledTimes(1);
    });

    mockBlockNoteState.lastEditor?.blocksToMarkdownLossy.mockResolvedValue(
      editedMarkdown,
    );
    await user.click(
      screen.getByRole("button", { name: /trigger editor change/i }),
    );

    rerender(
      <>
        <MarkdownBlockEditor
          colorScheme="light"
          draftMarkdown={editedMarkdown}
          errorMessage={null}
          isDirty
          isSaving={false}
          markdown="# Original"
          onImageUpload={vi.fn()}
          onMarkdownChange={vi.fn()}
          onSaveRequest={onSaveRequest}
          path="README.md"
          text={text}
          workspaceRoot="/workspace"
        />
        <button type="button">Outside editor</button>
      </>,
    );

    await user.click(screen.getByRole("button", { name: /outside editor/i }));

    await waitFor(() => {
      expect(onSaveRequest).toHaveBeenCalledWith(
        editedMarkdown,
        "blur-autosave",
      );
    });

    rerender(
      <>
        <MarkdownBlockEditor
          colorScheme="light"
          draftMarkdown={editedMarkdown}
          errorMessage={null}
          isDirty={false}
          isSaving={false}
          markdown={editedMarkdown}
          onImageUpload={vi.fn()}
          onMarkdownChange={vi.fn()}
          onSaveRequest={onSaveRequest}
          path="README.md"
          text={text}
          workspaceRoot="/workspace"
        />
        <button type="button">Outside editor</button>
      </>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockBlockNoteState.lastEditor?.replaceBlocks).toHaveBeenCalledTimes(
      1,
    );
  });

  it("does not rehydrate stale persisted markdown over unsaved local edits", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Original"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="# Original"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    await waitFor(() => {
      expect(
        mockBlockNoteState.lastEditor?.replaceBlocks,
      ).toHaveBeenCalledTimes(1);
    });

    await user.click(
      screen.getByRole("button", { name: /trigger editor change/i }),
    );

    rerender(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Local unsaved edit"
        errorMessage={null}
        isDirty
        isSaving={false}
        markdown="# Previous save completed"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockBlockNoteState.lastEditor?.replaceBlocks).toHaveBeenCalledTimes(
      1,
    );
  });

  it("rehydrates the editor when persisted markdown changes without local edits", async () => {
    const { rerender } = render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Original"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="# Original"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    await waitFor(() => {
      expect(
        mockBlockNoteState.lastEditor?.replaceBlocks,
      ).toHaveBeenCalledTimes(1);
    });

    rerender(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# External update"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="# External update"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    await waitFor(() => {
      expect(
        mockBlockNoteState.lastEditor?.replaceBlocks,
      ).toHaveBeenCalledTimes(2);
    });
  });

  it("passes pasted image files to the provided image upload handler", async () => {
    const onImageUpload = vi
      .fn()
      .mockResolvedValue("file:///workspace/.mde/assets/image.png");

    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Fixture Workspace"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="# Fixture Workspace"
        onImageUpload={onImageUpload}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    const file = new File(
      [new Uint8Array([137, 80, 78, 71])],
      "clipboard.png",
      {
        type: "image/png",
      },
    );
    const result = await mockBlockNoteState.lastOptions?.uploadFile?.(file);

    expect(onImageUpload).toHaveBeenCalledWith(file);
    expect(result).toBe("file:///workspace/.mde/assets/image.png");
  });

  it("uses the editor link click handler for Markdown links", () => {
    const onOpenLink = vi.fn();

    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="[Intro](docs/intro.md)"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="[Intro](docs/intro.md)"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onOpenLink={onOpenLink}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    const anchor = document.createElement("a");

    anchor.href = "docs/intro.md";
    anchor.setAttribute("href", "docs/intro.md");
    document.body.append(anchor);

    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "target", {
      configurable: true,
      value: anchor,
    });
    const preventDefault = vi.spyOn(event, "preventDefault");
    const handled = mockBlockNoteState.lastOptions?.links?.onClick?.(event);

    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalled();
    expect(onOpenLink).toHaveBeenCalledWith("docs/intro.md");
    anchor.remove();
  });

  it("opens the new-document link picker on the current visible directory only", async () => {
    const user = userEvent.setup();

    localStorage.setItem(
      "mde.hiddenExplorerEntries",
      JSON.stringify({
        "/workspace": ["private"],
      }),
    );
    render(
      <MarkdownBlockEditor
        colorScheme="light"
        createVisibleLinkWorkspaceTree={createVisibleEditorLinkTree}
        draftMarkdown="# Current"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="# Current"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="docs/nested/current.md"
        text={text}
        workspaceRoot="/workspace"
        workspaceTree={[
          {
            children: [
              {
                children: [],
                name: "nested",
                path: "docs/nested",
                type: "directory",
              },
            ],
            name: "docs",
            path: "docs",
            type: "directory",
          },
          {
            children: [
              {
                children: [],
                name: "child",
                path: "other/child",
                type: "directory",
              },
            ],
            name: "other",
            path: "other",
            type: "directory",
          },
          {
            children: [],
            name: ".mde",
            path: ".mde",
            type: "directory",
          },
          {
            children: [],
            name: "private",
            path: "private",
            type: "directory",
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /open link picker/i }));
    await user.click(screen.getByRole("tab", { name: /new document/i }));

    expect(screen.getByRole("dialog", { name: /insert link/i })).toHaveAttribute(
      "data-component-id",
      COMPONENT_IDS.link.pickerDialog,
    );
    expect(screen.getByRole("tab", { name: /new document/i })).toHaveAttribute(
      "data-component-id",
      COMPONENT_IDS.link.newDocumentTab,
    );
    const directoryTree = screen.getByRole("tree", { name: /directory tree/i });
    const docsDirectory = within(directoryTree).getByRole("treeitem", {
      name: /^docs$/,
    });
    const nestedDirectory = within(directoryTree).getByRole("treeitem", {
      name: /^nested$/,
    });

    expect(directoryTree).toHaveAttribute(
      "data-component-id",
      COMPONENT_IDS.link.directoryTree,
    );
    expect(nestedDirectory).toHaveAttribute(
      "data-component-id",
      COMPONENT_IDS.link.directoryRow,
    );
    expect(docsDirectory).toHaveAttribute("aria-expanded", "true");
    expect(nestedDirectory).toHaveAttribute("aria-selected", "true");
    expect(
      within(directoryTree).queryByRole("treeitem", { name: /^child$/ }),
    ).not.toBeInTheDocument();
    expect(
      within(directoryTree).queryByRole("treeitem", { name: /^\.mde$/ }),
    ).not.toBeInTheDocument();
    expect(
      within(directoryTree).queryByRole("treeitem", { name: /^private$/ }),
    ).not.toBeInTheDocument();
  });

  it("saves immediately after inserting an existing document link", async () => {
    const user = userEvent.setup();
    const onSaveRequest = vi.fn();

    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Current"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="# Current"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={onSaveRequest}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
        workspaceTree={[
          {
            children: [
              {
                name: "intro.md",
                path: "docs/intro.md",
                type: "file",
              },
            ],
            name: "docs",
            path: "docs",
            type: "directory",
          },
        ]}
      />,
    );

    mockBlockNoteState.lastEditor?.blocksToMarkdownLossy.mockResolvedValue(
      "[intro.md](docs/intro.md)",
    );

    await user.click(screen.getByRole("button", { name: /open link picker/i }));
    await user.type(screen.getByRole("textbox", { name: /link target/i }), "intro");
    await user.click(
      screen.getByRole("option", { name: /docs\/intro\.md/i }),
    );

    await waitFor(() => {
      expect(onSaveRequest).toHaveBeenCalledWith(
        "[intro.md](docs/intro.md)",
        "manual",
      );
    });
  });

  it("closes the link picker from Escape even after focus leaves the input", async () => {
    const user = userEvent.setup();

    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Current"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="# Current"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
        workspaceTree={[
          {
            children: [
              {
                name: "intro.md",
                path: "docs/intro.md",
                type: "file",
              },
            ],
            name: "docs",
            path: "docs",
            type: "directory",
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /open link picker/i }));
    await user.type(screen.getByRole("textbox", { name: /link target/i }), "intro");
    screen.getByRole("textbox", { name: /link target/i }).blur();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /insert link/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("saves immediately after creating and inserting a new document link", async () => {
    const user = userEvent.setup();
    const onCreateLinkedMarkdown = vi.fn().mockResolvedValue("docs/new-note.md");
    const onSaveRequest = vi.fn();

    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Current"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="# Current"
        onCreateLinkedMarkdown={onCreateLinkedMarkdown}
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={onSaveRequest}
        path="docs/current.md"
        text={text}
        workspaceRoot="/workspace"
        workspaceTree={[
          {
            children: [],
            name: "docs",
            path: "docs",
            type: "directory",
          },
        ]}
      />,
    );

    mockBlockNoteState.lastEditor?.blocksToMarkdownLossy.mockResolvedValue(
      "[new-note.md](new-note.md)",
    );

    await user.click(screen.getByRole("button", { name: /open link picker/i }));
    await user.click(screen.getByRole("tab", { name: /new document/i }));
    await user.clear(
      screen.getByRole("textbox", { name: /new document name/i }),
    );
    await user.type(
      screen.getByRole("textbox", { name: /new document name/i }),
      "new-note",
    );
    await user.click(screen.getByRole("button", { name: /create and insert/i }));

    await waitFor(() => {
      expect(onCreateLinkedMarkdown).toHaveBeenCalledWith("docs/new-note.md");
      expect(onSaveRequest).toHaveBeenCalledWith(
        "[new-note.md](new-note.md)",
        "manual",
      );
    });
  });

  it("rejects javascript link hrefs at the editor boundary", () => {
    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown="# Fixture Workspace"
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown="# Fixture Workspace"
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    expect(
      mockBlockNoteState.lastOptions?.links?.isValidLink?.(
        "javascript:alert(1)",
      ),
    ).toBe(false);
    expect(
      mockBlockNoteState.lastOptions?.links?.isValidLink?.("docs/intro.md"),
    ).toBe(true);
  });

  it("passes dark color scheme to BlockNote and Mermaid rendering", async () => {
    const markdown = ["```mermaid", "flowchart TD", "  A --> B", "```"].join(
      "\n",
    );

    render(
      <MarkdownBlockEditor
        colorScheme="dark"
        draftMarkdown={markdown}
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown={markdown}
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    expect(screen.getByTestId("blocknote-view")).toHaveAttribute(
      "data-theme",
      "dark",
    );
    await waitFor(() => {
      expect(mockMermaid.initialize).toHaveBeenCalledWith(
        expect.objectContaining({ theme: "dark" }),
      );
    });
  });

  it("renders Mermaid flowchart previews without duplicating the fenced source editor", async () => {
    const onMarkdownChange = vi.fn();
    const markdown = [
      "## End-to-End Flow",
      "",
      "```mermaid",
      "flowchart TD",
      "  A --> B",
      "```",
    ].join("\n");

    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown={markdown}
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown={markdown}
        onImageUpload={vi.fn()}
        onMarkdownChange={onMarkdownChange}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("mermaid-flowchart-preview-0")).toContainHTML(
        "<svg",
      );
    });

    expect(screen.queryByLabelText(/mermaid source 1/i)).not.toBeInTheDocument();
    expect(onMarkdownChange).not.toHaveBeenCalled();
  });

  it("keeps Mermaid previews below the editor content instead of the editor top", async () => {
    const markdown = [
      "## End-to-End Flow",
      "",
      "```mermaid",
      "flowchart TD",
      "  A --> B",
      "```",
    ].join("\n");

    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown={markdown}
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown={markdown}
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    await screen.findByTestId("mermaid-flowchart-preview-0");

    const editorContent = screen.getByTestId("markdown-editor-content");
    const preview = screen.getByTestId("mermaid-flowchart-preview-0");

    expect(
      editorContent.compareDocumentPosition(preview) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("opens Mermaid previews in a zoomable draggable read-only dialog", async () => {
    const user = userEvent.setup();
    const markdown = [
      "## End-to-End Flow",
      "",
      "```mermaid",
      "flowchart TD",
      "  A --> B",
      "```",
    ].join("\n");

    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown={markdown}
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown={markdown}
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    await user.click(
      await screen.findByRole("button", {
        name: /open flowchart preview 1/i,
      }),
    );

    expect(
      screen.getByRole("dialog", { name: /flowchart preview/i }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /zoom in/i })).toContainHTML(
      "<svg",
    );
    expect(screen.getByRole("button", { name: /zoom out/i })).toContainHTML(
      "<svg",
    );

    const viewport = screen.getByTestId("mermaid-flowchart-dialog-viewport");
    const preview = screen.getByTestId("mermaid-flowchart-dialog-preview");
    const dispatchPointerEvent = (
      target: Element,
      type: string,
      properties: Record<string, number>,
    ): void => {
      const event = new Event(type, { bubbles: true, cancelable: true });

      for (const [key, value] of Object.entries(properties)) {
        Object.defineProperty(event, key, {
          configurable: true,
          value,
        });
      }

      fireEvent(target, event);
    };

    fireEvent.wheel(viewport, { deltaY: 100 });
    expect(preview).toHaveStyle("--flowchart-preview-scale: 1");
    expect(preview).toHaveStyle("--flowchart-preview-pan-y: -100px");

    fireEvent.wheel(viewport, { ctrlKey: true, deltaY: -100 });
    expect(preview).toHaveStyle("--flowchart-preview-scale: 1.25");

    await user.click(screen.getByRole("button", { name: /reset view/i }));
    expect(preview).toHaveStyle("--flowchart-preview-scale: 1");
    expect(preview).toHaveStyle("--flowchart-preview-pan-x: 0px");
    expect(preview).toHaveStyle("--flowchart-preview-pan-y: 0px");

    dispatchPointerEvent(viewport, "pointerdown", {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    });
    dispatchPointerEvent(viewport, "pointermove", {
      clientX: 145,
      clientY: 130,
      pointerId: 1,
    });
    dispatchPointerEvent(viewport, "pointerup", { pointerId: 1 });
    await waitFor(() => {
      expect(preview).toHaveStyle("--flowchart-preview-pan-x: 45px");
      expect(preview).toHaveStyle("--flowchart-preview-pan-y: 30px");
    });

    await user.click(screen.getByRole("button", { name: /zoom in/i }));
    expect(preview).toHaveStyle(
      "--flowchart-preview-scale: 1.25",
    );

    await user.click(screen.getByRole("button", { name: /reset view/i }));
    expect(preview).toHaveStyle("--flowchart-preview-scale: 1");
    expect(preview).toHaveStyle("--flowchart-preview-pan-x: 0px");
    expect(preview).toHaveStyle("--flowchart-preview-pan-y: 0px");

    const flowchartText = within(preview).getByText("Rendered flowchart");

    dispatchPointerEvent(flowchartText, "pointerdown", {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 2,
    });
    dispatchPointerEvent(viewport, "pointermove", {
      clientX: 180,
      clientY: 150,
      pointerId: 2,
    });
    dispatchPointerEvent(viewport, "pointerup", { pointerId: 2 });
    expect(preview).toHaveStyle("--flowchart-preview-pan-x: 0px");
    expect(preview).toHaveStyle("--flowchart-preview-pan-y: 0px");

    await user.click(
      screen.getByRole("button", { name: /use full-page preview/i }),
    );
    expect(
      screen.getByRole("dialog", { name: /flowchart preview/i }),
    ).toHaveAttribute("data-view-mode", "full");

    await user.click(
      screen.getByRole("button", { name: /use centered preview/i }),
    );
    expect(
      screen.getByRole("dialog", { name: /flowchart preview/i }),
    ).toHaveAttribute("data-view-mode", "centered");
  });

  it("keeps Mermaid previews in the editor as static thumbnails", async () => {
    const markdown = [
      "## End-to-End Flow",
      "",
      "```mermaid",
      "flowchart TD",
      "  A --> B",
      "```",
    ].join("\n");

    render(
      <MarkdownBlockEditor
        colorScheme="light"
        draftMarkdown={markdown}
        errorMessage={null}
        isDirty={false}
        isSaving={false}
        markdown={markdown}
        onImageUpload={vi.fn()}
        onMarkdownChange={vi.fn()}
        onSaveRequest={vi.fn()}
        path="README.md"
        text={text}
        workspaceRoot="/workspace"
      />,
    );

    const preview = await screen.findByTestId("mermaid-flowchart-preview-0");
    const svgContainer = preview.querySelector(".mermaid-flowchart-svg");

    expect(preview.closest(".mermaid-flowchart-preview-viewport")).toBeNull();

    fireEvent.wheel(preview, { ctrlKey: true, deltaY: -100 });
    expect(svgContainer).not.toHaveStyle("--flowchart-inline-scale: 1.25");

    fireEvent.click(preview);
    expect(
      screen.getByRole("dialog", { name: /flowchart preview/i }),
    ).toBeVisible();
  });
});
