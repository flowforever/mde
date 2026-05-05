# Agent Instructions

## Testing Requirement

All production code changes must include automated test coverage at three levels:

* Unit tests for isolated functions, services, reducers, adapters, and components.

* Integration tests for cross-module behavior, IPC handlers, filesystem workflows, and editor data transforms.

* End-to-end tests for user-visible desktop flows, including opening a workspace, editing Markdown, and saving to disk.

Do not add or modify production code without adding or updating the relevant UT, IT, and E2E coverage in the same change. If a change is documentation-only or configuration-only, state why runtime tests are not applicable and still run the available verification commands.

Tests belong to the app or package that owns the behavior:

* Desktop app unit, integration, support, fixture, screenshot, and E2E tests live under `apps/desktop/tests/`.

* Shared editor package tests should be reachable from the owning package's local `test` script. Cross-package desktop integration coverage may live under `apps/desktop/tests/integration/` when it verifies how the desktop app consumes package contracts.

* The root `tests/` directory is limited to shared fixtures and ambient test types. Do not add new unit, integration, or E2E suites under root `tests/`.

* Root test commands are aggregation entry points. Package/app-specific test commands must remain runnable from the owning workspace package.

## Monorepo Layout and Ownership

`apps/desktop` owns the Electron desktop app, including desktop runtime dependencies, Electron/Vite/Playwright/Vitest config, desktop source, and desktop tests.

`packages/editor-core` owns pure editor document logic. It must not depend on React, BlockNote, Electron, DOM-only packages, or desktop app code.

`packages/editor-host` owns host contracts, bridge validation, fake host utilities, file-tree types, and related package tests. Keep runtime dependencies minimal.

`packages/editor-react` owns React/BlockNote editor UI primitives and their package contracts. React, BlockNote, Mermaid, Shiki, and editor UI dependencies belong here or in the consuming desktop app according to peer/runtime ownership.

The root `package.json` is a pnpm workspace orchestration surface. Keep common entry points such as `dev`, `start`, `build`, `test`, `lint`, and `typecheck` stable, but dispatch app/package-specific work through pnpm workspace filters or package-local scripts instead of moving implementation details back to root.

Do not add app/package-specific dependencies, tests, or config to root when they belong to `apps/desktop` or `packages/editor-*`. Root may keep shared TypeScript/ESLint/Vitest aggregation config and workspace-level release or documentation tooling.

## User-Facing Text

All user-visible production text must come from the app language packs and be accessed through the i18n text helpers. This includes operation menus, dialog copy, prompts, placeholders, button labels, aria labels, titles, status messages, and user-facing fallback errors.

Do not hard-code production UI text in components, renderer services, or preload-facing surfaces. Stable protocol identifiers, persisted keys, external product names, test fixture text, and test expectations may remain literal when they are not user-facing production copy.

When changing the wording or meaning of existing user-facing production text, add a new language-pack key and switch call sites to that new key instead of reusing the old key. This keeps stored custom language packs from showing stale translations for text whose intent has changed.

## Component Naming and IDs

All user-visible UI components, panels, dialogs, toolbars, rows, fields, menus, menu items, tabs, and buttons must have a stable internal component name and a matching `data-component-id` in the rendered component code.

Use the component naming reference requirement in `docs/requirements/internal-component-naming-reference.md` as the source of truth while it is active. When implementing or changing that requirement, keep `user-manual/zh-CN/component-names.md`, the renderer code, and tests aligned.

Maintain desktop component names and ids through `apps/desktop/src/renderer/src/componentIds.ts`. Editor package component ids are exposed through the `@mde/editor-react` contract and reused by the desktop map. The file must provide the code-level object mapping between each concrete standard component name and its `data-component-id`; do not use an array as the primary mapping structure. The top-level keys of `COMPONENT_NAME_ID_MAP` must stay sorted alphabetically. Renderer code should import ids from this mapping instead of scattering raw `data-component-id` strings through JSX.

`data-component-id` values must be stable lowercase kebab-case identifiers with a product-area namespace, such as `explorer.new-markdown-file-button`, `editor.markdown-editing-surface`, or `ai.result-panel`. Do not include user paths, file names, document content, search queries, AI output, random values, translated text, or runtime state in a component id.

Add `data-component-id` to the semantic element or the nearest meaningful owned container for the component. Do not add wrapper DOM solely to carry the id. Repeated component instances, such as list rows or tree rows, may share the same component type id; instance-specific testing should continue to use accessible names, existing test ids, paths, or other safe stable selectors.

