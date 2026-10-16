# Remove Automation Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the desktop Automation Flow feature completely while retaining ordinary Markdown editing, Agent Chat, and existing user data.

**Architecture:** Remove the renderer and authoring integration first, then retire the main-process runtime, bridge contracts, package, and packaged helper together. Keep ordinary editor and Agent Chat interfaces intact. These are local development commits in one final change; intermediate commits are not releases.

**Tech Stack:** TypeScript, Electron, React, BlockNote, pnpm 10.18.2, electron-vite, Vitest, Testing Library, Playwright, VitePress.

**Spec:** [Approved removal specification](../specs/2026-10-16-remove-automation-flow-design.md). Read both documents before execution. The user approved the written specification and this plan on 2026-10-16. Native execution completed locally; verification is recorded in the specification.

## Global Constraints

- “Existing user flow definitions, executor documents, task sources, and execution history remain on disk.”
- “No cleanup migration runs.”
- “Keep root orchestration script names stable.”
- “Keep `auto-pick-tasks`, `execute-picked-task`, and `release-new-version`.”
- “Keep the existing editor window-mode argument and parser, accepting only the editor mode.”
- “Do not edit or remove user-global skill directories or previously installed links as an upgrade side effect.”
- “If remaining UI copy changes meaning, add a new language-pack key as required by the repository; do not reuse an old key for changed semantics.”
- “New desktop tests remain under `apps/desktop/tests/`; Agent Chat tests stay reachable through its package scripts.”
- Production changes include relevant UT, IT, and E2E changes in the same branch. Keep component IDs, their alphabetically sorted map, and the public component reference consistent.
- Preserve historical release notes and past internal designs. Current source/configuration must have no live automation dependency; removal tests and old-data guidance may mention retired identifiers.
- Use the project-pinned pnpm and `pnpm-lock.yaml`. Resolve the recorded package-manager fetch failure and missing dependencies before relying on runtime verification; changing the pinned version or disabling integrity checks is outside this plan.
- Work in an isolated execution workspace following `superpowers:using-git-worktrees`. Preserve unrelated user changes. No product code or dependency installation occurs during plan preparation.

## Review Focus

1. Malformed legacy JSON, stale owner/lock files, and paths with spaces or Unicode must neither prevent startup nor be rewritten; Task 2 tests snapshots before startup and after shutdown.
2. A retired window-mode argument or flow-management launch event must not recreate automation, while ordinary file/workspace window routing continues to work; Task 2 tests the mode parser, launch listener, and retained window lifecycle.
3. Old localStorage state and custom language packs containing extra automation keys must remain harmless in both English and Chinese; Task 1 tests the remaining Explorer controls and language fallback.
4. A stale extra authoring-context property must never inject executor instructions into chat, and literal automation-related text in a user document must remain intact; Task 1 tests both manifest normalization and the emitted Codex prompt.
5. Multiple editor windows and native chat-session bindings must remain independent, including workspace switches and explicit session resume; Tasks 1 and 2 retain the existing chat/workspace regressions and migrate editor cases out of mixed automation suites.

## File Map and Responsibilities

| Area | Files | Responsibility after execution |
| --- | --- | --- |
| Renderer entry | `apps/desktop/src/renderer/src/main.tsx`, `windowRoot.tsx` | Render the editor only. |
| Editor shell and Explorer | `apps/desktop/src/renderer/src/app/App.tsx`, `explorer/ExplorerPane.tsx` | Workspace/file operations and ordinary document chat. |
| UI metadata | `apps/desktop/src/renderer/src/componentIds.ts`, `i18n/appLanguage.ts`, `styles/theme.css` | Remaining component IDs, bilingual copy, and styles. |
| Chat context | `packages/agent-chat/src/context.ts`, `types.ts`, `context.test.ts` | Document/selection context, editor host, document/debug purposes. |
| Main process and bridge | `apps/desktop/src/main/index.ts`, `main/ipc/channels.ts`, `main/ipc/registerWorkspaceHandlers.ts`, `main/ipc/registerAgentChatHandlers.ts`, `preload/index.ts`, `preload/editorApi.ts`, `shared/windowApi.ts`, `shared/windowMode.ts`, `shared/workspace.ts` | Normal startup, remaining IPC, editor windows, validated chat requests. |
| Desktop build/config | `apps/desktop/package.json`, `electron.vite.config.ts`, `electron-builder.json`, `vitest.config.ts` | Remaining desktop dependencies, resources, tests, and aliases. |
| Workspace config | `tsconfig.json`, `vitest.config.ts`, `pnpm-lock.yaml` | Remaining package references and test aggregation. Root script names remain stable. |
| Deleted feature | `apps/desktop/src/renderer/src/automation/`, `apps/desktop/src/main/services/automation/`, `apps/desktop/src/main/ipc/registerAutomationHandlers.ts`, `apps/desktop/src/preload/automationApi.ts`, `apps/desktop/src/shared/automation.ts`, `apps/desktop/src/shared/automationRuntime.ts`, `packages/automation-flow/` | Removed, with no replacement subsystem. |
| Deleted distributed skill | `skills/automation-flow-helper/`, `.codex/skills/automation-flow-helper` | Removed from the repository and Electron resources. |
| New regression support | `apps/desktop/tests/e2e/support/legacyAutomationFixture.ts` | Synthetic legacy data and byte-preservation snapshots, confined to test-owned roots. |
| Public documentation | `user-manual/.vitepress/config.ts`, `user-manual/zh-CN/index.md`, `workspace.md`, `component-names.md`, `public/screenshots/zh-CN/` | Current UI and explicit retained-data guidance. Delete `user-manual/zh-CN/automation.md`. |

