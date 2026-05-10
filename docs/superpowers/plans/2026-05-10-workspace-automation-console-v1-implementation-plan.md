# Workspace Automation Console V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first shippable MDE Automation Center: automation-flow-run-driven task discovery, task-first Signal Stack, Flowline details, local automation-flow structural parsing, discovery/task run records, structured events/reports, and a minimum Agent CLI adapter bridge.

**Architecture:** Keep automation-flow structural contracts in a reusable `@mde/automation-flow` package. Keep discovery execution, task execution, scheduling, adapter process orchestration, persistence, and path authorization in desktop main-process services. Renderer windows only render projections and issue explicit commands through typed IPC/preload APIs. Static local scanners are helper tools for discovery sessions, not a READY task source.

**Tech Stack:** TypeScript, React, Electron main/preload/renderer IPC, Vitest, Playwright, existing MDE i18n language packs, existing `MarkdownBlockEditor`, `js-yaml`, `zod`, Node filesystem APIs.

---

## Source Specs

- Main design: `docs/superpowers/specs/2026-05-09-workspace-automation-console-design.md`
- Agent CLI adapter contract: `docs/superpowers/specs/2026-05-10-agent-cli-adapter-integration.md`
- Prototype reference: `docs/superpowers/prototypes/workspace-automation-console.html`

## 2026-05-10 Correction Gate

This plan supersedes any earlier wording that implied local deterministic
indexing creates READY tasks. The corrected acceptance chain is:

1. MDE loads and structurally validates `some-automation-flow.md`.
2. MDE starts an Agent CLI discovery run for that automation-flow.
3. The discovery run may call MDE helper tools such as local Markdown scanning.
4. The discovery run returns normalized discovered task sources.
5. MDE persists discovery snapshots and projects READY from those discovered
   sources only.
6. Starting a task creates a separate task run with one primary native adapter
   session.
7. The task prompt bundle includes workspace/rules, automation-flow snapshot,
   discovered source snapshot, runtime contract, and task source content.
8. Running, Needs me, Done, and Failed are driven by normalized structured
   events/reports, not by fake state or final-text guessing.
9. Continuous flows schedule the next discovery run after a task reaches a
   terminal report state.

Deferred to a separate future plan:

- `docs/superpowers/specs/2026-05-10-agent-cli-chat-context-and-automation-flow-file-templates.md`
- Do not implement `New from template` task-file creation in this v1 plan except for API seams that do not affect the user flow.

## Review Plan

Review this plan before implementation with four passes.

1. Scope review:
   - Confirm v1 implements the main Automation Center flow and adapter contract.
   - Confirm `New from template` is deferred and not accidentally included as production scope.
   - Confirm no external issue-tracker or release-platform assumptions are required by this plan.

2. Architecture review:
   - Verify `@mde/automation-flow` owns only pure domain logic.
   - Verify desktop main process owns filesystem, scheduler, persistence, adapter processes, notifications, and path authorization.
   - Verify renderer owns no raw filesystem authority and no adapter session files.

3. Behavior review:
   - Check task identity uses `sourceItemId` plus owner-scoped `taskId`.
   - Check `Needs me` is only a run-backed human decision state.
   - Check diagnostics are not task cards.
   - Check blocked run loop behavior matches `onBlocked`.
   - Check formal automation-flow loading is local structural parsing only.
   - Check READY tasks are emitted only from discovery-run output.
   - Check local scanners are helper tools, not the default projection source.

4. Verification review:
   - Every production task below must include unit, integration, and E2E coverage unless it is explicitly non-runtime.
   - Check i18n keys and `data-component-id` coverage for every new user-visible UI surface.
   - Check security tests cover run-scoped runtime tool authorization and path restrictions.

Suggested reviewer prompt:

```text
Review docs/superpowers/plans/2026-05-10-workspace-automation-console-v1-implementation-plan.md against:
- docs/superpowers/specs/2026-05-09-workspace-automation-console-design.md
- docs/superpowers/specs/2026-05-10-agent-cli-adapter-integration.md

Focus on implementation feasibility, missing dependencies, test gaps, package boundaries, security/path authorization, i18n/component id coverage, and whether the plan accidentally includes deferred New from template work. Return prioritized findings with concrete fixes.
```

Plan readiness criteria:

- The plan has a clear first runnable slice.
- Each task has exact file paths.
- Each task has failing-test-first steps.
- Each task has commands and expected outcomes.
- The final verification list covers lint, typecheck, build, unit, integration, and E2E.

## Review-Driven Execution Order

The first implementation pass must produce a visible, testable Automation Center before the full runtime exists. Do not start by building every backend service in isolation.

Shippable checkpoints:

1. **Window shell checkpoint:** Explorer Home opens a separate Automation Center window. The renderer uses an explicit window mode and a fixture projection. This verifies the entry point, window lifecycle, i18n, and component ids.
2. **Read-only task checkpoint:** Signal Stack, workspace/flow filters, and Quiet Flowline render fixture and service-backed projections. Workspace context is optional and visually secondary.
3. **Discovery checkpoint:** workspace-local and user-global automation-flow Markdown files are parsed and structurally validated, then a fake Agent CLI discovery run emits normalized discovered task sources that project into READY.
4. **Runtime checkpoint:** fake adapter plus scheduler can start discovery runs, start task runs, block, resume the same native session or continuation lineage, cancel, and finish a task with persisted structured event/report state.
5. **Adapter checkpoint:** Codex/Claude adapters are connected through the adapter contract, capability probes, `startRun`, `resumeRun`, `cancelRun`, and `openNativeSession`. Unsupported capability becomes setup diagnostics, not hidden behavior.
6. **Authoring checkpoint:** New/Edit automation-flow opens the existing Markdown editor on the right side after template/setup validation is available.
7. **Notification and prompt-source checkpoint:** user-global prompt intake and OS-level notification/deep-link behavior are added after workspace Markdown task intake is stable.

Implementation rules from review:

- Window mode comes before Automation Center UI. A second `BrowserWindow` must not accidentally mount the normal editor app.
- Package wiring comes before package behavior. New package aliases, dependencies, Vite/Vitest/TypeScript paths, and lockfile updates must be explicit.
- E2E command support is part of the implementation. A new Automation Center E2E file must be reachable from a package script, not only by an argument that the current script ignores.
- Coverage configuration must include the new package and all new desktop automation surfaces.
- Adapter setup diagnostics must gate discovery and task run start when required capabilities are missing.
- The runtime store must persist MDE run identity separately from native Codex/Claude session identity and must not persist secrets, runtime tokens, credentials, or raw stdout logs. It may persist prompt-bundle metadata, source snapshots, hashes, event summaries, evidence paths, and final reports.

## File Structure

Create package:

- `packages/automation-flow/package.json` - package metadata and local test script.
- `packages/automation-flow/tsconfig.json` - package TypeScript config.
- `packages/automation-flow/src/index.ts` - public exports.
- `packages/automation-flow/src/types.ts` - core automation-flow, discovery source, task, run kind, run overlay, phase, diagnostic, and loop types.
- `packages/automation-flow/src/schema.ts` - `zod` schemas and type guards.
- `packages/automation-flow/src/parser.ts` - deterministic Markdown frontmatter and section parser.
- `packages/automation-flow/src/templates.ts` - built-in automation-flow template registry and rendering.
- `packages/automation-flow/src/discovery.ts` - normalize Agent CLI discovery output into discovered task sources.
- `packages/automation-flow/src/matching.ts` - local helper matching used only inside discovery helper tests and compatibility migrations.
- `packages/automation-flow/src/ownership.ts` - ownership resolution for discovered sources already emitted by a specific automation-flow; it must not scan globally for READY.
- `packages/automation-flow/src/projection.ts` - Signal Stack bucket projection from candidates plus run/report overlay inputs.
- `packages/automation-flow/src/loopPlanner.ts` - loop planning for manual/continuous flows.
- `packages/automation-flow/src/diagnostics.ts` - structured diagnostic codes and helpers.
- `packages/automation-flow/src/*.test.ts` - package unit tests.

