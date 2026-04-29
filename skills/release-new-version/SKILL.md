---
name: release-new-version
description: Use when preparing, tagging, pushing, or verifying a new MDE release version, including version calculation, release notes, annotated tags, GitHub Actions release checks, and avoiding duplicate local E2E runs when the user explicitly requests it.
---

# Release New Version

Use this workflow whenever publishing a production-ready MDE feature or bug fix.

## Version Rule

MDE versions use `a.b.c` with iteration rollover:

- Normal production releases increment `c` by 1.
- After 20 `c` iterations, increment `b` by 1 and reset `c` to 0.
- After 10 `b` iterations, increment `a` by 1 and reset `b` and `c` to 0.
- Examples:
  - `1.2.18` -> `1.2.19`
  - `1.2.19` -> `1.3.0`
  - `1.9.19` -> `2.0.0`

If the user asks for an exact version, validate that it does not reuse an existing tag or move backwards. Call out a mismatch before publishing.

## Workflow

1. Inspect `git status`, current branch, recent commits, `package.json`, and existing local/remote tags.
2. Compute the next version from the latest release tag unless the user supplied an exact version.
3. Update `package.json` and `package-lock.json` to the same version.
4. Create `.github/release-notes/vX.Y.Z.md` with complete notes:
   - Features
   - Bug Fixes
   - Breaking Changes
   - Maintenance
   - Verification
   - Artifacts
5. Run verification for the changed surface:
   - Always run `npm run lint`, `npm run typecheck`, `npm run test:unit`, and `npm run test:integration`.
   - Run `npm run test:e2e` for feature or bug-fix runtime changes unless it already passed for the same code state and the user explicitly says not to repeat local E2E.
6. Commit the release-ready changes with the repository commit message style.
7. Create an annotated tag from the release notes, preserving Markdown headings:

```bash
git tag -a vX.Y.Z --cleanup=verbatim -F .github/release-notes/vX.Y.Z.md
```

8. Push the branch and tag together:

```bash
git push origin master vX.Y.Z
```

If the user explicitly said not to rerun local E2E and verification already passed for the same code state, use `ECC_SKIP_PREPUSH=1` for that push so the global pre-push hook does not repeat the full local suite. Do not skip the GitHub Actions release workflow.

9. Verify release automation:

```bash
gh run list --workflow Release --limit 5
gh release view vX.Y.Z
```

If the release exists but notes are incomplete, sync or edit the notes from `.github/release-notes/vX.Y.Z.md`.

## Safety Rules

- Never reuse, overwrite, or force-push an existing remote tag.
- Do not delete or recreate a tag after it has been pushed.
- Do not release documentation-only, test-only, formatting-only, or local-only changes unless the user explicitly requests a release.
- Keep release notes concrete; do not ship placeholder or generated notes that fail to describe the actual changes.
