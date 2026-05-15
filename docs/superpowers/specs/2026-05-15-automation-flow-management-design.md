# Automation Flow Management Design

Date: 2026-05-15
Status: Accepted design; three-review loop completed with final blockers patched

## Goal

Redesign Automation Flow management so the main Workspace Explorer, the normal
Markdown editor, Agent Chat, and the Automation Center all work from the same
automation-flow model.

The central correction is semantic: an Automation Flow is not itself a task. An
Automation Flow produces normalized task data. A task becomes executable only
when that task data is bound to an enabled executor, then the executor runs
against that task data.

This design keeps two windows:

- The main window owns workspace management, flow spec editing, executor spec
  editing, and flow-authoring Chat.
- The Automation Center remains an independent execution and filtering window.

Both windows consume one shared main-process Automation Flow index so the UI does
not duplicate scanning, binding, executor resolution, or diagnostics.

## Decisions

- Flow specs stay at `<root>/.mde/automation-flows/{flow-id}.md`.
- Markdown executor specs live under
  `<root>/.mde/automation-flows/{flow-id}/{executor-id}.md`.
- Global flow application is stored as a workspace-local reference file, not by
  copying global flow specs.
- Executor discovery is hybrid: executor specs are auto-discovered from the
  flow directory, and the flow spec can sort, disable, rename, tag, or reference
  executors explicitly.
- Skills can be used as executors when they are visible to the current agent.
- Add/Edit flow spec opens the main-window Markdown editor, not an Automation
  Center embedded editor.
- Automation Center workspace filters default to no selected workspace, which
  means "show all workspace and global automation data".
- Automation Center flow toggles filter the task queue only; they do not enable
  or disable flows.
- A flow with no enabled executor is incomplete. It can be saved and displayed,
  but its task data cannot be started.
- A task data item may explicitly require an executor. That explicit task
  requirement wins over flow-level matching and ordering.
- Executor identity is unique within an Automation Flow owner. Explicit executor
  declarations merge with auto-discovered Markdown executors by normalized
  executor id.
- A global flow can own standalone global task data, and the same global flow can
  also be applied to one or more workspaces. Each applied instance has distinct
  workspace-scoped ownership and task identity.

## Non-Goals

- Do not merge Automation Center back into the main window.
- Do not keep the Automation Center flow template management feature.
- Do not introduce a second flow editor inside Automation Center.
- Do not rewrite the shared Agent Chat runtime.
- Do not extract a new automation-manager package in this slice. The shared
  index belongs in the existing desktop automation service layer unless later
  reuse creates a concrete package boundary.
- Do not treat local helper scans as executable tasks. They are inputs to
  Automation Flow discovery and task-data production.

## Definitions

**Automation Flow** is a Markdown spec that discovers, classifies, and schedules
task data. It is a producer and policy owner, not an executable task.

**Task data** is a normalized source item emitted by an Automation Flow. Examples
include a local requirement document, bug report, remote issue, remote merge
request, user prompt, or adapter-discovered source.

**Executor** is the unit that runs against task data. An executor can be a
workspace Markdown executor spec or a referenced skill.

**Executable task run** is the runtime record created from
`taskData + executorRef`. Starting a task means starting an executor with task
data, not running the Automation Flow once.

**Applied global flow** is a workspace-local reference to a global flow under
`~/.mde/automation-flows`. It is visible in the workspace Explorer, but the
global spec remains read-only from that workspace and can only be removed from
that workspace.

## Identity And Ownership

The runtime must use first-class identity keys before building UI projections.
These keys prevent global flows, applied global flows, workspace-local flows,
executors, and task data from colliding.

Recommended owner keys:

```text
workspace:{workspaceId}:flow:{flowId}
global:flow:{flowId}
workspace:{workspaceId}:applied-global:{globalFlowId}
```

`flowId` comes from the flow spec frontmatter. `workspaceId` must be the stable
workspace identity already used by the desktop app, not a display name.

Global-flow behavior:

- A global flow under `~/.mde/automation-flows/{flow-id}.md` has a canonical
  global owner, `global:flow:{flowId}`. It can produce standalone no-workspace
  task data when the flow source rules support global sources.
- Applying the same global flow to a workspace creates a separate owner,
  `workspace:{workspaceId}:applied-global:{flowId}`. It reuses the global
  spec and global executors as read-only inputs, but discovery runs and task
  data ownership are workspace-scoped.
- The same global flow applied to two workspaces creates two distinct owners and
  two distinct task-data namespaces.
- Dedupe happens only inside the same owner key plus source identity. Do not
  dedupe a global task and a workspace-applied task across owner keys.