Modify package/workspace wiring:

- `tsconfig.json` - add path alias for `@mde/automation-flow`.
- `apps/desktop/electron.vite.config.ts` - ensure desktop bundling can resolve `@mde/automation-flow`.
- `apps/desktop/vitest.config.ts` - include new automation package and desktop automation files in test/coverage config.
- `apps/desktop/package.json` - add package dependency and E2E scripts.
- `pnpm-lock.yaml` - update after adding `@mde/automation-flow`, `zod`, and direct `js-yaml` dependencies.

Create shared contracts:

- `apps/desktop/src/shared/automation.ts` - IPC-safe request/response types for projections, commands, adapter capability, run state, decisions, reports, and diagnostics.
- `apps/desktop/src/shared/windowMode.ts` - renderer bootstrap contract that distinguishes editor windows from Automation Center windows.
- `apps/desktop/src/main/ipc/registerAutomationHandlers.ts` - main-process automation IPC handlers.
- `apps/desktop/src/preload/automationApi.ts` - safe renderer API wrapper.
- `apps/desktop/src/preload/index.ts` - expose `automationApi`.
- `apps/desktop/src/main/ipc/channels.ts` - add `AUTOMATION_CHANNELS`.

Create main-process services:

- `apps/desktop/src/main/services/automation/automationPathSafety.ts` - workspace and app-data path guards.
- `apps/desktop/src/main/services/automation/automationFlowLibrary.ts` - load global/workspace automation-flow files and templates.
- `apps/desktop/src/main/services/automation/automationFlowDefinitionService.ts` - create, edit, validate, enable, disable, archive, and restore automation-flow Markdown definitions.
- `apps/desktop/src/main/services/automation/automationSourceScanner.ts` - helper-only scanner exposed to discovery runs for declared `.mde/docs/` and user prompt sources.
- `apps/desktop/src/main/services/automation/automationDiscoveryRuntime.ts` - start discovery runs and persist normalized discovered task sources.
- `apps/desktop/src/main/services/automation/automationPromptBundle.ts` - build discovery and task prompt bundles with snapshots, metadata, hashes, source content, and runtime contract.
- `apps/desktop/src/main/services/automation/automationIndexService.ts` - build task projections from persisted discovery results and run/report overlays.
- `apps/desktop/src/main/services/automation/automationStore.ts` - app-data store for runs, events, decisions, reports, scheduler state, and filter state.
- `apps/desktop/src/main/services/automation/automationScheduler.ts` - per-flow loop scheduling and blocked-run handling.
- `apps/desktop/src/main/services/automation/automationRuntime.ts` - start/resume/cancel discovery and task runs and persist normalized events.
- `apps/desktop/src/main/services/automation/automationAdapterRegistry.ts` - Codex/Claude/future adapter registry.
- `apps/desktop/src/main/services/automation/agentCliAdapters.ts` - v1 adapter detection, real/fake session execution, capability probes, resume, cancel, open-native-session, and structured event/report handling.
- `apps/desktop/src/main/services/automation/mdeRuntimeBridge.ts` - run-scoped runtime tool authorization and event normalization.
- `apps/desktop/src/main/services/automation/automationNotificationService.ts` - `Needs me` and terminal run notifications with deep-link payloads.

Create renderer UI:

- `apps/desktop/src/renderer/src/automation/AutomationCenterWindow.tsx` - top-level Automation Center renderer route/root.
- `apps/desktop/src/renderer/src/automation/SignalStack.tsx` - task buckets and task cards.
- `apps/desktop/src/renderer/src/automation/WorkspaceFlowFilters.tsx` - workspace tree, flow rows, archived toggle, context menu.
- `apps/desktop/src/renderer/src/automation/QuietFlowline.tsx` - selected task detail and empty states.
- `apps/desktop/src/renderer/src/automation/AutomationFlowEditorHost.tsx` - right-side editor mode using existing `MarkdownBlockEditor`.
- `apps/desktop/src/renderer/src/automation/automationFlowEditorHostAdapter.ts` - host adapter that lets the existing Markdown editor edit workspace-local and user-global automation-flow files.
- `apps/desktop/src/renderer/src/automation/automationViewModel.ts` - renderer projection shaping only.
- `apps/desktop/src/renderer/src/automation/automationText.ts` - typed text key helpers if needed.
- `apps/desktop/src/renderer/src/automation/styles.css` - Automation Center styling.

Modify existing files:

- `package.json` - add workspace awareness only if package scripts need a root aggregate update.
- `apps/desktop/package.json` - add dependencies only if desktop owns a new runtime package dependency.
- `pnpm-lock.yaml` - update after dependency/package changes.
- `apps/desktop/src/main/index.ts` - create/focus Automation Center window and register automation handlers.
- `apps/desktop/src/renderer/src/main.tsx` - choose editor app vs Automation Center app from window mode.
- `apps/desktop/src/renderer/src/app/App.tsx` - keep normal editor bootstrap scoped to editor windows.
- `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` - add Home icon button without removing `explorer-sidebar-toggle`.
- `apps/desktop/src/renderer/src/componentIds.ts` - add sorted automation and explorer Home component ids.
- `apps/desktop/src/renderer/src/i18n/appLanguage.ts` - add all user-visible Automation Center text keys.
- `user-manual/zh-CN/component-names.md` - document new component names and ids.
- `user-manual/` - add Automation Center entry and basic usage once runtime UI exists.

Create tests:

- `apps/desktop/tests/unit/automationFlow*.test.ts` for desktop-side helpers.
- `packages/automation-flow/src/*.test.ts` for package unit coverage.
- `apps/desktop/tests/integration/automation*.integration.test.ts` for IPC, storage, projection, adapter capability, runtime bridge, and editor integration.
- `apps/desktop/tests/e2e/automation-center.e2e.test.ts` must include a fake CLI executable flow that runs discovery, returns `task-dir/some-task.md`, starts a task run, verifies the fake CLI receives task Markdown content, emits a final report event, projects Done, and triggers the next discovery run for continuous flows.
- `apps/desktop/tests/integration/componentNames.integration.test.ts` - keep component naming reference, source ids, and manual names aligned.
- `apps/desktop/tests/e2e/automation-center.e2e.test.ts` for opening Automation Center, filters, editor mode, and basic task state flows.

## Implementation Tasks

### Task 0: Add Window Mode and Automation Center Shell

**Files:**
- Create: `apps/desktop/src/shared/windowMode.ts`
- Create: `apps/desktop/src/shared/windowApi.ts`
- Create: `apps/desktop/src/renderer/src/automation/AutomationCenterWindow.tsx`
- Create: `apps/desktop/src/renderer/src/windowRoot.tsx`
- Modify: `apps/desktop/src/main/index.ts`
- Modify: `apps/desktop/src/renderer/src/main.tsx`
- Modify: `apps/desktop/src/renderer/src/app/App.tsx`
- Modify: `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx`
- Modify: `apps/desktop/src/renderer/src/componentIds.ts`
- Modify: `apps/desktop/src/renderer/src/i18n/appLanguage.ts`
- Create: `apps/desktop/tests/unit/ExplorerPaneAutomationHome.test.tsx`
- Create: `apps/desktop/tests/unit/AutomationCenterWindowShell.test.tsx`
- Create: `apps/desktop/tests/integration/automationCenterWindow.integration.test.ts`
- Modify: `apps/desktop/tests/e2e/markdown-editor.e2e.test.ts`

- [x] **Step 1: Write failing renderer/window tests**

Assert:

- Explorer Home icon button appears on the left side of `explorer.header`
- existing `explorer-sidebar-toggle` still exists, including when the sidebar is collapsed
- Home uses an ordinary Home icon for v1 and has a stable component id
- Home button text/aria label comes from i18n
- editor windows still mount the normal editor app
- Automation Center windows mount `AutomationCenterWindow` instead of the normal editor app

- [x] **Step 2: Write failing window lifecycle integration tests**

