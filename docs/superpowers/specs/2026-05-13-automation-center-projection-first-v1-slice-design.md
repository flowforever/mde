# Automation Center Projection-First V1 Slice Design

Date: 2026-05-13
Status: Accepted for implementation planning after written-spec review

## Goal

Implement the first Automation Center V1 vertical slice with a projection-first
contract: a real automation-flow discovery run must produce persisted normalized
task sources, and the renderer must display those sources as Ready tasks in the
HTML prototype layout.

This slice starts the full V1 direction, but it is intentionally bounded. It
must close UI, runtime, and test coverage together for discovery-to-Ready. Later
slices extend the same projection and runtime contract for richer Running,
Needs me, Done, scheduler, adapter, and Agent Chat behavior.

Current sources for this slice:

- `docs/superpowers/prototypes/workspace-automation-console.html`
- `docs/superpowers/specs/2026-05-12-codex-agent-chat-design.md`

Older Automation Center design drafts are not source material for this slice.
Implementation planning should use only the requirements restated in this spec
plus the current HTML prototype for layout parity.

Source precedence: this spec is normative for slice behavior, the HTML
prototype is normative only for layout parity, and the Codex Agent Chat design
is normative only for shared Agent Chat reuse and Codex availability gating.

## User Decisions

- Use the full V1 path, not a UI-only approximation.
- Build it as strict vertical slices where each slice includes UI, runtime, and
  tests.
- The first slice is: Home opens Automation Center, Automation Center loads an
  automation-flow, starts a discovery run, receives normalized discovered
  sources, projects a Ready task, renders the prototype-style flat queue, and
  shows a Ready Flowline start preview.
- Use the projection-first approach. Main process projection is the contract
  between runtime and renderer.
- The renderer must not manufacture Ready tasks from fixtures or local helper
  scans.
- Prioritize local Codex support as the first real Agent CLI adapter path. The
  implementation must not treat fake JSONL discovery or Claude Code support as
  the primary V1 acceptance path.

## Scope

This slice includes:

- Automation Center renderer reshaped toward the HTML prototype:
  - left Task Stack filters
  - workspace and no-workspace flow filters
  - flat Signal Stack queue
  - right Flowline Ready start preview
  - existing automation-flow editor mode must remain usable when already present,
    but new authoring behavior is not an acceptance target for this slice
- Shared projection types needed by the prototype layout:
  - selected bucket
  - selected task
  - visible task queue
  - workspace and no-workspace flow groups
  - flow rows and setup diagnostics
  - Ready task metadata for workspace, source, flow, engine, and next action
- Real discovery-to-Ready data flow:
  - load and structurally validate automation-flow definitions
  - create discovery runs for enabled valid flows
  - accept normalized discovery output from the adapter bridge
  - persist discovery output and source snapshot metadata
  - derive Ready tasks only from persisted discovery results
  - overlay existing run, decision, and report records when building buckets
- Codex-first real adapter support:
  - use the local Codex CLI adapter as the first real execution target
  - reuse the Codex CLI call implementation from `@mde/agent-chat`
  - run discovery through Codex when the capability probe passes
  - keep fake JSONL adapters for deterministic automated tests only
  - keep Claude Code as a later or secondary adapter path for this slice
- Command wiring for filters and Ready start preview:
  - Task Stack bucket filter
  - workspace or flow filter
  - Start run command from Flowline
- Agent Chat entry point in the Automation Center surface:
  - use the existing Agent Chat runtime/UI stack
  - create automation sessions with `host: "automation-center"`
  - use `sessionPurpose: "automation-task"`
  - mount only the existing panel/entry path; do not add a new chat runtime,
    new session model, or chat-driven task execution
  - do not make chat a task intake source in this slice
- Unit, integration, and E2E coverage for the slice.

This slice does not include:

- Full automatic pick-next scheduler behavior.
- Complete Running, Needs me, Done Flowline report views.
- Remote provider discovery adapters beyond data-model compatibility.
- Manual task creation in Automation Center.
- Current document or selection task intake.
- A new chat runtime or second Automation Center-specific chat system.
- New automation-flow authoring/setup behavior beyond preserving existing
  create/edit functionality that is already wired in the app.
- Full Claude Code parity. Claude Code can remain visible in generic engine
  contracts, but it is not the first real adapter to complete for this slice.

## Architecture

`@mde/automation-flow` remains the pure domain package. It owns schema
validation, discovery output normalization, ownership diagnostics, bucket
derivation helpers, template contracts, and loop-planning primitives. It must
not import Electron, React, desktop services, native agent CLIs, or filesystem
storage.

`apps/desktop/src/main/services/automation/*` owns the runtime behavior. It
loads automation-flow files, runs discovery, starts adapters, stores run events
and discovered sources, applies run/report overlays, and builds the projection
served through IPC.

`@mde/agent-chat` owns Codex-specific CLI integration. That includes Codex
process invocation, capability probing, sustained-session protocol handling,
native session identity, and low-level Codex event/message normalization.
Automation services must reuse those Codex calls instead of implementing a
second Codex process runner, parser, or session protocol under
`apps/desktop/src/main/services/automation/*`.

The automation runtime owns only the automation-specific layer above
`@mde/agent-chat`: discovery and task prompt bundles, automation-flow snapshots,
run ids, source snapshots, structured discovery/result normalization, run/report
stores, and Automation Center projection.

`apps/desktop/src/shared/automation.ts` is the renderer contract. It should
carry the exact projection shape the renderer needs for the prototype layout,
instead of making renderer components derive runtime meaning from low-level
arrays.

`apps/desktop/src/renderer/src/automation/*` owns presentation and commands
only. Renderer components consume projection data, render i18n text, expose
stable component ids, and send explicit commands such as `updateFilters` and
`startRun`.

The first slice uses the existing automation runtime and adapter surfaces where
possible. If a fake JSONL adapter is used for tests, it must still travel
through the real discovery run, store, IPC, and projection path.

## Codex-First Adapter Requirement

The first real Agent CLI target for this slice is the local Codex CLI, reached
through the existing `@mde/agent-chat` Codex implementation. The implementation
plan must prioritize Codex adapter capability before Claude Code parity or
additional provider adapters.

The Codex path is required in these places:

- Discovery: an enabled automation-flow can start a discovery run through the
  local Codex adapter provided by `@mde/agent-chat` when Codex is installed,
  authenticated, and capability probing reports the required protocol support.
- Projection: discovered sources emitted by the Codex run are persisted and
  projected the same way as any adapter output.
- Start run command path: clicking Start run from the Ready Flowline must call
  the same runtime command path that will start a Codex task run for a
  Codex-owned task. The richer Running/Done UI can arrive in later slices.
- Slice boundary: Codex discovery and Codex `startRun` command wiring are
  required here; full Running/Done execution UX is not required in this slice.
- Verification: automated tests may use fake JSONL for deterministic assertions,
  but implementation handoff must include a local Codex smoke attempt when the
  machine has a supported Codex CLI. If local Codex is missing or unsupported,
  the handoff must report the capability diagnostic instead of silently claiming
  the real adapter path passed.

Automation-specific code may add an adapter bridge that adapts automation
prompt bundles to the `@mde/agent-chat` runtime, but it must not duplicate the
Codex CLI protocol implementation. Fake JSONL adapters are test doubles, not
product acceptance substitutes. Claude Code remains part of the long-term
adapter model, but it must not block or replace the Codex-first acceptance path
for this slice.

## Projection Data Flow

1. The Automation Center window mounts and calls `mdeAutomation.getProjection()`.
2. The main process loads workspace-local and user-global automation-flow
   definitions for the active context.
3. Enabled, structurally valid flows create or reuse discovery runs according
   to the current runtime rules.
4. Discovery runs execute through the adapter bridge.
5. The adapter emits normalized discovered task sources.
6. The main process validates and persists discovered sources with source item
   identity, source snapshot hash or reference, owning automation-flow id, run
   id, source type, workspace id when present, title, engine, and source path or
   URI metadata when safe.
