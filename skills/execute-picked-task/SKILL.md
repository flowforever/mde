---
name: execute-picked-task
description: Use when an MDE task execution flow receives a dispatched READY local task or GitHub WILL-DO issue and must complete or hand off that selected task.
---
# Execute Picked Task

## Overview

Execute one task that was already selected and dispatched by `skills/auto-pick-tasks/SKILL.md`. This skill owns the execution lifecycle, but it must run that lifecycle through arranged SubAgents. The auto-pick selector owns only candidate selection, claim, and direct invocation of this skill.

Within this skill, the `execute-picked-task` agent is the orchestrator, not the direct implementation worker. Every selected task must have explicit SubAgent ownership for task work or code change, review, manual testing, and release decision or release execution.

## Execution Boundary

The `execute-picked-task` agent owns orchestration:

* Reading the selected task source, linked docs, related done docs, user manual, tests, and nearby code.

* Preserving the selector's pick-gate assumptions or documenting why they no longer hold.

* Arranging a Task Work SubAgent for the selected task's primary work, including code change, docs/config change, tests, and automated verification.

* Arranging review, fix-review, manual divergent testing, release decision, and release execution SubAgents as required by this skill.

* Enforcing the repository's TDD, i18n, component-id, security, manual, verification, PR/MR, release, and archive rules through those SubAgent assignments.

* Consolidating SubAgent outputs into selected-source completion, release, verification, blocker, or handoff notes.

* Returning terminal status to `skills/auto-pick-tasks/SKILL.md`.

The `execute-picked-task` agent must not:

* Implement code, docs, config, tests, or product changes directly when a Task Work SubAgent can be arranged.

* Self-review its own orchestration as a substitute for Architect, Review, or Fix-Review SubAgents.

* Perform manual divergent testing itself.

* Run `skills/release-new-version/SKILL.md` directly instead of assigning a Release SubAgent when release/deploy is required.

* Mark a task complete until the required SubAgent phases have produced passing or terminal evidence.

If the harness cannot arrange required SubAgents, record "Blocked" on the selected source with the missing SubAgent capability and return control to auto-pick. Do not silently downgrade into a single-agent execution path.

The execution agent must not pick another task. If the selected task becomes blocked, record the blocker on the selected source and stop or hand off according to the user's latest instruction.

Because `skills/auto-pick-tasks/SKILL.md` is strictly serial, the execution agent must record a terminal status on the selected source before handoff whenever execution finishes, blocks, or needs human input. Without that terminal source note, auto-pick must keep waiting and must not dispatch another task.

## Mandatory SubAgent Plan

Every selected task must have an explicit SubAgent plan before work starts. The plan must name the required SubAgents, their ownership, and the evidence each one must return.

Required SubAgents:

| Phase | Required SubAgent | Required for | Required output |
| --- | --- | --- | --- |
| Task work or code change | Task Work SubAgent | Every selected task, including docs/config-only tasks | Implementation or non-code change, tests or test rationale, changed files, verification evidence, blockers |
| Architecture review | Architect SubAgent and Architect Fix-Review SubAgent as needed | Every task with production, package, runtime, UI, data-flow, or release impact | Architecture ALL PASS or concrete blocker |
| General review | Review SubAgent and Fix-Review SubAgent as needed | Every selected task | Review ALL PASS or concrete blocker |
| Manual testing | Manual Divergent Testing SubAgent rounds | Every selected task; runtime/user-visible tasks require at least one real exploratory round | Manual divergent testing ALL PASS, or not-applicable rationale for non-runtime work, or concrete blocker |
| Release | Release Decision SubAgent, then Release SubAgent using `skills/release-new-version/SKILL.md` when release-worthy | Every selected task needs the release decision; release-worthy production features and bug fixes need release execution | Release/deploy version and evidence, no-release rationale, or concrete blocker |