Assert:

- first Home click creates a separate Automation Center `BrowserWindow`
- second Home click focuses the existing Automation Center window
- opening files/workspaces still targets the editor window
- closing the Automation Center window does not close or reload the editor window

- [x] **Step 3: Implement explicit window mode**

Add a small shared bootstrap contract, for example:

```ts
export type MdeWindowMode = "editor" | "automation-center";
```

Expose the mode through preload/bootstrap data. Do not infer mode from URLs or DOM state.

- [x] **Step 4: Implement shell with fixture projection**

Render an empty Automation Center shell with fixture data only. Do not connect runtime services yet.

- [x] **Step 5: Run tests**

Run:

```bash
pnpm run test:unit -- apps/desktop/tests/unit/ExplorerPaneAutomationHome.test.tsx apps/desktop/tests/unit/AutomationCenterWindowShell.test.tsx apps/desktop/tests/unit/componentIds.test.ts apps/desktop/tests/unit/appLanguage.test.ts
pnpm run test:integration -- apps/desktop/tests/integration/automationCenterWindow.integration.test.ts
```

Expected: pass.

Task 0 completed on 2026-05-10. Verification run:

```bash
pnpm exec vitest run --project unit apps/desktop/tests/unit/ExplorerPaneAutomationHome.test.tsx apps/desktop/tests/unit/AutomationCenterWindowShell.test.tsx apps/desktop/tests/unit/componentIds.test.ts apps/desktop/tests/unit/appLanguage.test.ts
pnpm exec vitest run --project integration apps/desktop/tests/integration/automationCenterWindow.integration.test.ts apps/desktop/tests/integration/componentNames.integration.test.ts
pnpm exec playwright test --config apps/desktop/playwright.config.ts apps/desktop/tests/e2e/markdown-editor.e2e.test.ts --grep "opens Automation Center in a separate window"
pnpm run lint
pnpm run typecheck
pnpm run build
pnpm run docs:build
```

### Task 1: Create `@mde/automation-flow` Core Package

**Files:**
- Create: `packages/automation-flow/package.json`
- Create: `packages/automation-flow/tsconfig.json`
- Create: `packages/automation-flow/src/index.ts`
- Create: `packages/automation-flow/src/types.ts`
- Create: `packages/automation-flow/src/schema.ts`
- Create: `packages/automation-flow/src/parser.ts`
- Create: `packages/automation-flow/src/diagnostics.ts`
- Create: `packages/automation-flow/src/parser.test.ts`
- Create: `packages/automation-flow/src/parser.integration.test.ts`
- Create: `packages/automation-flow/src/schema.test.ts`
- Create: `packages/automation-flow/vitest.config.ts`
- Modify: `tsconfig.json`
- Modify: `apps/desktop/electron.vite.config.ts`
- Modify: `apps/desktop/vitest.config.ts`
- Modify: `apps/desktop/package.json`
- Modify: `pnpm-lock.yaml`

- [x] **Step 1: Add package/workspace scaffolding**

Create package metadata, empty public exports, and workspace wiring before writing behavior tests. This is scaffolding only, not production parser logic.

Explicitly add direct package dependencies:

- `js-yaml` for Markdown frontmatter parsing.
- `zod` for schema validation and type guards.

Update `pnpm-lock.yaml`, TypeScript path aliases, Vite resolution, and Vitest coverage/include config in the same task.

- [x] **Step 2: Write failing parser and schema tests**

Add tests that prove:

```ts
expect(parseAutomationFlowMarkdown(validMarkdown).ok).toBe(true);
expect(parseAutomationFlowMarkdown(markdownMissingDefaultEngine)).toMatchObject({
  ok: false,
});
expect(result.diagnostics[0]).toMatchObject({
  code: "automationFlow.missingRequiredField",
  messageKey: expect.any(String),
});
```

- [x] **Step 3: Run package test and verify it fails**

Run: `pnpm --filter @mde/automation-flow test`

Expected: tests fail because parser/schema exports are stubs or behavior is not implemented yet.

- [x] **Step 4: Implement minimal types and parser**

Implement:

```ts
export type AutomationFlowScope = "user" | "workspace";
export type AutomationFlowStatus = "formal" | "draft";
export type AutomationFlowLifecycle = "enabled" | "disabled" | "archived";
export type AgentEngineId = "codex" | "claude-code" | string;
```

Parser rules:

- parse YAML frontmatter
- extract required Markdown sections:
  - `Pick Rules`
  - `Execution Standard`
  - `Acceptance Standard`
  - `Verification Expectations`
  - `Report Pattern`
- do not call Codex or Claude
- emit structured diagnostics instead of throwing for user-authored validation errors

- [x] **Step 5: Run unit tests**

Run: `pnpm --filter @mde/automation-flow test`

Expected: parser/schema tests pass.

- [x] **Step 6: Run root typecheck**

Run: `pnpm run typecheck`

Expected: pass or fail only on missing downstream imports planned in later tasks. If it fails, fix package export/config before continuing.

Task 1 completed on 2026-05-10. Verification run:

```bash
pnpm --filter @mde/automation-flow test
pnpm --filter @mde/automation-flow typecheck
pnpm --filter @mde/automation-flow lint
pnpm --filter @mde/automation-flow test:coverage
pnpm run typecheck
pnpm run lint
pnpm run build
```

Reviewer follow-up completed on 2026-05-10:

- wrong-type frontmatter fields now return `automationFlow.invalidField` diagnostics instead of missing-field diagnostics.
- wrong-type frontmatter array entries are also classified as `automationFlow.invalidField` instead of missing-field diagnostics.
- package tests now run through a package-owned Node Vitest config instead of the desktop jsdom harness.
- package integration coverage verifies the public parser export without renderer globals.

### Task 2: Add Templates, Matching, Ownership, Projection, and Loop Planning

**Files:**
- Create: `packages/automation-flow/src/templates.ts`
- Create: `packages/automation-flow/src/templates.test.ts`
- Create: `packages/automation-flow/src/matching.ts`
- Create: `packages/automation-flow/src/matching.test.ts`
- Create: `packages/automation-flow/src/ownership.ts`
- Create: `packages/automation-flow/src/ownership.test.ts`
- Create: `packages/automation-flow/src/projection.ts`
- Create: `packages/automation-flow/src/projection.test.ts`
- Create: `packages/automation-flow/src/loopPlanner.ts`
- Create: `packages/automation-flow/src/loopPlanner.test.ts`
- Modify: `packages/automation-flow/src/index.ts`

- [x] **Step 1: Write failing tests for built-in templates**

Cover:

- Local Dev Task Automation Flow
- Bug Fix Automation Flow
- Requirement Implementation Automation Flow
- Research and Notes Automation Flow
- Manual Approval Automation Flow

Expected behavior:

```ts
const template = getBuiltInAutomationFlowTemplate("local-dev-task");
const markdown = renderAutomationFlowTemplate(template, requiredInputs);
expect(parseAutomationFlowMarkdown(markdown).ok).toBe(true);
```

- [x] **Step 2: Write failing discovery-source and ownership tests**

Cover:

- normalizing a discovery event for `task-dir/some-task.md`
- normalizing a discovery event for a remote Jira/GitHub/GitLab-style task
- rejecting discovered sources without stable `sourceItemId` and snapshot hash
- preserving the automation-flow id that emitted the discovered source
- duplicate source identity from different flows becomes a diagnostic/review state, not permission for MDE to pick by static matching
- local helper scan output is not a READY task until a discovery run returns it

- [x] **Step 3: Write failing projection and loop tests**

Cover:

- `Needs me` takes precedence over `Running`
- `Running` takes precedence over `Ready`
- terminal report takes precedence over rediscovered source with the same snapshot hash
- `Done` comes from historical report when no active source exists
- `onBlocked: skip-and-continue` ignores blocked runs when counting executing capacity
- `onBlocked: pause-automation-flow` pauses scheduling

- [x] **Step 4: Implement the modules**