7. Projection derives Ready tasks from persisted discovery output only.
8. Projection overlays active runs, pending decisions, and latest reports to
   assign each task to one bucket.
9. Projection applies the selected bucket, workspace, and flow filters.
10. Renderer displays the resulting flat visible queue.

Local scanners such as `.mde/docs/tasks`, `.mde/docs/requirements`, and
`.mde/docs/bugs` are helper inputs to discovery runs. They are not allowed to
create Ready task cards directly.

## Filter Contract

The projection filter state is explicit and persisted by the main process:

```ts
type AutomationProjectionFilters = {
  archivedVisible?: boolean;
  bucket?: "needsMe" | "running" | "ready" | "done";
  flowIds?: readonly string[];
  workspaceIds?: readonly string[];
};
```

`bucket` is a single status filter. For this slice, the first open defaults to
`ready` so the discovery-to-Ready acceptance path is immediately visible. Later
opens restore the last persisted bucket.

`workspaceIds` is multi-select. The first open defaults to the current workspace
id plus the semantic no-workspace id used for user-global automation-flows.
Later opens restore the persisted workspace id array.

`flowIds` is multi-select. An empty or missing `flowIds` array means all visible
flows under the selected workspaces and no-workspace scope. When `flowIds` is
present, only those flows are included.

Projection normalization removes stale filters before rendering:

- workspace ids that are no longer known are dropped
- flow ids whose flow no longer exists are dropped
- flow ids whose owning workspace is not selected are dropped
- if all workspace ids become stale, the projection falls back to the first-open
  workspace defaults
- if all flow ids become stale, projection treats it as all visible flows under
  the selected workspaces

Renderer components do not keep independent authoritative filter state. They
render the normalized filters returned by projection and send filter changes via
`updateFilters`.

## Task Identity And Overlay Contract

`sourceItemId` identifies the underlying discovered source. For workspace local
Markdown sources, it is derived from the stable workspace id plus the normalized
workspace-relative source path. For user-global prompt sources, it is derived
from the semantic user-prompt scope plus the normalized prompt-library relative
path. Remote source ids use the normalized provider/source identity emitted by
the discovery adapter.

`taskId` identifies the owner-scoped automation task and is derived from the
owning `automationFlowId` plus `sourceItemId`. The implementation may use a
helper for the exact string format, but it must preserve this invariant:

```text
taskId = stable owner-scoped id(automationFlowId, sourceItemId)
```

Run records, decisions, and reports are keyed by `taskId` and also store
`sourceItemId` for history and diagnostics. If a different automation-flow later
owns the same `sourceItemId`, the new owner gets a new `taskId`. Old runs and
reports may appear as source history or technical evidence, but they must not be
attached as the current report for the new owner-scoped task.

Bucket overlay uses `taskId` first. It applies active run, pending decision, and
latest report state only to the task with the matching owner-scoped id. This
prevents a report produced by one automation-flow from incorrectly moving
another automation-flow's task into Done.

## Renderer Design

### AutomationCenterWindow

`AutomationCenterWindow` keeps the existing shell responsibilities:

- load projection through IPC
- refresh after commands
- open/create automation-flow editor state
- keep the resize handle
- keep return-to-workspace behavior

The main layout becomes the prototype structure:

```text
[ left filters ] [ flat Signal Stack queue ] [ Quiet Flowline ]
```

When the automation-flow editor is open, the left filters remain visible and
the center/right work area switches to editor mode.

### WorkspaceFlowFilters

`WorkspaceFlowFilters` becomes the left prototype panel.

It renders:

- Task Stack status filter buttons for Needs me, Running, Ready, and Done.
- A compact filter toolbar with Archived visibility.
- A no-workspace/global flow group for user-global automation-flows.
- Workspace flow groups with flow rows.
- Setup diagnostics for missing coverage or invalid flows when those diagnostics
  already exist in projection.

