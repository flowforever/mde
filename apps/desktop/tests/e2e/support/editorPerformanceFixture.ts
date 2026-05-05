import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  EditorPerformanceFixtureStats,
  EditorPerformanceMode,
} from "./editorPerformanceMetrics";

export interface EditorPerformanceFixturePreset {
  readonly bulkInputLineCount: number;
  readonly codeBlockCount: number;
  readonly imageCount: number;
  readonly mermaidBlockCount: number;
  readonly mode: EditorPerformanceMode;
  readonly ordinaryBlockCount: number;
  readonly runCount: number;
  readonly warmupCount: number;
}

export interface EditorPerformanceTargets {
  readonly bottomText: string;
  readonly bulkInputText: string;
  readonly firstScreenText: string;
  readonly singleInputText: string;
}

export interface EditorPerformanceMarkdownFixture {
  readonly markdown: string;
  readonly stats: EditorPerformanceFixtureStats;
  readonly targets: EditorPerformanceTargets;
}

export interface CreatedEditorPerformanceWorkspace
  extends EditorPerformanceMarkdownFixture {
  readonly assetPaths: readonly string[];
  readonly documentPath: string;
  readonly relativeDocumentPath: string;
  readonly workspacePath: string;
}

export const EDITOR_PERFORMANCE_DOCUMENT_NAME = "performance.md";

export const EDITOR_PERFORMANCE_PRESETS = {
  benchmark: {
    bulkInputLineCount: 20,
    codeBlockCount: 22,
    imageCount: 3,
    mermaidBlockCount: 5,
    mode: "benchmark",
    ordinaryBlockCount: 2600,
    runCount: 3,
    warmupCount: 1,
  },
  smoke: {
    bulkInputLineCount: 20,
    codeBlockCount: 8,
    imageCount: 2,
    mermaidBlockCount: 3,
    mode: "smoke",
    ordinaryBlockCount: 900,
    runCount: 1,
    warmupCount: 0,
  },
} as const satisfies Record<
  EditorPerformanceMode,
  EditorPerformanceFixturePreset
>;

const IMAGE_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

const createCodeBlock = (index: number): string => {
  const languages = ["ts", "js", "json", "bash", "md", "yaml"] as const;
  const language = languages[index % languages.length];
  const body =
    index === 0
      ? Array.from(
          { length: 60 },
          (_, lineIndex) =>
            `const performanceLine${lineIndex} = "stable-${index}-${lineIndex}"`,
        ).join("\n")
      : [
          `// performance code block ${index}`,
          `const stage${index} = "editor-${index}"`,
          `console.log(stage${index})`,
        ].join("\n");

  return ["```" + language, body, "```"].join("\n");
};

const createMermaidBlock = (index: number): string =>
  [
    "```mermaid",
    "flowchart TD",
    `  A${index}[Open document] --> B${index}{Editable?}`,
    `  B${index} -->|yes| C${index}[Measure input]`,
    `  B${index} -->|no| D${index}[Fail performance guardrail]`,
    "```",
  ].join("\n");

const createOrdinaryBlock = (
  index: number,
  preset: EditorPerformanceFixturePreset,
  targets: EditorPerformanceTargets,
): string => {
  if (index === 1) {
    return `# ${targets.firstScreenText}`;
  }

  if (index === preset.ordinaryBlockCount) {
    return targets.bottomText;
  }

  if (index % 97 === 0) {
    return `## Performance Section ${index}`;
  }

  if (index % 53 === 0) {
    return "---";
  }

  if (index % 31 === 0) {
    return `> Blockquote ${index} keeps rendering paths realistic for editor performance.`;
  }

  if (index % 13 === 0) {
    return [
      `- Performance bullet ${index}.1 with inline \`code-${index}\``,
      `- Performance bullet ${index}.2 with deterministic content`,
    ].join("\n");
  }

  return `Paragraph ${index} for ${preset.mode} editor performance with inline \`token-${index}\`, a [relative link](docs/topic-${index}.md), and stable body text.`;
};