`data-component-id` does not replace accessible names, i18n text, ARIA labels, or existing `data-testid` selectors. UI changes that add or alter concrete component ids must include automated coverage that verifies the ids are present and that the component naming reference remains consistent with the renderer source.

## Release Tagging Policy

When pushing a production-ready feature or bug fix to the release branch, publish it as a new release version in the same handoff unless the user explicitly says not to release it:

* Use the project iteration version rule for `a.b.c`:

  * Normal production releases increment `c` by 1.

  * After 20 `c` iterations, increment `b` by 1 and reset `c` to 0. Example: `1.2.19` becomes `1.3.0`.

  * After 10 `b` iterations, increment `a` by 1 and reset `b` and `c` to 0. Example: `1.9.19` becomes `2.0.0`.

  * If the user specifies an exact version, validate that it does not reuse an existing tag or move backwards; call out any policy mismatch before release.

* Update root `package.json`, `apps/desktop/package.json`, any changed package manifests, and `pnpm-lock.yaml` so the workspace version metadata matches the release. `package-lock.json` is not used in this pnpm workspace.

* Prepare complete release notes before pushing the release tag. The notes must explain what changed in the version, grouped by user-facing features, bug fixes, breaking changes, maintenance, and verification when applicable.

* Do not ship a release with an empty or placeholder description. Generated notes are acceptable only if they clearly describe the actual version changes; otherwise edit the GitHub release after the workflow creates it.

* Use `skills/release-new-version/SKILL.md` when preparing or publishing a release.

* Create a new annotated git tag using `vX.Y.Z`; put the complete release notes in the tag message so GitHub Actions can publish them with the release. Use tag cleanup mode that preserves Markdown headings, for example `git tag -a vX.Y.Z --cleanup=verbatim -F .github/release-notes/vX.Y.Z.md`.

* Never reuse, overwrite, or force-push an existing release tag. If the intended tag already exists locally or on GitHub, bump to the next valid version.

* Push the branch and the new tag together, for example `git push origin master vX.Y.Z`, so the GitHub release workflow can build and publish the release.

* After pushing, verify the GitHub Actions release run started and check the release status and release notes with `gh run list` and `gh release view`.

Do not create a release tag for documentation-only, test-only, formatting-only, local-only, experimental, or internal configuration changes unless the user explicitly asks for a release. If it is unclear whether a change should ship as a user-facing release, ask before creating or pushing a tag.

## Requirement and Bug Tracking

`docs/requirements/` and `docs/bugs/` are internal local planning workspaces and are ignored by default. They are not public user-manual content and are not required release artifacts unless the user explicitly asks to publish or force-add them.

When a feature requirement or bug fix is completed and released:

* Update the corresponding document under `docs/requirements/` or `docs/bugs/` with a `Status` section that includes the release version, completion summary, and relevant verification notes.

* Move completed requirement documents into `docs/requirements/done/`.

* Move completed bug documents into `docs/bugs/done/`.

* Leave incomplete or not-yet-released requirement and bug documents in their original active directories.

## User Manual

User-facing feature and bug-fix changes must update `user-manual/` in the same change when behavior, UI flows, settings, AI actions, search, links, workspace handling, update behavior, or troubleshooting guidance changes.

Screenshots used by the manual must be generated through the E2E screenshot workflow and must not contain personal paths, secrets, real account data, or machine-specific state.

When a production release includes user-visible behavior changes, update the user manual before tagging, include the documentation change in release notes, and verify the docs build when the manual or site configuration changed.

Do not publish internal engineering docs under `docs/requirements`, `docs/bugs`, or `docs/superpowers` as part of the public user manual.

## Verification

Before handing off work, run the relevant checks for the changed surface:

* `pnpm run lint`

* `pnpm run typecheck`

* `pnpm run build`

* `pnpm run test:unit`

* `pnpm run test:integration`

* `pnpm run test:e2e`

For package-local changes, run the owning package script as well, for example `pnpm --filter @mde/editor-core test`, `pnpm --filter @mde/editor-host test`, `pnpm --filter @mde/editor-react test`, or `pnpm --filter @mde/desktop test`.

Treat failing lint, typecheck, unit, integration, or E2E checks as blockers unless the user explicitly asks for an unfinished checkpoint.