Executor identity:

- `executorId` is unique within a flow owner.
- Explicit executor declarations use their `id` after trimming and normalizing
  to the same lowercase kebab-case style used by flow ids.
- Auto-discovered Markdown executors derive `executorId` from the filename stem.
  For example, `{flow-id}/implementation.md` becomes `implementation`.
- Skill executors are never auto-discovered from the flow directory. They exist
  only when declared in the flow spec.

Task identity:

```text
taskDataId = stable owner-scoped id(ownerKey, sourceItemId)
taskDataSnapshotId = stable snapshot id(taskDataId, sourceSnapshotHash, normalizedTaskPayloadHash)
executorSnapshotId = stable snapshot id(ownerKey, executorId, executorDefinitionFingerprint)
executableTaskRunId = stable run id(taskDataId, executorId, run attempt)
```

Queue cards are keyed by task data, not by executor. The selected executor is
part of the card projection and run command, not the queue-card identity.

Task snapshots:

- `taskDataId` is stable across discovery refreshes while the owner and source
  identity stay the same.
- `taskDataSnapshotId` changes when discovery produces a new source snapshot for
  the same task data. It records the discovered content/version that the queue
  card currently represents.
- Rediscovering the same task data with the same source snapshot hash and same
  normalized payload keeps the same `taskDataSnapshotId`; the store can update
  `lastSeenDiscoveryRunId` separately without creating a new task snapshot.
- The current queue card points at the latest non-removed task data snapshot.
- Starting an executable task run stores `taskDataId`, `taskDataSnapshotId`,
  `executorId`, and `executorSnapshotId`. Existing runs and reports
  remain bound to the snapshots they started with.
- If a later discovery changes the source content, the queue card can point to a
  newer snapshot without rewriting historical run/report records.
- If a later discovery no longer emits the source item, the latest snapshot can
  be marked removed or stale. The card should leave the active queue unless an
  active run, decision, or report overlay still needs to show history.

Executor snapshots:

- Markdown executor fingerprints include normalized executor declaration
  metadata plus the content hash of the resolved executor Markdown file.
- Skill executor fingerprints include normalized executor declaration metadata,
  the skill ref, resolved source class, resolved source path or provider id, and
  the content hash or provider fingerprint for the resolved `SKILL.md`.
- If a skill resolver cannot provide a stable fingerprint, the executor is
  visible with diagnostics but blocked from starting until the fingerprint is
  available.
- Editing executor Markdown, changing executor declaration metadata, or
  resolving a skill ref to a different source creates a new
  `executorSnapshotId`.

## Storage Layout

Workspace-local flows:

```text
<workspace-root>/.mde/automation-flows/{flow-id}.md
<workspace-root>/.mde/automation-flows/{flow-id}/{executor-id}.md
<workspace-root>/.mde/automation-flows/.applied-global-flows.json
```

User-global flows:

```text
~/.mde/automation-flows/{flow-id}.md
~/.mde/automation-flows/{flow-id}/{executor-id}.md
```

The flow loader must stop treating every nested Markdown file under
`.mde/automation-flows` as a flow spec. Only direct child Markdown files are flow
specs. A directory whose name matches a flow id is an executor directory.

Reserved entries such as dotfiles and `archived/` are not executor directories.
Existing archive behavior can stay, but archived flow files are excluded from
normal flow projection unless explicitly requested by lifecycle management.

The applied-global reference file should be small and explicit:

```json
{
  "version": 1,
  "flowIds": ["research-flow", "release-flow"]
}
```

Invalid or missing global flow references produce diagnostics but do not stop the
workspace index from loading.

## Shared Automation Flow Index

Add a main-process Automation Flow index in
`apps/desktop/src/main/services/automation/*`. It is the shared source of truth
for both windows.

The index loads:

- workspace flow specs from each known or opened workspace
- workspace executor specs under each flow directory
- applied global flow references per workspace
- global flow specs and global executors from `~/.mde/automation-flows`
- skill executors from the skill sources visible to the current agent
- parser, resolver, path-safety, and lifecycle diagnostics

The index exposes projections for:

- the current main-window Explorer workspace
- Automation Center global workspace/group filters
- Automation Flow runtime discovery and executable task resolution
- flow-authoring Chat context

Renderer components do not scan `.mde/automation-flows` directly. They request a
projection and send explicit commands such as create flow, open flow, apply
global flow, remove global flow from workspace, open executor, and update
Automation Center filters.

## Executor Model

Flow specs keep the current Markdown and frontmatter model, extended with an
optional executor declaration.