const shouldInsert = (
  currentIndex: number,
  insertedCount: number,
  targetCount: number,
  ordinaryBlockCount: number,
): boolean => {
  if (insertedCount >= targetCount) {
    return false;
  }

  const interval = Math.max(1, Math.floor(ordinaryBlockCount / (targetCount + 1)));

  return currentIndex % interval === 0;
};

export const buildEditorPerformanceMarkdown = (
  preset: EditorPerformanceFixturePreset,
): EditorPerformanceMarkdownFixture => {
  const targets: EditorPerformanceTargets = {
    bottomText: `Editor performance bottom anchor ${preset.mode}`,
    bulkInputText: Array.from(
      { length: preset.bulkInputLineCount },
      (_, index) => `performance bulk edit ${index + 1}`,
    ).join("\n"),
    firstScreenText: `Editor Performance First Screen Anchor ${preset.mode}`,
    singleInputText: `performance single edit ${preset.mode}`,
  };
  let codeBlockCount = 0;
  let imageCount = 0;
  let mermaidBlockCount = 0;
  const blocks: string[] = [
    [
      "---",
      "title: Editor Performance",
      `mode: ${preset.mode}`,
      "tags:",
      "  - performance",
      "  - e2e",
      "---",
    ].join("\n"),
  ];

  for (let index = 1; index <= preset.ordinaryBlockCount; index += 1) {
    blocks.push(createOrdinaryBlock(index, preset, targets));

    if (
      shouldInsert(
        index,
        imageCount,
        preset.imageCount,
        preset.ordinaryBlockCount,
      )
    ) {
      imageCount += 1;
      blocks.push(
        `![Performance image ${imageCount}](.mde/assets/performance-image-${imageCount}.png)`,
      );
    }

    if (
      shouldInsert(
        index,
        codeBlockCount,
        preset.codeBlockCount,
        preset.ordinaryBlockCount,
      )
    ) {
      blocks.push(createCodeBlock(codeBlockCount));
      codeBlockCount += 1;
    }

    if (
      shouldInsert(
        index,
        mermaidBlockCount,
        preset.mermaidBlockCount,
        preset.ordinaryBlockCount,
      )
    ) {
      blocks.push(createMermaidBlock(mermaidBlockCount));
      mermaidBlockCount += 1;
    }
  }

  return {
    markdown: `${blocks.join("\n\n")}\n`,
    stats: {
      codeBlockCount,
      imageCount,
      mermaidBlockCount,
      mode: preset.mode,
      ordinaryBlockCount: preset.ordinaryBlockCount,
      totalMarkdownBlocks:
        preset.ordinaryBlockCount + codeBlockCount + imageCount + mermaidBlockCount,
    },
    targets,
  };
};

export const createEditorPerformanceWorkspace = async ({
  preset,
  workspacePath,
}: {
  readonly preset: EditorPerformanceFixturePreset;
  readonly workspacePath?: string;
}): Promise<CreatedEditorPerformanceWorkspace> => {
  const rootPath =
    workspacePath ?? (await mkdtemp(join(tmpdir(), "mde-performance-e2e-")));
  const fixture = buildEditorPerformanceMarkdown(preset);
  const assetDirectoryPath = join(rootPath, ".mde", "assets");
  const assetPaths = Array.from(
    { length: preset.imageCount },
    (_, index) => join(assetDirectoryPath, `performance-image-${index + 1}.png`),
  );
  const documentPath = join(rootPath, EDITOR_PERFORMANCE_DOCUMENT_NAME);

  await mkdir(assetDirectoryPath, { recursive: true });
  await writeFile(documentPath, fixture.markdown, "utf8");
  await Promise.all(assetPaths.map((assetPath) => writeFile(assetPath, IMAGE_BYTES)));

  return {
    ...fixture,
    assetPaths,
    documentPath,
    relativeDocumentPath: EDITOR_PERFORMANCE_DOCUMENT_NAME,
    workspacePath: rootPath,
  };
};
