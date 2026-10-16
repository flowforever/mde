# Remove Automation Flow

Date: 2026-10-16
Status: Written specification approved on 2026-10-16; implementation plan awaiting review

## Intent and approval

The user requested removal of the Automation Flow feature. They confirmed that
the scope includes Automation Center, Explorer flow management, background
discovery and execution, the automation-flow package, and feature-specific code,
dependencies, copy, and documentation. They approved the conversational design
on 2026-10-16.

Success means MDE starts and works as a Markdown editor with ordinary Agent Chat,
without an Automation Flow entry point or an automation execution subsystem.
Existing user flow definitions, executor documents, task sources, and execution
history remain on disk. Users can still open flow Markdown as ordinary files.

This approval permits writing this specification. Implementation follows review
of this written specification, preparation of a written implementation plan, and
the user's selection of an execution method.

## Approach

Remove the feature in one coherent change. This keeps UI, bridge contracts,
runtime registration, package dependencies, tests, and documentation consistent
in the resulting application.

An alternative would remove the UI first and remove the backend in a subsequent
change. That creates an intermediate application with an unused automation
subsystem and additional transitional interfaces. It does not serve this removal
request as well as completing the deletion together.

The existing Agent Chat runtime is already initialized independently of the
automation runtime in `apps/desktop/src/main/index.ts`. Preserve that boundary;
remove its automation consumer and the flow-specific chat context, without
replacing or restructuring ordinary chat.

## Resulting user experience

- Explorer has no Automation Center Home button and no Automation Flows panel,
  flow/executor management actions, global-flow application, or skill refresh.
- MDE no longer creates, opens, or focuses an Automation Center window. Ordinary
  workspace and file windows retain their existing behavior.
- Opening a workspace does not discover automation task sources, parse flows,
  recover runs, schedule work, or start an agent on behalf of Automation Flow.
- Opening an old flow or executor Markdown file uses the normal editor. Agent
  Chat receives the ordinary document context and no flow-specific instructions.
- Markdown editing, autosave, search, links, Mermaid diagrams, AI actions,
  settings, history, and ordinary Agent Chat continue to work.

## Ownership and removal boundaries

### Desktop main process

Remove `apps/desktop/src/main/services/automation/` and
`apps/desktop/src/main/ipc/registerAutomationHandlers.ts`, including the scanner,
index, store, scheduler, runtime coordinator, ownership heartbeat, run locks,
notifications, runtime bridge, executor/skill resolution, and automation agent
adapters.

Remove their initialization, IPC registration, environment switches, startup
skill linking, and shutdown hooks from the main entry point. Keep ordinary AI
handlers, Agent Chat adapters and process runner, file services, update handling,
CLI registration, and workspace handlers.

Remove Automation Center window creation, tracking, and focusing. Delete the
`workspace-automation-flows` launch-resource variant and its special routing from
the main process, workspace handlers, shared workspace contract, preload
validation, and renderer. Preserve string paths and `workspace-file` launch
resources and existing normal window reuse behavior.

### Bridge and window contracts

Remove `apps/desktop/src/preload/automationApi.ts`, its `mdeAutomation` global,
`AUTOMATION_CHANNELS`, and automation-specific shared types under
`apps/desktop/src/shared/automation*.ts`.

Remove `openAutomationCenter` from the window API, its IPC channel and handler,
and the Automation Center window-mode constant and rendering branch. Retain
window helpers still used by the editor; do not refactor unrelated window code.
Keep the existing editor window-mode argument and parser, accepting only the
editor mode. The retired `--mde-window-mode=automation-center` argument falls
back to the editor, as other unknown modes already do. Removed IPC operations
have no registered handler or compatibility implementation.

### Desktop renderer

Delete `apps/desktop/src/renderer/src/automation/`. Remove flow projection state,
refresh effects, callbacks, specialized launch handling, and automation authoring
context from `App.tsx`. Remove the flow panel, Home action, related props, state,
and persistence helpers from `ExplorerPane.tsx`.

