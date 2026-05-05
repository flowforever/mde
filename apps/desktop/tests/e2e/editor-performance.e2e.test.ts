import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

import { buildElectronApp, launchElectronApp } from "./support/electronApp";
import {
  EDITOR_PERFORMANCE_PRESETS,
  type CreatedEditorPerformanceWorkspace,
  createEditorPerformanceWorkspace,
} from "./support/editorPerformanceFixture";
import {
  evaluateEditorPerformanceBudget,
  formatEditorPerformanceFailures,
  parseEditorPerformanceBaseline,
} from "./support/editorPerformanceBudget";
import {
  createEditorPerformanceReport,
  serializeEditorPerformanceReport,
  summarizePerformanceRuns,
  type EditorPerformanceMode,
  type EditorPerformanceRun,
  type EditorPerformanceStageMetrics,
} from "./support/editorPerformanceMetrics";

const E2E_BUILD_TIMEOUT_MS = 600_000;
const E2E_PERFORMANCE_TIMEOUT_MS = 300_000;
const E2E_UI_READY_TIMEOUT_MS = 20_000;
const PERFORMANCE_MODE: EditorPerformanceMode =
  process.env.MDE_EDITOR_PERFORMANCE_MODE === "benchmark"
    ? "benchmark"
    : "smoke";
const PERFORMANCE_PRESET = EDITOR_PERFORMANCE_PRESETS[PERFORMANCE_MODE];

test.setTimeout(
  PERFORMANCE_MODE === "benchmark"
    ? E2E_PERFORMANCE_TIMEOUT_MS * 2
    : E2E_PERFORMANCE_TIMEOUT_MS,
);

test.beforeAll(async ({ browserName }, testInfo) => {
  void browserName;
  testInfo.setTimeout(E2E_BUILD_TIMEOUT_MS);
  await buildElectronApp();
});

const ensureWorkspaceDialogOpen = async (window: Page): Promise<void> => {
  const workspaceDialog = window.getByRole("dialog", {
    name: /workspace manager/i,
  });
  const workspaceDialogBackdrop = window.locator(".workspace-dialog-backdrop");
  const workspaceTrigger = window
    .getByRole("button", { name: /^open workspace$/i })
    .or(window.getByRole("button", { name: /manage workspaces/i }));

  if (
    await workspaceDialogBackdrop
      .isVisible({ timeout: E2E_UI_READY_TIMEOUT_MS })
      .catch(() => false)
  ) {
    return;
  }

  await workspaceTrigger.click({ timeout: E2E_UI_READY_TIMEOUT_MS });
  await expect(workspaceDialogBackdrop).toBeVisible();
  await expect(workspaceDialog).toBeVisible();
};

const openNewWorkspace = async (window: Page): Promise<void> => {
  await ensureWorkspaceDialogOpen(window);
  await window
    .getByRole("button", { name: /open new workspace/i })
    .click({ timeout: E2E_UI_READY_TIMEOUT_MS });
};

const rendererNow = (window: Page): Promise<number> =>
  window.evaluate(() => performance.now());

const elapsedSince = async (window: Page, startTime: number): Promise<number> =>
  Math.round(((await rendererNow(window)) - startTime) * 100) / 100;

const waitForFileContents = async (
  filePath: string,
  expectedText: string,
): Promise<void> => {
  await expect
    .poll(
      async () => {
        const contents = await readFile(filePath, "utf8").catch(() => "");

        return contents.includes(expectedText);
      },
      { timeout: 12_000 },
    )
    .toBe(true);
};

const pastePlainText = async (editable: Locator, text: string): Promise<void> => {
  await editable.evaluate((element, value) => {
    const dataTransfer = new DataTransfer();

    dataTransfer.setData("text/plain", value);
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer,
      }),
    );
  }, text);
};

