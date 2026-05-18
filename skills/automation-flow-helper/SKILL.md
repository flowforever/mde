---
name: automation-flow-helper
description: Use when a user opens, creates, references, edits, reviews, or improves MDE automation-flow Markdown documents under `.mde/automation-flows/` or `~/.mde/automation-flows/`, or when a user wants to create a task for an automation-flow. Covers guided intake, templates, status/lifecycle, global flow application, flow frontmatter, pick rules, execution standards, verification expectations, report patterns, source matching, loop policy, executor management, Automation Center runtime semantics, task-to-flow matching, and task document creation in the flow-associated source queue.
---

# Automation Flow Helper

## Purpose

Help a user turn an automation intent into a valid, runnable MDE automation-flow document, and help them create task documents that the intended flow can discover. Keep the document aligned with the current parser, runtime, Automation Center, and executor contracts rather than inventing a separate workflow language.

## Working Model

Treat automation-flow execution as two layers:

* Local loading parses YAML frontmatter plus five required Markdown sections into an `AutomationFlow`.

* Runtime AI consumes the parsed flow snapshot. Discovery runs return task sources only; task runs execute exactly one selected task source in a separate run/session.

Do not describe the flow as if free-form Markdown alone is enough. The document must satisfy the local schema before runtime AI can use it.

## Workflow

1. Locate the target flow document. Workspace flows live in `.mde/automation-flows/*.md`; user-global flows live in `~/.mde/automation-flows/*.md`. If the active or referenced file is an automation-flow document, treat it as the target. If creating a new workspace flow, use a lowercase hyphenated id and matching file name.

2. Read the relevant implementation when behavior is uncertain:
   * Parser/schema: `packages/automation-flow/src/parser.ts`, `packages/automation-flow/src/schema.ts`, `packages/automation-flow/src/types.ts`
   * Templates and ownership: `packages/automation-flow/src/templates.ts`, `packages/automation-flow/src/ownership.ts`, `packages/automation-flow/src/projection.ts`
   * Runtime prompt shape and locks: `apps/desktop/src/main/services/automation/automationPromptBundle.ts`, `apps/desktop/src/main/services/automation/automationRunLocks.ts`
   * Source discovery: `apps/desktop/src/main/services/automation/automationSourceScanner.ts`
   * Global flow application: `apps/desktop/src/main/services/automation/automationAppliedGlobalFlows.ts`
   * Executor resolution/start flow: `packages/automation-flow/src/executors.ts`, `apps/desktop/src/main/services/automation/automationExecutorLibrary.ts`, `apps/desktop/src/main/services/automation/automationSkillCatalog.ts`, `apps/desktop/src/main/ipc/registerAutomationHandlers.ts`, `apps/desktop/src/main/services/automation/automationRuntime.ts`

3. Guide the user to provide missing information. Do not dump the whole schema as a questionnaire. Read the document first, infer what is already clear, then ask only the highest-value missing questions.

4. If the user asks to create a task, identify the intended automation-flow before choosing a task path. Create the task under that flow's matching source queue and readiness rules.

5. Edit only the flow document, executor document, or new task document needed for the request. Do not change runtime code unless the user explicitly asks for implementation changes.

6. After any non-trivial edit, mentally cover these scenario families: flow creation/editing, template use, global-flow application, task-source discovery, task creation, executor routing, Automation Center state, run locks, and report/evidence safety.

7. Validate the document with the parser-facing tests or the owning package test command before handoff.

## Guided Intake

When a user opens, creates, or references an automation-flow document, act like a flow coauthor. Start from the document state and guide the user toward a runnable flow.

For an existing or opened flow:

* Summarize what is already known: flow id/name, scope, lifecycle, source types, source queue, readiness rule, loop mode, default engine, executors, and required sections.

* Identify gaps that block execution, such as missing required frontmatter, empty required sections, no enabled executor, unclear source queue, unclear ready signal, invalid engine, or ambiguous report expectations.

* Ask at most three concise questions at a time. Prefer questions that unblock parser validity or runtime execution.

* If the user's intent is clear enough, make a conservative edit instead of asking.

For a new flow:

* Ask for the minimum viable intent before writing: source queue, ready signal, manual vs continuous, executor strategy, and completion/report expectation.