Example:

```yaml
executors:
  - id: implementation
    type: markdown
    path: ./my-flow/implementation.md
    enabled: true
    tags: [implementation, requirement]
    handles:
      sourceTypes: [workspace-markdown]
      taskTypes: [requirement]
      tags: [implementation]
  - id: execute-picked-task
    type: skill
    ref: skill:execute-picked-task
    enabled: true
    tags: [implementation]
    handles:
      taskTypes: [requirement, bug]
  - id: verifier
    type: markdown
    path: ./my-flow/verifier.md
    enabled: false
    tags: [verification]
```

The normalized executor reference should include:

- `id`
- `type: markdown | skill`
- `enabled`
- `displayName`
- `tags`
- `handles.sourceTypes`
- `handles.taskTypes`
- `handles.tags`
- `sourcePath` for Markdown executors
- `skillRef` for skill executors
- `resolvedSource`
- `diagnostics`
- `order`

Auto-discovered Markdown executors are appended after explicitly declared
executors unless the flow spec gives them an order. They remain visible in
Explorer even if not explicitly declared.

Merge and collision rules:

- An explicit Markdown executor with `id: implementation` and no `path` defaults
  to `./{flow-id}/implementation.md`.
- An explicit Markdown executor whose normalized id matches an auto-discovered
  Markdown executor merges with that executor. The explicit declaration provides
  enabled state, display name, tags, handles, and order. The auto-discovered file
  provides the source path when the declaration does not.
- An auto-discovered Markdown executor whose id is not explicitly declared is
  included as `autoDiscovered: true`, enabled by default, and ordered after
  explicit executors.
- Duplicate explicit executor ids are blocking diagnostics for that flow owner.
  The projection may keep the first declaration for display, but task start is
  blocked until the duplicate is fixed.
- A Markdown executor declaration whose path matches another executor with a
  different id is a blocking duplicate-path diagnostic.
- A skill executor id can collide only with another explicit executor id; normal
  duplicate-id rules apply.

Skill executors are read-only references unless the resolved skill source is a
workspace-local skill. The UI should describe the source class, such as
workspace-local, repo-local, user-global, agent-global, or unresolved.

Skill visibility is provided by a Skill Catalog Provider owned by the desktop
automation service. For this design, "visible to the current agent" means skills
the configured local agent runtime can reference from its known skill roots,
including workspace-local skills, repo-local `.codex/skills`, user
`~/.codex/skills`, user `~/.agents/skills`, and any additional roots exposed by
the active agent runtime configuration. The catalog should refresh on app start,
workspace change, agent/runtime setting change, and explicit user refresh. It
does not need live filesystem watching in the first implementation slice.

## Task Data To Executor Selection

Task data can carry executor requirements or hints. The projection should support
at least:

- explicit required executor id or ref
- task type or source type
- task tags
- flow ownership

Primary executor selection uses this order:

1. If task data explicitly requires an executor, use that executor. If it is
   disabled, missing, or unresolved, the task data is blocked and cannot start.
2. Otherwise, choose the enabled executor whose `handles` best match the task
   data source type, task type, or tags.
3. If no executor matches by tag or type, fall back to the flow executor order:
   explicit flow spec order first, then auto-discovered executors.

Executor matching should score `handles` before descriptive `tags`. Tags can be
shown in UI, but planning and runtime matching should prefer explicit
`handles.sourceTypes`, `handles.taskTypes`, and `handles.tags`.

When multiple enabled executors have equal match strength, use flow executor
order as the deterministic tie-breaker. If order is still equal, sort by
normalized `executorId`.

When task data does not explicitly require an executor, the user may switch the
selected executor before starting, limited to enabled and resolved executors for
that owning flow.

If a flow has no enabled executor, every task data item owned by that flow is
blocked with a diagnostic such as `automationFlow.missingExecutor`.

## Workspace Explorer

The Explorer gains a collapsible Automation Flows section above Recent Files.
This section is the current workspace management surface.

Layout:

```text
[Add] [Apply global workflow]

- workspace flow item
  ... context/management button
  - executor markdown spec
  - skill executor
  - disabled or unconfigured executor

- applied global flow item
  ... remove from current workspace only
```

Behavior:

- `Add` creates `<workspace-root>/.mde/automation-flows/{new-flow-id}.md` and
  opens it in the normal Markdown editor.
- `Edit flow spec` opens the flow Markdown file in the normal Markdown editor.
- `Add executor` creates
  `<workspace-root>/.mde/automation-flows/{flow-id}/{executor-id}.md` and opens
  it in the normal Markdown editor.