Task Stack rows are buttons, not descriptive cards. Selecting a row calls
`updateFilters` with the selected bucket and refreshes projection.

Flow rows show a status light, flow name, source hint, and context menu. They do
not show lifecycle text such as `ENABLED` in the compact row.

Per-workspace add-flow actions, flowless setup rows, and richer automation-flow
authoring workflows are deferred unless they already exist and can be preserved
without changing the discovery-to-Ready slice boundary.

### SignalStack

`SignalStack` renders one flat task queue. It must not render visible bucket
sections in the center column.

Each task card shows:

- title
- status badge
- workspace or No workspace
- owning automation-flow
- engine when known
- next action or report availability

Ready task cards do not own the primary start action in this slice. The primary
Start run action appears in Flowline for the selected task, matching the
accepted V1 direction that task actions happen in Flowline.

### QuietFlowline

`QuietFlowline` implements the Ready and empty states for this slice.

For no selected task, no tasks in the current filter, or diagnostics-only setup,
it renders an empty state from the language pack.

For a Ready task, it renders:

- task title
- status and source summary
- owning automation-flow
- engine
- a preview phase plan derived from task and automation-flow metadata when
  available, with a conservative fallback phase list when no structured plan is
  available
- Start run action wired to `mdeAutomation.startRun({ taskId })`

Running, Needs me, and Done details can remain compact in this slice, but their
renderer structure should not block later milestone, decision, report, and
evidence sections.

### AutomationFlowEditorHost

Automation-flow authoring is not a new behavior target for this slice. Existing
create/edit behavior must keep using `MarkdownBlockEditor` and must remain
compatible with the prototype's editor-mode layout:

- editor workspace header
- Markdown editor surface
- validation and source-ownership inspector
- footer actions

The implementation must not introduce a bespoke textarea for automation-flow
Markdown.

### Agent Chat Entry

Automation Center must expose the minimal Agent Chat entry in the right-side
surface if the existing shared Agent Chat API is available to the window. The
entry mounts the existing `AgentChatPanel`; it does not introduce a new
Automation Center chat implementation. The entry inherits the existing Codex
availability gating from the shared Agent Chat design, so unsupported Codex chat
must not appear as a dead Automation Center action.

The integration must pass:

- `host: "automation-center"` when creating draft sessions
- `sessionPurpose: "automation-task"` in the context manifest

The first slice does not use Agent Chat to discover tasks, start runs, or
replace Flowline actions. It only proves the Automation Center can reuse the
shared chat runtime without creating a second chat stack.

## Error Handling

Missing or malformed automation-flow definitions become setup diagnostics. They
must not create Ready tasks and must not appear as Needs me tasks.

Adapter unavailability before discovery becomes a setup diagnostic. Signal Stack
stays empty for that flow unless there are existing valid projected tasks from a
prior persisted discovery result that remain eligible under the current runtime
rules.

If local Codex is missing, unauthenticated, or does not support the required
automation adapter protocol, the Codex path surfaces an adapter setup diagnostic.
The runtime must not silently switch a Codex-owned automation-flow to Claude Code
or to a fake adapter.

Discovery run failures produce flow or run diagnostics. The renderer must not
invent a Ready fallback task.

Malformed discovery output is rejected and surfaced as diagnostics. Raw adapter
payloads, stack traces, absolute internal paths, tokens, and session ids stay
out of primary UI.

Start run command failure leaves the selected task in Ready and shows a
user-facing diagnostic or alert state from the language pack.

Renderer components must not receive raw filesystem authority. Main-process
services validate automation-flow paths, source paths, evidence paths, and run
ids before accepting commands.

## Testing

### Unit Tests

- View model derives selected bucket, selected task, and visible flat queue.
- Task Stack filter command generation preserves unrelated filters.
- Signal Stack renders a flat queue and does not render center-column bucket
  section headings.
- Signal Stack task cards display status, workspace/no-workspace, flow, engine,
  and next-action metadata from projection.
