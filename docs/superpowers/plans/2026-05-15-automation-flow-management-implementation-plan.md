# Automation Flow Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Automation Flow management where flows produce task data, executors run task data, Explorer owns authoring, and Automation Center owns cross-workspace filtering and execution.

**Architecture:** Add a pure executor/task-data domain model in `@mde/automation-flow`, then expose one desktop main-process Automation Flow index consumed by both the main Explorer and Automation Center. Keep authoring in the normal Markdown editor and Agent Chat; remove Automation Center template/editor responsibilities and change task start to `taskDataSnapshot + executorSnapshot`.

**Tech Stack:** TypeScript, Electron IPC/preload, React, Vitest unit/integration tests, Playwright E2E, existing `@mde/automation-flow`, `@mde/agent-chat`, and desktop automation services.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-05-15-automation-flow-management-design.md`
- Current Automation Center spec for historical context only: `docs/superpowers/specs/2026-05-13-automation-center-projection-first-v1-slice-design.md`
- Existing prototype for visual density only: `docs/superpowers/prototypes/workspace-automation-console.html`

## File Structure

Domain package:

- Modify `packages/automation-flow/src/types.ts` to add executor declarations, normalized executor refs, task data snapshots, executor snapshots, and selected executor fields.
- Modify `packages/automation-flow/src/schema.ts` to parse `executors` and `handles`.
- Modify `packages/automation-flow/src/parser.ts` to pass parsed executor declarations through the existing flow parser.
- Create `packages/automation-flow/src/executors.ts` for executor id normalization, merge/collision rules, matching, and snapshot id helpers.
- Modify `packages/automation-flow/src/taskIdentity.ts` for owner-scoped `taskDataId`, `taskDataSnapshotId`, and `executorSnapshotId`.
- Modify `packages/automation-flow/src/discovery.ts` and `projection.ts` to project task data with selected executors instead of treating flow runs as executable tasks. `ownership.ts` should only be touched if source ownership resolution still needs executor-aware diagnostics after Task 3 tests are written.
- Modify `packages/automation-flow/src/index.ts` to export new helpers.

Desktop main process:

- Modify `apps/desktop/src/main/services/automation/automationFlowLibrary.ts` to load only direct child flow specs and attach executor directories.
- Create `apps/desktop/src/main/services/automation/automationExecutorLibrary.ts` for Markdown executor file discovery and fingerprinting.
- Create `apps/desktop/src/main/services/automation/automationSkillCatalog.ts` for configured skill root discovery and skill executor fingerprinting.
- Modify `apps/desktop/src/main/services/automation/automationFlowOwnerIdentity.ts` to implement `global:flow:{flowId}`, `workspace:{workspaceId}:flow:{flowId}`, and `workspace:{workspaceId}:applied-global:{flowId}` owner keys.
- Modify `apps/desktop/src/main/services/automation/automationStore.ts` to persist task data snapshots and executor snapshot ids on runs.
- Modify `apps/desktop/src/main/services/automation/automationIndexService.ts` to build the shared index projection.
- Modify `apps/desktop/src/main/services/automation/automationRuntime.ts` and `automationPromptBundle.ts` to start executor-backed task runs.
- Modify `apps/desktop/src/main/ipc/channels.ts`, `registerAutomationHandlers.ts`, `apps/desktop/src/shared/automation.ts`, and `apps/desktop/src/preload/automationApi.ts` for new commands and projection contracts.

Desktop renderer:

- Modify `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx` to render the new Automation Flows section above Recent Files.
- Modify `apps/desktop/src/renderer/src/app/App.tsx` to load the Explorer automation projection, open flow/executor Markdown files in the normal editor, support `~/.mde` pseudo-workspace, and create Agent Chat flow-authoring context.
- Modify `apps/desktop/src/renderer/src/automation/AutomationCenterWindow.tsx`, `WorkspaceFlowFilters.tsx`, `SignalStack.tsx`, `QuietFlowline.tsx`, `automationViewModel.ts`, and `styles.css` to remove template/editor management, add scope/owner filters, and show executor-backed task cards.
- Remove or retire `apps/desktop/src/renderer/src/automation/AutomationFlowEditorHost.tsx` and `automationFlowEditorHostAdapter.ts` only after renderer tests no longer need them. If deletion is too risky in the first pass, leave them unused and remove in cleanup.
- Modify `apps/desktop/src/renderer/src/componentIds.ts` and `apps/desktop/src/renderer/src/i18n/appLanguage.ts` for new component ids and localized text.

Tests and docs:

- Add package tests under `packages/automation-flow/src/*.test.ts`.
- Add desktop unit tests under `apps/desktop/tests/unit/`.
- Add desktop integration tests under `apps/desktop/tests/integration/`.
- Extend `apps/desktop/tests/e2e/automation-center.e2e.test.ts`.
- Update `user-manual/zh-CN/automation.md`, `user-manual/zh-CN/workspace.md`, and `user-manual/zh-CN/component-names.md`.
- Update completed implementation status in the originating spec/requirement doc when the feature is implemented and released.

## Task 1: Domain Executor Model And Identity

**Files:**
- Modify: `packages/automation-flow/src/types.ts`
- Modify: `packages/automation-flow/src/schema.ts`
- Modify: `packages/automation-flow/src/parser.ts`
- Modify: `packages/automation-flow/src/taskIdentity.ts`
- Modify: `packages/automation-flow/src/diagnostics.ts`
- Create: `packages/automation-flow/src/executors.ts`
- Modify: `packages/automation-flow/src/index.ts`
- Test: `packages/automation-flow/src/executors.test.ts`
- Test: `packages/automation-flow/src/schema.test.ts`
- Test: `packages/automation-flow/src/parser.test.ts`
- Test: `packages/automation-flow/src/taskIdentity.test.ts`

- [ ] **Step 1: Write failing executor schema tests**

Add tests covering explicit Markdown executor declarations, skill executor declarations, `handles.sourceTypes`, `handles.taskTypes`, and `handles.tags`.

```ts
it('parses executor declarations with handles', () => {
  const result = automationFlowSchema.parse({
    ...baseFlow,
    executors: [
      {
        enabled: true,
        handles: {
          sourceTypes: ['workspace-markdown'],
          tags: ['implementation'],
          taskTypes: ['requirement']
        },
        id: 'implementation',
        path: './flow-a/implementation.md',
        type: 'markdown'
      },
      {
        enabled: true,
        id: 'execute-picked-task',
        ref: 'skill:execute-picked-task',
        type: 'skill'
      }
    ]
  })

  expect(result.executors).toHaveLength(2)
})
```

- [ ] **Step 2: Run schema tests and verify they fail**

Run: `pnpm --filter @mde/automation-flow exec vitest run src/schema.test.ts --testTimeout=30000`

Expected: FAIL because `executors` is not in the schema yet.

- [ ] **Step 3: Add domain types**

Add these interfaces to `packages/automation-flow/src/types.ts`:

```ts
export type AutomationFlowExecutorType = 'markdown' | 'skill'

export interface AutomationFlowExecutorHandles {
  readonly sourceTypes?: readonly AutomationFlowSourceType[]
  readonly tags?: readonly string[]
  readonly taskTypes?: readonly string[]
}

export interface AutomationFlowExecutorDeclaration {
  readonly displayName?: string
  readonly enabled?: boolean
  readonly handles?: AutomationFlowExecutorHandles
  readonly id: string
  readonly path?: string
  readonly ref?: string
  readonly tags?: readonly string[]
  readonly type: AutomationFlowExecutorType
}

export interface AutomationFlowExecutorRef {
  readonly autoDiscovered: boolean
  readonly diagnostics: readonly AutomationFlowDiagnostic[]
  readonly displayName: string
  readonly enabled: boolean
  readonly executorId: string
  readonly handles: AutomationFlowExecutorHandles
  readonly order: number
  readonly resolvedSource?: string
  readonly skillRef?: string
  readonly sourcePath?: string
  readonly tags: readonly string[]
  readonly type: AutomationFlowExecutorType
}
```

Extend `AutomationFlow` and `ParsedAutomationFlow` with `executors: readonly AutomationFlowExecutorDeclaration[]`.

- [ ] **Step 4: Add schema support**

In `packages/automation-flow/src/schema.ts`, add executor declaration schemas and default `executors` to `[]`.

```ts
export const automationFlowExecutorHandlesSchema = z.object({
  sourceTypes: z.array(automationFlowSourceTypeSchema).optional(),
  tags: z.array(nonEmptyStringSchema).optional(),
  taskTypes: z.array(nonEmptyStringSchema).optional()
}).default({})

export const automationFlowExecutorDeclarationSchema = z.object({
  displayName: nonEmptyStringSchema.optional(),
  enabled: z.boolean().default(true),
  handles: automationFlowExecutorHandlesSchema.optional(),
  id: nonEmptyStringSchema,
  path: nonEmptyStringSchema.optional(),
  ref: nonEmptyStringSchema.optional(),
  tags: z.array(nonEmptyStringSchema).optional(),
  type: z.enum(['markdown', 'skill'])
})
```

- [ ] **Step 5: Add executor merge helper tests**

Create `packages/automation-flow/src/executors.test.ts` with tests for:

- explicit id merges with auto-discovered Markdown id
- duplicate explicit ids are blocking diagnostics
- duplicate paths under different ids are blocking diagnostics
- auto-discovered executors append after explicit declarations
- equal handle matches use flow order, then normalized executor id
- no enabled executor returns `automationFlow.missingExecutor`
- task data `requiredExecutorId` overrides handle matching and flow order
- task data `requiredExecutorRef` resolves a skill executor and overrides handle matching and flow order
- disabled or unresolved required executor blocks start

```ts
expect(resolveAutomationFlowExecutors({
  autoDiscoveredMarkdownExecutors: [{ path: '/repo/.mde/automation-flows/flow-a/implementation.md' }],
  declarations: [{ enabled: false, id: 'implementation', type: 'markdown' }],
  flowId: 'flow-a'
}).executors[0]).toMatchObject({
  enabled: false,
  executorId: 'implementation'
})
```

- [ ] **Step 6: Run executor tests and verify they fail**

Run: `pnpm --filter @mde/automation-flow exec vitest run src/executors.test.ts --testTimeout=30000`

Expected: FAIL because `executors.ts` does not exist.

- [ ] **Step 7: Implement `executors.ts`**

Create helpers:

```ts
export const normalizeAutomationExecutorId = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9._-]+/gu, '-').replace(/^-+|-+$/gu, '')

export const resolveAutomationFlowExecutors = (input: {
  readonly autoDiscoveredMarkdownExecutors: readonly { readonly path: string }[]
  readonly declarations: readonly AutomationFlowExecutorDeclaration[]
  readonly flowId: string
}): {
  readonly diagnostics: readonly AutomationFlowDiagnostic[]
  readonly executors: readonly AutomationFlowExecutorRef[]
} => {
  // Implement merge/collision rules from the spec.
}
```

Keep all returned arrays frozen, following existing package style.

- [ ] **Step 8: Implement identity helpers**

In `taskIdentity.ts`, add:

```ts
export const createAutomationTaskDataId = (input: {
  readonly ownerKey: string
  readonly sourceItemId: string
}): string => stableJoin('automation-task-data', input.ownerKey, input.sourceItemId)

export const createAutomationTaskDataSnapshotId = (input: {
  readonly normalizedTaskPayloadHash: string
  readonly sourceSnapshotHash: string
  readonly taskDataId: string
}): string => stableJoin(
  'automation-task-data-snapshot',
  input.taskDataId,
  input.sourceSnapshotHash,
  input.normalizedTaskPayloadHash
)

export const createAutomationExecutorSnapshotId = (input: {
  readonly executorDefinitionFingerprint: string
  readonly executorId: string
  readonly ownerKey: string
}): string => stableJoin(
  'automation-executor-snapshot',
  input.ownerKey,
  input.executorId,
  input.executorDefinitionFingerprint
)
```

- [ ] **Step 9: Update parser tests**

Add a parser test that reads frontmatter `executors` and returns parsed declarations in `ParsedAutomationFlow`.

Run: `pnpm --filter @mde/automation-flow exec vitest run src/parser.test.ts src/schema.test.ts src/executors.test.ts src/taskIdentity.test.ts --testTimeout=30000`

Expected: PASS.

- [ ] **Step 10: Export new helpers**

Modify `packages/automation-flow/src/index.ts`:

```ts
export * from './executors'
```

- [ ] **Step 11: Run package checks**

Run: `pnpm --filter @mde/automation-flow test`

If no package test script exists, run:

`pnpm --filter @mde/automation-flow exec vitest run --testTimeout=30000`

Expected: PASS.

- [ ] **Step 12: Commit Task 1**

```bash
git add packages/automation-flow/src
git commit -m "feat: add automation executor domain model"
```

## Task 2: Desktop Flow Library, Applied Globals, And Skill Catalog

**Files:**
- Modify: `apps/desktop/src/main/services/automation/automationFlowLibrary.ts`
- Modify: `apps/desktop/src/main/services/automation/automationPathSafety.ts`
- Modify: `apps/desktop/src/main/services/automation/automationFlowOwnerIdentity.ts`
- Create: `apps/desktop/src/main/services/automation/automationExecutorLibrary.ts`
- Create: `apps/desktop/src/main/services/automation/automationAppliedGlobalFlows.ts`
- Create: `apps/desktop/src/main/services/automation/automationSkillCatalog.ts`
- Test: `apps/desktop/tests/unit/automationFlowLibrary.test.ts`
- Test: `apps/desktop/tests/unit/automationExecutorLibrary.test.ts`
- Test: `apps/desktop/tests/unit/automationAppliedGlobalFlows.test.ts`
- Test: `apps/desktop/tests/unit/automationSkillCatalog.test.ts`
- Test: `apps/desktop/tests/unit/automationFlowOwnerIdentity.test.ts`

- [ ] **Step 1: Write failing flow library tests**

Extend `automationFlowLibrary.test.ts`:

```ts
it('loads only direct child Markdown files as flow specs', async () => {
  await writeFile(join(workspaceRoot, '.mde', 'automation-flows', 'flow-a.md'), renderFlow('flow-a', 'workspace'))
  await mkdir(join(workspaceRoot, '.mde', 'automation-flows', 'flow-a'), { recursive: true })
  await writeFile(join(workspaceRoot, '.mde', 'automation-flows', 'flow-a', 'implementation.md'), '# Executor')

  const library = await loadAutomationFlowLibrary({ homePath, workspaceRoot })

  expect(library.automationFlows.map((flow) => flow.id)).toEqual(['flow-a'])
  expect(library.diagnostics).toEqual([])
})
```

- [ ] **Step 2: Run flow library test and verify it fails**

Run: `pnpm exec vitest run --project unit apps/desktop/tests/unit/automationFlowLibrary.test.ts --testTimeout=30000`

Expected: FAIL because current library recursively parses nested executor Markdown as flow specs.

- [ ] **Step 3: Modify flow spec scanning**

In `automationFlowLibrary.ts`, replace recursive flow scanning with direct child Markdown scanning for flow specs. Leave `archived/` excluded. Return executor directory metadata separately if needed by the new index.

- [ ] **Step 4: Write failing executor library tests**

Create `automationExecutorLibrary.test.ts` with tests for:

- finds `<workspace-root>/.mde/automation-flows/{flow-id}/*.md`
- does not scan `archived/`
- fingerprints executor Markdown content
- returns safe normalized paths

- [ ] **Step 5: Implement `automationExecutorLibrary.ts`**

Create:

```ts
export interface DiscoveredMarkdownExecutorFile {
  readonly executorId: string
  readonly fingerprint: string
  readonly path: string
}

export const listMarkdownExecutorFiles = async (input: {
  readonly flowDefinitionPath: string
  readonly flowId: string
}): Promise<readonly DiscoveredMarkdownExecutorFile[]> => {
  // Resolve sibling directory named flow id; read direct child .md files.
}
```

Use `node:crypto` SHA-256 for fingerprints.

- [ ] **Step 6: Write failing applied global tests**

Create tests for reading/writing:

`<workspace-root>/.mde/automation-flows/.applied-global-flows.json`

including invalid JSON diagnostics and missing global ids.

- [ ] **Step 7: Implement `automationAppliedGlobalFlows.ts`**

Create helpers:

```ts
export const loadAppliedGlobalFlowRefs = async (workspaceRoot: string): Promise<{
  readonly diagnostics: readonly AutomationFlowDiagnostic[]
  readonly flowIds: readonly string[]
}>

export const saveAppliedGlobalFlowRefs = async (
  workspaceRoot: string,
  flowIds: readonly string[]
): Promise<void>
```

- [ ] **Step 8: Write failing owner identity tests**

Create `automationFlowOwnerIdentity.test.ts`:

```ts
expect(createWorkspaceFlowOwnerKey({ flowId: 'flow-a', workspaceId: '/repo' }))
  .toBe('workspace:%2Frepo:flow:flow-a')
expect(createGlobalFlowOwnerKey({ flowId: 'flow-a' }))
  .toBe('global:flow:flow-a')
expect(createAppliedGlobalFlowOwnerKey({ flowId: 'flow-a', workspaceId: '/repo' }))
  .toBe('workspace:%2Frepo:applied-global:flow-a')
```

- [ ] **Step 9: Implement owner identity helpers**

Replace or wrap current source-file-based owner keys with explicit helpers. Preserve `getStoredAutomationFlowOwnerKey` compatibility for legacy stored runs.

- [ ] **Step 10: Write failing skill catalog tests**

Create tests with temporary skill roots:

```text
workspace/.codex/skills/flow-helper/SKILL.md
home/.codex/skills/global-helper/SKILL.md
home/.agents/skills/agent-helper/SKILL.md
```

Assert source classes and fingerprints.

- [ ] **Step 11: Implement `automationSkillCatalog.ts`**

Create:

```ts
export type AutomationSkillSourceClass =
  | 'agent-global'
  | 'repo-local'
  | 'unresolved'
  | 'user-global'
  | 'workspace-local'

export interface AutomationSkillCatalogEntry {
  readonly fingerprint?: string
  readonly ref: string
  readonly sourceClass: AutomationSkillSourceClass
  readonly sourcePath?: string
}
```

Support at least workspace `.codex/skills`, repo `.codex/skills`, `~/.codex/skills`, and `~/.agents/skills`.

Also model runtime-provided roots and refresh behavior:

```ts
export interface AutomationSkillCatalogProvider {
  readonly listSkillRoots: () => Promise<readonly string[]>
  readonly refresh: (reason: 'agent-settings' | 'app-start' | 'manual' | 'workspace-change') => Promise<AutomationSkillCatalog>
  readonly resolveSkillRef: (ref: string) => Promise<AutomationSkillCatalogEntry>
}
```

The first implementation may discover roots from existing known paths plus a runtime-provided root list, but tests must cover refresh on app start, workspace change, agent/runtime setting change, and explicit user refresh.

- [ ] **Step 12: Add skill catalog refresh tests**

Extend `automationSkillCatalog.test.ts` with:

- app start refresh includes known user roots
- workspace change refresh adds the new workspace `.codex/skills`
- agent/runtime setting change refresh replaces runtime-provided roots
- manual refresh re-reads changed `SKILL.md` fingerprints
- unresolved skill refs remain visible with `sourceClass: 'unresolved'`

- [ ] **Step 13: Wire real skill catalog refresh triggers**

Connect the provider to desktop lifecycle, not only to unit-test-only helpers:

- app start: initialize the catalog before the first automation index build
- workspace change: refresh with `workspace-change` before building the Explorer automation projection for the new workspace
- agent/runtime setting change: refresh with `agent-settings` from the same path that persists AI/agent runtime settings in `App.tsx` and the corresponding main-process settings bridge
- explicit user refresh: expose an automation IPC/preload command, `refreshSkillCatalog`, and call it from the Explorer Automation Flows section refresh action

The index builder should receive the current catalog snapshot; renderer code should never scan skill roots directly.

- [ ] **Step 14: Add refresh trigger integration tests**

Add or extend `apps/desktop/tests/integration/automationIndex.integration.test.ts` to prove:

- first projection after app start sees user-global skills
- switching workspace sees the new workspace-local skill root
- explicit `refreshSkillCatalog` updates a changed `SKILL.md` fingerprint
- stale unresolved skill refs become resolved after refresh

- [ ] **Step 15: Run desktop unit and integration tests for this task**

Run:

```bash
pnpm exec vitest run --project unit \
  apps/desktop/tests/unit/automationFlowLibrary.test.ts \
  apps/desktop/tests/unit/automationExecutorLibrary.test.ts \
  apps/desktop/tests/unit/automationAppliedGlobalFlows.test.ts \
  apps/desktop/tests/unit/automationSkillCatalog.test.ts \
  apps/desktop/tests/unit/automationFlowOwnerIdentity.test.ts \
  --testTimeout=30000
pnpm exec vitest run --project integration apps/desktop/tests/integration/automationIndex.integration.test.ts --testTimeout=30000
```

Expected: PASS.

- [ ] **Step 16: Commit Task 2**

```bash
git add apps/desktop/src/main/services/automation apps/desktop/src/main/ipc apps/desktop/src/preload apps/desktop/tests/unit apps/desktop/tests/integration
git commit -m "feat: index automation flows and executors"
```

## Task 3: Task Data Snapshots And Executor-Aware Projection

**Files:**
- Modify: `packages/automation-flow/src/types.ts`
- Modify: `packages/automation-flow/src/discovery.ts`
- Modify: `packages/automation-flow/src/projection.ts`
- Modify: `apps/desktop/src/main/services/automation/automationIndexService.ts`
- Modify: `apps/desktop/src/main/services/automation/automationStore.ts`
- Test: `packages/automation-flow/src/discovery.test.ts`
- Test: `packages/automation-flow/src/projection.test.ts`
- Test: `apps/desktop/tests/unit/automationStore.test.ts`
- Test: `apps/desktop/tests/unit/automationIndexService.test.ts`

- [ ] **Step 1: Write failing projection tests**

Add package tests that a projected task includes:

- `taskDataId`
- `taskDataSnapshotId`
- `primaryExecutor`
- `eligibleExecutors`
- blocking diagnostic when no enabled executor exists

```ts
expect(projectAutomationFlowSignalStack({ candidates, reports: [], runs: [] }).tasks[0])
  .toMatchObject({
    bucket: 'ready',
    primaryExecutor: { executorId: 'implementation' },
    taskDataId: expect.stringContaining('automation-task-data')
  })
```

- [ ] **Step 2: Run projection tests and verify failure**

Run: `pnpm --filter @mde/automation-flow exec vitest run src/projection.test.ts --testTimeout=30000`

Expected: FAIL because projected tasks have no executor fields yet.

- [ ] **Step 3: Extend discovery/task types**

Add optional task-data hints to `AutomationDiscoveredTaskSource` and `AutomationFlowTaskCandidate`:

```ts
readonly requiredExecutorId?: string
readonly requiredExecutorRef?: string
readonly taskDataId: string
readonly taskDataSnapshotId: string
readonly taskType?: string
```

Keep backwards compatibility by deriving ids in normalization when missing.

- [ ] **Step 4: Implement snapshot hash helpers**

In `discovery.ts`, compute `normalizedTaskPayloadHash` from safe normalized fields and use `createAutomationTaskDataSnapshotId`.

Unchanged rediscovery must keep `taskDataSnapshotId` stable.

- [ ] **Step 5: Update projection logic**

In `projection.ts`, key queue cards by `taskDataId`, not executor id. Select primary executor using:

1. task required executor id or ref
2. `handles` match score
3. flow order
4. normalized executor id

Blocked cards remain visible but cannot start.

- [ ] **Step 6: Add required executor id/ref tests**

Add tests proving:

- `requiredExecutorId: 'implementation'` selects the matching Markdown executor even if another executor has better handles
- `requiredExecutorRef: 'skill:execute-picked-task'` selects the matching skill executor
- disabled required executor id blocks start
- unresolved required executor ref blocks start with a diagnostic

- [ ] **Step 7: Write failing store tests for snapshots**

Extend `automationStore.test.ts` to cover:

- storing task data snapshots
- unchanged rediscovery updates `lastSeenDiscoveryRunId`
- changed source hash creates new `taskDataSnapshotId`
- source missing from a later discovery marks the latest snapshot stale/removed
- stale/removed snapshots leave the active queue when no active run, decision, or report overlay needs history
- run records preserve `taskDataSnapshotId` and `executorSnapshotId`

- [ ] **Step 8: Extend `automationStore.ts`**

Add persisted snapshot records under `automation/task-data-snapshots`. Avoid rewriting run/report historical records when new snapshots arrive.

Do not remove old `discovered-sources` reading immediately; keep a compatibility read path until all projection code uses snapshots.

- [ ] **Step 9: Implement stale snapshot projection behavior**

When a discovery run replaces the current source set for an owner, mark previously current snapshots for that owner as stale/removed if their `sourceItemId` was not re-emitted. Projection should omit stale/removed snapshots from Ready unless an active run, pending decision, or report overlay needs them for Running, Needs me, or Done history.

- [ ] **Step 10: Update `automationIndexService.ts`**

Build the shared index from:

- parsed flows
- resolved executors
- task data snapshots
- run/report overlays

Return diagnostics from flow parsing, executor resolution, snapshot state, and ownership.

- [ ] **Step 11: Add owner/scope integration coverage**

Create or extend `apps/desktop/tests/integration/automationIndex.integration.test.ts` with:

```ts
it('keeps applied global flow task data separate per workspace', async () => {
  // Arrange the same global flow applied to workspace A and B.
  // Assert two owner keys and no cross-owner dedupe.
})

it('treats empty scopeIds as no scope restriction', async () => {
  // Arrange standalone global, workspace-local, and applied-global owners.
  // Assert projection includes all of them when scopeIds is undefined or [].
})
```

- [ ] **Step 12: Run focused tests**

Run:

```bash
pnpm --filter @mde/automation-flow exec vitest run src/discovery.test.ts src/projection.test.ts --testTimeout=30000
pnpm exec vitest run --project unit apps/desktop/tests/unit/automationStore.test.ts apps/desktop/tests/unit/automationIndexService.test.ts --testTimeout=30000
pnpm exec vitest run --project integration apps/desktop/tests/integration/automationIndex.integration.test.ts --testTimeout=30000
```

Expected: PASS.

- [ ] **Step 13: Commit Task 3**

```bash
git add packages/automation-flow/src apps/desktop/src/main/services/automation apps/desktop/tests/unit apps/desktop/tests/integration/automationIndex.integration.test.ts
git commit -m "feat: project task data through executors"
```

## Task 4: Automation IPC And Preload Contracts

**Files:**
- Modify: `apps/desktop/src/shared/automation.ts`
- Modify: `apps/desktop/src/main/ipc/channels.ts`
- Modify: `apps/desktop/src/main/ipc/registerAutomationHandlers.ts`
- Modify: `apps/desktop/src/preload/automationApi.ts`
- Modify: `apps/desktop/tests/unit/automationSharedTypes.test.ts`
- Modify: `apps/desktop/tests/integration/automationPreload.integration.test.ts`
- Modify: `apps/desktop/tests/integration/automationHandlers.integration.test.ts`

- [ ] **Step 1: Write failing shared type tests**

Extend `automationSharedTypes.test.ts` to require:

- `AutomationCenterFilters.scopeIds`
- `AutomationTaskCard.primaryExecutor`
- `AutomationTaskCard.eligibleExecutors`
- `AutomationTaskCard.blockingDiagnostics`
- `AutomationStartRunRequest.taskDataId`
- `AutomationStartRunRequest.taskDataSnapshotId`
- `AutomationStartRunRequest.executorId`
- new commands for Explorer flow projection and flow/executor creation

- [ ] **Step 2: Run shared type tests and verify failure**

Run: `pnpm exec vitest run --project unit apps/desktop/tests/unit/automationSharedTypes.test.ts --testTimeout=30000`

Expected: FAIL because contracts are not updated.

- [ ] **Step 3: Update shared contracts**

In `apps/desktop/src/shared/automation.ts`, add:

```ts
export type AutomationCenterScopeId = 'global' | `workspace:${string}`

export interface AutomationCenterFilters {
  readonly bucket?: AutomationProjectionBucketFilter
  readonly flowOwnerKeys?: readonly string[]
  readonly scopeIds?: readonly AutomationCenterScopeId[]
}

export interface AutomationTaskExecutorSummary {
  readonly displayName: string
  readonly executorId: string
  readonly sourceClass?: string
  readonly type: 'markdown' | 'skill'
}
```

Keep the old `AutomationProjectionFilters` as a compatibility alias only if existing tests still need it during transition.

- [ ] **Step 4: Add Explorer management request/response types**

Add types for:

- `getExplorerAutomationProjection`
- `createFlowDraft`
- `createExecutorDraft`
- `applyGlobalFlowToWorkspace`
- `removeAppliedGlobalFlowFromWorkspace`
- `openAutomationManagementTarget`

- [ ] **Step 5: Define draft file content contract**

`createFlowDraft` must write a short draft, not an empty file and not a rendered template. Use the minimum flow structure plus one disabled starter executor declaration:

```md
---
id: {flowId}
name: {displayName}
scope: workspace
status: draft
lifecycle: enabled
allowedEngines:
  - codex
defaultEngine: codex
sourceTypes:
  - workspace-markdown
executors:
  - id: implementation
    type: markdown
    path: ./{flowId}/implementation.md
    enabled: false
---

# {displayName}

## Pick Rules

Describe what task data this flow should produce.

## Execution Standard

Describe how executors should run selected task data.

## Acceptance Standard

Describe when executor output is acceptable.

## Verification Expectations

Describe how results should be verified.

## Report Pattern

Describe the final report format.
```

For global flow drafts created from the `~/.mde` pseudo-workspace management path, use the same shape with `scope: user` and a user/global-friendly source type, for example:

```yaml
scope: user
sourceTypes:
  - user-prompt
```

`createExecutorDraft` must write:

```md
# {executorDisplayName}

## Purpose

Describe what this executor does with task data.

## Inputs

- Task data title
- Task data source
- Flow requirements

## Steps

1. Inspect the task data.
2. Execute the required work.
3. Report changed files and verification.

## Output

Return a concise implementation or verification report.
```

- [ ] **Step 6: Update IPC channels and preload**

Add channels to `AUTOMATION_CHANNELS` and methods to `AutomationApi`. Keep path validation in main process.

- [ ] **Step 7: Update handler assertions**

In `registerAutomationHandlers.ts`, add assertion helpers for:

- `scopeIds`
- `flowOwnerKeys`
- `taskDataId`
- `taskDataSnapshotId`
- `executorId`
- safe draft ids

- [ ] **Step 8: Update integration tests**

In `automationPreload.integration.test.ts` and `automationHandlers.integration.test.ts`, assert all new methods invoke expected channels and reject invalid paths outside allowed roots.

- [ ] **Step 9: Run focused IPC tests**

Run:

```bash
pnpm exec vitest run --project unit apps/desktop/tests/unit/automationSharedTypes.test.ts --testTimeout=30000
pnpm exec vitest run --project integration apps/desktop/tests/integration/automationPreload.integration.test.ts apps/desktop/tests/integration/automationHandlers.integration.test.ts --testTimeout=30000
```

Expected: PASS.

- [ ] **Step 10: Commit Task 4**

```bash
git add apps/desktop/src/shared/automation.ts apps/desktop/src/main/ipc apps/desktop/src/preload apps/desktop/tests
git commit -m "feat: expose automation flow management contracts"
```

## Task 5: Explorer Automation Flows Section And Normal Editor Launch

**Files:**
- Modify: `apps/desktop/src/renderer/src/explorer/ExplorerPane.tsx`
- Modify: `apps/desktop/src/renderer/src/app/App.tsx`
- Modify: `apps/desktop/src/renderer/src/componentIds.ts`
- Modify: `apps/desktop/src/renderer/src/i18n/appLanguage.ts`
- Modify: `apps/desktop/src/main/services/workspace/*` if pseudo-workspace launch support is needed
- Test: `apps/desktop/tests/unit/ExplorerPaneAutomationFlows.test.tsx`
- Test: `apps/desktop/tests/unit/shell.test.tsx`
- Test: `apps/desktop/tests/integration/componentNames.integration.test.ts`
- Test: `apps/desktop/tests/integration/workspaceService.integration.test.ts`

- [ ] **Step 1: Write failing Explorer unit test**

Create `ExplorerPaneAutomationFlows.test.tsx` and assert:

- section renders above Recent Files
- `Add` calls `onCreateAutomationFlow`
- `Apply global workflow` calls `onApplyGlobalAutomationFlow`
- workspace flow rows render executor Markdown and skill executor children
- applied global flow rows expose remove-only management
- applied global flow rows expose jump to global flow location
- skill executor rows open safe local skill sources when resolved
- unresolved or external skill executor rows show diagnostics and remain read-only
- explicit refresh control calls `refreshSkillCatalog`
- collapse state persists and expanding the section refreshes/validates the projection without starting automation

- [ ] **Step 2: Add draft content assertions to tests**

In the same unit test or a matching handler integration test, assert `Add` creates the short flow draft from Task 4 and `Add executor` creates the short executor draft. This prevents a return to empty files or the old template picker flow.

- [ ] **Step 3: Run Explorer unit test and verify failure**

Run: `pnpm exec vitest run --project unit apps/desktop/tests/unit/ExplorerPaneAutomationFlows.test.tsx --testTimeout=30000`

Expected: FAIL because the section does not exist.

- [ ] **Step 4: Add renderer projection props**

Add `automationFlowsProjection` and callbacks to `ExplorerPaneProps`. Keep the component dumb: render the projection, send user actions upward.

- [ ] **Step 5: Render the section above Recent Files**

In `ExplorerPane.tsx`, insert the section before the existing Recent Files resize handle and section. Reuse existing `explorer-section-header-button` style and add new class names only where needed.

- [ ] **Step 6: Add component ids and i18n**

Add sorted entries to `COMPONENT_NAME_ID_MAP` and `COMPONENT_IDS` for:

- `explorer.automation-flows-panel`
- `explorer.automation-flow-row`
- `explorer.automation-executor-row`
- `explorer.apply-global-flow-button`
- `explorer.add-automation-flow-button`
- `explorer.automation-flow-menu`
- `explorer.jump-global-automation-flow-button`
- `explorer.refresh-automation-skills-button`

Add English and Chinese language-pack keys in `appLanguage.ts`.

- [ ] **Step 7: Wire App data loading**

In `App.tsx`, call `window.mdeAutomation.getExplorerAutomationProjection` when workspace opens, tree refreshes, or flow actions complete. Store the projection in app state or local state near existing Explorer state.

- [ ] **Step 8: Implement normal editor launch**

Use existing file open path for flow and executor Markdown files:

- created flow: `onSelectFile(filePath)`
- edit flow: `onSelectFile(filePath)`
- add executor: create through IPC, then `onSelectFile(filePath)`

Do not open `AutomationFlowEditorHost`.

- [ ] **Step 9: Implement skill executor row behavior**

Skill executor rows must follow path-safety and read-only rules:

- if `sourceClass` is `workspace-local`, `repo-local`, or `user-global` and `sourcePath` is a safe local Markdown path, clicking opens the source in the normal editor
- if the source is not editable but has a safe local `sourcePath`, open it read-only or via the existing safe file-open behavior without delete/rename actions
- if the skill is unresolved, external, or has no safe path, do not open anything; show the ref plus diagnostics
- never delete, rename, or remove skill source files from the workspace flow menu unless they are explicitly workspace-local and the user is managing the skill itself outside this flow section

- [ ] **Step 10: Implement collapse persistence and refresh**

Persist the Automation Flows section collapsed state with a storage key parallel to `mde.explorerRecentFilesPanel`. When the user expands the section, refresh/validate the Explorer automation projection. Refresh must not start discovery or task execution.

- [ ] **Step 11: Add explicit skill catalog refresh UI**

Add an icon button in the Automation Flows section toolbar for explicit skill catalog refresh. It must:

- call `window.mdeAutomation.refreshSkillCatalog`
- refresh the Explorer automation projection after the command resolves
- use `COMPONENT_IDS.explorer.refreshAutomationSkillsButton`
- use localized label/title text
- not start discovery or task execution

- [ ] **Step 12: Implement applied global jump**

Applied global flow rows in a workspace must have two management actions:

- remove from current workspace
- jump to global flow location

Jump uses the same `~/.mde` pseudo-workspace root and locates `automation-flows/{flow-id}.md`.

- [ ] **Step 13: Implement `~/.mde` pseudo-workspace launch**

For global management, open or focus a main window rooted at `~/.mde`, then locate `automation-flows/`. Reuse existing workspace open APIs; do not create a special Explorer root at `~/.mde/automation-flows`.

- [ ] **Step 14: Run focused renderer tests**

Run:

```bash
pnpm exec vitest run --project unit apps/desktop/tests/unit/ExplorerPaneAutomationFlows.test.tsx apps/desktop/tests/unit/shell.test.tsx --testTimeout=30000
pnpm exec vitest run --project integration apps/desktop/tests/integration/componentNames.integration.test.ts apps/desktop/tests/integration/workspaceService.integration.test.ts --testTimeout=30000
```

Expected: PASS.

- [ ] **Step 15: Commit Task 5**

```bash
git add apps/desktop/src/renderer/src apps/desktop/src/main/services apps/desktop/tests
git commit -m "feat: manage automation flows from explorer"
```

## Task 6: Flow Authoring Agent Chat Context

**Files:**
- Modify: `packages/agent-chat/src/types.ts`
- Modify: `packages/agent-chat/src/context.ts`
- Modify: `apps/desktop/src/renderer/src/app/App.tsx`
- Modify: `apps/desktop/src/main/ipc/registerAgentChatHandlers.ts` only if validation needs new context fields
- Test: `packages/agent-chat/src/context.test.ts`
- Test: `apps/desktop/tests/unit/AgentChatPanel.test.tsx` if present, otherwise add targeted test near existing agent chat tests
- Test: `apps/desktop/tests/integration/agentChatPreload.integration.test.ts` if context validation changes

- [ ] **Step 1: Write failing context tests**

Add tests that a flow authoring manifest includes:

- active flow spec path
- executor spec summaries
- skill executor refs and diagnostics
- automation validation diagnostics
- runtime constraints, including missing executor blocking state and skill resolver source class

- [ ] **Step 2: Run context tests and verify failure**

Run: `pnpm --filter @mde/agent-chat exec vitest run src/context.test.ts --testTimeout=30000`

Expected: FAIL because context manifest does not include automation context.

- [ ] **Step 3: Extend Agent Chat context types**

Add optional automation context fields:

```ts
export interface AgentChatAutomationAuthoringContext {
  readonly diagnostics: readonly string[]
  readonly executorRefs: readonly string[]
  readonly flowPath?: string
}
```

Add optional `automationAuthoringContext?: AgentChatAutomationAuthoringContext` to `AgentChatContextManifest`.

- [ ] **Step 4: Update context builder**

In `packages/agent-chat/src/context.ts`, include a concise section:

```text
Automation flow authoring context:
Flow path: ...
Executors:
- ...
Diagnostics:
- ...
```

- [ ] **Step 5: Wire App authoring context**

In `App.tsx`, when active file is inside `.mde/automation-flows`, query the Explorer automation projection and include related executor refs/diagnostics in `createAgentChatContextManifest`.

- [ ] **Step 6: Keep Chat user-initiated**

Do not auto-open Agent Chat. Existing open chat button should use the richer context only when the user opens Chat.

- [ ] **Step 7: Run focused tests**

Run:

```bash
pnpm --filter @mde/agent-chat exec vitest run src/context.test.ts --testTimeout=30000
pnpm exec vitest run --project unit apps/desktop/tests/unit/shell.test.tsx --testTimeout=30000
```

Expected: PASS.

- [ ] **Step 8: Commit Task 6**

```bash
git add packages/agent-chat/src apps/desktop/src/renderer/src/app/App.tsx apps/desktop/tests
git commit -m "feat: add automation flow authoring chat context"
```

## Task 7: Automation Center Scope Filters And Template Removal

**Files:**
- Modify: `apps/desktop/src/renderer/src/automation/AutomationCenterWindow.tsx`
- Modify: `apps/desktop/src/renderer/src/automation/WorkspaceFlowFilters.tsx`
- Modify: `apps/desktop/src/renderer/src/automation/automationViewModel.ts`
- Modify: `apps/desktop/src/renderer/src/automation/styles.css`
- Modify: `apps/desktop/src/renderer/src/componentIds.ts`
- Modify: `apps/desktop/src/renderer/src/i18n/appLanguage.ts`
- Remove or orphan after tests: `apps/desktop/src/renderer/src/automation/AutomationFlowEditorHost.tsx`
- Remove or orphan after tests: `apps/desktop/src/renderer/src/automation/automationFlowEditorHostAdapter.ts`
- Test: `apps/desktop/tests/unit/AutomationCenterWindow.test.tsx`
- Test: `apps/desktop/tests/unit/WorkspaceFlowFilters.test.tsx`
- Test: `apps/desktop/tests/unit/automationViewModel.test.ts`
- Test: `apps/desktop/tests/integration/automationCenterWindow.integration.test.ts`

- [ ] **Step 1: Write failing WorkspaceFlowFilters tests**

Update tests to expect:

- Global group scope toggle
- workspace group scope toggles
- no template picker/new template wording
- flow toggles call `flowOwnerKeys`
- scope toggles call `scopeIds`

- [ ] **Step 2: Run WorkspaceFlowFilters tests and verify failure**

Run: `pnpm exec vitest run --project unit apps/desktop/tests/unit/WorkspaceFlowFilters.test.tsx --testTimeout=30000`

Expected: FAIL because current component still uses workspaceIds/flowIds and template-oriented text.

- [ ] **Step 3: Update Automation Center filter model**

Replace renderer `AutomationProjectionFilters` usage with `AutomationCenterFilters`. Local optimistic update should preserve empty arrays as "no restriction".

- [ ] **Step 4: Remove embedded editor state from AutomationCenterWindow**

Remove `AutomationEditorState`, `openCreateEditor`, `createFlowFromTemplate`, `openEditEditor`, `saveEditorDocument`, and the `<AutomationFlowEditorHost />` branch. Replace create/edit actions with management jump commands to main Explorer.

- [ ] **Step 5: Render grouped scopes**

Update `WorkspaceFlowFilters.tsx` to render:

```text
Global automation flows [scope toggle] [management icon]
Workspace name [scope toggle] [management icon]
```

Workspace groups should include workspace-local owners and workspace-applied global owners.

- [ ] **Step 6: Update i18n and component ids**

Remove template management text from rendered paths, but keep old keys temporarily if tests or unused code still import them. Add component names for scope toggles and management buttons.

- [ ] **Step 7: Run focused renderer tests**

Run:

```bash
pnpm exec vitest run --project unit \
  apps/desktop/tests/unit/AutomationCenterWindow.test.tsx \
  apps/desktop/tests/unit/WorkspaceFlowFilters.test.tsx \
  apps/desktop/tests/unit/automationViewModel.test.ts \
  --testTimeout=30000
pnpm exec vitest run --project integration apps/desktop/tests/integration/automationCenterWindow.integration.test.ts --testTimeout=30000
```

Expected: PASS.

- [ ] **Step 8: Commit Task 7**

```bash
git add apps/desktop/src/renderer/src/automation apps/desktop/src/renderer/src/componentIds.ts apps/desktop/src/renderer/src/i18n/appLanguage.ts apps/desktop/tests
git commit -m "feat: refocus automation center on task filters"
```

## Task 8: Executor-Backed Start Run And Flowline

**Files:**
- Modify: `apps/desktop/src/main/services/automation/automationRuntime.ts`
- Modify: `apps/desktop/src/main/services/automation/automationPromptBundle.ts`
- Modify: `apps/desktop/src/main/services/automation/automationRunLocks.ts`
- Modify: `apps/desktop/src/main/ipc/registerAutomationHandlers.ts`
- Modify: `apps/desktop/src/renderer/src/automation/SignalStack.tsx`
- Modify: `apps/desktop/src/renderer/src/automation/QuietFlowline.tsx`
- Modify: `apps/desktop/src/renderer/src/automation/automationViewModel.ts`
- Test: `apps/desktop/tests/unit/automationRuntime.test.ts`
- Test: `apps/desktop/tests/unit/automationPromptBundle.test.ts`
- Test: `apps/desktop/tests/unit/AutomationCenterWindowShell.test.tsx`
- Test: `apps/desktop/tests/unit/SignalStack.test.tsx`
- Test: `apps/desktop/tests/unit/QuietFlowline.test.tsx`
- Test: `apps/desktop/tests/integration/automationRunLifecycle.integration.test.ts`

- [ ] **Step 1: Write failing runtime tests**

Extend `automationRuntime.test.ts` so `startRun` requires:

- `taskDataId`
- `taskDataSnapshotId`
- `executorId`
- `executorSnapshotId`

Assert missing executor blocks start with a diagnostic.

- [ ] **Step 2: Run runtime tests and verify failure**

Run: `pnpm exec vitest run --project unit apps/desktop/tests/unit/automationRuntime.test.ts --testTimeout=30000`

Expected: FAIL because `startRun` currently accepts a candidate and flow.

- [ ] **Step 3: Change start command resolution**

In `registerAutomationHandlers.ts`, resolve the selected task card from the shared index using `taskDataId` and `taskDataSnapshotId`, then resolve selected executor by `executorId`. Reject stale or blocked starts.

- [ ] **Step 4: Update runtime input**

Change `AutomationRuntime.startRun` input to carry task data snapshot and executor snapshot, not just `AutomationFlowTaskCandidate`.

- [ ] **Step 5: Update prompt bundle**

`automationPromptBundle.ts` should include:

```text
## Task Data
...

## Executor
Executor id: ...
Executor type: markdown|skill
Executor instructions:
...
```

Keep discovery prompt generation separate.

- [ ] **Step 6: Persist executor snapshot on run**

Update `AutomationStoredRun` and `store.createRun` to include:

```ts
readonly executorId?: string
readonly executorSnapshotId?: string
readonly taskDataId?: string
readonly taskDataSnapshotId?: string
```

- [ ] **Step 7: Update renderer task cards**

In `SignalStack.tsx`, show owning flow and primary executor. In `QuietFlowline.tsx`, disable start when `blockingDiagnostics.length > 0`, show diagnostics, and allow executor selection when multiple eligible executors exist.

- [ ] **Step 8: Add component ids and i18n for executor controls**

Update `componentIds.ts` and `appLanguage.ts` for:

- executor selector
- blocked start diagnostics panel
- blocked start diagnostic row
- primary executor label
- start task with selected executor button

Also update `user-manual/zh-CN/component-names.md` in Task 9.

- [ ] **Step 9: Run focused tests**

Run:

```bash
pnpm exec vitest run --project unit \
  apps/desktop/tests/unit/automationRuntime.test.ts \
  apps/desktop/tests/unit/automationPromptBundle.test.ts \
  apps/desktop/tests/unit/SignalStack.test.tsx \
  apps/desktop/tests/unit/QuietFlowline.test.tsx \
  --testTimeout=30000
pnpm exec vitest run --project integration apps/desktop/tests/integration/automationRunLifecycle.integration.test.ts --testTimeout=30000
```

Expected: PASS.

- [ ] **Step 10: Commit Task 8**

```bash
git add apps/desktop/src/main/services/automation apps/desktop/src/main/ipc apps/desktop/src/renderer/src/automation apps/desktop/src/renderer/src/componentIds.ts apps/desktop/src/renderer/src/i18n/appLanguage.ts apps/desktop/tests
git commit -m "feat: start automation tasks through executors"
```

## Task 9: E2E, Manual Docs, Cleanup, And Full Verification

**Files:**
- Modify: `apps/desktop/tests/e2e/automation-center.e2e.test.ts`
- Modify: `user-manual/zh-CN/automation.md`
- Modify: `user-manual/zh-CN/workspace.md`
- Modify: `user-manual/zh-CN/component-names.md`
- Modify: `docs/superpowers/specs/2026-05-15-automation-flow-management-design.md`
- Delete if unused: `apps/desktop/src/renderer/src/automation/AutomationFlowEditorHost.tsx`
- Delete if unused: `apps/desktop/src/renderer/src/automation/automationFlowEditorHostAdapter.ts`
- Update tests that import deleted editor host files.

- [ ] **Step 1: Write failing E2E coverage**

Extend `automation-center.e2e.test.ts` with:

- add flow from Explorer
- add executor
- open both in normal editor
- flow blocked before enabled executor exists
- apply global flow to workspace and remove it
- Automation Center default shows all scopes
- scope filter narrows data
- flow filter narrows data
- start uses selected executor

- [ ] **Step 2: Run E2E test and verify failure before final fixes**

Run:

`pnpm --filter @mde/desktop test:e2e:automation-center`

Expected: FAIL until all UI wiring from previous tasks is complete.

- [ ] **Step 3: Remove dead template/editor code**

If no tests or imports require `AutomationFlowEditorHost` and `automationFlowEditorHostAdapter`, delete them. If they remain as compatibility, add a comment-free deprecation path and a cleanup task in the docs.

- [ ] **Step 4: Update user manual**

Update `user-manual/zh-CN/automation.md` to explain:

- Automation Flow produces task data
- executor runs task data
- Automation Center filters and starts executor-backed task data
- template management no longer exists

Update `user-manual/zh-CN/workspace.md` to explain Explorer `Automation Flows`.

Update `user-manual/zh-CN/component-names.md` with all new ids.

- [ ] **Step 5: Update design status**

Append implementation completion notes to `docs/superpowers/specs/2026-05-15-automation-flow-management-design.md` only after implementation and release decision are complete.

- [ ] **Step 6: Run full verification**

Run:

```bash
pnpm run lint
pnpm run typecheck
pnpm run build
pnpm run test:unit
pnpm run test:integration
pnpm run test:e2e
```

Expected: PASS.

- [ ] **Step 7: Check git diff**

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 8: Commit Task 9**

```bash
git add apps/desktop/tests/e2e user-manual docs/superpowers/specs apps/desktop/src/renderer/src/automation apps/desktop/tests
git commit -m "docs: document automation flow management"
```

- [ ] **Step 9: Release decision**

This is user-visible production behavior. If merging to `master` as production-ready, use `skills/release-new-version/SKILL.md` unless the user explicitly says not to release. Include release notes for Explorer Automation Flows, executor-backed Automation Center tasks, flow-authoring Chat context, and template-management removal.
