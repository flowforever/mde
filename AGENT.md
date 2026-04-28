# Agent Instructions

## Testing Requirement

All production code changes must include automated test coverage at three levels:

- Unit tests for isolated functions, services, reducers, adapters, and components.
- Integration tests for cross-module behavior, IPC handlers, filesystem workflows, and editor data transforms.
- End-to-end tests for user-visible desktop flows, including opening a workspace, editing Markdown, and saving to disk.

Do not add or modify production code without adding or updating the relevant UT, IT, and E2E coverage in the same change. If a change is documentation-only or configuration-only, state why runtime tests are not applicable and still run the available verification commands.

## Verification

Before handing off work, run the relevant checks for the changed surface:

- `npm run lint`
- Unit test command once configured
- Integration test command once configured
- E2E test command once configured

Treat failing lint, typecheck, unit, integration, or E2E checks as blockers unless the user explicitly asks for an unfinished checkpoint.