- Flowline renders Ready start preview and empty states.
- Flowline Start run calls the real command callback with the selected task id.
- WorkspaceFlowFilters renders Task Stack buttons, workspace groups,
  no-workspace flows, archived toggle, flow rows, and projected diagnostics.
- Filter normalization covers first-open defaults, persisted reopen state, and
  stale workspace or flow ids.
- Task identity derivation keeps `taskId` owner-scoped and overlays reports by
  `taskId`.
- Agent Chat Automation Center entry uses automation host and task purpose when
  the shared API is available.
- New and changed UI strings use language-pack keys.
- New and changed UI components use stable `data-component-id` values.

### Integration Tests

- Projection derives Ready tasks from persisted discovery output, not from raw
  helper scanner results.
- Local Codex capability verdict controls whether a Codex discovery run can
  start, and unsupported Codex produces setup diagnostics.
- Automation runtime uses `@mde/agent-chat` Codex calls for capability and
  local Codex session execution instead of a duplicate automation-only Codex
  implementation.
- Discovery output validation rejects malformed discovered sources and records
  diagnostics.
- `updateFilters` changes selected bucket, workspace, or flow and projection
  reflects the selected filter.
- Multi-select workspace and flow filters persist and are normalized when stale.
- Invalid automation-flow, unavailable adapter, and failed discovery appear as
  diagnostics rather than task cards.
- Reports from an old owner-scoped `taskId` do not attach to a new task when a
  different automation-flow later discovers the same `sourceItemId`.
- `startRun` from a Ready Flowline uses the existing automation command path.
- Automation Center renderer close does not destroy persisted discovery output
  or run metadata.

### E2E Tests

- Open MDE, click Explorer Home, and verify Automation Center opens in a
  separate window.
- Fake JSONL discovery emits a local Markdown task and the task appears as a
  Ready card in the flat Signal Stack.
- When local Codex is available in the test environment, a smoke path starts
  discovery through Codex and verifies the resulting projection or records the
  explicit Codex capability diagnostic.
- Task Stack Ready filter shows the Ready task without center-column bucket
  section headings.
- Selecting the Ready task shows the Flowline start preview.
- Clicking Start run reaches the real automation command path.
- The original editor window remains usable after opening Automation Center.

## Verification Plan

Run targeted tests for the changed packages and app surfaces first:

- `pnpm --filter @mde/automation-flow test`
- `pnpm --filter @mde/desktop test`
- focused desktop unit and integration tests for Automation Center
- focused E2E Automation Center test
- local Codex smoke for discovery-to-Ready when `codex` is installed and reports
  the required capability; otherwise capture the setup diagnostic

Before final handoff for the implementation slice, run the relevant repository
checks required by `AGENTS.md` for the touched surface:

- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm run build`
- `pnpm run test:unit`
- `pnpm run test:integration`
- `pnpm run test:e2e`

If a broad check fails because of unrelated pre-existing failures, capture the
failing command and keep the slice's targeted verification passing.

## Planning Notes For The Next Phase

The implementation plan should order work so the contract hardens before the UI
depends on it:

1. Extend shared projection types and view-model derivation.
2. Ensure discovery output is persisted and projected as Ready task data.
3. Prioritize local Codex adapter capability and discovery-run wiring through
   `@mde/agent-chat`.
4. Add explicit filter normalization and owner-scoped task identity helpers.
5. Implement Task Stack filters and flat Signal Stack.
6. Implement Ready Flowline start preview and command wiring.
7. Add the minimal Automation Center Agent Chat entry using the existing chat
   runtime.
8. Update tests at unit, integration, and E2E levels.
9. Update user manual content for the visible Automation Center behavior.

The plan should keep later V1 work as follow-up slices:

- richer Running Flowline milestones
- Needs me decision actions
- Done report and evidence views
- full scheduler pick-next behavior
- remote source providers
- deeper Agent Chat and automation run coordination
- richer automation-flow authoring/setup workflows
- full Claude Code parity
