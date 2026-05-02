# Document History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build workspace-local Markdown version history, read-only editor preview, deleted-document recovery, and empty-autosave protection.

**Architecture:** Keep all history IO in the main process behind a new `documentHistoryService`. `markdownFileService` remains the owner of user file operations and captures history before risky writes. Renderer state controls preview/recovery modes while all user-visible text comes from `appLanguage.ts`.

**Tech Stack:** Electron main/preload IPC, React, TypeScript, Vitest unit/integration tests, Playwright E2E.

---

## Execution Note

This repository currently has unrelated local changes. Stage only files touched by this plan. Do not stage `.gitignore`, `skills/release-new-version/SKILL.md`, or unrelated active task docs unless the current task explicitly changes them.

The current tool policy does not allow spawning subagents unless the user explicitly asks for them. Execute inline with TDD checkpoints.

## File Map

- Create `src/shared/documentHistory.ts`: shared readonly types for history records, deleted documents, preview payloads, and event/filter ids.
- Create `src/main/services/documentHistoryService.ts`: hash/blob storage, JSONL/document metadata, path safety, list/read/restore/capture, external-delete derivation, and retention helpers.
- Modify `src/main/services/markdownFileService.ts`: accept an optional history service dependency and capture before write/rename/delete/restore-sensitive operations.
- Modify `src/main/ipc/channels.ts`: add document history IPC channel constants.
- Modify `src/main/ipc/registerFileHandlers.ts`: add intent-level history handlers with input validation and active workspace checks.
- Modify `src/preload/editorApi.ts` and `src/shared/workspace.ts`: expose typed history APIs to renderer.
- Modify `src/renderer/src/i18n/appLanguage.ts`: add English and Chinese history, recovery, and autosave-clear text.
- Modify `src/renderer/src/app/appTypes.ts` and `src/renderer/src/app/appReducer.ts`: add preview/recovery state transitions.
- Modify `src/renderer/src/app/App.tsx`: wire history API calls, empty autosave guard, read-only preview mode, and restore actions.
- Modify `src/renderer/src/explorer/ExplorerPane.tsx`: add restore icon and expanded `Deleted Documents` section below Recent Files.
- Modify `src/renderer/src/editor/MarkdownBlockEditor.tsx`: expose version history titlebar actions, read-only preview banner, and save suppression.
- Modify `src/renderer/src/styles/theme.css`: style history panel, preview banner, deleted section, restore confirmation.
- Add/update tests under `tests/unit`, `tests/integration`, and `tests/e2e`.

## Task 1: Shared History Types

**Files:**
- Create: `src/shared/documentHistory.ts`
- Test: `tests/unit/documentHistoryTypes.test.ts`

- [ ] **Step 1: Write the failing unit test**

Test the public constants and simple type-facing helper behavior:

```ts
import { DOCUMENT_HISTORY_EVENT_LABEL_KEYS, isDocumentHistoryEvent } from '../../src/shared/documentHistory'

it('recognizes only supported history events', () => {
  expect(isDocumentHistoryEvent('manual-save')).toBe(true)
  expect(isDocumentHistoryEvent('bad')).toBe(false)
  expect(DOCUMENT_HISTORY_EVENT_LABEL_KEYS['delete']).toBe('history.event.delete')
})
```

- [ ] **Step 2: Run RED**

Run: `npm run test:unit -- tests/unit/documentHistoryTypes.test.ts`

Expected: fail because `src/shared/documentHistory.ts` does not exist.

- [ ] **Step 3: Implement minimal shared types**

Export readonly event ids, filter ids, `DocumentHistoryEntry`, `DocumentHistoryVersion`, `DeletedDocumentHistoryEntry`, `DocumentHistoryPreview`, and `isDocumentHistoryEvent`.

- [ ] **Step 4: Run GREEN**

Run: `npm run test:unit -- tests/unit/documentHistoryTypes.test.ts`

Expected: pass.

## Task 2: Main-Process History Storage

**Files:**
- Create: `src/main/services/documentHistoryService.ts`
- Test: `tests/unit/documentHistoryService.test.ts`

- [ ] **Step 1: Write failing tests**

Cover hash creation, blob de-duplication, JSONL malformed-line tolerance, document record creation, duplicate snapshot suppression, autosave throttle, `.mde/history` symlink rejection, and deleted/external-deleted listing.

- [ ] **Step 2: Run RED**

Run: `npm run test:unit -- tests/unit/documentHistoryService.test.ts`

Expected: fail because service API is missing.

- [ ] **Step 3: Implement minimal storage service**

Create `createDocumentHistoryService()` with:

- `captureSnapshot({ workspacePath, filePath, event, nextPath?, sourceVersionId? })`
- `listDocumentHistory(workspacePath, filePath)`
- `listDeletedDocumentHistory(workspacePath)`
- `readVersion(workspacePath, versionId)`
- `restoreVersion(workspacePath, versionId)`
- `markExternalDeletes(workspacePath)`

Use `crypto.createHash('sha256')`, `fs/promises`, append-only JSONL, and `resolveWorkspacePath`.

- [ ] **Step 4: Run GREEN**

Run: `npm run test:unit -- tests/unit/documentHistoryService.test.ts`

Expected: pass.

## Task 3: File Operation Capture

**Files:**
- Modify: `src/main/services/markdownFileService.ts`
- Test: `tests/integration/fileHandlers.integration.test.ts`

- [ ] **Step 1: Write failing integration tests**

Add tests for:

- `writeMarkdownFile` records the old content before overwrite.
- snapshot failure blocks overwrite.
- `renameEntry` keeps one document identity and records rename.
- `deleteEntry` records delete content.
- workspace search ignores `.mde/history`.

- [ ] **Step 2: Run RED**

Run: `npm run test:integration -- tests/integration/fileHandlers.integration.test.ts`

Expected: fail because writes do not capture history.

- [ ] **Step 3: Inject and call history service**

Change `createMarkdownFileService(options?)` to accept `documentHistoryService`. Capture before writes, renames, and deletes. Keep default behavior by creating a default service when none is provided.

- [ ] **Step 4: Run GREEN**

Run: `npm run test:integration -- tests/integration/fileHandlers.integration.test.ts`

Expected: pass.

## Task 4: History IPC and Preload API

**Files:**
- Modify: `src/main/ipc/channels.ts`
- Modify: `src/main/ipc/registerFileHandlers.ts`
- Modify: `src/preload/editorApi.ts`
- Modify: `src/shared/workspace.ts`
- Test: `tests/integration/fileHandlers.integration.test.ts`

- [ ] **Step 1: Write failing integration tests**

Cover:

- `listDocumentHistory` rejects stale workspace roots.
- `readDocumentHistoryVersion` returns blob content by version id, not path.
- `restoreDocumentHistoryVersion` restores and records a restore event.
- `listDeletedDocumentHistory` includes delete and external-delete records.

- [ ] **Step 2: Run RED**

Run: `npm run test:integration -- tests/integration/fileHandlers.integration.test.ts`

Expected: fail because IPC channels are missing.

- [ ] **Step 3: Add channels and typed API**

Add intent-level methods only. Validate `workspaceRoot`, `filePath`, and `versionId` as strings. Do not expose history filesystem paths to renderer.

- [ ] **Step 4: Run GREEN**

Run: `npm run test:integration -- tests/integration/fileHandlers.integration.test.ts`

Expected: pass.

## Task 5: Renderer State and Empty Autosave Guard

**Files:**
- Modify: `src/renderer/src/app/appTypes.ts`
- Modify: `src/renderer/src/app/appReducer.ts`
- Modify: `src/renderer/src/app/App.tsx`
- Test: `tests/unit/appReducer.test.ts`
- Test: `tests/unit/MarkdownBlockEditor.test.tsx`

- [ ] **Step 1: Write failing tests**

Cover reducer transitions for entering/exiting version preview and deleted recovery. Cover autosave-empty guard so autosave does not call `writeMarkdownFile` before confirmation when current content is non-empty.

- [ ] **Step 2: Run RED**

Run: `npm run test:unit -- tests/unit/appReducer.test.ts tests/unit/MarkdownBlockEditor.test.tsx`

Expected: fail because state/actions/UI are missing.

- [ ] **Step 3: Implement state and guard**

Add history preview state with:

- mode: `current-file` or `deleted-document`
- selected version id
- preview contents
- selected deleted document
- confirmation state for empty autosave

Use existing `isReadOnly` support to suppress editor changes and saves during preview.

- [ ] **Step 4: Run GREEN**

Run: `npm run test:unit -- tests/unit/appReducer.test.ts tests/unit/MarkdownBlockEditor.test.tsx`

Expected: pass.

## Task 6: Explorer Deleted Documents Section

**Files:**
- Modify: `src/renderer/src/explorer/ExplorerPane.tsx`
- Modify: `src/renderer/src/styles/theme.css`
- Test: `tests/unit/ExplorerTree.test.tsx` or new `tests/unit/ExplorerPane.test.tsx`

- [ ] **Step 1: Write failing component tests**

Cover:

- restore icon exists with i18n aria label.
- clicking restore expands `Deleted Documents` below `Recent Files`.
- selecting a deleted document invokes the preview callback.
- no deleted documents shows localized empty text.

- [ ] **Step 2: Run RED**

Run: `npm run test:unit -- tests/unit/ExplorerPane.test.tsx`

Expected: fail because component behavior is missing.

- [ ] **Step 3: Implement Explorer UI**

Use lucide `ArchiveRestore` or `RotateCcw` icon. Keep it compact in the toolbar. Add props for deleted documents and callbacks without coupling Explorer to history IO.

- [ ] **Step 4: Run GREEN**

Run: `npm run test:unit -- tests/unit/ExplorerPane.test.tsx`

Expected: pass.

## Task 7: Editor Preview and Version Panel

**Files:**
- Modify: `src/renderer/src/editor/MarkdownBlockEditor.tsx`
- Modify: `src/renderer/src/app/App.tsx`
- Modify: `src/renderer/src/styles/theme.css`
- Test: `tests/unit/MarkdownBlockEditor.test.tsx`

- [ ] **Step 1: Write failing tests**

Cover:

- version history button appears when a document is loaded.
- read-only preview banner appears with event/time text.
- restore and exit preview buttons call provided callbacks.
- BlockNote remains non-editable in preview.

- [ ] **Step 2: Run RED**

Run: `npm run test:unit -- tests/unit/MarkdownBlockEditor.test.tsx`

Expected: fail because titlebar history controls and preview banner are missing.

- [ ] **Step 3: Implement UI**

Add optional props for `historyPreview`, `onOpenVersionHistory`, `onExitHistoryPreview`, and `onRestoreHistoryPreview`. Keep titlebar text localized.

- [ ] **Step 4: Run GREEN**

Run: `npm run test:unit -- tests/unit/MarkdownBlockEditor.test.tsx`

Expected: pass.

## Task 8: i18n Coverage

**Files:**
- Modify: `src/renderer/src/i18n/appLanguage.ts`
- Test: `tests/unit/appLanguage.test.ts`

- [ ] **Step 1: Write failing test**

Assert both English and Chinese packs contain all `history.*` and autosave-clear keys.

- [ ] **Step 2: Run RED**

Run: `npm run test:unit -- tests/unit/appLanguage.test.ts`

Expected: fail because keys are missing.

- [ ] **Step 3: Add localized text**

Add concise English and Chinese text for history controls, deleted section, empty states, restore confirmations, errors, and empty autosave confirmation.

- [ ] **Step 4: Run GREEN**

Run: `npm run test:unit -- tests/unit/appLanguage.test.ts`

Expected: pass.

## Task 9: End-to-End Workflows

**Files:**
- Modify: `tests/e2e/markdown-editor.e2e.test.ts`
- Modify support helpers if needed.

- [ ] **Step 1: Write failing E2E tests**

Cover:

- open a document, edit, autosave, open history, preview old version in editor, restore.
- delete a file, click restore icon, select it under `Deleted Documents`, preview, restore.
- externally delete a tracked file, refresh, restore from `Deleted Documents`.
- clear a non-empty document, wait for autosave guard, cancel, verify disk and editor remain non-empty.

- [ ] **Step 2: Run RED**

Run: `npm run test:e2e -- tests/e2e/markdown-editor.e2e.test.ts`

Expected: fail because UI workflow is missing or incomplete.

- [ ] **Step 3: Wire final renderer flows**

Connect App callbacks to preload APIs, refresh tree/deleted history after restore, and keep read-only preview out of autosave.

- [ ] **Step 4: Run GREEN**

Run: `npm run test:e2e -- tests/e2e/markdown-editor.e2e.test.ts`

Expected: pass.

## Task 10: Full Verification, Release, and Archive

**Files:**
- Modify: `docs/requirements/history-support.md`
- Move after release: `docs/requirements/done/history-support.md`
- Use: `skills/release-new-version/SKILL.md`

- [ ] **Step 1: Full local verification**

Run:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
```

Expected: all pass.

- [ ] **Step 2: Commit implementation**

Stage only relevant files and commit with a conventional message.

- [ ] **Step 3: Release**

Reload and follow `skills/release-new-version/SKILL.md`. Bump from the latest tag to the next valid version, update package files, create release notes, create annotated tag, push branch and tag together, and verify GitHub release status.

- [ ] **Step 4: Archive requirement**

After release succeeds, add a `Status` section to `docs/requirements/history-support.md`, move it to `docs/requirements/done/history-support.md`, commit and push the archive update.