* If the user only gives a rough goal, create a setup flow with safe defaults: `scope: workspace`, `status: draft`, `lifecycle: enabled`, `defaultEngine: codex`, `loopPolicy.mode: manual`, and a disabled or clearly scoped executor. Current MDE Explorer creation follows this shape: the flow is visible/setup-ready, but not runnable until sections, source matching, and an enabled executor are valid.

* If the user says the flow should run now or be production-ready, use `status: formal` and `lifecycle: enabled` only after source matching and executor routing are explicit.

Keep `status` and `lifecycle` separate:

* `status: draft` or `formal` describes definition maturity; `lifecycle: enabled`, `disabled`, or `archived` describes runtime availability or archival state.
* A `draft` flow can be loaded and shown as setup work; it should not be described as production-ready.

For a referenced flow without a direct edit request:

* Provide a compact improvement checklist first.

* Separate parser blockers from runtime-quality improvements.

* Offer concrete next edits, but do not rewrite broad policy text unless the user asks.

Core intake questions to choose from:

* Which source queue should discovery scan: `.mde/docs/tasks`, `.mde/docs/requirements`, `.mde/docs/bugs`, user prompts, remote issues, or something else?

* What marks a source as ready: `automation.status: ready`, a title starting with `READY`, a remote label/comment, or a custom rule?

* Should the loop be `manual` or `continuous`, and what should happen when no work is found?

* Which executor should run selected tasks: an existing skill, a new flow-local Markdown executor, or multiple executors selected by type/tags?

* What should the final report include so MDE can tell whether the task is done, blocked, cancelled, or failed?

## Flow Management Semantics

When guiding a user through flow creation or management, match the current MDE surfaces.

Current create behavior:

* Explorer-created flows are ordinary Markdown documents under the automation-flow root. The current skeleton is `status: draft` plus `lifecycle: enabled`, with parser-required sections and a disabled Markdown executor draft.

* Treat that as a setup state: the document exists and can be edited, but task execution still needs valid source matching and at least one usable executor.

Template creation:

* Built-in template ids include `bug-fix`, `local-dev-task`, `manual-approval`, `requirement-implementation`, and `research-and-notes`.

* `manual-approval` supports user and workspace scope; `research-and-notes` is user scope; the other built-ins are workspace scope.

* If creating from a template contract, validate the template's allowed scopes and required inputs before writing the flow.

Editing surface:

* Automation Center is an independent task console. It does not own an embedded flow editor.

* New and existing automation-flow documents and Markdown executor files should be opened and saved through the main Explorer as ordinary Markdown files, then validated through parser and executor diagnostics.

Global flow application:

* A user-global flow lives in `~/.mde/automation-flows/`, but file existence alone does not make it active in a workspace.

* Applying a global flow to a workspace is a reference relationship persisted in the workspace automation-flow root as `.applied-global-flows.json`.

* Do not copy a user-global flow into the workspace just to make it applied. Edit the original user-global file, then manage the workspace application reference.

Archive and restore:

* Current archive/restore semantics are file moves: archive moves the definition into an `archived/` child folder; restore moves it back to the root.

* Do not simulate archive by only changing `lifecycle: archived`. The normal library loads top-level flow Markdown files from the root, not archived child files.

## Task Creation

When the user asks to create a task for automation, do not guess a path first. Identify the target automation-flow, then create a task document that matches that flow.

### Identify The Target Flow

Build a candidate list from workspace `.mde/automation-flows/*.md`, applied user-global flows when visible, and any flow path/name/id the user mentioned.

Prefer a flow in this order:

1. Explicit flow path, id, or name from the user's request.

2. The currently opened automation-flow document.

3. An enabled or setup workspace flow whose `match.taskPathGlobs`, `pickOrder`, `sourceTypes`, `executors`, or `Pick Rules` match the task intent.

4. A formal flow over a draft flow, and an enabled flow over a disabled flow.

5. Higher `priority` when two enabled flows both match.

If more than one flow still plausibly matches, ask a concise disambiguation question and name the candidate flows. Do not create duplicate task documents for multiple flows unless the user explicitly requests that.

Runtime ownership for a matching source is not decided by path specificity or `pickOrder`. It is scored by higher `priority`, then `status: formal`, then `scope: workspace`. If two enabled flows can own the same source with the same ownership score, runtime may emit an ownership-tie diagnostic and produce no candidate. Use explicit flow selection or distinct priorities to avoid that.

