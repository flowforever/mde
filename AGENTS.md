# Agent Instructions

## Testing Requirement

All production code changes must include automated test coverage at three levels:

- Unit tests for isolated functions, services, reducers, adapters, and components.
- Integration tests for cross-module behavior, IPC handlers, filesystem workflows, and editor data transforms.
- End-to-end tests for user-visible desktop flows, including opening a workspace, editing Markdown, and saving to disk.

Do not add or modify production code without adding or updating the relevant UT, IT, and E2E coverage in the same change. If a change is documentation-only or configuration-only, state why runtime tests are not applicable and still run the available verification commands.

## Release Tagging Policy

When pushing a production-ready feature or bug fix to the release branch, publish it as a new release version in the same handoff unless the user explicitly says not to release it:

- New feature: bump the minor version unless the user specifies an exact version.
- Bug fix: bump the patch version unless the user specifies an exact version.
- Breaking change: bump the major version and call out the breaking behavior.
- Update both `package.json` and `package-lock.json` so the app version matches the release.
- Prepare complete release notes before pushing the release tag. The notes must explain what changed in the version, grouped by user-facing features, bug fixes, breaking changes, maintenance, and verification when applicable.
- Do not ship a release with an empty or placeholder description. Generated notes are acceptable only if they clearly describe the actual version changes; otherwise edit the GitHub release after the workflow creates it.
- Create a new annotated git tag using `vX.Y.Z`; put the complete release notes in the tag message so GitHub Actions can publish them with the release.
- Never reuse, overwrite, or force-push an existing release tag. If the intended tag already exists locally or on GitHub, bump to the next valid version.
- Push the branch and the new tag together, for example `git push origin master vX.Y.Z`, so the GitHub release workflow can build and publish the release.
- After pushing, verify the GitHub Actions release run started and check the release status and release notes with `gh run list` and `gh release view`.

Do not create a release tag for documentation-only, test-only, formatting-only, local-only, experimental, or internal configuration changes unless the user explicitly asks for a release. If it is unclear whether a change should ship as a user-facing release, ask before creating or pushing a tag.

## Verification

Before handing off work, run the relevant checks for the changed surface:

- `npm run lint`
- Unit test command once configured
- Integration test command once configured
- E2E test command once configured

Treat failing lint, typecheck, unit, integration, or E2E checks as blockers unless the user explicitly asks for an unfinished checkpoint.
