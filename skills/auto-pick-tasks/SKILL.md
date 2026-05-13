---
name: auto-pick-tasks
description: Use when Codex should run a strictly serial autonomous loop over READY local task documents or WILL-DO GitHub issues.
---
# Auto Pick Tasks

## Overview

Run a continuous strictly-serial task-picking loop for MDE. The main agent is only the selector, dispatcher, and in-flight monitor: pull the latest branch state, reload this skill, scan for one eligible local READY task or GitHub issue marked `WILL-DO`, apply the pick gate, claim the selected source when required, directly execute `skills/execute-picked-task/SKILL.md` in a dedicated task execution SubAgent, then wait for that selected task to reach a terminal execution state before considering any other task.

The main agent must not implement, test, release, or archive the selected task. Those responsibilities belong to `execute-picked-task` and the SubAgents it arranges.

The dispatch target is always `skills/execute-picked-task/SKILL.md`. Do not create an ad hoc worker prompt or a generic execution workflow for a picked task.

Strict serial means there can be at most one auto-pick-dispatched task in flight across local READY documents and GitHub `WILL-DO` issues. Do not scan for, claim, or dispatch the next task while the current selected task is still "Dispatched" or "In progress".

## Main Agent Boundary

The main agent owns only these responsibilities:

* Refresh branch state before each pick cycle.

* Reload `skills/auto-pick-tasks/SKILL.md` before each pick cycle.

* Find and rank candidate task sources.

* Apply the pick gate to decide whether a candidate can be dispatched without immediate human input.

* Claim or mark the selected source as in progress when the source requires visible coordination.

* Dispatch exactly one selected task by directly invoking `skills/execute-picked-task/SKILL.md` with enough context to continue independently.

* Monitor the selected source after dispatch until it records a terminal execution state.

* Resume candidate polling only after the in-flight task is completed, released/archived, blocked, marked as needing human input, marked not autonomous, or explicitly handed off/cleared by the user.

The main agent must not:

* Perform deeper implementation analysis after the handoff has enough context.

* Edit production code for the selected task.

* Run the selected task's TDD, lint, typecheck, unit, integration, E2E, or release verification.

* Commit, push, create MR/PR, tag, release, close issues, or move completed task documents to `done` for the selected task.

* Finish the selected task locally just because task execution agents are slow or unavailable.

If `execute-picked-task` cannot be started, do not start local implementation. Record that dispatch is blocked when there is a selected source to annotate, then continue the pick loop.

## Selection Rules

* Candidate priority is local-first, GitHub-last.

* Search candidates in this order: `docs/bugs/`, then `docs/requirements/`, then GitHub issues in `https://github.com/flowforever/mde/issues`.

* Do not select a GitHub issue while any non-blocked local READY candidate remains available.

* Only select a local document whose title explicitly contains `READY`.

* Only select an open GitHub issue when an issue comment contains the exact keyword `WILL-DO`.

* Treat `flowforever` as the user's GitHub account for `WILL-DO` selection.

* When GitHub authentication can identify the current user, accept `WILL-DO` comments by either `flowforever` or the current authenticated user.

* If GitHub access or user identity is unavailable, skip GitHub issue selection for that loop and keep processing local task documents.

* `READY` means the document is a candidate, not permission for the main agent to implement it.

* `WILL-DO` means the issue is a candidate, not permission for the main agent to implement it.

* Dispatch exactly one autonomous task at a time.

* Before scanning for new candidates, check whether any local task document or GitHub issue still has an unresolved auto-pick "Dispatched" or "In progress" status. If one exists, treat it as the active in-flight task and enter the Serial In-Flight Gate instead of selecting another task.

* If no local READY task or GitHub `WILL-DO` issue exists, wait 15 minutes, then search again. Repeat this wait-and-search cycle indefinitely until a candidate appears or the user explicitly stops the loop.

* Never treat an empty candidate search as completion. If no task is detected, the loop must keep running.

* Skip ambiguous documents instead of inferring readiness from body text.