If no flow matches, either:

* create or improve the automation-flow first, when that is the user's intent, or
* ask where the task should live before creating it.

### Choose The Task Directory

For workspace Markdown task sources, choose the directory from the selected flow's `match.taskPathGlobs` and `pickOrder`, not from the user's wording alone.

Workspace Markdown discovery roots are fixed to `.mde/docs/bugs/`, `.mde/docs/requirements/`, and `.mde/docs/tasks/`. `match.taskPathGlobs` filters within those roots; it does not expand discovery to `docs/*` or other directories. If a selected flow still points at `docs/bugs`, `docs/requirements`, or another non-scanned root, stop and report a flow/runtime mismatch before creating the task.

Use the first matching queue that fits the task type:

* bug or defect work: `.mde/docs/bugs/`
* feature, requirement, or product work: `.mde/docs/requirements/`
* general local work item: `.mde/docs/tasks/`

If the selected flow uses a narrower glob, such as `.mde/docs/tasks/release/**/*.md`, create the task inside that narrower directory. If the flow's globs do not match the current scanner roots, call that out as a flow/runtime mismatch before creating the task.

Avoid `done/` and `archived/`. Create missing directories when needed.

### Write A Discoverable Task

Create one Markdown file per task. Use a lowercase hyphenated filename, usually prefixed with `ready-` only when the task should be immediately discoverable.

For a ready task, use both a status and a title that discovery can recognize:

```markdown
---
automation:
  status: ready
tags: automation implementation
---

# READY Implement example behavior

## Summary

...

## Acceptance Criteria

...

## Automation Flow

- Flow: `example-flow`
- Expected executor: `execute-picked-task`

## Verification

...
```

For a draft task, use `automation.status: draft` and do not start the title with `READY`.

Readiness depends on source type:

* `workspace-markdown`: `automation.status: ready` is ready; without an automation status, a first heading starting with `READY` is also ready.

* `user-prompt`: only `automation.status: ready` makes the prompt source eligible; a `READY` title alone is not enough.

* `remote-issue`, `remote-mr`, `remote-doc`, `local-file`, and `adapter-discovered`: there is no local Markdown-ready parser for comments or labels. Define the exact ready rule in `Pick Rules` and the discovery adapter contract.

Do not treat body prose like `Ready for $flow`, a `ready-*.md` filename, or a plan note as a ready signal. Discovery uses source metadata and headings, not body text.

Task content should include:

* clear summary and acceptance criteria,
* selected automation-flow id/name,
* expected executor when known,
* required source links, designs, screenshots, or code paths,
* constraints such as no release, no push, manual-test gate, or credentials needed,
* verification expectations.

Do not mark a task `ready` if required product scope, credentials, designs, or acceptance criteria are missing. Create a draft task and list the missing inputs instead.

### Keep Flow And Task Aligned

After creating the task, confirm it satisfies the selected flow:

* task path matches one of the flow's `match.taskPathGlobs`,
* source type is included in `sourceTypes`,
* ready signal matches the flow's title/status rules,
* tags or task type match executor handles when those handles are required,
* no `done` or `archived` path segment is present.

If the task cannot be made discoverable without changing the flow, stop and explain the mismatch instead of creating a task that automation will never see.

## Required Frontmatter

Make these fields explicit unless the user is intentionally drafting a partial example:

```yaml
---
id: example-flow
name: Example Flow
status: formal
lifecycle: enabled
scope: workspace
sourceTypes:
  - workspace-markdown
priority: 50
match:
  taskPathGlobs:
    - .mde/docs/tasks/**/*.md
  titleIncludes:
    - READY
pickOrder:
  - .mde/docs/tasks/**/*.md
loopPolicy:
  mode: manual
  intervalMinutes: 15
  maxActiveRuns: 1
  onEmpty: wait
  onBlocked: pause-automation-flow
allowedEngines:
  - codex
defaultEngine: codex
confirmationPolicy:
  highRisk: require-user
  unclearScope: require-user
  fileWrites: automation-flow-controlled
reportPattern: Short machine-usable report summary name or sentence.
executors:
  - id: execute-picked-task
    displayName: Execute Picked Task
    type: skill
    ref: skill:execute-picked-task
    enabled: true
---
```

Use only current source types: `adapter-discovered`, `local-file`, `remote-doc`, `remote-issue`, `remote-mr`, `workspace-markdown`, `user-prompt`.

