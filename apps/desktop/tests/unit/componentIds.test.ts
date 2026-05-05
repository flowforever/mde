import { describe, expect, it } from "vitest";

import {
  COMPONENT_IDS,
  COMPONENT_NAME_ID_MAP,
} from "../../src/renderer/src/componentIds";

const kebabComponentIdPattern =
  /^(app|workspace|explorer|editor|search|link|flowchart|ai|settings|updates)\.[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe("componentIds", () => {
  it("keeps the top-level component name map sorted by key", () => {
    const keys = Object.keys(COMPONENT_NAME_ID_MAP);

    expect(keys).toEqual([...keys].sort((left, right) => left.localeCompare(right)));
  });

  it("defines unique non-empty standard names and concrete component ids", () => {
    const entries = Object.values(COMPONENT_NAME_ID_MAP);
    const standardNames = entries.map((entry) => entry.standardName);
    const componentIds = entries.map((entry) => entry.componentId);

    expect(new Set(standardNames).size).toBe(standardNames.length);
    expect(new Set(componentIds).size).toBe(componentIds.length);

    for (const entry of entries) {
      expect(entry.standardName.trim()).toBe(entry.standardName);
      expect(entry.standardName).not.toHaveLength(0);
      expect(entry.componentId).toMatch(kebabComponentIdPattern);
      expect(entry.constantPath).not.toHaveLength(0);
    }
  });

  it("exposes JSX-friendly constants for key product areas", () => {
    expect(COMPONENT_IDS.app.shell).toBe(
      COMPONENT_NAME_ID_MAP.appShell.componentId,
    );
    expect(COMPONENT_IDS.explorer.newMarkdownFileButton).toBe(
      COMPONENT_NAME_ID_MAP.explorerNewMarkdownFileButton.componentId,
    );
    expect(COMPONENT_IDS.editor.markdownEditingSurface).toBe(
      COMPONENT_NAME_ID_MAP.editorMarkdownEditingSurface.componentId,
    );
    expect(COMPONENT_IDS.search.workspaceSearchDialog).toBe(
      COMPONENT_NAME_ID_MAP.searchWorkspaceSearchDialog.componentId,
    );
  });
});
