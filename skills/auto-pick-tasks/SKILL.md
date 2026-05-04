---
name: auto-pick-tasks
description: Use when Codex should run an autonomous loop over READY local task documents or WILL-DO GitHub issues.
---
# Auto Pick Tasks

## Overview

Run a continuous autonomous task loop for MDE: pick one local READY task or GitHub issue marked `WILL-DO`, confirm it can be completed without human participation, develop it, verify it, release it when appropriate, archive the task, then reload this skill and continue. The loop does not stop just because no candidate is currently available.

## Selection Rules

* Candidate priority is local-first, GitHub-last.

* Search candidates in this order: `docs/bugs/`, then `docs/requirements/`, then GitHub issues in `https://github.com/flowforever/mde/issues`.

* Do not select a GitHub issue while any non-blocked local READY candidate remains available.

* Only select a local document whose title explicitly contains `READY`.

* Only select an open GitHub issue when an issue comment contains the exact keyword `WILL-DO`.

* Treat `flowforever` as the user's GitHub account for `WILL-DO` selection.

* When GitHub authentication can identify the current user, accept `WILL-DO` comments by either `flowforever` or the current authenticated user.

* If GitHub access or user identity is unavailable, skip GitHub issue selection for that loop and keep processing local task documents.

* `READY` means the document is a candidate, not permission to start development.

* `WILL-DO` means the issue is a candidate, not permission to start development.

* Process exactly one autonomous task per loop.

* If no local READY task or GitHub `WILL-DO` issue exists, wait 5 minutes, then search again. Repeat this wait-and-search cycle indefinitely until a candidate appears or the user explicitly stops the loop.

* Skip ambiguous documents instead of inferring readiness from body text.

* Skip documents that already contain an unresolved auto-pick "Needs human input" or "Not autonomous" status note unless the user has edited the document or explicitly cleared the blocker.

* Skip GitHub issues that already contain an unresolved auto-pick "Needs human input" or "Not autonomous" comment unless the user has added a newer `WILL-DO` comment or explicitly cleared the blocker.

## Autonomy Gate

Before marking a task as started, decide whether it can be completed end-to-end without human participation. Bias toward resolving uncertainty autonomously; do not classify a task as human-blocked just because it has minor gaps, ordinary ambiguity, or implementation choices.

First try to remove uncertainty by:

* Reading the task document, related requirement or bug docs, recent done docs, tests, user manual, and nearby code.

* For GitHub issues, reading the issue title, body, labels, comments, linked PRs, and any referenced local docs or code paths.

* Inferring expected behavior from established product patterns, existing UI copy, i18n keys, test conventions, and release policy.

* Choosing the smallest conservative implementation that satisfies the stated task when multiple implementation options are valid.

* Treating missing internal implementation details as engineering work, not human input, when they can be discovered from the repository.

* Documenting reasonable assumptions in the task status note or issue comment instead of stopping for confirmation.

Start only when all of these are true:

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

If the task is not fully autonomous after this investigation, do not mark development as started. Add a brief status note or issue comment explaining what you checked, the concrete blocker, and the exact human input needed; keep the task outside `done` and leave GitHub issues open, then select another candidate if one exists.

## Loop

1. Reload `skills/auto-pick-tasks/SKILL.md` so the latest workflow rules apply.

2. Select the highest-priority candidate: READY local bug, then READY local requirement, then GitHub `WILL-DO` issue.

3. Apply the Autonomy Gate. If investigation confirms the task is not fully autonomous, record what was checked plus the needed human input, then return to step 2. If every visible candidate is blocked, wait 5 minutes and restart from step 1 instead of pausing.

4. Update the selected task source with a status note showing that development has started: edit the local task document, or add a GitHub issue comment.

5. Analyze the task, dependencies, risks, and expected verification.

6. Use multiple subagents for independent analysis, implementation, and testing when the harness supports them. If subagents are unavailable, perform the same phases locally.

7. Implement the task according to repository instructions, including TDD, i18n, security, and verification requirements.

8. Run the relevant lint, typecheck, unit, integration, and E2E checks for the changed surface.

9. After the task is complete and verified, use `$release-new-version` in a fresh subagent when possible, or run the release workflow locally when subagents are unavailable.

10. After the release succeeds, update the task source with release version, completion summary, and verification notes.

11. Archive the completed task: move local documents into the matching `done` directory; for GitHub issues, add a completion comment and close the issue when the issue is fully resolved.

12. Return to step 1.

If any loop finds no selectable candidate, do not send a final status response solely because the queue is empty. Wait 5 minutes and restart from step 1. Brief progress updates are fine while waiting; the agent should keep the turn alive and keep polling.

## Release and Archive Rules

* Do not move a task document to `done` before the production release succeeds.

* Do not close a GitHub issue before the production release succeeds.

* Do not create a release for documentation-only, test-only, formatting-only, local-only, experimental, or internal configuration changes unless the user explicitly asks for one.

* When a release is required, follow `skills/release-new-version/SKILL.md` and the repository release tagging policy.

* Preserve any existing user edits in task documents; add status and completion details without deleting unrelated content.

* Preserve GitHub issue history; add new comments instead of editing or deleting existing issue text.

## Continuous Loop Rules

Do not pause or end the turn only because:

* No READY local task exists.

* No GitHub `WILL-DO` issue exists.

* Every currently visible candidate is blocked by the Autonomy Gate.

* Verification fails for one candidate and the failure has been recorded.

In these cases, record the relevant status note when there is a task or issue to annotate, wait 5 minutes, reload this skill, and search again.

Only stop the continuous loop when:

* The user explicitly asks to stop, pause, or change priorities.

* The harness or environment prevents further polling or tool execution.

* Continuing would require a destructive action, credential disclosure, force-push, or other unsafe operation that cannot be bypassed by selecting another task.

## Quick Reference

| Situation                          | Action                                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| READY local task found             | Apply the Autonomy Gate before marking it in development                                             |
| GitHub issue has `WILL-DO` comment | Use only after no local READY candidate is available; then apply the Autonomy Gate                   |
| Multiple candidates found          | Prefer `docs/bugs/`, then `docs/requirements/`, then GitHub; complete one task before taking another |
| Candidate appears ambiguous        | Investigate repository context and make reasonable conservative assumptions                          |
| Candidate still needs human input  | Do not start it; record checks, blocker, and select another candidate; if none remain, wait and loop |
| No candidate found                 | Wait 5 minutes and check again indefinitely                                                          |
| Release fails                      | Keep the task outside `done`; fix if possible, otherwise record the blocker and continue the loop    |
| Skill file changes                 | Reload it before the next loop                                                                       |
