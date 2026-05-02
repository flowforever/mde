---
name: release-new-version
description: Use when preparing, tagging, pushing, or verifying a new MDE release version, including version calculation, release notes, annotated tags, GitHub Actions release checks, and user manual updates.
---

# Release New Version

## Overview

Use this workflow when publishing a production-ready MDE feature or bug fix. The release must include version updates, complete release notes, local verification, an annotated tag, a branch-and-tag push, post-push GitHub release checks, and user manual handling.

## Preflight

* Inspect `git status`, the current branch, recent commits, `package.json`, `package-lock.json`, and existing local and remote tags.

* Confirm the change is release-worthy. Do not release documentation-only, test-only, formatting-only, local-only, experimental, or internal configuration changes unless the user explicitly asks for a release.

* Check whether this release changes user-visible behavior, UI flows, settings, AI actions, search, links, workspace handling, update behavior, or troubleshooting guidance. If yes, update `user-manual/` before tagging. If no, state why the manual is unaffected in the handoff or release notes.

* If the user supplied an exact version, validate that it does not reuse an existing tag or move backwards. Call out any mismatch before publishing.

* Check whether optional macOS signing and notarization secrets exist in the GitHub repository: `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_API_KEY_P8_BASE64`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER`.

* Treat signing secrets as optional for the no-paid-account release path. Without them, macOS releases are unsigned DMG/ZIP artifacts and Windows releases use the NSIS updater artifact from GitHub Releases.

## Version Rule

MDE versions use `a.b.c` with iteration rollover:

* Normal production releases increment `c` by 1.

* After 20 `c` iterations, increment `b` by 1 and reset `c` to 0.

* After 10 `b` iterations, increment `a` by 1 and reset `b` and `c` to 0.

Examples:

| Current  | Next     |
| -------- | -------- |
| `1.2.18` | `1.2.19` |
| `1.2.19` | `1.3.0`  |
| `1.9.19` | `2.0.0`  |

## Release Notes

Create `.github/release-notes/vX.Y.Z.md` before tagging. Include concrete notes for:

* Features

* Bug Fixes

* Breaking Changes

* Maintenance

* Documentation or User Manual changes when applicable

* Verification

* Artifacts for macOS and Windows

Do not ship empty, placeholder, or vague generated notes. If GitHub creates a release with incomplete notes, sync or edit the release from `.github/release-notes/vX.Y.Z.md`.

## Workflow

1. Compute the next version from the latest valid release tag unless the user supplied an exact version.

2. Update `package.json` and `package-lock.json` to the same version.

3. Update `user-manual/` for user-visible behavior changes, or explicitly record that the manual is unaffected.

4. Prepare `.github/release-notes/vX.Y.Z.md` with complete release notes.

5. Run verification for the changed surface:

   * Always run `npm run lint`, `npm run typecheck`, `npm run test:unit`, and `npm run test:integration`.

   * Run `npm run test:e2e` for feature or bug-fix runtime changes unless E2E already passed for the same code state and the user explicitly says not to repeat local E2E.

   * Run `npm run docs:build` when `user-manual/`, docs site config, or docs scripts changed.

   * Run `npm run docs:screenshots` when user manual screenshots need to be created or refreshed.

6. Commit the release-ready changes with the repository commit message style.

7. Create an annotated tag from the release notes, preserving Markdown headings:

```bash
git tag -a vX.Y.Z --cleanup=verbatim -F .github/release-notes/vX.Y.Z.md
```

8. Push the release branch and tag together:

```bash
git push origin master vX.Y.Z
```

If the user explicitly said not to rerun local E2E and verification already passed for the same code state, use `ECC_SKIP_PREPUSH=1` for that push so the global pre-push hook does not repeat the full local suite. Do not skip the GitHub Actions release workflow.

9. Verify release automation:

```bash
gh run list --workflow Release --limit 5
gh release view vX.Y.Z
```

10. If `user-manual/` or docs site config changed, verify the Pages workflow:

```bash
gh run list --workflow "Deploy User Manual" --limit 5
```

## Safety Rules

* Never reuse, overwrite, delete, recreate, or force-push an existing remote tag.

* Do not delete or recreate a tag after it has been pushed.

* Do not move requirement or bug documents into `done` until the release succeeds.

* Do not create a release tag when a user-visible behavior change lacks a user manual update or an explicit note explaining why the manual is unaffected.

* Keep release notes concrete and aligned with the actual version changes.

* If GitHub Actions fails or the release is missing, keep the task open and fix or report the blocker.

## Quick Reference

| Situation                                                      | Action                                              |
| -------------------------------------------------------------- | --------------------------------------------------- |
| Production feature or bug fix is ready                         | Version, verify, tag, push, and check release       |
| User-visible behavior changed                                  | Update `user-manual/` before tagging                |
| User gives exact version                                       | Validate tag uniqueness and monotonic version first |
| Same code state already passed E2E and user says not to repeat | Skip local E2E only; still run release workflow     |
| Remote tag already exists                                      | Stop and choose the next valid version              |
| Release notes are incomplete                                   | Update them before considering the release complete |
