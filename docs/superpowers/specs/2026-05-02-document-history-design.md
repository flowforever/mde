# Document History Design

Date: 2026-05-02
Status: Approved for implementation planning

## Goal

Add local, workspace-scoped Markdown document history so users can recover content after autosave, manual save, AI write, rename, delete, restore, or accidental empty autosave writes.

This history is separate from Recent Files. Recent Files remains a navigation aid; version history stores recoverable document contents.

## User Decisions

- Store history inside the workspace under `.mde/history`.
- Do not expose `.mde/history` in the file tree or workspace search.
- Show selected historical content directly in the current editor area as read-only preview.
- Use the right panel for version selection, not for the main preview.
- Clicking the file tree restore icon expands a `Deleted Documents` section below `Recent Files`.
- Users choose deleted documents from the left navigation first, then preview and restore them.
- Finder-deleted files are recoverable only if MDE already has a snapshot for the file. They appear after workspace refresh or startup as external deletions.

## Scope

The first implementation must support:

- Capture old content before overwrite for manual save, autosave, AI writes, rename, delete, and restore.
- Read, list, preview, and restore versions through intent-level IPC.
- Recover deleted Markdown documents through a workspace-level left navigation section.
- Detect external deletion for tracked documents whose current path no longer exists.
- Block unconfirmed autosave attempts that would overwrite non-empty content with empty content.
- Enforce path safety and reject symlinked `.mde/history` paths.
- Apply retention defaults without exposing cleanup decisions to users.

Non-goals:

- Git integration.
- Cross-workspace history.
- Rich visual diff.
- Binary asset history.
- Full user-configurable retention settings.

## Storage Model

History lives in:

```text
<workspace>/.mde/history/
  index.jsonl
  documents/
    <document-id>.json
  blobs/
    <sha256>.md
```

`index.jsonl` stores append-only version metadata. Blob files store complete Markdown snapshots by SHA-256 hash. Document records map stable document IDs to current and previous workspace-relative paths.

Snapshot records use user-meaningful event types:

- `manual-save`
- `autosave`
- `ai-write`
- `rename`
- `delete`
- `restore`
- `external-delete`

Most records store the content before the event. Restore records also point back to the source version so users can undo mistaken restores.

## Main Process Design

Create a focused `documentHistoryService` in `src/main/services/`.

Responsibilities:

- Validate and resolve `.mde/history` paths under the active workspace.
- Reject symlink path components for `.mde/history`.
- Create and read document records.
- Append and parse JSONL index entries while ignoring malformed lines.
- Write deduplicated blobs.
- Capture snapshots before risky file operations.
- List current document history.
- List deleted or externally missing tracked documents.
- Read a version blob.
- Restore a version to the original path or a generated adjacent path when a conflict exists.
- Prune old records and unreferenced blobs according to retention limits.

`markdownFileService` remains the owner of user file operations. It calls the history service before overwriting, renaming, deleting, and restoring Markdown files.

## Renderer and IPC Design

Expose intent-level methods only. The renderer must not pass history filesystem paths.

Recommended API:

- `listDocumentHistory(filePath, workspaceRoot)`
- `readDocumentHistoryVersion(versionId, workspaceRoot)`
- `restoreDocumentHistoryVersion(versionId, workspaceRoot)`
- `listDeletedDocumentHistory(workspaceRoot)`
- `restoreDeletedDocumentHistoryVersion(versionId, workspaceRoot)`

All IPC handlers validate string inputs and verify the provided workspace root still matches the active workspace root.

## UX Design

### Current File History

The editor title bar gets a compact `Version History` icon button. It is enabled only when a Markdown file is loaded. Selecting a version opens the right panel and changes the current editor into read-only preview mode.

The read-only preview:

- Uses the normal editor area.
- Disables typing, paste, AI edits, and autosave.
- Shows a small banner with version event, time, and read-only state.
- Offers `Exit preview` and `Restore this version`.

The right panel shows version records for the selected document and optional filters:

- All
- Saves
- AI
- Delete

Labels are localized and may be simplified to `全部`, `保存`, `AI 修改`, `删除前` in Chinese.

### Deleted Document Recovery

The explorer toolbar gets a restore icon. Clicking it expands a `Deleted Documents` section below `Recent Files`.

The section:

- Is workspace-level, not tied to the current selected file.
- Lists documents with delete events or external-deletion status.
- Shows original path and deletion or missing-detected time.
- Selects a deleted document before any preview appears.

When a user selects a deleted document:

- The editor shows the selected deleted file as read-only preview.
- The right panel shows available versions for that deleted file.
- The main action restores the selected version.

If the original path is free, MDE restores there. If it is occupied, MDE restores to an adjacent generated path such as `intro.restored.md`, avoiding a destructive overwrite prompt in v1.

### External Delete Detection

On workspace refresh or startup, MDE compares tracked document records with the current filesystem. If a tracked current path is missing, it marks that document as externally deleted and lists it in `Deleted Documents`.

Files deleted in Finder before MDE ever captured a snapshot are not recoverable and do not appear.

## Empty Autosave Protection

Autosave must not silently overwrite non-empty content with empty Markdown.

If `nextContents.trim().length === 0` and the current disk or loaded contents are non-empty:

- Do not call the write API immediately.
- Show a localized confirmation.
- If confirmed, save normally and capture history first.
- If canceled, restore the editor to the current disk or last loaded non-empty content.
- Avoid repeated prompts until the user actively creates a new clear operation.

Manual save remains explicit in v1, but still captures a history snapshot before overwrite.

## Security

- All history IO stays in the main process.
- Renderer cannot pass arbitrary `.mde/history` paths.
- All workspace-relative paths are validated.
- History paths must stay under the active workspace root.
- Symlinked `.mde/history` or symlink path components are rejected.
- Malformed index lines are ignored, not executed or surfaced as raw internal errors.
- User-facing errors are concise and localized.

## Testing Strategy

Unit tests:

- Blob hash and storage path creation.
- JSONL append/read with malformed line tolerance.
- Document identity creation and rename path tracking.
- Duplicate snapshot suppression.
- Autosave throttle.
- Retention and workspace cap pruning.
- Empty autosave guard predicate.
- Deleted/external-deleted document list derivation.

Integration tests:

- Write captures old content before overwrite.
- Snapshot failure blocks risky overwrite.
- Rename records history and preserves document identity.
- Delete records recoverable content.
- Restore replaces or recreates the target and records a restore event.
- Symlinked `.mde/history` is rejected.
- Workspace search excludes `.mde/history`.
- External deletion is listed after refresh.
- Empty autosave does not call write before confirmation.

E2E tests:

- Open version history from the editor title bar.
- Edit and autosave, then preview and restore an earlier version.
- Delete a document, expand `Deleted Documents`, preview it in the editor, and restore it.
- Delete a tracked file outside MDE, refresh workspace, and restore it from `Deleted Documents`.
- Cancel empty autosave and verify editor and disk retain non-empty content.
- Verify English and Chinese UI text for the new history surface.