The Task Work SubAgent may be specialized by task type, for example code change, docs change, config change, test-only change, or GitHub issue branch/PR work. Even when no production code changes are needed, use a SubAgent to make and verify the task-specific change or to prove that no change is needed.

Review, manual testing, and release SubAgents must be fresh SubAgents. Do not reuse the Task Work SubAgent as its own reviewer, manual tester, or release executor.

## Preflight

1. Read the task source and the selector handoff before editing code.

2. Inspect `git status` and identify edits that predate this execution. Work around them; do not revert unrelated user, selector, or other-agent changes.

3. Create the Mandatory SubAgent Plan. If required SubAgents cannot be arranged, record a blocker before making task changes.

4. Confirm whether the task has task-specific constraints that override the normal release path, such as "do not stage", "do not commit", "do not push", or "do not release".

5. For a GitHub issue, assign branch creation, branch work, PR/MR creation, and issue-comment coordination to the Task Work SubAgent. Include the issue number in the branch name, commit message, and PR description when possible.

6. If a required credential, signing material, customer data sample, legal/security approval, destructive action, force-push, or ambiguous product decision is missing, record a blocker instead of guessing.

## Development

The Task Work SubAgent performs the first development pass. The `execute-picked-task` agent dispatches the SubAgent, passes the selected task source and constraints, then waits for changed files, verification evidence, and blocker status.

1. Instruct the Task Work SubAgent to write focused failing tests first for the behavior being changed. Use package-local tests for package behavior and `apps/desktop/tests/` for desktop unit, integration, support, screenshot, and E2E coverage.

2. Instruct the Task Work SubAgent to implement the smallest conservative change that satisfies the selected task and existing product patterns.

3. Require user-facing text to stay in language packs and be accessed through the app i18n helpers.

4. Require stable component names and `data-component-id` values through the owning component-id map. Keep `COMPONENT_NAME_ID_MAP` sorted and update `user-manual/zh-CN/component-names.md` when concrete UI ids change.

5. Require `user-manual/` updates when behavior, UI flows, settings, AI actions, search, links, workspace handling, update behavior, local data, or troubleshooting guidance changes.

6. Preserve safety boundaries: no hardcoded secrets, no renderer process spawning for desktop UI, no arbitrary local-path injection from renderer APIs, and no raw logs or private paths in user-facing messages.

## Verification

The Task Work SubAgent, or a dedicated Verification SubAgent when needed, runs the checks required by the changed surface. For production code, expect the full repository gate unless the task-specific instruction narrows it:

* `pnpm run lint`

* `pnpm run typecheck`

* `pnpm run build`

* `pnpm run test:unit`

* `pnpm run test:integration`

* `pnpm run test:e2e`

Require owning package scripts as well, for example `pnpm --filter @mde/editor-core test`, `pnpm --filter @mde/editor-host test`, `pnpm --filter @mde/editor-react test`, or `pnpm --filter @mde/desktop test`.

Require `pnpm run docs:build` when manual or docs-site surfaces change. Require `git diff --check` before handoff.

Treat failing lint, typecheck, unit, integration, E2E, docs, or build checks as blockers unless the user explicitly asked for an unfinished checkpoint. If a failure is unrelated and pre-existing, capture exact evidence and keep remediation scoped.

## Review And Manual Divergent Testing

After the Task Work SubAgent's first development pass and automated verification, dispatch a fresh Architect SubAgent review before the general code review, release/deploy, or completion handoff. The `execute-picked-task` agent must not self-approve the Task Work SubAgent's result.

Architecture review uses this loop:

1. Dispatch a fresh Architect SubAgent with the task source, implementation summary, changed files, known constraints, and verification evidence.

2. Ask the Architect SubAgent to review whether the first implementation is architecturally reasonable, including package ownership, renderer/main/preload/IPC boundaries, editor package boundaries, data flow, persistence model, abstraction level, coupling, maintainability, performance shape, security boundaries, and whether the design is over- or under-engineered for the selected task.

