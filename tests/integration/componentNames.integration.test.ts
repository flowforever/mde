import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { COMPONENT_NAME_ID_MAP } from "../../apps/desktop/src/renderer/src/componentIds";

interface ManualComponentRow {
  readonly componentId: string;
  readonly standardName: string;
}

const MANUAL_PATH = join(
  process.cwd(),
  "user-manual",
  "zh-CN",
  "component-names.md",
);
const RENDERER_SOURCE_ROOT = join(
  process.cwd(),
  "apps",
  "desktop",
  "src",
  "renderer",
  "src",
);
const nonConcreteMarkers = ["命名规则", "第三方内部", "不分配"];

const normalizeMarkdownCodeCell = (cell: string): string =>
  cell.replace(/^`|`$/g, "");

const readRendererSources = async (directoryPath: string): Promise<string> => {
  const directoryEntries = await readdir(directoryPath, { withFileTypes: true });
  const sourceChunks = await Promise.all(
    directoryEntries
      .filter((entry) => entry.name !== "componentIds.ts")
      .map(async (entry) => {
        const entryPath = join(directoryPath, entry.name);

        if (entry.isDirectory()) {
          return readRendererSources(entryPath);
        }

        if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) {
          return "";
        }

        return readFile(entryPath, "utf8");
      }),
  );

  return sourceChunks.join("\n");
};

const parseManualComponentRows = (markdown: string): readonly ManualComponentRow[] =>
  markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && !line.includes("---"))
    .map((line) =>
      line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim()),
    )
    .filter(
      (cells) =>
        cells.length >= 6 &&
        cells[0] !== "Standard Name" &&
        cells[0].length > 0,
    )
    .map(([standardName, componentId]) => ({
      componentId: normalizeMarkdownCodeCell(componentId),
      standardName,
    }));

const isConcreteManualRow = (row: ManualComponentRow): boolean =>
  nonConcreteMarkers.every((marker) => !row.componentId.includes(marker));

describe("component naming reference", () => {
  it("keeps the manual concrete component table in sync with componentIds.ts", async () => {
    const manual = await readFile(MANUAL_PATH, "utf8");
    const manualRows = parseManualComponentRows(manual);
    const concreteManualRows = manualRows.filter(isConcreteManualRow);
    const mappedEntries = Object.values(COMPONENT_NAME_ID_MAP);

    expect(concreteManualRows.length).toBeGreaterThan(60);

    for (const row of concreteManualRows) {
      expect(mappedEntries).toContainEqual(
        expect.objectContaining({
          componentId: row.componentId,
          standardName: row.standardName,
        }),
      );
    }

    for (const entry of mappedEntries) {
      expect(concreteManualRows).toContainEqual({
        componentId: entry.componentId,
        standardName: entry.standardName,
      });
    }
  });

  it("binds every concrete component id to a renderer data-component-id constant reference", async () => {
    const rendererSources = await readRendererSources(RENDERER_SOURCE_ROOT);

    expect(rendererSources).toContain("data-component-id={");

    for (const entry of Object.values(COMPONENT_NAME_ID_MAP)) {
      expect(rendererSources).toContain(`COMPONENT_IDS.${entry.constantPath}`);
    }
  });
});
