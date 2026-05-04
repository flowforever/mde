export const EDITOR_LINE_SPACING_STORAGE_KEY = "mde.editorLineSpacing";

export type EditorLineSpacing = "compact" | "relaxed" | "standard";

export const EDITOR_LINE_SPACING_OPTIONS: readonly {
  readonly id: EditorLineSpacing;
  readonly labelKey:
    | "editor.lineSpacingCompact"
    | "editor.lineSpacingRelaxed"
    | "editor.lineSpacingStandard";
}[] = [
  { id: "compact", labelKey: "editor.lineSpacingCompact" },
  { id: "standard", labelKey: "editor.lineSpacingStandard" },
  { id: "relaxed", labelKey: "editor.lineSpacingRelaxed" },
];

const isEditorLineSpacing = (value: string | null): value is EditorLineSpacing =>
  value === "compact" || value === "standard" || value === "relaxed";

export const readEditorLineSpacing = (
  storage: Pick<Storage, "getItem"> = globalThis.localStorage,
): EditorLineSpacing => {
  try {
    const storedValue = storage.getItem(EDITOR_LINE_SPACING_STORAGE_KEY);

    return isEditorLineSpacing(storedValue) ? storedValue : "standard";
  } catch {
    return "standard";
  }
};

export const writeEditorLineSpacing = (
  storage: Pick<Storage, "setItem"> = globalThis.localStorage,
  lineSpacing: EditorLineSpacing,
): void => {
  try {
    storage.setItem(EDITOR_LINE_SPACING_STORAGE_KEY, lineSpacing);
  } catch {
    // Storage may be unavailable in restricted renderer contexts.
  }
};

export const EDITOR_VIEW_MODE_STORAGE_KEY = "mde.editorViewMode";

export type EditorViewMode = "centered" | "full-width";

export const readEditorViewMode = (
  storage: Pick<Storage, "getItem"> = globalThis.localStorage,
): EditorViewMode => {
  try {
    return storage.getItem(EDITOR_VIEW_MODE_STORAGE_KEY) === "full-width"
      ? "full-width"
      : "centered";
  } catch {
    return "centered";
  }
};

export const writeEditorViewMode = (
  storage: Pick<Storage, "setItem"> = globalThis.localStorage,
  viewMode: EditorViewMode,
): void => {
  try {
    storage.setItem(EDITOR_VIEW_MODE_STORAGE_KEY, viewMode);
  } catch {
    // Storage may be unavailable in restricted renderer contexts.
  }
};