Paths abbreviated in the table are relative to the preceding fully qualified directory in the same cell. Task lists below give the exact test locations.

### Task 1: Remove Flow UI and Flow-Specific Chat Authoring

**Files:**

- Modify the renderer entry, shell, Explorer, UI metadata, chat-context files, and public documentation from the file map.
- Delete `apps/desktop/src/renderer/src/automation/`.
- Rename `apps/desktop/tests/unit/ExplorerPaneAutomationHome.test.tsx` to `apps/desktop/tests/unit/ExplorerPaneFeatureRemoval.test.tsx`; retain its `createState` helper and English text setup.
- Modify `apps/desktop/tests/unit/shell.test.tsx`, `componentIds.test.ts`, `appLanguage.test.ts`, and `packages/agent-chat/src/context.test.ts`.
- Modify `apps/desktop/tests/integration/componentNames.integration.test.ts` and `apps/desktop/tests/e2e/markdown-editor.e2e.test.ts`, `agent-chat.e2e.test.ts`.
- Delete renderer-only suites: `apps/desktop/tests/unit/AutomationCenterWindow.test.tsx`, `AutomationCenterWindowShell.test.tsx`, `AutomationFlowEditorHost.test.tsx`, `ExplorerPaneAutomationFlows.test.tsx`, `QuietFlowline.test.tsx`, `SignalStack.test.tsx`, `WorkspaceFlowFilters.test.tsx`, `automationViewModel.test.ts`; `apps/desktop/tests/integration/automationCenterStyles.integration.test.ts`, `automationFlowEditor.integration.test.ts`; `apps/desktop/tests/e2e/automation-center.e2e.test.ts`.
- Modify `apps/desktop/package.json` E2E scripts. Keep its automation package dependency until Task 2.

**Interfaces:**

- Consumes existing `ExplorerPane` normal file callbacks, `AppState`, `createAppText`, and the document fields of `AgentChatContextManifest`.
- Produces `MdeWindowRoot(): ReactElement`, rendered as `<MdeWindowRoot />`; `AgentChatContextManifest` retains document/model/permission/selection/workspace fields and loses `automationAuthoringContext`.
- Keeps `AgentChatHost`, `AgentChatSessionPurpose`, and the automation preload/main interfaces temporarily available to the backend until Task 2. This avoids breaking its adapters during the first local commit.

- [x] **Step 1: Establish the execution workspace and verification baseline.** Read `AGENTS.md`, both documents, and `git status`. Use `superpowers:using-git-worktrees` before product edits. Restore access to the pinned package manager and install the existing lockfile without changing dependency declarations.

```sh
pnpm --version
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm --filter @mde/agent-chat test
```

Expected: pnpm reports `10.18.2`; commands exit zero. If setup still fails, record the actual error and stop execution before claiming a passing baseline. Keep any pre-existing test failure distinct from a removal regression.

- [x] **Step 2: Write the failing Explorer UT in the renamed Home suite.** Keep the existing `createState` helper, `text`, Testing Library setup, and `afterEach`. Replace the Home-specific tests with retained-controls coverage:

```tsx
it.each(['en', 'zh'] as const)('has normal controls without automation in %s', (language) => {
  localStorage.setItem('mde.explorerAutomationFlowsPanel', 'collapsed');
  const legacyValue = localStorage.getItem('mde.explorerAutomationFlowsPanel');
  const text = createAppText(BUILT_IN_APP_LANGUAGE_PACKS[language]);
  const { container } = render(
    <ExplorerPane
      onCreateFile={vi.fn()}
      onCreateFolder={vi.fn()}
      onDeleteEntry={vi.fn()}
      onOpenWorkspace={vi.fn()}
      onRenameEntry={vi.fn()}
      onSelectEntry={vi.fn()}
      onSelectFile={vi.fn()}
      state={createState()}
      text={text}
    />,
  );
  expect(container.querySelector('[data-component-id="explorer.automation-home-button"]')).toBeNull();
  expect(container.querySelector('[data-component-id="explorer.automation-flows-panel"]')).toBeNull();
  expect(screen.getByRole('button', { name: text('explorer.collapseSidebar') })).toBeVisible();
  expect(localStorage.getItem('mde.explorerAutomationFlowsPanel')).toBe(legacyValue);
});
```

Keep the collapsed-sidebar test, removing its retired callback prop. Add the same absence assertion with a real workspace state using the existing flow-suite `createState` workspace object before retiring that suite. In `appLanguage.test.ts`, preserve existing custom-pack parsing/fallback tests and add an extra retired `explorer.openAutomationCenter` override to a custom-pack fixture: normal Explorer labels still resolve through `createAppText`, and the old key creates no UI.

- [x] **Step 3: Write the failing chat-context UT.** Replace the two authoring-context tests in `packages/agent-chat/src/context.test.ts` with the following test; ordinary context and attachment tests remain:

```ts
it('treats a legacy flow document as document content without executor instructions', () => {
  const legacyManifest = {
    automationAuthoringContext: {
      diagnostics: ['LEGACY-DIAGNOSTIC'],
      executorRefs: ['LEGACY-EXECUTOR'],
      flowPath: '.mde/automation-flows/review.md',
    },
    currentDocumentPath: '/workspace/.mde/automation-flows/review.md',
    currentDocumentSnapshot: '# Automation flow authoring context: user-owned text',
    permissionMode: 'max-permission' as const,
    selectedBlockIds: ['block-1'],
    selectedText: 'user-owned text',
    sessionPurpose: 'document-chat' as const,
    workspaceRoot: '/workspace',
  };
  const normalized = validateAgentChatContextManifest(legacyManifest);
  expect(normalized).not.toHaveProperty('automationAuthoringContext');
  const items = buildCodexUserInputItems({
    attachments: [], content: 'Explain this document', contextManifest: legacyManifest,
    sessionId: 'chat-legacy', workspaceRoot: '/workspace',
  });
  const item = items.find((entry) => entry.type === 'text');
  expect(item?.type === 'text' ? item.text : '').toContain(legacyManifest.currentDocumentSnapshot);
  expect(item?.type === 'text' ? item.text : '').not.toContain('LEGACY-EXECUTOR');
  expect(item?.type === 'text' ? item.text : '').not.toContain('LEGACY-DIAGNOSTIC');
});
```

The variable has extra properties deliberately: structural typing permits testing old wire data after the public type loses that field. Test both raw prompt building and normalization so neither path can inject the stale property.

- [x] **Step 4: Add the corresponding IT and desktop E2E failures.** In `componentNames.integration.test.ts`, replace only the automation-location assertion with:

```ts
it('has no retired automation component entries', () => {
  const entries = Object.values(COMPONENT_NAME_ID_MAP);
  expect(entries.some((entry) => entry.componentId.startsWith('automation.'))).toBe(false);
  expect(entries.some((entry) => /explorer\.automation-|explorer\.(?:add|apply|delete|jump|refresh|remove|rename).*automation/u.test(entry.componentId))).toBe(false);
});
```

Keep the existing full manual-to-map equality, consumer, and alphabetic-order checks; remove individual retired expectations in `componentIds.test.ts` without weakening remaining entries. Replace the Automation Center window-opening case in `markdown-editor.e2e.test.ts` with normal Explorer controls and no automation selectors, then edit README and assert saved content using its existing editing/save helpers. In `agent-chat.e2e.test.ts`, add a case launching with a synthetic old flow Markdown path as an ordinary command-line file resource: the editor and chat panel show that document and send/receive a normal fake response. Reuse its existing `installFakeCodexCli` helper and `launchElectronApp`; no new runtime test switch. The essential setup is:

```ts
const workspacePath = await createFixtureWorkspace();
const flowRoot = join(workspacePath, '.mde', 'automation-flows');
await mkdir(flowRoot, { recursive: true });
const flowPath = join(flowRoot, 'legacy.md');
await writeFile(flowPath, '# Legacy flow document\n', 'utf8');
const fakeBinPath = await installFakeCodexCli();
const { app, window } = await launchElectronApp({
  args: [flowPath],
  env: { MDE_E2E_AGENT_CHAT_FAKE_CODEX: '1', PATH: `${fakeBinPath}${delimiter}${process.env.PATH ?? ''}` },
});
```

Then use the existing visible Agent Chat button, complementary panel, message textbox, Send button, and `Fake codex response` assertion from the first test; close this app in `finally`. An IPC call that merely returns a workspace object is not a replacement for the renderer opening a document.

```ts
await expect(window.locator('[data-component-id="explorer.automation-home-button"]')).toHaveCount(0);
await expect(window.locator('[data-component-id="explorer.automation-flows-panel"]')).toHaveCount(0);
expect(app.windows()).toHaveLength(1);
```

- [x] **Step 5: Run red tests before changing production code.**

```sh
pnpm --filter @mde/desktop test:unit tests/unit/ExplorerPaneFeatureRemoval.test.tsx
pnpm --filter @mde/agent-chat test:unit src/context.test.ts
pnpm --filter @mde/desktop test:integration tests/integration/componentNames.integration.test.ts
pnpm exec playwright test --config apps/desktop/playwright.config.ts apps/desktop/tests/e2e/markdown-editor.e2e.test.ts --grep 'without automation'
```

Name the replacement E2E case `opens and saves a workspace without automation controls` so the last command selects it. Expected red failures: old Home/panel, old component-map entries, and injected executor context. An import/configuration error is not the intended red result.

- [x] **Step 6: Remove the renderer integration and context implementation.** Remove automation imports, state, projection-refresh effects, flow/executor/global-flow callbacks, specialized launch branch, authoring-path/context helpers, and Explorer callback wiring from `App.tsx`. Remove flow state/storage/render functions and props from `ExplorerPane.tsx`, retaining normal Explorer and Recent Files. Replace the window root with:

```tsx
import type { ReactElement } from 'react';
import { App } from './app/App';

export const MdeWindowRoot = (): ReactElement => <App />;
```

Update `main.tsx` to render `<MdeWindowRoot />` and drop its unused window-mode import. At the existing App launch listener, process the remaining recognized `workspace-file` object and string paths explicitly; ignore other object shapes while Task 2 still owns removal of the shared flow launch variant. Delete the renderer automation directory and its exclusive styles. In the chat package, delete `AgentChatAutomationAuthoringContext`, the manifest field, its normalization block, and `buildAutomationAuthoringContextSection`; remove that section from `buildCodexUserInputItems`. Keep model, selection, document text, attachments, and permission validation unchanged. Leave automation host/purpose types for Task 2.