- Markdown executor rows open their files like normal Markdown files.
- Skill executor rows open the resolved skill source when a safe local source is
  known; otherwise they show the unresolved reference and diagnostics.
- `Apply global workflow` lets the user choose a global flow and writes its id to
  `.applied-global-flows.json`.
- Applied global flow rows are not editable from the workspace. Their management
  menu supports remove from current workspace and jump to the global flow
  location.
- Global flow management opens the normal Explorer as a pseudo-workspace rooted
  at `~/.mde`, then locates `automation-flows/`. The product should not create a
  special Explorer rooted directly at `~/.mde/automation-flows`, because normal
  flow paths still need to look like `automation-flows/{flow-id}.md` inside that
  pseudo-workspace.
- Flow and executor rows need stable component ids and localized text.

The section can save collapsed state like Recent Files. Expanding it should
refresh or validate the current projection, but it should not trigger task
execution.

## Flow Spec Editor And Chat

Add/Edit flow spec opens the main-window Markdown editor. The file should behave
like a normal Markdown file:

- selected in the file tree when visible
- included in Recent Files
- autosaved through the existing editor save path
- edited through the same Markdown editor component
- eligible for normal editor commands where path safety allows them

Automation-specific validation comes from the shared index and parser. The editor
does not maintain a private flow parser.

Agent Chat gets a flow-authoring context when the active Markdown file is a flow
spec or executor spec. This context includes:

- the active flow spec Markdown
- related executor specs
- skill executor references and resolver state
- parser diagnostics
- missing executor diagnostics
- runtime constraints relevant to the flow

Chat should not automatically start a wizard. The user initiates the Chat, and
Chat can guide the user to provide enough information or edit the current
Markdown file and related executor specs.

New flow creation should create a short valid-enough draft surface, not a full
template-picker-driven workflow. The draft may still be incomplete and blocked
until required sections and at least one enabled executor exist.

## Automation Center

Automation Center remains an independent window for filtering and execution.
Remove the built-in flow template management and embedded flow editor from this
surface.

The left filter changes to grouped flow filters:

```text
Global automation flows [scope toggle] [management icon -> ~/.mde pseudo-workspace]
  - flow item 1 [toggle filter]
  - flow item 2 [toggle filter]

Workspace 1 automation flows [scope toggle] [management icon -> workspace Explorer]
  - flow item 1 [toggle filter]
  - flow item 2 [toggle filter]

Workspace 2 automation flows ...
```

Filter state:

```ts
type AutomationCenterScopeId = "global" | `workspace:${string}`;

interface AutomationCenterFilters {
  readonly bucket?: "needsMe" | "running" | "ready" | "done";
  readonly flowOwnerKeys?: readonly string[];
  readonly scopeIds?: readonly AutomationCenterScopeId[];
}
```

Filter semantics:

- `scopeIds` controls the global/workspace group filter.
- Missing or empty `scopeIds` means no scope restriction, so Automation Center
  shows standalone global data plus all known/open workspace automation data.
- Selecting `global` shows canonical global owners.
- Selecting `workspace:{workspaceId}` shows workspace-local owners and
  workspace-applied global owners for that workspace.
- Selecting multiple scope ids unions those scopes.
- The top-level Global group represents the canonical `global:flow:{flowId}`
  owners. Workspace groups include workspace-local flow owners plus applied
  global owners for that workspace.
- Flow item toggles write `flowOwnerKeys` and filter the task data queue only.
- Missing or empty `flowOwnerKeys` means all flow owners inside the selected
  scopes.
- Flow item toggles do not enable, disable, archive, restore, or edit flows.
- Flow lifecycle and authoring actions jump to the Explorer management surface.
- The global management icon opens or focuses a main window using `~/.mde` as a
  pseudo-workspace root and locates `automation-flows/`.
- The workspace management icon opens or focuses a main window at that
  workspace's `.mde/automation-flows` area.

Task queue semantics:

- Queue cards represent task data, not Automation Flow runs.
- Each visible card shows the task title, task data source, owning flow, primary
  executor, eligible executor status, and current run bucket.
- Starting a card creates an executable task run for
  `taskData + selectedExecutor`.
- Flow discovery or refresh is separate from task start. It produces or updates
  task data.
- Blocked task data can remain visible with diagnostics, but the start action is
  disabled.

## Runtime Flow

1. The shared index loads flows, executors, applied global references, and skill
   executor refs.
2. Automation Flow discovery runs produce normalized task data.
3. The runtime persists task data with owner key, source identity,
   `taskDataId`, source snapshot hash, normalized task payload hash,
   `lastSeenDiscoveryRunId`, and `taskDataSnapshotId`.