Delete exclusive automation styles and imports. Remove retired component names
and IDs from `componentIds.ts` and the public component reference. Keep the
remaining component map sorted alphabetically, with existing stable IDs and
accessible names intact. Do not add replacement controls solely to occupy space.

### Agent Chat package

In `packages/agent-chat`, remove the `automation-center` host,
`automation-task` purpose, `AgentChatAutomationAuthoringContext`, the
`automationAuthoringContext` manifest property, its validation, and its prompt
section. Keep the editor host, `document-chat` and `debug` purposes, attachments,
session history, native session binding, changed-file support, and Codex runtime.

Update desktop Agent Chat request validation to match the remaining contract.
Explicit retired host/purpose values must not create an automation session;
reject these requests before runtime execution. Preserve existing defaulting
for omitted host/purpose fields and the normal editor/debug flows.

The existing native-session binding storage does not require an automation data
migration. Preserve it and ordinary chat metadata. No historical automation
session is automatically resumed by the new app. Opening native history remains
an explicit ordinary chat action.

### Package, build, and skill distribution

Delete `packages/automation-flow/`, including its exclusive tests and config.
Remove the desktop workspace dependency, aliases, bundling entries, TypeScript
paths, Vitest projects/coverage references, and other active configuration entries
that refer to the removed package or desktop automation files. Refresh
`pnpm-lock.yaml`; remove external dependencies only where no remaining workspace
package owns or uses them. Keep root orchestration script names stable.

Remove the repository-owned `skills/automation-flow-helper/` source and its
`.codex/skills/automation-flow-helper` link, its Electron packaged resource, and
the startup registration logic. Do not edit or remove user-global skill
directories or previously installed links as an upgrade side effect.

Keep `auto-pick-tasks`, `execute-picked-task`, and `release-new-version`. These
are repository development workflows, independent of the removed desktop
Automation Flow runtime; this request does not retire those workflows.

## Data preservation and compatibility

No cleanup migration runs. In particular, the application must not delete,
rewrite, archive, or move existing data under:

- Workspace and user-global `.mde/automation-flows/`, including executor files,
  archives, and `.applied-global-flows.json`.
- Workspace `.mde/docs/` task, bug, and requirement documents.
- The application user-data `automation/` directory, including run, report,
  discovery, evidence, lock, ownership, and runtime records.
- Existing unrelated Agent Chat metadata or native-session bindings.

Old automation-specific localStorage entries remain inert. Remove application
code that reads or writes them; do not introduce a new storage cleanup feature.

Preservation means no automatic automation-specific reads or writes. Ordinary
file-tree listing, search, and explicit user opening/editing of Markdown continue
under existing file and workspace rules. Saving an explicitly edited old flow
file is an ordinary document edit, not an automation operation.

Missing or malformed legacy automation records must not prevent startup or
workspace opening, since no automation loader or recovery service remains.
There is no replacement scheduler, archival viewer, migration dialog, or runtime
compatibility layer.

## Errors and user-facing text

Remove automation-only errors, diagnostics, prompts, translations, titles, and
status messages along with their call sites. Retain shared text used by other
features. If remaining UI copy changes meaning, add a new language-pack key as
required by the repository; do not reuse an old key for changed semantics.

Ordinary document, workspace, and Agent Chat failures keep their existing error
handling. Any new user-facing request-validation message must use the language
packs and text helpers. Do not expose retired automation errors during ordinary
startup or file editing.

## Documentation

Remove `user-manual/zh-CN/automation.md` and its navigation links. Update the
manual landing page, workspace guide, data-directory descriptions, and component
reference to describe the resulting app. Explain that old flow Markdown and
history files are retained, but automated execution and its management UI have
been removed.

Regenerate affected manual screenshots through the existing E2E screenshot
workflow, using sanitized fixture workspaces. Do not hand-edit screenshots.
Verify the documentation build after manual changes.

Keep historical release notes and past internal specifications as historical
records. Current runtime, active build/test configuration, and current manual
must contain no live dependency on the removed feature. Mentions in removal
tests, fixtures, migration guidance, historical notes, or this specification are
expected and must not drive unrelated deletion.