* Skip documents that already contain an unresolved auto-pick "Dispatched", "In progress", or "Dispatch blocked" status note unless the user has edited the document or explicitly cleared the status.

* Skip documents that already contain an unresolved auto-pick "Needs human input" or "Not autonomous" status note unless the user has edited the document or explicitly cleared the blocker.

* Skip GitHub issues that already contain an unresolved auto-pick "Dispatched", "In progress", or "Dispatch blocked" comment unless the user has added a newer `WILL-DO` comment, the task execution agent has added a newer completion/release/blocked/handoff comment, or the user has explicitly cleared the status.

* Skip GitHub issues that already contain an unresolved auto-pick "Needs human input" or "Not autonomous" comment unless the user has added a newer `WILL-DO` comment or explicitly cleared the blocker.

* Skip GitHub issues that already contain an unresolved auto-pick "In progress" status comment by another actor unless the same actor has added a newer completion, release, blocked, or handoff comment.

## Autonomy Gate

Before dispatching a task, decide whether it appears completable end-to-end by a task execution agent without immediate human participation. This is a pick gate, not a full implementation plan. Bias toward resolving uncertainty autonomously; do not classify a task as human-blocked just because it has minor gaps, ordinary ambiguity, or implementation choices.

First try to remove uncertainty by:

* Reading the task document, related requirement or bug docs, recent done docs, tests, user manual, and nearby code.

* For GitHub issues, reading the issue title, body, labels, comments, linked PRs, and any referenced local docs or code paths.

* Inferring expected behavior from established product patterns, existing UI copy, i18n keys, test conventions, and release policy.

* Confirming that at least one small conservative implementation path appears available when multiple implementation options are valid.

* Treating missing internal implementation details as engineering work, not human input, when they can be discovered from the repository.

* Documenting reasonable assumptions in the task status note, issue comment, or task execution handoff instead of stopping for confirmation.

Dispatch only when all of these are true:

* The required behavior, acceptance criteria, and affected user flow are clear from the task document and repository context.

* Any missing implementation detail can be resolved from existing code, tests, docs, or established project patterns.

* Required credentials, external access, signing material, release permissions, and local tooling are already available or are not needed.

* Verification can be completed with automated lint, typecheck, unit, integration, and E2E checks that can run in the current environment.

* Any release decision follows existing policy without needing product, design, security, legal, or operational approval.

Stop for human input only when a concrete blocker remains after the autonomy investigation, including:

* Ambiguous product, UX, copy, scope, priority, or acceptance-criteria choices.

* Missing screenshots, designs, data samples, credentials, accounts, secrets, signing keys, or external system access.

* Real customer data, private account data, payment, legal, compliance, security, or privacy review.

* Manual QA or release judgment that cannot be converted into automated verification from the current context.

* A request to reuse, overwrite, force-push, or otherwise bypass repository safety policies.

If the task is not fully autonomous after this investigation, do not dispatch it and do not mark development as started. Add a brief status note or issue comment explaining what you checked, the concrete blocker, and the exact human input needed; keep the task outside `done` and leave GitHub issues open, then select another candidate if one exists.

## GitHub Issue Coordination

For GitHub issues, coordination happens immediately after the Autonomy Gate passes and before handoff to the task execution agent. The main agent performs only the visible claim needed to prevent duplicate handling; the task execution agent owns deeper analysis, implementation, branch work, MR/PR creation, verification, release, and closure.

When claiming a GitHub issue for dispatch:

* Re-read the issue comments immediately before claiming it. If another unresolved auto-pick "In progress" status appeared, skip the issue and select another candidate.

* Add a GitHub issue comment immediately stating that auto-pick has selected and dispatched the issue, who claimed it when GitHub identity is available, and that the issue is in progress to avoid duplicate handling.

* If the repository exposes safe issue state surfaces such as assignee, label, or project status, update the relevant status to in-progress in the same claiming step when permissions allow.

* If the in-progress comment or available status update fails, do not dispatch that GitHub issue. Record the failure if possible, then select another candidate or wait and loop.