Keep all functions pure. No filesystem, Electron, renderer state, shell commands, or app-data access. Static matching helpers may remain for migration/helper tests, but default READY projection must consume normalized discovery output.

- [x] **Step 5: Run package tests**

Run: `pnpm --filter @mde/automation-flow test`

Expected: all package tests pass.

Task 2 completed on 2026-05-10. Verification run:

```bash
pnpm --filter @mde/automation-flow test
pnpm --filter @mde/automation-flow typecheck
pnpm --filter @mde/automation-flow lint
pnpm --filter @mde/automation-flow test:coverage
pnpm run typecheck
pnpm run lint
pnpm run build
```

Reviewer follow-up completed on 2026-05-10:

- Signal Stack projection now preserves upstream candidate order inside buckets after run/report overlays are applied.
- User-prompt helper output requires explicit `automation.status: ready`; missing status remains draft helper evidence.
- Workspace Markdown helper output can be offered to discovery sessions when it has `automation.status: ready` frontmatter or a `READY` title prefix, but helper output is not a READY task until a discovery run returns it as a normalized source.
- `manual-approval` with `scope: user` renders user-prompt source semantics in both frontmatter and Pick Rules text.

### Task 3: Add Shared Automation IPC Contracts

**Files:**
- Create: `apps/desktop/src/shared/automation.ts`
- Modify: `apps/desktop/src/main/ipc/channels.ts`
- Create: `apps/desktop/tests/unit/automationSharedTypes.test.ts`

- [x] **Step 1: Write failing shared contract tests**

Test stable channel names and discriminated union shape:

```ts
expect(AUTOMATION_CHANNELS.getProjection).toBe("automation:get-projection");
expect(isAutomationCommand({ type: "start-run", taskId: "t1" })).toBe(true);
```

- [x] **Step 2: Implement shared types**

Include:

- `AutomationProjection`
- `AutomationTaskCard`
- `AutomationFlowRow`
- `AutomationDiagnostic`
- `AutomationRunState`
- `AutomationDecision`
- `AutomationReportSummary`
- `AgentCliCapabilityReport`
- request/response command types

- [x] **Step 3: Add channels**

Add `AUTOMATION_CHANNELS` without changing existing channel names.

- [x] **Step 4: Run tests**

Run: `pnpm run test:unit -- apps/desktop/tests/unit/automationSharedTypes.test.ts`

Expected: pass.

Task 3 completed on 2026-05-10. Verification run:

```bash
pnpm run test:unit -- apps/desktop/tests/unit/automationSharedTypes.test.ts
pnpm exec vitest run --project unit apps/desktop/tests/unit/automationSharedTypes.test.ts --testTimeout=30000
pnpm run typecheck
pnpm run lint
pnpm run build
```

Note: the root `test:unit -- <file>` command currently ignores the file argument and ran the full unit suite, which passed; the direct `pnpm exec vitest` command above was used for the focused Task 3 unit verification.

### Task 4: Implement Main-Process Automation Storage and Path Safety

**Files:**
- Create: `apps/desktop/src/main/services/automation/automationPathSafety.ts`
- Create: `apps/desktop/src/main/services/automation/automationStore.ts`
- Create: `apps/desktop/tests/unit/automationPathSafety.test.ts`
- Create: `apps/desktop/tests/unit/automationStore.test.ts`

- [x] **Step 1: Write failing path-safety tests**

Cover:

- global automation-flow path: `~/.mde/automation-flows`
- workspace automation-flow path: `<workspace-root>/.mde/automation-flows`
- workspace task docs: `<workspace-root>/.mde/docs/{tasks,requirements,bugs}`
- reject `..` escapes and symlink/realpath mismatches
- evidence/report paths must stay under app-data automation storage or the run workspace root

- [x] **Step 2: Write failing store tests**

Cover:

- create run
- append event
- create decision
- mark `Needs me`
- create report
- persist and reload filter state
- preserve adapter session references
- persist MDE `runId` separately from native Codex/Claude `sessionId`
- do not persist prompt bundles, runtime tokens, credential material, or raw stdout logs
- redact secrets from stored evidence summaries and user-visible error payloads
- full app relaunch marks in-flight adapter processes as interrupted/recoverable or rehydrates scheduled waits
- closing the Automation Center window does not stop active main-process runs or scheduler state

- [x] **Step 3: Implement path guards**

Reuse existing `apps/desktop/src/main/services/pathSafety.ts` patterns where possible.

- [x] **Step 4: Implement JSON-backed v1 store**

Use app-data storage under:

```text
<app-data>/automation/
  user-task-prompts/
  runs/
  reports/
  automation-flow-runtime/
  workspaces/
```

Keep store APIs narrow and testable. Do not expose raw filesystem authority to renderer.

Persist only normalized event metadata and evidence pointers. If raw adapter output is required for troubleshooting, store it behind an explicit debug-only path that is not surfaced in primary UI and is covered by redaction tests.

- [x] **Step 5: Run tests**

Run: `pnpm run test:unit -- apps/desktop/tests/unit/automationPathSafety.test.ts apps/desktop/tests/unit/automationStore.test.ts`

Expected: pass.

Task 4 completed on 2026-05-10. Verification run:

```bash
pnpm exec vitest run --project unit apps/desktop/tests/unit/automationPathSafety.test.ts apps/desktop/tests/unit/automationStore.test.ts --testTimeout=30000
pnpm run typecheck
pnpm run lint
pnpm run build
```

The v1 store persists normalized JSON state under `<app-data>/automation/`, keeps run identity separate from adapter session identity, redacts sensitive summaries, omits prompt bundles/tokens/credentials/raw stdout, and marks in-flight adapter runs as recoverable after relaunch.

### Task 5: Implement Automation-Flow Loading and Discovery Indexing

**Files:**
- Create: `apps/desktop/src/main/services/automation/automationFlowLibrary.ts`
- Create: `apps/desktop/src/main/services/automation/automationFlowDefinitionService.ts`
- Create: `apps/desktop/src/main/services/automation/automationSourceScanner.ts`
- Create: `apps/desktop/src/main/services/automation/automationPromptBundle.ts`
- Create: `apps/desktop/src/main/services/automation/automationIndexService.ts`
- Create: `apps/desktop/tests/unit/automationFlowLibrary.test.ts`
- Create: `apps/desktop/tests/unit/automationFlowDefinitionService.test.ts`
- Create: `apps/desktop/tests/unit/automationSourceScanner.test.ts`
- Create: `apps/desktop/tests/integration/automationIndex.integration.test.ts`

- [x] **Step 1: Write failing library tests**

Cover:

- load user-global flows from `~/.mde/automation-flows`
- load workspace-local flows from `<workspace-root>/.mde/automation-flows`
- ignore `archived/`
- invalid formal flow produces diagnostics
- no Codex/Claude call is required for parsing

- [x] **Step 2: Write failing definition-service tests**

Cover:

- create workspace-local automation-flow from built-in template
- create user-global automation-flow from built-in template
- load existing Markdown into an editable document model
- save and validate edited Markdown
- enable/disable without deleting the definition
- archive/restore by moving under or out of `archived/`
- refresh projection after create/update/archive
- reject writes outside `~/.mde/automation-flows` and `<workspace-root>/.mde/automation-flows`

- [x] **Step 3: Write failing scanner tests**

Cover:

- only `.md` files
- ignore `done/`
- expose explicit ready state for discovery helper use
- malformed candidate creates source diagnostic
- workspace Markdown source directories default to `.mde/docs/{tasks,requirements,bugs}`
- legacy `docs/requirements` and `docs/bugs` paths are not default v1 intake unless explicitly configured
- user-global prompt sources remain helper-only until a discovery run returns normalized task sources

- [x] **Step 4: Write failing integration tests**

Build a fixture workspace where a scanner helper finds one local Markdown file. Verify no READY task is projected until the file is normalized as discovery output for one owning automation-flow.

- [x] **Step 5: Implement services**