4. Projection resolves eligible executors and primary executor for each task data
   item using the current task data snapshot.
5. Automation Center applies workspace and flow filters.
6. The user starts a visible task data item.
7. The runtime starts the selected executor with that task data snapshot and
   stores `executorSnapshotId` on the run.
8. Run, decision, and report overlays update task buckets.

The runtime should keep the distinction between discovery runs and executable
task runs in storage, IPC names, diagnostics, and UI copy.

## Diagnostics And Blocking Rules

Blocking diagnostics prevent task start:

- missing enabled executor
- explicitly required executor is missing, disabled, or unresolved
- skill executor cannot be resolved
- Markdown executor path is missing or outside the allowed root
- flow spec is invalid
- task data cannot be matched to an owning flow

Non-blocking diagnostics can still show in Explorer and Automation Center:

- applied global flow reference points to a missing global flow
- auto-discovered executor is not declared in flow spec
- flow has disabled executors
- skill source is read-only or external
- workspace has no local flows

Saving an incomplete flow is allowed. Starting an executable task from incomplete
flow-owned task data is not allowed.

## Security And Path Safety

All writes must be constrained to:

- `<workspace-root>/.mde/automation-flows`
- `~/.mde/automation-flows`

Global flows referenced from a workspace are not copied or edited from the
workspace. Removing an applied global flow only edits the workspace reference
file.

Skill executors are resolved as read-only unless their source is explicitly a
workspace-local editable skill. Unresolved, external, or agent-global skill
references cannot be deleted through workspace flow management.

Renderer commands must send ids or safe file paths through existing IPC
validation. User-visible text must come from language packs, and new UI elements
must have stable component ids.

## Phased Delivery

This is one product change, but implementation should be sliced:

1. Shared index and schema slice: storage layout, executor parsing, skill
   resolver contracts, task-data-to-executor selection, and diagnostics.
2. Explorer management slice: Automation Flows section, add/edit flow spec,
   executor rows, applied global flow refs, and normal editor launch.
3. Automation Center semantic slice: remove template management, workspace/global
   filters, task data queue cards with primary executor, blocked start
   diagnostics, and executor-backed start command.
4. Flow-authoring Chat slice: active flow/executor context manifest and Chat
   guidance for completing specs.

Each slice should include focused unit, integration, and E2E coverage for the
changed surface.

## Testing Expectations

Unit tests:

- flow loader ignores nested executor Markdown as flow specs
- executor declarations parse and normalize correctly
- auto-discovered executors merge with explicit declarations
- duplicate executor ids and duplicate executor paths block task start
- missing executor blocks task start
- task-required executor overrides tag and order matching
- tag/type matching falls back to flow order
- equal executor matches use flow order and then executor id as tie-breakers
- applied global flow refs load and diagnose missing globals
- global, workspace-local, and applied-global owner keys produce separate task
  data identities
- discovery refreshes keep `taskDataId` stable while changing
  `taskDataSnapshotId`
- unchanged rediscovery keeps `taskDataSnapshotId` stable while updating
  `lastSeenDiscoveryRunId`
- Markdown and skill executor fingerprint changes produce new
  `executorSnapshotId` values
- skill executor resolver reports source class and unresolved refs

Integration tests:

- main-process index projects workspace flows, global refs, executors, and
  diagnostics
- the same global flow applied to two workspaces produces separate
  workspace-scoped owners and does not dedupe task data across workspaces
- Explorer commands create flow specs and executor specs under safe paths
- normal editor can open flow and executor Markdown files
- Automation Center projection shows all workspaces when no workspace is selected
- Automation Center `scopeIds` filters standalone global, workspace-local, and
  applied-global owners predictably
- global management opens `~/.mde` as a pseudo-workspace and locates
  `automation-flows/`
- flow toggles filter without changing lifecycle
- start command starts executor with the selected task data snapshot, not an
  Automation Flow run, and stores `executorSnapshotId`

E2E tests:

- open workspace, add a flow, add an executor, edit both in the normal editor,
  and see the flow become startable only after an enabled executor exists
- apply a global flow to a workspace, verify it appears as read-only in Explorer,
  then remove it from the workspace
- open Automation Center, verify all workspace/global data appears by default,
  filter a workspace, filter a flow, and start a task data item through its
  selected executor

User manual updates should cover the Explorer Automation Flows section,
flow-authoring Chat behavior, applied global workflows, executor requirements,
and the Automation Center task-data queue semantics.