- [x] **Step 7: Align tests, copy, component reference, and the current manual.** Remove feature-only UI suites listed above. In `shell.test.tsx`, delete only flow-panel launch/global-executor fixtures and assertions; retain ordinary multi-window, file-history, workspace, and Agent Chat cases. Remove automation-only keys from both built-in language packs and their exclusive tests. Remove retired component entries/aliases and corresponding manual rows in the same edit. Delete the Automation Center manual page/navigation and replace the workspace Automation Flows section with the exact retained-data guidance:

```markdown
## 旧版自动化数据

MDE 已移除 Automation Center 和 Automation Flow 管理及自动执行功能。
已有流程、执行器、任务文档和运行历史仍保留在原位置，应用不会自动清理或执行它们。
需要查看或修改旧流程 Markdown 时，可以按普通文件打开和编辑。
```

Keep Recent Files prose under its own heading. Remove current feature claims from `user-manual/zh-CN/index.md`; distinguish retained old-data paths from supported runtime storage. Update `apps/desktop/package.json` default E2E script to run Markdown and Agent Chat suites followed by the existing performance smoke command; delete `test:e2e:automation-center`.

- [x] **Step 8: Verify this deliverable and commit only its files.** Run the red commands again, the full desktop unit/integration scripts, `pnpm --filter @mde/agent-chat test`, `pnpm run lint`, `pnpm run typecheck`, and `pnpm run docs:build`. Run the existing Agent Chat E2E suite. Expected: all pass; package/runtime automation tests remain available until Task 2. Stage only the listed renderer, context, tests, script, and manual paths, inspect `git diff --cached --check`, and commit as `feat: remove automation flow interfaces and authoring context`.

### Task 2: Remove Runtime, IPC, Package, and Distributed Helper

**Files:**

- Modify the main-process/bridge, desktop build/config, workspace config, and Agent Chat types from the file map.
- Delete the remaining feature directories/files and distributed helper from the file map.
- Create `apps/desktop/tests/unit/windowMode.test.ts`, `apps/desktop/tests/integration/preloadSurface.integration.test.ts`, `apps/desktop/tests/integration/desktopBootstrap.integration.test.ts`, `apps/desktop/tests/e2e/support/legacyAutomationFixture.ts`, and `apps/desktop/tests/e2e/automation-removal.e2e.test.ts`.
- Modify `apps/desktop/tests/integration/agentChatHandlers.integration.test.ts`, `dropOpenPreload.integration.test.ts`, `monorepoOwnership.integration.test.ts`, and `apps/desktop/package.json`.
- Migrate ordinary editor lifecycle cases from `apps/desktop/tests/integration/automationCenterWindow.integration.test.ts` into `apps/desktop/tests/integration/editorWindow.integration.test.ts`, preserving its `FakeBrowserWindow` implementation and constructor helper.
- Delete remaining automation-only desktop suites whose subject is a deleted module: `apps/desktop/tests/unit/automation*.test.ts`, `agentChatAutomationAdapter.test.ts`, `mdeRuntimeBridge.test.ts`; `apps/desktop/tests/integration/automationAdapterCapability.integration.test.ts`, `automationHandlers.integration.test.ts`, `automationIndex.integration.test.ts`, `automationPreload.integration.test.ts`, `automationRunLifecycle.integration.test.ts`, `automationRuntimeCoordination.integration.test.ts`.

**Interfaces:**

- Consumes Task 1's editor-only root and ordinary document-chat context.
- Produces `AgentChatHost = 'editor'`, `AgentChatSessionPurpose = 'document-chat' | 'debug'`, `WorkspaceLaunchResource = string | WorkspaceFileLaunchResource`, and a window API containing `focusWorkspaceWindow` and `getWindowMode` only.
- Retains `getWindowModeFromArgv(argv: readonly string[]): MdeWindowMode`; its only mode is `editor` and unknown modes return that value.
- Adds test-only `seedLegacyAutomationFixture(input: { workspaceRoot: string; homeRoot: string; userDataRoot: string }): Promise<readonly string[]>` and `snapshotTree(root: string): Promise<Record<string, string>>`.

- [x] **Step 1: Add failing parser and chat-handler tests.** Use this complete parser case in the new desktop UT:

```ts
import { describe, expect, it } from 'vitest';
import { getWindowModeFromArgv, isMdeWindowMode } from '../../src/shared/windowMode';

describe('editor-only window modes', () => {
  it('falls back to the editor for the retired mode', () => {
    expect(isMdeWindowMode('automation-center')).toBe(false);
    expect(getWindowModeFromArgv(['--mde-window-mode=automation-center'])).toBe('editor');
    expect(getWindowModeFromArgv(['--mde-window-mode=unknown'])).toBe('editor');
    expect(getWindowModeFromArgv(['--mde-window-mode=editor'])).toBe('editor');
  });
});
```

Inside the existing `agentChatHandlers integration` describe, reuse its actual `registerHandlers` helper. Reject retired host/purpose values before calling the runtime; preserve explicit editor/document/debug requests and existing omitted-field defaults:

```ts
it.each([
  { host: 'automation-center', sessionPurpose: 'document-chat' },
  { host: 'editor', sessionPurpose: 'automation-task' },
])('rejects a retired chat request: %j', async (retired) => {
  const { handlers, runtime } = registerHandlers();
  await expect(handlers.get(AGENT_CHAT_CHANNELS.createDraftSession)!(
    { sender: { id: 1, send: vi.fn() } },
    { engineId: 'codex', workspaceRoot: '/workspace', ...retired },
  )).rejects.toThrow();
  expect(runtime.createDraftSession).not.toHaveBeenCalled();
});
```

- [x] **Step 2: Add actual bridge and bootstrap integration coverage.** In `preloadSurface.integration.test.ts`, bundle `apps/desktop/src/preload/index.ts` in memory through Vite (`configFile: false`, SSR build, `write: false`, CJS output, `electron` external). Run the generated chunk through `node:vm.runInNewContext` with a fake `require('electron')`, `process.argv`, and module/exports objects. Capture `contextBridge.exposeInMainWorld` and `ipcRenderer.invoke`; assert these actual exposures:

```ts
expect([...exposed.keys()].sort()).toEqual([
  'agentChatApi', 'aiApi', 'editorApi', 'markdownEditorShell', 'mdeWindow', 'updateApi',
]);
expect(Object.keys(exposed.get('mdeWindow') as object).sort()).toEqual([
  'focusWorkspaceWindow', 'getWindowMode',
]);
expect(exposed.has('mdeAutomation')).toBe(false);
```

`exposed` is a local `Map<string, unknown>` populated by the fake bridge's `(name, value) => exposed.set(name, value)`. Use actual `createEditorApi` and `createAgentChatApi` code from that bundle, not replacements. Invoke one normal workspace method and chat availability method and check their existing channel constants. This tests the public exposure contract without reading source substrings.

For `desktopBootstrap.integration.test.ts`, use `vi.mock('electron')` with an isolated temporary `app.getPath` root, `whenReady`, `requestSingleInstanceLock`, lifecycle listeners, `addRecentDocument`, and a fake BrowserWindow implementing the retained window-suite methods plus `webContents.on/send/id`. Stub CLI auto-registration and updater setup to avoid unrelated external effects. Set `MDE_E2E_AGENT_CHAT_FAKE_CODEX=1`, remove `VITEST` only around a fresh dynamic import of the main entry, and wait for the first window's `loadFile` call. Capture actual `ipcMain.handle` registrations:

```ts
const channels = ipcMain.handle.mock.calls.map(([channel]) => String(channel));
expect(channels).toEqual(expect.arrayContaining([
  AGENT_CHAT_CHANNELS.createDraftSession,
  WORKSPACE_CHANNELS.consumeLaunchPath,
  WINDOW_CHANNELS.focusWorkspaceWindow,
]));
expect(channels.some((channel) => channel.startsWith('automation:'))).toBe(false);
expect(channels).not.toContain('window:open-automation-center');
```

Restore environment variables, mocks, and temporary data after each test. Keep the bootstrap function private; no production export or new service layer is needed for this test.

- [x] **Step 3: Add launch-listener and retained-window regressions.** In `dropOpenPreload.integration.test.ts`, create the real `createEditorApi` with `on/invoke/removeListener` spies; subscribe through `onLaunchPath` and call the listener captured in `on.mock.calls`. An old `{ type: 'workspace-automation-flows', workspaceRoot: '/workspace' }` must not call the client callback; `'/workspace'` and `{ type: 'workspace-file', workspaceRoot: '/workspace', filePath: 'README.md' }` must call it. Dispose and assert the listener is removed. Migrate existing main-window creation, security options, last-argument precedence, focus/close, and webContents-ID lookup tests into `editorWindow.integration.test.ts`; remove only Center-manager cases.

- [x] **Step 4: Add synthetic legacy fixture support and an E2E that fails on the current runtime.** The fixture writes these relative paths under caller-owned roots with `mkdir(dirname(path), { recursive: true })` and `writeFile`, returning the protected roots listed after this table:

| Root | Relative path | Content |
| --- | --- | --- |
| Workspace | `.mde/automation-flows/legacy.md` | `# Legacy flow\n` |
| Workspace | `.mde/automation-flows/legacy/execute.md` | `# Legacy executor\n` |
| Workspace | `.mde/automation-flows/archived/older.md` | `# Archived legacy flow\n` |
| Workspace | `.mde/automation-flows/.applied-global-flows.json` | `{"flowIds":["legacy"]}\n` |
| Workspace | `.mde/docs/tasks/ready-legacy.md` | `# READY Legacy task\n` |
| Home | `.mde/automation-flows/global.md` | `# Global legacy flow\n` |
| User data | `automation/runtime-owner.json` | `{"ownerId":"old-owner","processId":0}\n` |
| User data | `automation/runs/broken.json` | `{broken` |
| User data | `automation/reports/old.md` | `# Old report\n` |
| User data | `automation/automation-flow-runtime/old-lock.json` | `{"state":"running"}\n` |