3. Dispatch a fresh Task Work Fix SubAgent to fix every valid architecture finding, rerun the affected automated checks, and record the fix summary.

4. Dispatch a new Architect Fix-Review SubAgent after each architecture fix batch. It must verify the previous architecture findings are fixed, check for regressions introduced by the fixes, and call out any new valid architecture issues.

5. Repeat fix plus new architect fix-review until Architecture ALL PASS.

Architecture ALL PASS means every valid architecture finding is fixed and re-reviewed, every affected automated check passes, and no valid unresolved architecture blocker remains. Do not treat accepted residual architecture risk as Architecture ALL PASS unless the user explicitly approves that risk.

After Architecture ALL PASS, run the general review and fix-review loop:

1. Dispatch a fresh Review SubAgent with the task source, implementation summary, changed files, known constraints, Architecture ALL PASS evidence, and verification evidence.

2. Ask the Review SubAgent to check requirement fit, correctness, missing tests, regressions, security/safety boundaries, i18n/component-id/manual requirements, and verification gaps.

3. Dispatch a fresh Task Work Fix SubAgent to fix every valid review finding, rerun the affected automated checks, and record the fix summary.

4. Dispatch a new Fix-Review SubAgent after each fix batch. It must verify the previous findings are fixed, check for regressions introduced by the fixes, and call out any new valid issues.

5. Repeat fix plus new fix-review until Review ALL PASS.

Review ALL PASS means Architecture ALL PASS is already recorded, every required automated check passes, every valid general review or fix-review finding is fixed and re-reviewed, and no valid unresolved blocker remains. Do not treat accepted residual risk as Review ALL PASS unless the user explicitly approves that risk.

After the architecture and general review loops are ALL PASS, arrange 1-5 rounds of SubAgent manual divergent testing before release/deploy or completion handoff. Production runtime and user-visible tasks must run at least one manual divergent testing round.

The round count is based on task complexity:

| Complexity | Rounds | Use when |
| --- | --- | --- |
| Low | 1 | Narrow pure logic, small package behavior, or one contained non-UI change |
| Moderate | 2 | One visible UI flow, one IPC/filesystem path, or one settings/action path |
| Medium | 3 | A feature spans renderer/main/package code, persistence, i18n, or docs/manual behavior |
| High | 4 | The task changes stateful sessions, multiple windows, workspace files, automation, AI/runtime behavior, or security-sensitive boundaries |
| Critical | 5 | The task is broad, release-critical, touches destructive operations, migrations, auth/secrets, native process execution, or multiple high-risk user workflows |

Manual divergent testing means exploratory testing by fresh Manual Divergent Testing SubAgents. Each round must have a different mission. A later round may re-check previous findings, but it must not be limited to "did the last bugs get fixed". Every round should also explore a new workflow, data shape, edge case, platform state, failure path, or user sequence.

For every production runtime or user-visible task, at least one manual divergent testing round must explicitly cover all of these dimensions when applicable:

* Usability: whether the flow is understandable, discoverable, and efficient for a real user.

* Performance: whether the flow creates slow startup, high CPU/memory use, excessive IO, or scaling problems.

* Response speed: whether user actions, loading states, streaming, save/open actions, dialogs, and feedback feel responsive.

* Visual quality: whether layout, spacing, density, hierarchy, color, focus, empty/error/loading states, and aesthetic polish fit the product.

If a dimension is genuinely not applicable, record why in the selected task source instead of silently omitting it.

Use this pattern for each round:

1. Give the SubAgent the task source, implementation summary, how to run the app/tests, and the changed surfaces.

2. Assign a distinct exploration mission, such as happy-path user flow, hostile/invalid input, persistence/reload, multi-window/workspace switching, accessibility/i18n/component ids, offline/CLI-missing state, recovery after failure, or regression against adjacent flows.

3. Ask for concrete reproduction steps, screenshots/log snippets when useful, severity, and whether each finding is new, a known unresolved issue, or a previous-fix regression.