* Do not rely on local notes, branch names, or unpushed work as the coordination signal for GitHub issues; the status must be visible on GitHub.

## GitHub Issue Execution Boundary

GitHub issues require visible coordination before handoff, but branch work, commits, PR/MR creation, release/deploy, and issue closure belong to `skills/execute-picked-task/SKILL.md`. The main agent must pass the issue URL, claim details, and any observed coordination constraints in the handoff, then enter the Serial In-Flight Gate for that issue.

## Serial In-Flight Gate

If any selected task is already in flight, the main agent must not select another task.

An in-flight task is any local task document or GitHub issue with an unresolved auto-pick status of:

* "Dispatched"

* "In progress"

* "Dispatch blocked" when the blocker is dispatch infrastructure and the task has not been explicitly cleared

The in-flight task is terminal only when one of these is true:

* A local task document has been moved to the matching `done` directory after required release/deploy.

* The selected source records "Completed", "Released", "Archived", or equivalent completion/release details from the task execution agent.

* The selected source records "Blocked", "Needs human input", or "Not autonomous" with a concrete blocker.

* A GitHub issue has a newer task-execution completion, release, blocked, or handoff comment.

* The user explicitly clears the in-flight status or changes priority.

While an in-flight task is not terminal:

1. Pull latest branch state and reload this skill on the normal polling cadence.

2. Re-check only the active in-flight task source and, when available in the current harness, the task execution agent status.

3. Do not scan `docs/bugs/`, `docs/requirements/`, or GitHub issues for new candidates.

4. Do not inspect diffs, run tests, release/deploy, archive, close issues, or finish the task locally.

5. Wait 15 minutes, then repeat the in-flight check until the task is terminal or the user explicitly stops or reprioritizes the loop.

When the in-flight task becomes terminal, do not silently continue. Send a user-visible status update before selecting another task. The update must include:

* The selected task source.

* The terminal state: completed, released, archived, blocked, needs human input, not autonomous, or user-cleared.

* The task execution summary available from the task source or GitHub issue comment.

* Verification, release/deploy, PR/MR, archive/close, and manual divergent testing status when present.

* Any blocker, exact human input needed, or residual risk.

* The next loop action: continue picking automatically, follow a user-specified priority change, or stop/pause only when the user explicitly requested it or continuing would be unsafe.

If the terminal state is "Needs human input", include the concrete question in the notification and leave that selected task blocked or waiting for the user's answer. Do not wait for the answer before resuming candidate polling for other autonomous work unless the missing input is required to safely run any task, the user explicitly pauses the loop, or continuing would require destructive action, credential disclosure, force-push, or another unsafe operation.

## Execute Picked Task Handoff

After a candidate passes the Autonomy Gate and any required claim succeeds, directly start a dedicated SubAgent using `skills/execute-picked-task/SKILL.md`. The handoff must include:

* The selected task source: local file path or GitHub issue URL.

* The candidate type and priority reason.

* The pick-gate evidence that made the task dispatchable.

* Any assumptions the execution agent should preserve or verify.

* Required coordination rules, including GitHub issue claim details and MR/PR requirements when applicable.

* Required execution skill: `skills/execute-picked-task/SKILL.md`; this must be the direct target of the handoff.

* A clear ownership statement: `execute-picked-task` owns arranging the required SubAgents for analysis, code or task changes, tests, verification, review, manual testing, commit/MR/PR when allowed, release/deploy when required and allowed, task-source completion notes, and archive/close steps.

Once the `execute-picked-task` SubAgent accepts the handoff, the main agent enters the Serial In-Flight Gate for that selected source. Wait for terminal execution status before selecting another task, but do not inspect diffs, run tests, release, archive, or perform task execution work unless the user explicitly changes the main agent role.

## Loop

1. Pull the latest branch state from the configured remote, then reload `skills/auto-pick-tasks/SKILL.md` so the latest workflow rules apply.

2. Check for an active in-flight auto-pick task. If one exists, enter the Serial In-Flight Gate and do not scan for new candidates.