Ensure `defaultEngine` is listed in `allowedEngines`. Prefer `codex` unless the user names another supported engine.

## Required Sections

Every flow needs exactly these semantic sections with non-empty content:

* `## Pick Rules`: how discovery should identify eligible sources, readiness, priority, skip rules, and empty-queue behavior.

* `## Execution Standard`: what the selected executor must do for one task, including boundaries, safety constraints, and handoff expectations.

* `## Acceptance Standard`: how to decide whether the run satisfied the selected source.

* `## Verification Expectations`: what checks or evidence are expected for this class of work.

* `## Report Pattern`: the fields or summary structure the final report should include.

Write these sections as operational instructions for another agent, not product marketing copy. Prefer concrete paths, statuses, keywords, and terminal conditions.

## Source Matching Guidance

For workspace Markdown queues, align `match.taskPathGlobs` and `pickOrder` with actual scanned roots. Current local scanning reads `.mde/docs/bugs/`, `.mde/docs/requirements/`, and `.mde/docs/tasks/`, skipping `done/` and `archived/`.

The scanner roots are not inferred from the flow. A glob such as `docs/requirements/**/*.md` is legacy drift unless the runtime has changed, because the workspace scanner only produces sources under `.mde/docs/{bugs,requirements,tasks}`.

Readiness is normally one of:

* frontmatter `automation.status: ready`, or
* a first heading/title that starts with `READY`.

For `workspace-markdown`, either signal can work. For `user-prompt`, require `automation.status: ready`. Do not rely on body text alone for readiness. If a flow should use `remote-issue`, `remote-mr`, or another source type, state the runtime/discovery expectation in `Pick Rules` and ensure an executor can handle that source type.

## Executor Guidance

Use a `skill` executor when the work should follow an existing reusable skill, for example:

```yaml
executors:
  - id: execute-picked-task
    type: skill
    ref: skill:execute-picked-task
    enabled: true
    handles:
      sourceTypes:
        - workspace-markdown
      tags:
        - implementation
```

Use a `markdown` executor when the flow owns local executor instructions under a sibling folder, for example `./example-flow/implementation.md`. Keep markdown executor paths inside the flow's executor directory.

The Markdown executor file content becomes runtime executor instructions in the task prompt. Write it as executable per-task instructions, not descriptive notes.

Make `handles.sourceTypes`, `handles.tags`, and `handles.taskTypes` specific when multiple executors exist. This improves executor selection and avoids ambiguous task routing.

## Executor Management

Support executor management as part of this skill. Executor management means adding, editing, disabling, removing, or diagnosing executor declarations and any flow-local Markdown executor instruction files.

Before changing executors, inspect:

* the flow's `executors:` frontmatter,
* sibling Markdown executor files under `.mde/automation-flows/<flow-id>/`,
* referenced skills under workspace `.codex/skills`, repo `.codex/skills`, `~/.codex/skills`, and `~/.agents/skills` when relevant.

Any `.md` file under `.mde/automation-flows/<flow-id>/` can become an auto-discovered Markdown executor even without a frontmatter declaration. Removing the declaration alone does not disable that file; rename, move, or delete the file if it must leave executor selection.

When adding a `skill` executor:

* Use `type: skill` plus `ref: skill:<skill-name>`.

* Prefer existing repo-local skills for project workflows, especially when the flow should reuse established task execution behavior.

* If the referenced skill is missing or only exists as an unresolved idea, say that clearly and either create/update the skill only when asked or keep the executor disabled.

* Add `handles.sourceTypes`, `handles.taskTypes`, and `handles.tags` when there is more than one executor.

Skill refs are resolved in this visibility order when available: workspace-local `.codex/skills`, repo-local `.codex/skills`, user-global `~/.codex/skills`, agent-global `~/.agents/skills`, then runtime extra roots. Same-name skills are first-win. Treat an unresolved required skill executor as start-blocking.

When adding a `markdown` executor:

* Use an id that normalizes cleanly to lowercase kebab-case.

* Put the instruction file under `.mde/automation-flows/<flow-id>/<executor-id>.md` unless the current code or user specifies another safe pattern.

* Keep the path inside the flow's executor directory. Do not point markdown executors at arbitrary workspace files.

