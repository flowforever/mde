import { describe, expect, it } from "vitest";

import {
  composeMarkdownWithFrontmatter,
  splitMarkdownFrontmatter,
} from "../../src/renderer/src/editor/frontmatter";

describe("frontmatter round trips", () => {
  it("keeps raw YAML metadata lossless while exposing lightweight fields", () => {
    const markdown = [
      "---",
      "# keep this comment",
      "name: auto-pick-tasks",
      "description: Use ready tasks",
      "nested:",
      "  enabled: true",
      "---",
      "# Body",
      "",
      "Body text.",
    ].join("\n");

    const parsed = splitMarkdownFrontmatter(markdown);

    expect(parsed.frontmatter?.fields).toEqual([
      { key: "name", value: "auto-pick-tasks" },
      { key: "description", value: "Use ready tasks" },
      { key: "nested", value: '{"enabled":true}' },
    ]);
    expect(composeMarkdownWithFrontmatter(parsed, parsed.body)).toBe(markdown);
  });

  it("uses edited source YAML without rewriting the Markdown body", () => {
    const parsed = splitMarkdownFrontmatter(
      ["---", "name: old", "---", "# Body", "", "Text."].join("\n"),
    );

    expect(
      composeMarkdownWithFrontmatter(
        parsed,
        "# Body\n\nText.",
        "name: new\ndescription: Updated",
      ),
    ).toBe(
      [
        "---",
        "name: new",
        "description: Updated",
        "---",
        "# Body",
        "",
        "Text.",
      ].join("\n"),
    );
  });
});
