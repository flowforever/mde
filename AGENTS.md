# Agent Instructions

## Testing Requirement

All production code changes must include automated test coverage at three levels:

* Unit tests for isolated functions, services, reducers, adapters, and components.

* Integration tests for cross-module behavior, IPC handlers, filesystem workflows, and editor data transforms.

* End-to-end tests for user-visible desktop flows, including opening a workspace, editing Markdown, and saving to disk.

Do not add or modify production code without adding or updating the relevant UT, IT, and E2E coverage in the same change. If a change is documentation-only or configuration-only, state why runtime tests are not applicable and still run the available verification commands.

## User-Facing Text

All user-visible production text must come from the app language packs and be accessed through the i18n text helpers. This includes operation menus, dialog copy, prompts, placeholders, button labels, aria labels, titles, status messages, and user-facing fallback errors.

Do not hard-code production UI text in components, renderer services, or preload-facing surfaces. Stable protocol identifiers, persisted keys, external product names, test fixture text, and test expectations may remain literal when they are not user-facing production copy.

## Release Tagging Policy

When pushing a production-ready feature or bug fix to the release branch, publish it as a new release version in the same handoff unless the user explicitly says not to release it:

* Use the project iteration version rule for `a.b.c`:

  * Normal production releases increment `c` by 1.

  * After 20 `c` iterations, increment `b` by 1 and reset `c` to 0. Example: `1.2.19` becomes `1.3.0`.

  * After 10 `b` iterations, increment `a` by 1 and reset `b` and `c` to 0. Example: `1.9.19` becomes `2.0.0`.

  * If the user specifies an exact version, validate that it does not reuse an existing tag or move backwards; call out any policy mismatch before release.

* Update both `package.json` and `package-lock.json` so the app version matches the release.

* Prepare complete release notes before pushing the release tag. The notes must explain what changed in the version, grouped by user-facing features, bug fixes, breaking changes, maintenance, and verification when applicable.

* Do not ship a release with an empty or placeholder description. Generated notes are acceptable only if they clearly describe the actual version changes; otherwise edit the GitHub release after the workflow creates it.

* Use `skills/release-new-version/SKILL.md` when preparing or publishing a release.

* Create a new annotated git tag using `vX.Y.Z`; put the complete release notes in the tag message so GitHub Actions can publish them with the release. Use tag cleanup mode that preserves Markdown headings, for example `git tag -a vX.Y.Z --cleanup=verbatim -F .github/release-notes/vX.Y.Z.md`.

* Never reuse, overwrite, or force-push an existing release tag. If the intended tag already exists locally or on GitHub, bump to the next valid version.

* Push the branch and the new tag together, for example `git push origin master vX.Y.Z`, so the GitHub release workflow can build and publish the release.

* After pushing, verify the GitHub Actions release run started and check the release status and release notes with `gh run list` and `gh release view`.

Do not create a release tag for documentation-only, test-only, formatting-only, local-only, experimental, or internal configuration changes unless the user explicitly asks for a release. If it is unclear whether a change should ship as a user-facing release, ask before creating or pushing a tag.

## Requirement and Bug Tracking

When a feature requirement or bug fix is completed and released:

* Update the corresponding document under `docs/requirements/` or `docs/bugs/` with a `Status` section that includes the release version, completion summary, and relevant verification notes.

* Move completed requirement documents into `docs/requirements/done/`.

* Move completed bug documents into `docs/bugs/done/`.

* Leave incomplete or not-yet-released requirement and bug documents in their original active directories.

## Verification

Before handing off work, run the relevant checks for the changed surface:

* `npm run lint`

* Unit test command once configured

* Integration test command once configured

* E2E test command once configured

Treat failing lint, typecheck, unit, integration, or E2E checks as blockers unless the user explicitly asks for an unfinished checkpoint.