4. Dispatch a fresh Task Work Fix SubAgent for every valid manual-testing finding before release/deploy or completion handoff. After each fix batch, require affected automated checks and manual regression testing that proves the reported issue is fixed.

5. Continue the fix-and-retest loop until all valid manual-testing findings are fixed and retested. Do not release, archive, close, or mark complete while valid unresolved manual-testing defects remain. A finding may become accepted residual risk only when the user explicitly approves that risk.

6. Record the round count, missions, required dimension coverage, findings, fixes, retest evidence, and remaining risk in the selected task source before terminal handoff.

Manual divergent testing is ALL PASS only when every required round is complete, usability/performance/response-speed/visual-quality coverage is recorded for production runtime or user-visible changes, every valid manual-testing finding is fixed and manually retested, and no valid unresolved manual-testing blocker remains.

Documentation-only, formatting-only, or internal configuration-only tasks still need a Manual Divergent Testing SubAgent. That SubAgent may mark runtime manual divergent testing as not applicable only with a recorded rationale. Production runtime and user-visible tasks must run at least one real exploratory round.

## Release And Deploy

Arrange a Release Decision SubAgent for every selected task after Architecture ALL PASS, Review ALL PASS, and manual divergent testing ALL PASS. The Release Decision SubAgent decides whether the task is release-worthy under repository policy and task-specific constraints.

For release-worthy production features and bug fixes, dispatch a fresh Release SubAgent to run `skills/release-new-version/SKILL.md`. Do not run release locally in the `execute-picked-task` orchestrator. Do not wait for extra user confirmation unless the task-specific instructions explicitly say not to stage, commit, push, tag, or release, or unless a real blocker such as missing credentials, failed verification, or required external approval remains.

Before release/deploy:

* Require the Release Decision SubAgent to confirm the change is release-worthy. Do not release documentation-only, test-only, formatting-only, local-only, experimental, or internal configuration changes unless the user explicitly asks.

* Require user-visible behavior changes to have matching `user-manual/` updates or a clear note explaining why the manual is unaffected.

* Require all required verification for the changed surface to have passed.

* Confirm the architecture review loop is Architecture ALL PASS.

* Confirm the general review and fix-review loop is Review ALL PASS.

* Confirm manual divergent testing is ALL PASS for production runtime or user-visible changes, including usability, performance, response speed, visual quality coverage, and retest evidence for every fixed manual-testing finding.

* For GitHub issues, confirm the PR/MR is created and merged before issue closure. Do not mark the issue released before the production release succeeds.

If release/deploy is blocked by task-specific instructions or missing credentials, keep the task source outside `done`, record the exact blocker, and include the verification state already achieved.

## Release Fix Loop

If the Release SubAgent discovers a required fix during `skills/release-new-version/SKILL.md`, classify the fix before changing files:

* Release-only metadata fixes may stay inside the Release SubAgent. Examples: version metadata, release notes wording, tag-message preparation, release command retry notes, and release workflow status documentation.

* Task-scope fixes must return to `execute-picked-task` before release continues. Examples: production code, tests, user manual content, runtime configuration, build/package behavior, packaging behavior, task acceptance criteria, or any change that could affect Architecture ALL PASS, Review ALL PASS, or manual divergent testing ALL PASS.

For a task-scope release fix:

1. Stop the release before tagging or pushing whenever possible.

2. Record "Release fix required" on the selected task source with the exact release-stage finding, files or behavior likely affected, and any partial release state.

3. Dispatch a fresh Task Work Fix SubAgent for the fix.

4. After the fix lands, rerun the full required `execute-picked-task` lifecycle: Architecture review/fix-review to Architecture ALL PASS, general review/fix-review to Review ALL PASS, manual divergent testing to ALL PASS, Release Decision SubAgent, then a fresh Release SubAgent.