const measureEditorPerformanceRun = async (
  fixture: CreatedEditorPerformanceWorkspace,
  iteration: number,
  warmup: boolean,
): Promise<EditorPerformanceRun> => {
  const { app, startupDiagnostics, window } = await launchElectronApp({
    args: [`--test-workspace=${fixture.workspacePath}`],
  });
  const stages: Partial<EditorPerformanceStageMetrics> = {};

  try {
    await openNewWorkspace(window);
    const fileButton = window.getByRole("button", {
      name: new RegExp(`${fixture.relativeDocumentPath} Markdown file`, "i"),
    });
    const editor = window.getByTestId("markdown-block-editor");
    const openStart = await rendererNow(window);

    await fileButton.click({ timeout: E2E_UI_READY_TIMEOUT_MS });
    await expect(editor).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS });
    stages.openEditorVisible = await elapsedSince(window, openStart);
    await expect(
      window.getByText(fixture.targets.firstScreenText, { exact: true }),
    ).toBeVisible({
      timeout: E2E_UI_READY_TIMEOUT_MS,
    });
    stages.openFirstBlockAttached = await elapsedSince(window, openStart);

    const editable = editor.locator('[contenteditable="true"]').first();
    const readyStart = await rendererNow(window);

    await editable.click({ timeout: E2E_UI_READY_TIMEOUT_MS });
    await expect
      .poll(() =>
        window.evaluate(() =>
          Boolean(document.activeElement?.closest('[contenteditable="true"]')),
        ),
      )
      .toBe(true);
    stages.readyToType = await elapsedSince(window, readyStart);

    const singleInputStart = await rendererNow(window);

    await window.keyboard.insertText(fixture.targets.singleInputText);
    await expect(window.getByText(fixture.targets.singleInputText).first()).toBeVisible({
      timeout: E2E_UI_READY_TIMEOUT_MS,
    });
    stages.singleInputVisible = await elapsedSince(window, singleInputStart);

    const bulkInputStart = await rendererNow(window);
    const bulkInputLines = fixture.targets.bulkInputText.split("\n");
    const lastBulkLine = bulkInputLines.at(-1) ?? "";

    await pastePlainText(editable, `\n${fixture.targets.bulkInputText}`);
    await expect(window.getByText(lastBulkLine).first()).toBeVisible({
      timeout: E2E_UI_READY_TIMEOUT_MS,
    });
    stages.bulkInputVisible = await elapsedSince(window, bulkInputStart);

    const scrollStart = await rendererNow(window);

    await window.locator(".editor-pane").evaluate((element) => {
      element.scrollTo({ top: element.scrollHeight });
    });
    await expect(
      window.getByText(fixture.targets.bottomText, { exact: true }),
    ).toBeVisible({ timeout: E2E_UI_READY_TIMEOUT_MS });
    stages.scrollBottomVisible = await elapsedSince(window, scrollStart);

    const autosaveStart = await rendererNow(window);

    await waitForFileContents(fixture.documentPath, lastBulkLine);
    stages.autosaveFileUpdated = await elapsedSince(window, autosaveStart);
    expect(startupDiagnostics.errors).toEqual([]);

    return {
      iteration,
      mode: PERFORMANCE_MODE,
      stages: stages as EditorPerformanceStageMetrics,
      warmup,
    };
  } finally {
    await app.close();
  }
};

const writePerformanceArtifacts = async (
  report: ReturnType<typeof createEditorPerformanceReport>,
  testInfo: TestInfo,
): Promise<void> => {
  const serialized = serializeEditorPerformanceReport(report);
  const playwrightReportPath = testInfo.outputPath(
    `editor-performance-${PERFORMANCE_MODE}.json`,
  );
  const stableReportPath = resolve(
    "test-results",
    `editor-performance-${PERFORMANCE_MODE}.json`,
  );

  await writeFile(playwrightReportPath, serialized, "utf8");
  await mkdir(resolve("test-results"), { recursive: true });
  await writeFile(stableReportPath, serialized, "utf8");
  await testInfo.attach(`editor-performance-${PERFORMANCE_MODE}`, {
    contentType: "application/json",
    path: playwrightReportPath,
  });
};

test(`keeps editor ${PERFORMANCE_MODE} performance inside budget`, async ({
  browserName,
}, testInfo) => {
  const baseline = parseEditorPerformanceBaseline(
    JSON.parse(
      await readFile(
        resolve("apps/desktop/tests/e2e/fixtures/editor-performance-baseline.json"),
        "utf8",
      ),
    ),
  );
  const runs: EditorPerformanceRun[] = [];
  const totalIterations =
    PERFORMANCE_PRESET.warmupCount + PERFORMANCE_PRESET.runCount;
  let lastFixture: CreatedEditorPerformanceWorkspace | null = null;

  for (let iteration = 0; iteration < totalIterations; iteration += 1) {
    const fixture = await createEditorPerformanceWorkspace({
      preset: PERFORMANCE_PRESET,
    });

    lastFixture = fixture;
    runs.push(
      await measureEditorPerformanceRun(
        fixture,
        iteration,
        iteration < PERFORMANCE_PRESET.warmupCount,
      ),
    );
  }

  if (!lastFixture) {
    throw new Error("Editor performance fixture was not created");
  }

  const summary = summarizePerformanceRuns(runs);
  const budget = evaluateEditorPerformanceBudget({
    baseline,
    mode: PERFORMANCE_MODE,
    summary,
  });
  const report = createEditorPerformanceReport({
    budget,
    environment: {
      browserName,
      node: process.version,
      platform: process.platform,
      runner: "playwright",
    },
    fixture: lastFixture.stats,
    mode: PERFORMANCE_MODE,
    runs,
    summary,
  });

  await writePerformanceArtifacts(report, testInfo);
  expect(
    budget.failures,
    formatEditorPerformanceFailures(budget.failures),
  ).toEqual([]);
});