3. Select the highest-priority candidate only when no in-flight task exists: READY local bug, then READY local requirement, then GitHub `WILL-DO` issue.

4. Apply the Autonomy Gate. If investigation confirms the task is not dispatchable without immediate human input, record what was checked plus the needed human input, then return to step 3. If every visible candidate is blocked, wait 15 minutes and restart from step 1 instead of pausing.

5. Confirm `execute-picked-task` can be started as a dedicated SubAgent. If not, record "Dispatch blocked" on the selected source when possible, then return to step 3.

6. Claim or mark the selected task source as dispatched: edit the local task document with a short auto-pick status note, or for GitHub issues follow the GitHub Issue Coordination rules before handoff.

7. Directly execute `skills/execute-picked-task/SKILL.md` in the dedicated SubAgent using the Execute Picked Task Handoff rules.

8. If the handoff is accepted, enter the Serial In-Flight Gate and wait for terminal execution status before returning to step 1.

9. If the handoff fails after the source was claimed, record the dispatch blocker on the selected source when possible. Treat that selected source as the in-flight task until the dispatch blocker is resolved, cleared, or marked terminal.

10. When the in-flight task reaches a terminal state, send the non-blocking Terminal User Notification before returning to step 1.

11. Repeat indefinitely until the user explicitly stops the loop or the environment prevents further polling.

If any loop finds no selectable candidate, do not send a final status response solely because the queue is empty. Wait 15 minutes and restart from step 1. Brief progress updates are fine while waiting; the main agent must keep the turn alive and keep polling.

## Execution Follow-up Boundary

The main agent waits for selected-task terminal status but does not inspect the worker's diffs, run its verification, release/deploy, move task documents to `done`, or close GitHub issues. Those actions belong to `skills/execute-picked-task/SKILL.md`.

If a task execution agent later records completion, release/deploy, blocker, or handoff details, the next pick loop may use those notes only to decide whether the in-flight source is terminal. The main agent must not retroactively finish the task locally.

## Continuous Loop Rules

Do not pause or end the turn only because:

* No READY local task exists.

* No GitHub `WILL-DO` issue exists.

* A selected task is still in flight.

* Every currently visible candidate is blocked by the Autonomy Gate.

* Dispatch fails for one candidate and the failure has been recorded.

In these cases, record the relevant status note when there is a task or issue to annotate, wait 15 minutes, pull the latest branch state, reload this skill, and search again.

Only stop the continuous loop when:

* The user explicitly asks to stop, pause, or change priorities.

* The harness or environment prevents further polling or tool execution.

* Continuing would require a destructive action, credential disclosure, force-push, or other unsafe operation that cannot be bypassed by selecting another task.

## Quick Reference

| Situation                          | Action                                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| READY local task found             | Apply the Autonomy Gate, mark it dispatched, and directly execute `skills/execute-picked-task/SKILL.md` |
| GitHub issue has `WILL-DO` comment | Use only after no local READY candidate is available; apply the Autonomy Gate, claim it on GitHub, and directly execute `skills/execute-picked-task/SKILL.md` |
| In-flight task exists              | Do not scan or dispatch another task; wait 15 minutes and re-check the active task source            |
| Multiple candidates found          | Prefer `docs/bugs/`, then `docs/requirements/`, then GitHub; dispatch one task only when none is in flight |
| Candidate appears ambiguous        | Investigate repository context and make reasonable conservative assumptions                          |
| Candidate still needs human input  | Do not dispatch it; record checks, blocker, and select another candidate; if none remain, wait and loop |
| No candidate found                 | Wait 15 minutes and check again indefinitely; do not stop the loop                                   |
| In-flight task reaches terminal    | Notify the user with terminal state, summary, verification/release/manual-test status, and next action, then continue picking automatically |
| Handoff fails                      | Do not implement locally; record the dispatch blocker and keep the task in-flight until cleared or terminal |
| Execution or release fails         | Task execution agent records the blocker through `skills/execute-picked-task/SKILL.md`; the main agent does not fix it locally |
| Skill file changes                 | Pull the latest branch state, then reload it before the next loop                                    |