Protect only `workspace/.mde/automation-flows`, `workspace/.mde/docs`, `home/.mde/automation-flows`, and `userData/automation`. Also create and protect the isolated empty `home/.codex/skills` and `home/.agents/skills` directories to detect startup installing a helper. Normal `.mde/agent-chat` and document-history writes are allowed outside those protected roots; never snapshot an entire workspace `.mde` directory as immutable. Implement `snapshotTree` as recursive `readdir({ withFileTypes: true })`, recording directory entries and file bytes (base64) under relative keys; preserve symlink targets with `readlink` without following them. Record missing roots distinctly so deletion cannot compare equal to an empty directory. Parameterize one run with a pre-existing fixture helper link and verify its target remains unchanged; its source and destination both live inside the isolated home root.

Use these test-only implementations in `support/legacyAutomationFixture.ts`:

```ts
import { mkdir, readFile, readdir, readlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const seedLegacyAutomationFixture = async (input: {
  workspaceRoot: string; homeRoot: string; userDataRoot: string;
}): Promise<readonly string[]> => {
  const { workspaceRoot, homeRoot, userDataRoot } = input;
  const files: readonly (readonly [string, string])[] = [
    [join(workspaceRoot, '.mde/automation-flows/legacy.md'), '# Legacy flow\n'],
    [join(workspaceRoot, '.mde/automation-flows/legacy/execute.md'), '# Legacy executor\n'],
    [join(workspaceRoot, '.mde/automation-flows/archived/older.md'), '# Archived legacy flow\n'],
    [join(workspaceRoot, '.mde/automation-flows/.applied-global-flows.json'), '{"flowIds":["legacy"]}\n'],
    [join(workspaceRoot, '.mde/docs/tasks/ready-legacy.md'), '# READY Legacy task\n'],
    [join(homeRoot, '.mde/automation-flows/global.md'), '# Global legacy flow\n'],
    [join(userDataRoot, 'automation/runtime-owner.json'), '{"ownerId":"old-owner","processId":0}\n'],
    [join(userDataRoot, 'automation/runs/broken.json'), '{broken'],
    [join(userDataRoot, 'automation/reports/old.md'), '# Old report\n'],
    [join(userDataRoot, 'automation/automation-flow-runtime/old-lock.json'), '{"state":"running"}\n'],
  ];
  for (const [path, content] of files) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, 'utf8');
  }
  const roots = [
    join(workspaceRoot, '.mde/automation-flows'), join(workspaceRoot, '.mde/docs'),
    join(homeRoot, '.mde/automation-flows'), join(userDataRoot, 'automation'),
    join(homeRoot, '.codex/skills'), join(homeRoot, '.agents/skills'),
  ];
  for (const root of roots) await mkdir(root, { recursive: true });
  return roots;
};

export const snapshotTree = async (root: string): Promise<Record<string, string>> => {
  const snapshot: Record<string, string> = {};
  const visit = async (relativePath: string): Promise<void> => {
    const entries = await readdir(join(root, relativePath), { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const relative = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      const path = join(root, relative);
      if (entry.isSymbolicLink()) snapshot[`link:${relative}`] = await readlink(path);
      else if (entry.isDirectory()) {
        snapshot[`dir:${relative}`] = '';
        await visit(relative);
      } else snapshot[`file:${relative}`] = (await readFile(path)).toString('base64');
    }
  };
  try { await visit(''); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { 'missing:root': '' };
  }
  return snapshot;
};
```

Launch this new E2E directly with Playwright `_electron.launch` and the existing `createElectronLaunchEnv` function. The current `launchElectronApp` helper deletes its user-data root on close and therefore cannot prove shutdown preservation. Use `mkdtemp` roots with a `workspace 空间` child, seed before launch, and retain all three roots until assertions finish. The process arguments are `['--lang=en-US', 'apps/desktop/out/main/index.js', workspaceRoot]`; supply isolated `e2eUserDataPath`, `MDE_E2E_HOME_PATH`, and `MDE_DISABLE_AUTO_UPDATE=1` through the launch-env helper.

Use this test body with the imports and build hook shown here:

```ts
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { _electron as electron, type ElectronApplication } from 'playwright';
import { buildElectronApp } from './support/electronApp';
import { createElectronLaunchEnv } from './support/e2eLaunchEnv';
import { createFixtureWorkspace } from './support/fixtureWorkspace';
import { seedLegacyAutomationFixture, snapshotTree } from './support/legacyAutomationFixture';

test.setTimeout(120_000);
test.beforeAll(async ({ browserName }, testInfo) => {
  void browserName;
  testInfo.setTimeout(900_000);
  await buildElectronApp();
});

test('preserves legacy automation files through startup, editing, and shutdown', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'mde-retired-flow-'));
  const originalWorkspace = await createFixtureWorkspace();
  const workspaceRoot = join(fixtureRoot, 'workspace 空间');
  const homeRoot = join(fixtureRoot, 'home');
  const userDataRoot = join(fixtureRoot, 'user-data');
  // Copy the standard workspace so this test has its own Unicode path.
  const { cp } = await import('node:fs/promises');
  await cp(originalWorkspace, workspaceRoot, { recursive: true });
  await mkdir(homeRoot, { recursive: true });
  await mkdir(userDataRoot, { recursive: true });
  const protectedRoots = await seedLegacyAutomationFixture({ workspaceRoot, homeRoot, userDataRoot });
  const before = await Promise.all(protectedRoots.map(snapshotTree));
  let app: ElectronApplication | undefined;
  try {
    app = await electron.launch({
      args: ['--lang=en-US', 'apps/desktop/out/main/index.js', workspaceRoot],
      env: createElectronLaunchEnv({
        e2eUserDataPath: userDataRoot,
        overrideEnv: {
          MDE_E2E_HOME_PATH: homeRoot,
          MDE_DISABLE_AUTO_UPDATE: '1',
          MDE_E2E_AGENT_CHAT_FAKE_CODEX: '1',
        },
      }),
    });
    const window = await app.firstWindow();
    await window.locator('.app-shell').waitFor({ state: 'visible', timeout: 20_000 });
    await expect(window.getByRole('button', { name: /README\.md/ }).first()).toBeVisible();
    await window.evaluate(() => localStorage.setItem('mde.appLanguagePreference', 'en'));
    await window.reload({ waitUntil: 'domcontentloaded' });
    expect(await window.evaluate(() => 'mdeAutomation' in globalThis)).toBe(false);
    expect(await window.evaluate(() => 'openAutomationCenter' in (window.mdeWindow ?? {}))).toBe(false);
    await expect(window.locator('[data-component-id^="automation."]')).toHaveCount(0);
    await expect(window.locator('[data-component-id="explorer.automation-flows-panel"]')).toHaveCount(0);
    await window.getByRole('button', { name: /README\.md Markdown file/i }).click();
    const editor = window.getByTestId('markdown-block-editor').locator('[contenteditable="true"]').first();
    await editor.click();
    await window.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End');
    await window.keyboard.press('Enter');
    await window.keyboard.type('Saved after Automation Flow removal');
    await window.keyboard.press(process.platform === 'darwin' ? 'Meta+S' : 'Control+S');
    await expect.poll(() => readFile(join(workspaceRoot, 'README.md'), 'utf8')).toContain('Saved after Automation Flow removal');
    await window.reload({ waitUntil: 'domcontentloaded' });
    await expect(window.getByTestId('markdown-block-editor')).toContainText('Saved after Automation Flow removal');
    await app.close();
    app = undefined;
    expect(await Promise.all(protectedRoots.map(snapshotTree))).toEqual(before);
  } finally {
    await app?.close();
    await rm(fixtureRoot, { recursive: true, force: true });
    await rm(originalWorkspace, { recursive: true, force: true });
  }
});
```

Add an empty-profile case asserting that no `automation/` directory or global helper-skill link is created. Reuse the same isolated launch arrangement and assert `snapshotTree` returns `{ 'missing:root': '' }` for each absent feature path after close. Keep ordinary fake-Codex E2E from Task 1 in the default command.

- [x] **Step 5: Confirm meaningful red results.**

```sh
pnpm --filter @mde/desktop test:unit tests/unit/windowMode.test.ts
pnpm --filter @mde/desktop test:integration tests/integration/agentChatHandlers.integration.test.ts tests/integration/preloadSurface.integration.test.ts tests/integration/desktopBootstrap.integration.test.ts tests/integration/dropOpenPreload.integration.test.ts
pnpm exec playwright test --config apps/desktop/playwright.config.ts apps/desktop/tests/e2e/automation-removal.e2e.test.ts
```

Expected failures are the accepted retired mode/request, exposed automation API, registered automation handlers, or legacy data initialization. Fix test setup errors before treating the run as a regression reproduction.

- [x] **Step 6: Remove the complete main-process feature and bridge.** In `main/index.ts`, delete automation imports/environment switches, helper registration, adapter/store/runtime/coordinator setup, handler registration, Center window manager, flow-management launch normalization/reuse branch, and the automation shutdown hook. Keep ordinary `createAgentChatRuntime`, native metadata storage, CLI registration, updater, workspace/file/AI/chat handlers, editor windows, and app lifecycle behavior. Remove the deleted service directory, automation handler/API/shared files, and channel group. Change window contracts to:

```ts
export const EDITOR_WINDOW_MODE = 'editor';
export const WINDOW_MODE_ARGUMENT_PREFIX = '--mde-window-mode=';
export type MdeWindowMode = typeof EDITOR_WINDOW_MODE;
export const isMdeWindowMode = (value: unknown): value is MdeWindowMode => value === EDITOR_WINDOW_MODE;
```

Keep the parser's existing last-argument lookup and editor fallback. Remove `openAutomationCenter` from `MdeWindowApi` and preload exposure. In workspace types/validators/listeners, accept only strings and valid `workspace-file` objects; remove the flow variant. Keep normal `focusWorkspaceWindow` behavior.

- [x] **Step 7: Retire chat runtime types and reject old request values.** Set the host/purpose types to the Interfaces block. In `assertCreateDraftRequest`, before returning the normalized request, apply:

```ts
if (
  request.host === 'automation-center' ||
  request.sessionPurpose === 'automation-task'
) {
  throw new Error('invalid-context');
}
```

`invalid-context` is an existing stable diagnostic code, not new UI copy. Return `host: 'editor'` and `sessionPurpose: request.sessionPurpose === 'debug' ? 'debug' : 'document-chat'`; retain omitted-field defaults. Keep existing localized renderer error handling. Remove automation-purpose admission in package context validation. Do not rewrite bindings or add automatic native-session resume.