Use `@mde/automation-flow` for parse, discovered-source normalization, projection, and loop planning. Matching/ownership remains helper or migration-only behavior and must not feed the default projection.

- [x] **Step 6: Run tests**

Run:

```bash
pnpm run test:unit -- apps/desktop/tests/unit/automationFlowLibrary.test.ts apps/desktop/tests/unit/automationFlowDefinitionService.test.ts apps/desktop/tests/unit/automationSourceScanner.test.ts
pnpm run test:integration -- apps/desktop/tests/integration/automationIndex.integration.test.ts
```

Expected: pass.

Task 5 completed on 2026-05-10. Verification run:

```bash
pnpm exec vitest run --project unit apps/desktop/tests/unit/automationFlowLibrary.test.ts apps/desktop/tests/unit/automationFlowDefinitionService.test.ts apps/desktop/tests/unit/automationSourceScanner.test.ts --testTimeout=30000
pnpm exec vitest run --project integration apps/desktop/tests/integration/automationIndex.integration.test.ts --testTimeout=30000
pnpm run typecheck
pnpm run lint
pnpm run build
```

The implementation loads user-global and workspace-local automation-flow Markdown, ignores archived definitions, exposes editable definition operations, keeps local `.mde/docs/{bugs,requirements,tasks}` scanning as a discovery helper, persists discovered task sources, and projects READY only from discovery output.

### Task 6: Implement Adapter Registry, Capability Probe, and Runtime Bridge

**Files:**
- Create: `apps/desktop/src/main/services/automation/automationAdapterRegistry.ts`
- Create: `apps/desktop/src/main/services/automation/agentCliAdapters.ts`
- Create: `apps/desktop/src/main/services/automation/mdeRuntimeBridge.ts`
- Create: `apps/desktop/tests/unit/automationAdapterRegistry.test.ts`
- Create: `apps/desktop/tests/unit/mdeRuntimeBridge.test.ts`
- Create: `apps/desktop/tests/integration/automationAdapterCapability.integration.test.ts`

- [x] **Step 1: Write failing capability tests**

Cover:

- full-featured fake CLI executable creates native-like discovery/task sessions and returns `verdict: "full"`
- CLI without structured events/runtime tools returns `limited` or `unsupported`
- missing executable returns setup diagnostic
- warnings use structured codes/message keys, not raw user-facing text
- capability probe records executable path, version, auth readiness, and current workspace support without storing credentials
- `nonInteractiveRun`
- `workingDirectory`
- `structuredEventStream`
- `schemaConstrainedFinalOutput`
- `automationFlowAuthoring` as optional
- `autonomyGate`
- `mdeRuntimeTools`
- `runScopedRuntimeAuthorization`
- `sessionId`, resume, and continuation support
- distinct native session ids for distinct task runs
- `openNativeSession`
- cancellation
- permission mode
- evidence capture
- file mutation
- stdout JSONL fallback
- setup diagnostics block run start or flow enablement when required capabilities are unavailable

- [x] **Step 2: Write failing runtime bridge authorization tests**

Cover:

- wrong `runId` rejected
- expired token rejected
- mismatched `automationFlowSnapshotId` rejected
- mismatched `sourceItemId` rejected
- `update_task_status` for the wrong task/source rejected
- source patch outside allowed source file rejected
- archived source rejected
- evidence path outside workspace/app-data rejected
- report path outside allowed roots rejected
- valid `report_phase_update` appends normalized event
- rejected runtime tool calls are recorded as technical evidence without exposing secrets

- [x] **Step 3: Implement registry and executable adapters**

Implement v1 adapters with real lifecycle methods: `probe`, `startRun`,
`resumeRun`, `cancelRun`, and `openNativeSession`. Tests may use a fake JSONL
CLI executable, but runtime code must call the adapter instead of creating fake
run state directly.

- [x] **Step 4: Implement run-scoped bridge**

Use per-run token/session records. Treat adapter-supplied paths and messages as untrusted.

- [x] **Step 5: Run tests**

Run:

```bash
pnpm run test:unit -- apps/desktop/tests/unit/automationAdapterRegistry.test.ts apps/desktop/tests/unit/mdeRuntimeBridge.test.ts
pnpm run test:integration -- apps/desktop/tests/integration/automationAdapterCapability.integration.test.ts
```

Expected: pass.

Task 6 completed on 2026-05-10. Verification run:

```bash
pnpm exec vitest run --project unit apps/desktop/tests/unit/automationAdapterRegistry.test.ts apps/desktop/tests/unit/mdeRuntimeBridge.test.ts --testTimeout=30000
pnpm exec vitest run --project integration apps/desktop/tests/integration/automationAdapterCapability.integration.test.ts --testTimeout=30000
pnpm run typecheck
pnpm run lint
pnpm run build
```

The v1 adapter layer now exposes fake/missing adapter probes, a JSONL executable adapter for fake CLI acceptance, structured setup diagnostics, required-capability discovery/task run gating, and a run-scoped runtime bridge that rejects wrong run/token/snapshot/source/task calls, unsafe source/evidence paths, archived sources, and redacts rejected technical evidence.

### Task 7: Implement Runtime, Scheduler, and Run Lifecycle

**Files:**
- Create: `apps/desktop/src/main/services/automation/automationScheduler.ts`
- Create: `apps/desktop/src/main/services/automation/automationRuntime.ts`
- Create: `apps/desktop/src/main/services/automation/automationNotificationService.ts`
- Create: `apps/desktop/tests/unit/automationScheduler.test.ts`
- Create: `apps/desktop/tests/unit/automationRuntime.test.ts`
- Create: `apps/desktop/tests/unit/automationNotificationService.test.ts`
- Create: `apps/desktop/tests/integration/automationRunLifecycle.integration.test.ts`

- [x] **Step 1: Write failing scheduler tests**

Cover:

- continuous flow starts the next discovery run after terminal completion
- scheduler picks the next task only from discovery output owned by the automation-flow, not from an agent-chosen queue
- `onEmpty: wait` schedules the next discovery run
- `onBlocked: skip-and-continue` leaves blocked run visible and starts another task when executing capacity allows
- `onBlocked: pause-automation-flow` pauses scheduling
- stopped flow does not create new runs
- app restart reloads scheduled waits or marks active adapter processes recoverable
- closing and reopening Automation Center keeps scheduler state unchanged

- [x] **Step 2: Write failing runtime tests**

Cover:

- create discovery and task runs store automation-flow snapshot id
- task run stores discovered source snapshot, source hash, and prompt bundle metadata
- autonomy gate failure creates `Needs me`
- resume keeps same MDE `runId`
- continuation adapter session stays under same run
- native adapter session id changes are visible as session lineage in Flowline data
- `openNativeSession` exposes a safe action when the adapter supports it
- recoverable failure exposes retry/resume/evidence/abandon actions
- terminal success creates report
- task-specific phase progress is derived from automation-flow `Execution Standard`, adapter phase events, and report updates
- missing phase events fall back to deterministic phases generated from the flow and task source snapshot, not arbitrary UI placeholders

- [x] **Step 3: Write failing notification tests**

Cover:

- `run.decision_required` creates a notification/deep-link payload
- clicking the deep link selects the blocked task in Automation Center
- terminal success/failure can be notified without exposing raw logs or paths
- notification service is no-op in tests or unsupported OS surfaces

- [x] **Step 4: Implement runtime**

Use adapter `startRun`/`resumeRun` for both discovery and task execution.
The agent never picks the next task inside a task session; scheduler owns the
loop and starts a separate discovery run.

- [x] **Step 5: Run tests**

Run:

```bash
pnpm run test:unit -- apps/desktop/tests/unit/automationScheduler.test.ts apps/desktop/tests/unit/automationRuntime.test.ts apps/desktop/tests/unit/automationNotificationService.test.ts
pnpm run test:integration -- apps/desktop/tests/integration/automationRunLifecycle.integration.test.ts
```

Expected: pass.

Task 7 completed on 2026-05-10. Verification run:

```bash
pnpm exec vitest run --project unit apps/desktop/tests/unit/automationScheduler.test.ts apps/desktop/tests/unit/automationRuntime.test.ts apps/desktop/tests/unit/automationNotificationService.test.ts --testTimeout=30000
pnpm exec vitest run --project integration apps/desktop/tests/integration/automationRunLifecycle.integration.test.ts --testTimeout=30000
pnpm exec vitest run --project unit apps/desktop/tests/unit/automationStore.test.ts apps/desktop/tests/unit/automationAdapterRegistry.test.ts apps/desktop/tests/unit/mdeRuntimeBridge.test.ts --testTimeout=30000
pnpm run typecheck
pnpm run lint
pnpm run build
```

The runtime checkpoint now has a stateless per-flow scheduler, persisted discovery/task run lifecycle orchestration, automation-flow snapshots, discovered source snapshots, source hashes, prompt bundle metadata, adapter session lineage, run-scoped runtime authorization registration, structured-event Needs-me decisions, deterministic phase derivation from `Execution Standard`, terminal report creation, continuous discovery refresh after terminal task reports, safe run actions, and no-op/deep-link notification payloads that avoid raw logs and local paths.

### Task 8: Add Automation IPC and Preload API

**Files:**
- Create: `apps/desktop/src/main/ipc/registerAutomationHandlers.ts`
- Create: `apps/desktop/src/preload/automationApi.ts`
- Modify: `apps/desktop/src/preload/index.ts`
- Modify: `apps/desktop/src/main/index.ts`
- Create: `apps/desktop/tests/integration/automationHandlers.integration.test.ts`
- Create: `apps/desktop/tests/integration/automationPreload.integration.test.ts`

- [x] **Step 1: Write failing IPC integration tests**

Cover:

- renderer can request projection
- renderer can request adapter setup diagnostics
- renderer can create automation-flow from built-in template
- renderer can list built-in automation-flow templates
- renderer can validate required template inputs before opening the editor
- renderer can start run
- renderer cannot start run when required adapter capabilities are missing
- renderer can provide decision input
- renderer can open a supported native Codex/Claude session from a stored session reference
- renderer can disable/enable/archive flow
- invalid path command is rejected in main process

- [x] **Step 2: Implement handlers**

Handlers must call services, not package internals directly from renderer.

- [x] **Step 3: Implement preload wrapper**

Expose a narrow `window.mdeAutomation` API. Do not expose raw `ipcRenderer`.

- [x] **Step 4: Register handlers in main**

Add registration alongside existing workspace/file/AI handlers.

- [x] **Step 5: Run integration tests**

Run: `pnpm run test:integration -- apps/desktop/tests/integration/automationHandlers.integration.test.ts apps/desktop/tests/integration/automationPreload.integration.test.ts`

Expected: pass.

Task 8 completed on 2026-05-10. Verification run:

```bash
pnpm exec vitest run --project integration apps/desktop/tests/integration/automationHandlers.integration.test.ts apps/desktop/tests/integration/automationPreload.integration.test.ts --testTimeout=30000
pnpm exec vitest run --project unit apps/desktop/tests/unit/automationSharedTypes.test.ts apps/desktop/tests/unit/automationScheduler.test.ts apps/desktop/tests/unit/automationRuntime.test.ts apps/desktop/tests/unit/automationNotificationService.test.ts --testTimeout=30000
pnpm exec vitest run --project integration apps/desktop/tests/integration/automationRunLifecycle.integration.test.ts --testTimeout=30000
pnpm run typecheck
pnpm run lint
pnpm run build
```

The Automation IPC checkpoint now registers service-backed main-process handlers, exposes a narrow `window.mdeAutomation` preload API, supports projections, adapter setup diagnostics, built-in template listing/validation/creation, lifecycle/archive/restore commands, start/resume/cancel/decision commands, native-session availability checks, and rejects unsafe definition paths in the main process.

### Task 9: Connect Automation Center Window Shell to IPC Projection

**Files:**
- Modify: `apps/desktop/src/renderer/src/automation/AutomationCenterWindow.tsx`
- Create: `apps/desktop/src/renderer/src/automation/automationViewModel.ts`
- Modify: `apps/desktop/src/renderer/src/componentIds.ts`
- Modify: `apps/desktop/src/renderer/src/i18n/appLanguage.ts`
- Modify: `apps/desktop/src/main/index.ts`
- Modify: `apps/desktop/tests/unit/AutomationCenterWindowShell.test.tsx`
- Modify: `apps/desktop/tests/integration/automationCenterWindow.integration.test.ts`

- [x] **Step 1: Write failing shell projection tests**

Assert:

- Automation Center requests projection through `window.mdeAutomation`
- loading, empty, diagnostics-only, and populated states render through i18n text
- setup diagnostics can disable run/start controls without becoming task cards
- fixture projection used in Task 0 is removed or isolated to tests/story fixtures

- [x] **Step 2: Extend window lifecycle integration tests**

Assert:

- opening the Automation Center receives current projection from IPC
- projection refresh events update the existing window
- closing and reopening the window does not clear filters or active run selection

- [x] **Step 3: Implement component id and i18n keys**

Keep `COMPONENT_NAME_ID_MAP` top-level keys sorted alphabetically.

- [x] **Step 4: Connect shell to IPC**

Keep renderer transformation in `automationViewModel.ts`. The renderer must not read files or adapter state directly.

- [x] **Step 5: Run tests**

Run:

```bash
pnpm run test:unit -- apps/desktop/tests/unit/AutomationCenterWindowShell.test.tsx apps/desktop/tests/unit/componentIds.test.ts apps/desktop/tests/unit/appLanguage.test.ts
pnpm run test:integration -- apps/desktop/tests/integration/automationCenterWindow.integration.test.ts
```

Expected: pass.

Task 9 completed on 2026-05-10. Verification run:

```bash
pnpm exec vitest run --project unit apps/desktop/tests/unit/AutomationCenterWindowShell.test.tsx apps/desktop/tests/unit/componentIds.test.ts apps/desktop/tests/unit/appLanguage.test.ts --testTimeout=30000
pnpm exec vitest run --project integration apps/desktop/tests/integration/automationCenterWindow.integration.test.ts --testTimeout=30000
pnpm exec vitest run --project integration apps/desktop/tests/integration/componentNames.integration.test.ts --testTimeout=30000
pnpm run typecheck
pnpm run lint
pnpm run build
```

The Automation Center shell now requests projection data through `window.mdeAutomation`, removes the Task 0 fixture task from production rendering, renders loading/empty/error/setup-diagnostic states through i18n text, keeps diagnostics out of task cards, shapes renderer data in `automationViewModel.ts`, and adds a stable component id/manual entry for the diagnostic list.

### Task 10: Build Signal Stack, Workspace Flow Filters, and Quiet Flowline UI

**Files:**
- Modify: `apps/desktop/src/renderer/src/automation/AutomationCenterWindow.tsx`
- Create: `apps/desktop/src/renderer/src/automation/SignalStack.tsx`
- Create: `apps/desktop/src/renderer/src/automation/WorkspaceFlowFilters.tsx`
- Create: `apps/desktop/src/renderer/src/automation/QuietFlowline.tsx`
- Modify: `apps/desktop/src/renderer/src/automation/automationViewModel.ts`
- Create: `apps/desktop/src/renderer/src/automation/styles.css`
- Modify: `apps/desktop/src/renderer/src/componentIds.ts`
- Modify: `apps/desktop/src/renderer/src/i18n/appLanguage.ts`
- Create: `apps/desktop/tests/unit/AutomationCenterWindow.test.tsx`
- Create: `apps/desktop/tests/unit/SignalStack.test.tsx`
- Create: `apps/desktop/tests/unit/WorkspaceFlowFilters.test.tsx`
- Create: `apps/desktop/tests/unit/QuietFlowline.test.tsx`
- Modify: `apps/desktop/tests/integration/componentNames.integration.test.ts`
- Modify: `user-manual/zh-CN/component-names.md`

- [x] **Step 1: Write failing UI tests**