5. Treat earlier Architecture ALL PASS, Review ALL PASS, and manual divergent testing ALL PASS as invalidated by the task-scope release fix. Do not reuse them as final gates for the changed code state.

If the task-scope fix is discovered only after a tag or release push, do not delete, recreate, move, or force-push the existing tag. Record the blocker and release state, then return to `execute-picked-task` for the full fix loop and follow the release skill's tag-safety rules for any follow-up release.

## Completion

Use one of these terminal status meanings in the task source so auto-pick can safely resume:

* "Completed" or "Released" when implementation, required verification, and required release/deploy are done.

* "Archived" when a local task document has been moved to `done`.

* "Blocked" when execution cannot continue without an external dependency or failed release/deploy follow-up.

* "Needs human input" when the next decision requires the user.

* "Not autonomous" when repository context proves the task cannot be completed autonomously.

For local task documents:

* Add a status note with implementation summary, verification commands, release/deploy version when applicable, and any residual risk.

* Include architecture review status, general review/fix-review status, manual divergent testing round count, missions, required dimension coverage, findings, fixes, retest evidence, and any remaining risk.

* Move the document into the matching `done` directory only after required release/deploy succeeds.

For GitHub issues:

* Add a PR/MR link comment as soon as the PR/MR exists.

* Add completion, release/deploy, and verification comments without deleting issue history.

* Include architecture review status, general review/fix-review status, manual divergent testing round count, missions, required dimension coverage, findings, fixes, retest evidence, and any remaining risk in the completion or handoff comment.

* Close the issue only after its required PR/MR is merged and the production release/deploy has succeeded.

If the task cannot complete, record "Blocked" or "Needs human input" on the selected source with what was checked, the concrete blocker, and the exact human input needed.

After recording a terminal completion, release, archive, blocker, or handoff status, return control to the `skills/auto-pick-tasks/SKILL.md` main agent. The task execution agent must not pick the next task itself; the terminal selected-source note is the signal that auto-pick can resume candidate polling.

## Quick Reference

| Situation | Action |
| --- | --- |
| Dispatched local READY task | Arrange Task Work, Review, Manual Testing, and Release Decision SubAgents; archive only after required release |
| Dispatched GitHub WILL-DO issue | Arrange Task Work SubAgent for branch/PR/MR/issue coordination, then release/deploy after merge when required |
| Task says do not commit/push/release | Arrange SubAgents for allowed work and verification; record unreleased checkpoint and keep source active |
| First development pass | Dispatch a Task Work SubAgent, then send the result to fresh Architect SubAgent review |
| Architecture review finds valid issues | Dispatch a Task Work Fix SubAgent, require affected checks, then dispatch a new Architect Fix-Review SubAgent |
| Architecture ALL PASS | Dispatch the fresh general Review SubAgent |
| Review finds valid issues | Dispatch a Task Work Fix SubAgent, require affected checks, then dispatch a new Fix-Review SubAgent |
| Review ALL PASS | Arrange 1-5 Manual Divergent Testing SubAgent rounds based on complexity |
| Runtime or user-visible task | Arrange at least one manual round covering usability, performance, response speed, and visual quality |
| Manual testing finds valid issues | Dispatch a Task Work Fix SubAgent, require affected checks and manual retest evidence before completion |
| Manual divergent testing ALL PASS | Arrange Release Decision SubAgent, then Release SubAgent with `skills/release-new-version/SKILL.md` when release-worthy |
| Release discovers task-scope fix | Stop release if possible, dispatch Task Work Fix SubAgent, then rerun the full execute-picked-task lifecycle |
| Completion, release, archive, blocked, or handoff recorded | Return control to the auto-pick main agent; do not pick the next task here |
| Verification fails | Arrange a Task Work Fix SubAgent if caused by this task; otherwise record exact unrelated failure evidence |
| Release/deploy fails | Keep source outside `done`, record blocker, and do not close GitHub issue |
| Human input required | Stop execution, record the concrete question/blocker, and do not guess |
