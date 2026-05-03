import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readThemeCss = (): Promise<string> =>
  readFile(resolve("src/renderer/src/styles/theme.css"), "utf8");

const getCssBlock = (css: string, selector: string): string => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockPattern = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`);
  const match = blockPattern.exec(css);

  if (!match) {
    throw new Error(`Missing CSS block for ${selector}`);
  }

  return match[1];
};

describe("editor render regressions", () => {
  it("lets rendered editor content reserve document height before flowchart previews", async () => {
    const css = await readThemeCss();
    const contentBlock = getCssBlock(css, ".markdown-editor-content");

    expect(contentBlock).toContain("display: block");
    expect(contentBlock).not.toContain("flex: 1");
  });

  it("keeps the code block language selector visible above highlighted source", async () => {
    const css = await readThemeCss();
    const codeBlock = getCssBlock(
      css,
      ".markdown-editor-surface .bn-block-content[data-content-type='codeBlock']",
    );
    const selectBlock = getCssBlock(
      css,
      ".markdown-editor-surface .bn-block-content[data-content-type='codeBlock'] > div > select",
    );
    const preBlock = getCssBlock(
      css,
      ".markdown-editor-surface .bn-block-content[data-content-type='codeBlock'] > pre",
    );

    expect(codeBlock).toContain("flex-direction: column");
    expect(codeBlock).toContain("align-items: stretch");
    expect(selectBlock).toContain("opacity: 1");
    expect(selectBlock).toContain("color: var(--editor-text)");
    expect(selectBlock).toContain("background: var(--editor-bg)");
    expect(preBlock).toContain("padding-top: 42px");
  });

  it("keeps collapsed frontmatter summary aligned with editor body text", async () => {
    const css = await readThemeCss();
    const summaryButtonBlock = getCssBlock(css, ".frontmatter-summary-button");
    const summaryTextBlock = getCssBlock(css, ".frontmatter-summary-text");

    expect(summaryButtonBlock).toContain("width: calc(100% + 25px)");
    expect(summaryButtonBlock).toContain("margin-left: -25px");
    expect(summaryTextBlock).toContain("grid-column: 2 / -1");
  });

  it("keeps inline Mermaid previews inside the matching code block flow", async () => {
    const css = await readThemeCss();
    const targetBlock = getCssBlock(css, ".mermaid-flowchart-inline-target");
    const cardBlock = getCssBlock(css, ".mermaid-flowchart-inline-card");
    const hostBlock = getCssBlock(css, ".mermaid-flowchart-host");
    const previewShellBlock = getCssBlock(
      css,
      ".mermaid-flowchart-preview-shell",
    );
    const previewSvgBlock = getCssBlock(css, ".mermaid-flowchart-svg");
    const nestedSvgBlock = getCssBlock(css, ".mermaid-flowchart-svg svg");
    const dialogViewportBlock = getCssBlock(
      css,
      ".mermaid-flowchart-dialog-viewport",
    );
    const dialogPreviewBlock = getCssBlock(
      css,
      ".mermaid-flowchart-dialog-preview",
    );
    const dialogPreviewSvgBlock = getCssBlock(
      css,
      ".mermaid-flowchart-dialog-preview svg",
    );
    const dialogPreviewTextBlock = getCssBlock(
      css,
      ".mermaid-flowchart-dialog-preview text",
    );
    const dialogPreviewNodeLabelBlock = getCssBlock(
      css,
      ".mermaid-flowchart-dialog-preview .nodeLabel",
    );
    const fullDialogBackdropBlock = getCssBlock(
      css,
      ".mermaid-flowchart-dialog-backdrop[data-view-mode='full']",
    );
    const fullDialogBlock = getCssBlock(
      css,
      ".mermaid-flowchart-dialog[data-view-mode='full']",
    );

    expect(hostBlock).toContain("display: none");
    expect(targetBlock).toContain("display: block");
    expect(targetBlock).toContain("min-width: 0");
    expect(targetBlock).toContain("padding: 0 12px 12px");
    expect(cardBlock).toContain("display: block");
    expect(cardBlock).toContain("user-select: none");
    expect(previewShellBlock).toContain("height: clamp");
    expect(previewShellBlock).toContain("overflow: hidden");
    expect(previewSvgBlock).toContain("place-items: center");
    expect(nestedSvgBlock).toContain("max-width: 100%");
    expect(nestedSvgBlock).toContain("max-height: 100%");
    expect(dialogViewportBlock).toContain("cursor: grab");
    expect(dialogPreviewBlock).toContain("translate");
    expect(dialogPreviewBlock).toContain("--flowchart-preview-pan-x");
    expect(dialogPreviewSvgBlock).toContain("user-select: text");
    expect(dialogPreviewTextBlock).toContain("user-select: text");
    expect(dialogPreviewNodeLabelBlock).toContain("user-select: text");
    expect(fullDialogBackdropBlock).toContain("padding: 0");
    expect(fullDialogBlock).toContain("width: 100%");
    expect(fullDialogBlock).toContain("max-height: none");
  });
});