Cover:

- four buckets: `Needs me`, `Running`, `Ready`, `Done`
- workspace tree with automation-flow submenu
- archived toggle
- New automation-flow icon button
- automation-flow context menu with stop, enable, disable, archive, and restore actions
- status light colors through class names or accessible labels
- no visible `ENABLED`/`SETUP` tags
- status text is not shown for normal flow rows; status is represented by green/yellow/gray/red lights with accessible labels
- diagnostics are not task cards
- empty states for no selected task, no tasks in bucket, no selected source, diagnostics-only setup
- Quiet Flowline displays task-specific phases derived from task/run data, not hardcoded generic stages

- [x] **Step 2: Implement view model**

Keep transformation from API projection to UI props in `automationViewModel.ts`.

- [x] **Step 3: Implement components**

Use restrained task-first layout from prototype. Keep workspace secondary. Do not expose raw `.mde/docs/...` paths in normal task cards or flow rows.

- [x] **Step 4: Add i18n keys and component ids**

Every button, menu item, status, empty state, and aria label must use language-pack text.

Update `componentIds.ts`, `componentIds.test.ts`, `componentNames.integration.test.ts`, and `user-manual/zh-CN/component-names.md` together. If `automation.*` ids require a namespace regex update, make that explicit in the component id tests.

- [x] **Step 5: Run tests**

Run:

```bash
pnpm run test:unit -- apps/desktop/tests/unit/AutomationCenterWindow.test.tsx apps/desktop/tests/unit/SignalStack.test.tsx apps/desktop/tests/unit/WorkspaceFlowFilters.test.tsx apps/desktop/tests/unit/QuietFlowline.test.tsx apps/desktop/tests/unit/componentIds.test.ts
pnpm run test:integration -- apps/desktop/tests/integration/componentNames.integration.test.ts
```

Expected: pass.

Task 10 completed on 2026-05-10. Verification run:

```bash
pnpm exec vitest run --project unit apps/desktop/tests/unit/AutomationCenterWindow.test.tsx apps/desktop/tests/unit/SignalStack.test.tsx apps/desktop/tests/unit/WorkspaceFlowFilters.test.tsx apps/desktop/tests/unit/QuietFlowline.test.tsx apps/desktop/tests/unit/AutomationCenterWindowShell.test.tsx apps/desktop/tests/unit/componentIds.test.ts apps/desktop/tests/unit/appLanguage.test.ts --testTimeout=30000
pnpm exec vitest run --project integration apps/desktop/tests/integration/componentNames.integration.test.ts --testTimeout=30000
pnpm run typecheck
pnpm run lint
pnpm run build
```

The Automation Center now renders service-backed projections through separate Signal Stack, Workspace Flow Filters, and Quiet Flowline components. The UI uses bucket task cards, accessible status lights instead of visible lifecycle tags, archived/new-flow controls, diagnostics outside task cards, derived task phases, i18n text, stable component ids, and manual component-name coverage.

### Task 11: Integrate `New/Edit automation-flow` with Existing MarkdownEditor

**Files:**
- Create: `apps/desktop/src/renderer/src/automation/AutomationFlowEditorHost.tsx`
- Create: `apps/desktop/src/renderer/src/automation/automationFlowEditorHostAdapter.ts`
- Modify: `apps/desktop/src/renderer/src/automation/AutomationCenterWindow.tsx`
- Modify: `apps/desktop/src/renderer/src/componentIds.ts`
- Modify: `apps/desktop/src/renderer/src/i18n/appLanguage.ts`
- Modify: `apps/desktop/tests/integration/componentNames.integration.test.ts`
- Modify: `user-manual/zh-CN/component-names.md`
- Create: `apps/desktop/tests/unit/AutomationFlowEditorHost.test.tsx`
- Create: `apps/desktop/tests/integration/automationFlowEditor.integration.test.ts`

- [x] **Step 1: Write failing tests**

Assert:

- New automation-flow opens right editor mode
- Signal Stack and Flowline are hidden while editor mode is open
- workspace/flow navigation remains visible
- component contains existing `editor.markdown-editor-shell`
- component contains existing `editor.markdown-editing-surface`
- no `<textarea>` is rendered
- save calls automation IPC create/update command
- workspace-local automation-flow files use workspace-aware editor host behavior
- user-global automation-flow files under `~/.mde/automation-flows` use a safe pseudo-workspace editor host
- link/image/file-tree operations are disabled or adapted when editing user-global automation-flow files

- [x] **Step 2: Implement editor host**

Mount existing desktop `MarkdownBlockEditor` wrapper or the same component path used for normal Markdown editing. Do not build a bespoke text editor.

If the normal editor wrapper is too coupled to workspace documents, extract the minimal host adapter needed for opening, saving, dirty state, and validation. Keep the existing `MarkdownBlockEditor` component and `editor.*` component ids.

Add component ids and manual component names for editor-mode controls such as template picker, validation panel, save, close editor mode, and archive/restore actions.

- [x] **Step 3: Implement template/setup and save/validate flow**

Before opening a new automation-flow file, list built-in templates, collect required template inputs and engine choice, validate the setup, then open generated canonical Markdown in the right-side editor. On save, call main-process validation. Show validation diagnostics beside editor.

- [x] **Step 4: Run tests**

Run:

```bash
pnpm run test:unit -- apps/desktop/tests/unit/AutomationFlowEditorHost.test.tsx apps/desktop/tests/unit/componentIds.test.ts
pnpm run test:integration -- apps/desktop/tests/integration/automationFlowEditor.integration.test.ts apps/desktop/tests/integration/componentNames.integration.test.ts
```

Expected: pass.

Task 11 completed on 2026-05-10. Verification run:

```bash
pnpm exec vitest run --project unit apps/desktop/tests/unit/AutomationFlowEditorHost.test.tsx apps/desktop/tests/unit/AutomationCenterWindow.test.tsx apps/desktop/tests/unit/WorkspaceFlowFilters.test.tsx apps/desktop/tests/unit/componentIds.test.ts apps/desktop/tests/unit/appLanguage.test.ts --testTimeout=30000
pnpm exec vitest run --project integration apps/desktop/tests/integration/automationFlowEditor.integration.test.ts apps/desktop/tests/integration/automationPreload.integration.test.ts apps/desktop/tests/integration/automationHandlers.integration.test.ts apps/desktop/tests/integration/componentNames.integration.test.ts --testTimeout=30000
pnpm run typecheck
pnpm run lint
pnpm run build
```

New/Edit automation-flow now enters a right-side editor mode while the workspace flow navigation remains visible and Signal Stack/Flowline are hidden. The editor mode reuses `MarkdownBlockEditor`, exposes template setup, validates and creates template-backed definitions, loads/saves existing automation-flow Markdown through safe IPC handlers, keeps user-global editor operations limited, and updates i18n/component-id/manual coverage.

### Task 12: Add E2E Coverage for the V1 User Journey

**Files:**
- Create: `apps/desktop/tests/e2e/automation-center.e2e.test.ts`
- Modify or reuse: `apps/desktop/tests/e2e/support/fixtureWorkspace.ts`
- Modify or reuse: `apps/desktop/tests/e2e/support/electronApp.ts`
- Modify: `apps/desktop/package.json`

- [x] **Step 1: Write failing E2E for opening Automation Center**

Flow:

- launch MDE with fixture workspace
- click Explorer Home
- verify separate Automation Center window opens
- verify editor window remains usable

- [x] **Step 2: Write failing E2E for creating a workspace automation-flow**

Flow:

- open Automation Center
- click workspace `New automation-flow`
- choose Local Dev Task template
- save canonical Markdown
- verify validation success
- fake CLI discovery session receives the automation-flow Markdown and emits `task-dir/some-task.md`
- verify the task appears in `Ready` only after the discovery output is persisted

- [x] **Step 3: Write failing E2E for `Needs me` and Flowline**

Use fake CLI task session/autonomy gate to force a decision. Assert:

- task appears in `Needs me`
- Flowline shows current phase and decision actions
- providing input resumes the same MDE run and the same native adapter session when supported

- [x] **Step 4: Write failing E2E for task execution and report**

Use a fake CLI executable with JSONL output. Assert:

- task run starts a distinct native session from the discovery run
- fake CLI receives task Markdown content and discovered source snapshot
- fake CLI emits phase update and final report events
- MDE projects the task into `Done` from the report event
- a continuous flow schedules the next discovery run after terminal report

- [x] **Step 5: Write failing E2E for filters and archived toggle**

Assert:

- workspace selection changes visible task cards
- per-flow selection filters tasks
- archived toggle shows archived flows but does not re-enable discovery

- [x] **Step 6: Implement support fixtures**

Add fixture workspace files and fake CLI executables under test temp dirs, not repo docs. The fake CLI must record the prompt bundle it receives so tests can prove automation-flow discovery and task execution content were actually sent.

- [x] **Step 7: Add runnable E2E script**

The current desktop `test:e2e` command does not automatically run arbitrary file arguments. Add an explicit script such as:

```json
"test:e2e:automation-center": "cd ../.. && playwright test --config apps/desktop/playwright.config.ts apps/desktop/tests/e2e/automation-center.e2e.test.ts"
```

Also decide whether root `pnpm run test:e2e` should include `automation-center.e2e.test.ts` directly or delegate to the new script.

- [x] **Step 8: Run E2E**

Run:

```bash
pnpm --filter @mde/desktop test:e2e:automation-center
pnpm run test:e2e
```

Expected: pass.

Task 12 completed on 2026-05-10. Verification run:

```bash
pnpm exec vitest run --project unit apps/desktop/tests/unit/WorkspaceFlowFilters.test.tsx apps/desktop/tests/unit/AutomationCenterWindow.test.tsx apps/desktop/tests/unit/componentIds.test.ts apps/desktop/tests/unit/appLanguage.test.ts --testTimeout=30000
pnpm exec vitest run --project integration apps/desktop/tests/integration/automationHandlers.integration.test.ts apps/desktop/tests/integration/componentNames.integration.test.ts --testTimeout=30000
pnpm run typecheck
pnpm --filter @mde/desktop test:e2e:automation-center
pnpm run lint
pnpm run build
pnpm run test:e2e
```

Automation Center E2E now covers the separate window entry, workspace automation-flow creation through the editor path, fake CLI discovery returning a local task, Ready projection from discovery output only, task execution in its own native adapter session, Needs me decision/resume on the same MDE run/session, final report projection to Done, archived-flow visibility, continuous next-discovery scheduling, and per-flow filtering that keeps archived flows from re-enabling discovery. The root E2E aggregation passed with 56 Playwright tests plus the editor performance smoke.

### Task 13: Update User Manual and Internal Requirement Status

**Files:**
- Modify: relevant `user-manual/` pages after UI behavior exists
- Modify: `docs/requirements/...` only if an active requirement file exists for Automation Center
- Modify: `docs/superpowers/specs/2026-05-10-agent-cli-adapter-integration.md` only if implementation changes the public adapter capability contract or conformance checklist
- Create or modify: screenshot fixtures only through E2E screenshot workflow if manual screenshots are needed

- [x] **Step 1: Search for existing manual locations**

Run: `rg -n "AI|Automation|workspace|Explorer|Markdown" user-manual`

Expected: identify the best existing page instead of creating a top-level manual page blindly.

- [x] **Step 2: Update manual text**

Document:

- Home button opens Automation Center
- workspace filters are optional
- automation-flow discovery sessions create task candidates
- each task run uses one native Codex/Claude Code session
- `Needs me` means a running task needs input
- where reports/evidence appear

- [x] **Step 3: Verify adapter integration docs**

Check the adapter integration spec still matches implemented capability probes, `openNativeSession`, runtime-tool authorization, and conformance test expectations. Update only if the implementation intentionally changes the contract.

- [x] **Step 4: Run docs build if manual changed**

Run: `pnpm run docs:build`

Expected: pass.

Task 13 completed on 2026-05-10. Verification run:

```bash
rg -n "AI|Automation|workspace|Explorer|Markdown" user-manual
pnpm run docs:build
```

Added a public Automation Center manual page, linked it from the Chinese manual home page and VitePress sidebar, documented workspace flows, discovery-created task queues, session-backed task runs, Needs me, reports/evidence storage, and updated the adapter integration spec with the V1 capability probe/run-gate/session details. No screenshots were added because this task did not generate E2E screenshot artifacts.

### Task 14: Final Verification

**Files:**
- No new files unless fixing issues found by verification.

- [x] **Step 1: Run package tests**

Run: `pnpm --filter @mde/automation-flow test`

Expected: pass.

- [x] **Step 2: Run desktop automation E2E directly**

Run: `pnpm --filter @mde/desktop test:e2e:automation-center`

Expected: pass.

- [x] **Step 3: Run root unit tests**

Run: `pnpm run test:unit`

Expected: pass.

- [x] **Step 4: Run root integration tests**

Run: `pnpm run test:integration`

Expected: pass.

- [x] **Step 5: Run E2E tests**

Run: `pnpm run test:e2e`

Expected: pass.

- [x] **Step 6: Run coverage**

Run: `pnpm run test:coverage`

Expected: pass and include:

- `packages/automation-flow/src/**`
- `apps/desktop/src/renderer/src/automation/**`
- `apps/desktop/src/shared/automation.ts`
- `apps/desktop/src/shared/windowMode.ts`
- `apps/desktop/src/preload/automationApi.ts`
- `apps/desktop/src/main/services/automation/**`

- [x] **Step 7: Run lint and typecheck**

Run:

```bash
pnpm run lint
pnpm run typecheck
```

Expected: pass.

- [x] **Step 8: Run build**

Run: `pnpm run build`

Expected: pass.

- [x] **Step 9: Smoke check coverage**

Run: `pnpm run dev`

Verify:

- Explorer Home is present and sidebar toggle remains present
- Automation Center opens in a separate window
- task-first UI is not cluttered by workspace paths
- New/Edit automation-flow opens right editor mode with real Markdown editor
- fake CLI discovery emits a local task into `Ready`
- fake CLI task session receives task Markdown content
- fake CLI decisions appear as `Needs me`
- fake CLI final report projects the task into `Done`

Task 14 completed on 2026-05-10. Verification run:

- `pnpm --filter @mde/automation-flow test` passed with 8 files and 44 tests.
- `pnpm run test:unit` passed with 68 files and 448 tests.
- `pnpm run test:integration` passed with 65 files and 175 tests.
- `pnpm run test:coverage` passed with 133 files and 623 tests, and the coverage report included the automation-flow package, renderer automation UI, shared automation/window-mode contracts, preload automation API, and main-process automation services.
- `pnpm --filter @mde/desktop test:e2e:automation-center` passed for the Automation Center launch, flow creation, fake CLI discovery, task session execution, Needs me decision, final report projection, archived-flow visibility, and per-flow filtering flows.
- `pnpm run test:e2e` passed with 56 Playwright tests and the editor performance smoke.
- `pnpm run docs:build`, `pnpm run typecheck`, `pnpm run build`, and `pnpm run lint` passed after the final documentation and verification-config updates.

The smoke checklist is covered by the focused Electron E2E suite rather than a separate long-running `pnpm run dev` manual session.

## Implementation Notes

- Do not commit or release as part of this plan unless the user explicitly asks.
- Do not implement background daemon behavior.
- Do not implement team-shared automation-flow synchronization.
- Do not implement automation-flow marketplace.
- Do not implement `New from template` task-file creation in this v1 plan.
- Do not expose raw logs, stack traces, adapter internals, or filesystem paths in primary UI.
- Do not write into Codex or Claude native session stores.
- Keep all user-visible production text in `apps/desktop/src/renderer/src/i18n/appLanguage.ts`.
- Keep all new component ids in `apps/desktop/src/renderer/src/componentIds.ts` and keep the map sorted.
