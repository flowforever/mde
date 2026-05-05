import { describe, expect, it } from "vitest";

import {
  EDITOR_LINE_SPACING_OPTIONS,
  readEditorLineSpacing,
  readEditorViewMode,
  writeEditorLineSpacing,
  writeEditorViewMode,
} from "@mde/editor-react";

describe("editor layout preferences integration", () => {
  it("persists editor width and line spacing preferences independently", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };

    writeEditorViewMode(storage, "full-width");
    writeEditorLineSpacing(storage, "relaxed");

    expect(readEditorViewMode(storage)).toBe("full-width");
    expect(readEditorLineSpacing(storage)).toBe("relaxed");

    writeEditorLineSpacing(storage, "compact");

    expect(readEditorViewMode(storage)).toBe("full-width");
    expect(readEditorLineSpacing(storage)).toBe("compact");
  });

  it("exposes exactly three ordered line spacing modes for the toolbar menu", () => {
    expect(EDITOR_LINE_SPACING_OPTIONS.map((option) => option.id)).toEqual([
      "compact",
      "standard",
      "relaxed",
    ]);
  });
});
