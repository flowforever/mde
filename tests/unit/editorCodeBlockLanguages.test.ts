import { describe, expect, it } from "vitest";
import type { Block } from "@blocknote/core";

import {
  normalizeCodeBlockLanguageId,
  normalizeImportedCodeBlockLanguages,
} from "../../src/renderer/src/editor/editorCodeBlockLanguages";

describe("editorCodeBlockLanguages", () => {
  it("normalizes common fenced code aliases to visible selector language ids", () => {
    expect(normalizeCodeBlockLanguageId("ts")).toBe("typescript");
    expect(normalizeCodeBlockLanguageId("js")).toBe("javascript");
    expect(normalizeCodeBlockLanguageId("sh")).toBe("bash");
    expect(normalizeCodeBlockLanguageId("txt")).toBe("text");
    expect(normalizeCodeBlockLanguageId("mermaid")).toBe("mermaid");
  });

  it("normalizes imported nested code block language props immutably", () => {
    const blocks = [
      {
        children: [
          {
            children: [],
            content: "const value = 1",
            id: "nested-code",
            props: { language: "ts" },
            type: "codeBlock",
          },
        ],
        content: "",
        id: "parent",
        props: {},
        type: "paragraph",
      },
    ] as unknown as Block[];

    const normalized = normalizeImportedCodeBlockLanguages(blocks);

    expect(normalized).not.toBe(blocks);
    expect(
      (normalized[0].children[0].props as { readonly language: string })
        .language,
    ).toBe("typescript");
    expect(
      (blocks[0].children[0].props as { readonly language: string }).language,
    ).toBe("ts");
  });
});