* Write the executor file as direct runtime instructions for one selected task source. Include boundaries, allowed edits, verification expectations, decision prompts, and final report requirements.

If a matching auto-discovered file already exists for the same normalized executor id, an explicit declaration can reuse that file path. Check its content before assuming a new blank executor will be created.

When editing an executor:

* Preserve existing id stability unless the user explicitly wants a rename.

* If renaming, update both the frontmatter declaration and the markdown executor path/file name when applicable.

* Preserve disabled executors unless the user asks to remove them; disabled executors may be intentional drafts.

* Avoid two executors with the same normalized id or the same markdown path.

When removing an executor:

* Remove the frontmatter declaration.

* Ask before deleting a markdown executor file if it contains non-placeholder instructions or could be referenced elsewhere.

* If removing the last enabled executor, either add a replacement, disable the flow, or clearly report that the flow cannot start tasks.

Executor selection rules to remember:

* A required executor from task source metadata wins by `requiredExecutorId` or `requiredExecutorRef`.

* Disabled required executors block task start.

* Without a required executor, enabled executors are scored by matching `sourceTypes`, `taskTypes`, and tags, then ordered by declaration order and executor id.

* If there is no enabled executor, the flow is parser-valid but task execution is blocked at runtime.

Automation Center starts a task with the selected `executorSnapshotId`, not only `executorId`. If the executor declaration, skill content, or Markdown executor file changes after preview, the old selection can become stale and start may be rejected.

Start-blocking diagnostics to check before saying a task can run:

* no enabled executor,
* required executor missing,
* required executor disabled,
* duplicate normalized executor id,
* duplicate Markdown executor path,
* unresolved required skill ref,
* stale or missing selected executor snapshot at start time.

## Runtime Semantics To Preserve

When improving a flow document, preserve these truths unless the code has changed:

Parser vs runtime AI:

* Parser loading only validates YAML frontmatter, schema fields, and the five required Markdown sections.

* Runtime AI consumes a parsed flow snapshot and selected task/executor snapshots. It should not be treated as a free-form parser for arbitrary automation-flow Markdown.

* Discovery prompt contract: return normalized discovered task sources and do not execute any task.

* Task prompt contract: execute exactly one task source and emit structured events plus a final report.

* Discovery and task execution are separate runtime runs/sessions.

Automation Center state model:

* `needs-me` means a run is waiting for human decision or input.

* `running` includes `starting` and `running`.

* `ready` means task data was discovered and has at least one usable executor.

* `done` means a completed report exists.

* Projection priority is `needs-me`, then `running`, then `ready`, then `done`.

Run lock and duplicate execution:

* Discovery and task execution both use active-run protection.

* Task run lock identity includes profile, workspace scope, automation flow, source item, task id, and when present the flow owner key, executor snapshot id, and task data snapshot id.

* `starting`, `running`, `needs-me`, and recoverable runs are active and should block duplicate starts for the same lock.

* The flow document should still describe visible coordination and terminal status rules when humans or external issue queues are involved.

* Continuous flows should define what happens on empty queues and blocked runs; manual flows should make clear that user action starts execution.

Codex and Agent Chat availability:

* Automation Center currently does not expose an Automation Agent Chat entry point or open native Agent Chat sessions from the console.

* Real task execution still depends on the local agent runtime and Codex availability. If Codex is not logged in or the workspace/runtime is unavailable, a flow can be valid but not runnable.

Report and evidence safety:

* Task runs should emit structured `finalReport` or `decisionPrompt` data, not only free-form prose.

* Evidence paths must stay inside the current workspace or MDE automation storage. Reject path traversal, unsupported symlinks, and evidence paths outside those roots.

* Report summaries, phase messages, and evidence should avoid secrets and should respect runtime redaction behavior.

## Validation

For flow-document-only changes, run the smallest relevant parser validation:

```bash
pnpm --filter @mde/automation-flow test
```

If the change also affects desktop loading, executor resolution, Automation Center UI, or prompt bundling, add the relevant desktop unit or integration tests and run the owning command. For docs-only edits, state that runtime tests were not applicable and still report the parser validation result.

Before handoff, summarize:

* created or changed flow path,
* source queue and readiness rule,
* run mode and loop behavior,
* selected executor,
* executor files or skill refs added, changed, disabled, or removed,
* validation command and result,
* any remaining runtime/code gap that the document cannot solve.