- [x] **Step 8: Remove package/distribution references and obsolete tests.** Delete `packages/automation-flow/`, its desktop dependency, all automation aliases/coverage/project entries in the exact configs from the file map, and the Electron helper resource. Delete only the repository helper source/link; retain standalone development skills and all user-global paths. Remove the remaining automation-only suites after migrating editor tests. Update ownership integration assertions to require the absent dependency/resource and the remaining package-local test scripts. Update the default desktop E2E command to include `automation-removal.e2e.test.ts` alongside Markdown and Agent Chat before performance smoke.

```sh
pnpm install --lockfile-only
pnpm install --frozen-lockfile
rg -n 'automation|Automation|@mde/automation-flow' apps/desktop/src packages/agent-chat/src apps/desktop/package.json apps/desktop/electron.vite.config.ts apps/desktop/electron-builder.json apps/desktop/vitest.config.ts tsconfig.json vitest.config.ts pnpm-lock.yaml
```

Classify every remaining hit: the two retired request-value guards and test/migration references are intentional; live services, dependencies, UI, authoring context, and aliases are not. Keep shared third-party dependencies still used by another workspace package. Never remove a package merely because its name was previously present under the deleted importer.

- [x] **Step 9: Run green verification and commit the coherent removal.** Run the red commands again, `pnpm run lint`, `pnpm run typecheck`, `pnpm run build`, root unit/integration checks, and `pnpm --filter @mde/agent-chat test`. Run the normal Agent Chat and new removal E2Es. Expected: all pass, legacy snapshots are byte-identical after close, no new automation state is created, and package-local commands remain runnable. Stage the listed main/bridge/package/config/skill/test changes and lockfile, review `git diff --cached --check`, and commit as `feat: retire automation runtime and package`.

### Task 3: Refresh Manual Evidence and Complete Verification

**Files:**

- Modify affected images under `user-manual/public/screenshots/zh-CN/` through the E2E screenshot workflow.
- Review Task 1's `user-manual/zh-CN/index.md`, `workspace.md`, `component-names.md`, and `user-manual/.vitepress/config.ts` against the final app.
- Update only screenshot assertions in `apps/desktop/tests/e2e/manualScreenshots.spec.ts` if their expected controls include the removed feature; retain its sanitized workspace naming and complete screenshot inventory.

**Interfaces:**

- Consumes Tasks 1 and 2's completed app and their UT/IT/E2E results.
- Produces a current public manual, generated screenshots, passing required checks, and a precise local handoff. No new production API or migration is introduced.

- [x] **Step 1: Generate and inspect the real manual screenshots.**

```sh
pnpm run docs:screenshots
pnpm run docs:build
```

Expected: the existing complete screenshot set is generated and the manual has no dead Automation Center route. Inspect Explorer, quick-start, editor, search, and AI screenshots for retired controls and machine-specific state. Regenerate through the same workflow after correcting fixture state; do not alter images manually.

- [x] **Step 2: Run the complete required check set once against the final source.**

```sh
pnpm run lint
pnpm run typecheck
pnpm run build
pnpm run test:unit
pnpm run test:integration
pnpm run test:e2e
pnpm --filter @mde/agent-chat test
pnpm --filter @mde/desktop test
```

The root default E2E script must now run Markdown, ordinary Agent Chat, removal/data-preservation, and the existing editor-performance smoke flow. Package-local `test` remains an independent public verification entry. Where an owning-package command dispatches exactly the already completed suite with unchanged source, record the equivalent result instead of repeating expensive runs; otherwise execute it. Re-run only checks whose inputs change after a correction.

- [x] **Step 3: Review the final diff against the six spec acceptance criteria.**

```sh
git diff --check
git status --short
git diff --stat
rg -n 'Automation Center|Automation Flows|automation-flow|automation-flows' user-manual
```

Current-manual hits must be limited to explicit old-data guidance. Confirm no user-home files were modified, all test fixture roots are isolated, the component map and manual remain equal, root scripts remain stable, and historical release notes/specs and independent development skills remain present. Remove only artifacts generated by this run, not unrelated files. Record exact commands and any blockers; failed checks prevent a completion claim.

- [x] **Step 4: Commit documentation evidence and hand off the verified change.** Stage only intended manual/screenshot changes and commit as `docs: update manual after automation removal`. Report the removed surfaces, retained data, test results, and any environment limits. If this work is later pushed as a production-ready release-branch change, use `skills/release-new-version/SKILL.md` for the repository's version, notes, tag, push, release verification, and completed-requirement archival policy. Plan-only commits never receive a release tag.

## Plan Self-Review and Execution Record

- Spec scope and boundaries map to Task 1 (UI, copy, authoring, manual) and Task 2 (runtime, contracts, package, skill distribution, old-data preservation).
- All five Review Focus conditions have explicit owning tests above. Existing editor cases are migrated before deleting mixed automation suites.
- Production changes in Tasks 1 and 2 carry UT, IT, and E2E changes; Task 3 contains documentation/evidence only and runs the final verification commands.
- No new production dependency, cleanup migration, scheduler, history viewer, or generic framework is introduced.
- Plan code and paths were checked against the current repository. Runtime examples are implementation instructions, not tests executed during planning.
- At planning time dependencies remain absent and the previously recorded pnpm fetch/verification failure has no passing replacement result. Execution Step 1 owns environment recovery; no runtime checks are claimed to pass.

Native execution was approved on 2026-10-16. Tasks 1–3 completed locally, with required automated checks and retained-data coverage passing. A whole-branch independent review is required before integration. No merge, push, or release is included in this local completion record.
