import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readAutomationCss = (): Promise<string> =>
  readFile(
    resolve("apps/desktop/src/renderer/src/automation/styles.css"),
    "utf8",
  );

const readThemeCss = (): Promise<string> =>
  readFile(resolve("apps/desktop/src/renderer/src/styles/theme.css"), "utf8");

const normalizeSelector = (selector: string): string =>
  selector.replace(/\s+/g, "");

const getCssBlock = (css: string, selector: string): string => {
  const normalizedSelector = normalizeSelector(selector);
  const blockPattern = /([^{}]+)\{([^}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(css)) !== null) {
    if (normalizeSelector(match[1].trim()) === normalizedSelector) {
      return match[2];
    }
  }

  throw new Error(`Missing CSS block for ${selector}`);
};

describe("Automation Center theme styles", () => {
  it("maps Automation Center action and status semantics to shared theme tokens", async () => {
    const themeCss = await readThemeCss();
    const appShellBlock = getCssBlock(themeCss, ".app-shell");

    expect(appShellBlock).toContain("--primary-action: var(--editor-accent);");
    expect(appShellBlock).toContain("--primary-action-text: var(--editor-bg);");
    expect(appShellBlock).toContain("--status-success: var(--editor-accent);");
  });

  it("keeps Automation Center status and CTA controls off fixed prototype colors", async () => {
    const css = await readAutomationCss();
    const statusBlocks = [
      ".automation-status-light--enabled",
      ".automation-task-card--ready",
      ".automation-flowline-phase--done::before",
    ].map((selector) => getCssBlock(css, selector).trim());
    const primaryActionBlock = getCssBlock(
      css,
      ".automation-flowline-start,\n.automation-agent-chat-button",
    );
    const taskStartBlock = getCssBlock(css, ".automation-task-start");
    const selectedTaskStackBlock = getCssBlock(
      css,
      ".automation-task-stack-row--selected,\n.automation-task-stack-row[aria-pressed='true']",
    );

    statusBlocks.forEach((block) => {
      expect(block).toContain("var(--status-success)");
    });
    [primaryActionBlock, taskStartBlock, selectedTaskStackBlock].forEach(
      (block) => {
        expect(block).toContain("var(--primary-action)");
      },
    );
    [primaryActionBlock, taskStartBlock].forEach((block) => {
      expect(block).toContain("var(--primary-action-text)");
    });

    expect(css).not.toContain("#2f8f5f");
    expect(css).not.toContain("#155eef");
    expect(css).not.toContain("#fff");
    expect(css).not.toContain("var(--accent)");
  });

  it("keeps Signal Stack and Flowline hierarchy on prototype-parity selectors", async () => {
    const css = await readAutomationCss();

    expect(getCssBlock(css, ".automation-card-queue")).toContain("gap:");
    expect(getCssBlock(css, ".automation-task-card__action")).toContain(
      "var(--primary-action)",
    );
    expect(getCssBlock(css, ".automation-diagnostic-row")).toContain(
      "grid-template-columns",
    );
    expect(getCssBlock(css, ".automation-flow-head")).toContain(
      "grid-template-columns",
    );
    expect(getCssBlock(css, ".automation-flowline-close")).toContain(
      "var(--panel-border)",
    );
    expect(getCssBlock(css, ".automation-flowline-actions")).toContain(
      "grid-template-columns",
    );
  });
});
