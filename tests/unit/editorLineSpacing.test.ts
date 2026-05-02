import { describe, expect, it, vi } from "vitest";

import {
  EDITOR_LINE_SPACING_STORAGE_KEY,
  readEditorLineSpacing,
  writeEditorLineSpacing,
} from "../../src/renderer/src/editor/editorLineSpacing";

const createStorage = (
  initialValue?: string,
): {
  readonly setItem: ReturnType<typeof vi.fn>;
  readonly storage: Storage;
} => {
  const values = new Map<string, string>();
  const setItem = vi.fn((key: string, value: string) => {
    values.set(key, value);
  });

  if (initialValue !== undefined) {
    values.set(EDITOR_LINE_SPACING_STORAGE_KEY, initialValue);
  }

  return {
    setItem,
    storage: {
      clear: vi.fn(() => {
        values.clear();
      }),
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
      get length() {
        return values.size;
      },
      removeItem: vi.fn((key: string) => {
        values.delete(key);
      }),
      setItem,
    },
  };
};

describe("editorLineSpacing", () => {
  it("uses the MDE storage key", () => {
    expect(EDITOR_LINE_SPACING_STORAGE_KEY).toBe("mde.editorLineSpacing");
  });

  it("reads only supported editor line spacing modes", () => {
    expect(readEditorLineSpacing(createStorage("compact").storage)).toBe(
      "compact",
    );
    expect(readEditorLineSpacing(createStorage("standard").storage)).toBe(
      "standard",
    );
    expect(readEditorLineSpacing(createStorage("relaxed").storage)).toBe(
      "relaxed",
    );
    expect(readEditorLineSpacing(createStorage("expanded").storage)).toBe(
      "standard",
    );
  });

  it("writes the selected editor line spacing mode", () => {
    const { setItem, storage } = createStorage();

    writeEditorLineSpacing(storage, "relaxed");

    expect(setItem).toHaveBeenCalledWith(
      EDITOR_LINE_SPACING_STORAGE_KEY,
      "relaxed",
    );
    expect(readEditorLineSpacing(storage)).toBe("relaxed");
  });

  it("falls back to standard mode when storage is unavailable", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("storage unavailable");
      }),
      setItem: vi.fn(() => {
        throw new Error("storage unavailable");
      }),
    };

    expect(readEditorLineSpacing(storage)).toBe("standard");
    expect(() => {
      writeEditorLineSpacing(storage, "compact");
    }).not.toThrow();
  });
});