## Automated verification

Delete tests whose only subject has been removed. Add or update meaningful
coverage at all three required levels in the same production change.

| Level | Owner | Required behavior |
| --- | --- | --- |
| Unit | Desktop tests and `packages/agent-chat` local tests | Explorer renders its normal controls without Automation Center or flow actions; root renders the editor; remaining chat context includes normal document/selection data without flow instructions; retired chat request values are rejected; component-name/ID reference stays consistent. |
| Integration | `apps/desktop/tests/integration/` and Agent Chat package tests | Bootstrap registers normal file/workspace/AI/chat handlers without automation channels or startup services; preload exposes the remaining API without `mdeAutomation` or `openAutomationCenter`; normal workspace/file launch contracts and chat lifecycle still work. |
| E2E | `apps/desktop/tests/e2e/` | Open a workspace with legacy flow, executor, task, history, and malformed automation fixtures; verify no automation controls or window appear, edit and save Markdown to disk, reopen saved content, and verify protected legacy files remain byte-identical. Exercise ordinary Agent Chat with the existing fake adapter and confirm normal document context and session behavior. |

Legacy preservation checks cover both workspace and isolated E2E home/user-data
locations. Snapshot the fixture automation paths and file contents before launch,
then compare them after startup, workspace operations, and shutdown. Do not
compare all of `.mde/` as a single immutable tree: normal chat and document
history legitimately write their own metadata. Use synthetic content and no
real accounts or personal paths.

Replace the retired Automation Center E2E entry in the desktop default E2E script
with the existing Agent Chat suite so the default desktop checks cover the
retained chat behavior. Remove the dedicated automation E2E script and preserve
the editor performance smoke check. New desktop tests remain under
`apps/desktop/tests/`; Agent Chat tests stay reachable through its package scripts.

Before the implementation is handed off, all of these must pass:

```sh
pnpm run lint
pnpm run typecheck
pnpm run build
pnpm run test:unit
pnpm run test:integration
pnpm run test:e2e
pnpm --filter @mde/agent-chat test
pnpm --filter @mde/desktop test
pnpm run docs:screenshots
pnpm run docs:build
```

The desktop local test command and root aggregators must remain independently
runnable. Reuse a completed equivalent check where commands dispatch the same
suite and build; avoid extra repeated runs unless a later edit or failure makes
the earlier evidence stale. Failures are blockers, not reasons to weaken checks.

## Acceptance criteria

1. There is no Automation Center window, Explorer Home entry, flow panel,
   management action, or automation-specific Agent Chat context.
2. Startup, workspace opening, and shutdown initialize no automation service,
   heartbeat, scheduler, runtime bridge, skill linker, or run recovery.
3. The removed package, API, channels, types, renderer, and packaged helper have
   no active source, dependency, or build/test configuration references.
4. Existing flow, executor, task, report, history, and ownership files survive
   normal app use unchanged unless the user explicitly edits an ordinary file.
5. Workspace and Markdown open/edit/save flows and ordinary Agent Chat pass UT,
   IT, and desktop E2E regression coverage.
6. Current manual copy, navigation, screenshots, translations, and component
   naming match the resulting UI, and required verification passes.

## Delivery boundary

This document is an internal design artifact, not public manual content or a
production implementation. It does not assign a release version. A later
production push follows the repository release policy, including release notes,
version validation, verification, and manual updates. This specification-only
commit has no release tag.

## Specification review and verification

The specification was checked for placeholders, conflicting scope, ambiguous
legacy behavior, required sections, balanced code fences, and trailing whitespace.
The only changed file at this stage is this internal design document.

Repository lint, typecheck, application build, and documentation build were
attempted on 2026-10-16. All stopped before their scripts ran: pnpm could not
fetch and verify the project-pinned `10.18.2` release. Workspace dependencies are
also not installed. These commands have no passing result at this stage; the
implementation must establish the environment and pass the required checks.

Runtime UT, IT, and E2E were not run for this specification-only change because
no application code, runtime configuration, package manifest, or public manual
was changed. Their required implementation coverage is defined above.
