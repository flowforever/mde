# Markdown Editor Design

Date: 2026-04-28
Status: Approved for implementation planning

## Goal

Build a desktop Markdown editor with a VS Code-like file explorer on the left and a Notion-like block editor on the right. The first version should be a real Electron application, not only a web mockup. Users open a local folder, select Markdown files, edit them as blocks, and save changes back to disk.

## User Decisions

- Runtime: Electron desktop app.
- Workspace: open a real local folder from disk.
- Navigation: VS Code-like explorer.
- Editing model: pure Notion-like block editor.
- Markdown role: storage, import, and export format rather than the primary editing surface.

## Recommended Approach

Use Electron, electron-vite, React, TypeScript, and BlockNote.

Electron provides the local desktop shell and filesystem access. electron-vite provides a conventional split between main, preload, and renderer processes. React handles application UI. BlockNote provides the Notion-like editor surface, slash menu behavior, block model, and Markdown import/export APIs.

The main tradeoff is that Markdown conversion is lossy for some rich block features. The first version should constrain available blocks to Markdown-friendly content: paragraph, headings, bullet list, numbered list, checklist, quote, code block, horizontal rule, and links. This keeps save/load behavior predictable.

## Alternatives Considered

### BlockNote

Pros:
- Fastest path to a Notion-like block editor.
- Built-in React integration.
- Built-in Markdown parsing and lossy export.
- Lower editor implementation risk.

Cons:
- Less control than a fully custom ProseMirror/Tiptap implementation.
- Markdown serialization requires block constraints.

Decision: recommended for the first version.

### TipTap or ProseMirror Custom Blocks

Pros:
- Fine-grained control over document schema, Markdown mapping, and editor behavior.
- Strong long-term fit for advanced editor features.

Cons:
- Larger first implementation.
- More custom code for block controls, slash menu, and file-safe serialization.

Decision: defer unless BlockNote constraints become a blocker.

### Lexical Custom Editor

Pros:
- Modern editor architecture.
- Good long-term extensibility.

Cons:
- Higher initial cost for Notion-like block editing.
- More custom Markdown import/export work.

Decision: not selected for v1.

## Architecture

### Process Boundary

The renderer process never receives direct Node.js or filesystem access. Electron runs with context isolation enabled and node integration disabled. The preload script exposes a small typed API through `contextBridge`.

Renderer API surface:

- `openWorkspace(): Promise<Workspace>`
- `listDirectory(path): Promise<TreeNode[]>`
- `readMarkdownFile(path): Promise<FileContents>`
- `writeMarkdownFile(path, contents): Promise<void>`
- `createFile(parentPath, name): Promise<TreeNode>`
- `createFolder(parentPath, name): Promise<TreeNode>`
- `renameEntry(path, nextName): Promise<TreeNode>`
- `deleteEntry(path): Promise<void>`

All IPC handlers validate paths against the active workspace root. Renderer-provided paths must not escape that root.

### Project Structure

```text
src/
  main/
    index.ts
    ipc/
      workspaceHandlers.ts
      fileHandlers.ts
    services/
      workspaceService.ts
      markdownFileService.ts
  preload/
    index.ts
    editorApi.ts
  renderer/
    index.html
    src/
      app/
        App.tsx
        appStore.ts
      explorer/
        ExplorerPane.tsx
        ExplorerTree.tsx
        explorerTypes.ts
      editor/
        MarkdownBlockEditor.tsx
        markdownTransforms.ts
      layout/
        Shell.tsx
      styles/
        theme.css
```

The structure keeps filesystem logic in the main process, typed bridge definitions in preload, and user-facing UI in renderer.

## UX Design

### Layout

The app uses a two-pane desktop layout.

Left pane:
- Dark VS Code-like explorer.
- Workspace name at the top.
- File/folder tree with disclosure arrows.
- Markdown files are selectable.
- Basic entry actions: create file, create folder, rename, delete.

Right pane:
- Warm white Notion-like document canvas.
- Wide readable text column with generous spacing.
- File title derived from filename, editable later but read-only in v1 if needed.
- Subtle block handles shown on hover.
- Slash command entry for common Markdown-compatible blocks.
- Empty state prompts the user to open a folder or select a Markdown file.

### Visual Direction

Explorer:
- Dark neutral background, compact density, restrained hover states.
- Similar information density to VS Code, without copying its full chrome.

Editor:
- Quiet Notion-like surface.
- Serif or refined display treatment for document title, system sans for body.
- No decorative icons unless they communicate file actions.
- Minimal borders; spacing and typography carry hierarchy.

## Data Flow

1. User selects "Open Folder".
2. Main process shows native folder picker.
3. Main process stores active workspace root in memory.
4. Main process scans the workspace tree and returns Markdown-focused nodes to renderer.
5. User selects a `.md` file.
6. Renderer asks main process to read the file.
7. Renderer parses Markdown into BlockNote blocks.
8. User edits blocks.
9. Save serializes current blocks to Markdown and sends content to main process.
10. Main process writes the file to disk after validating the path is inside the workspace root.

Autosave can be added after explicit save works reliably. v1 should start with explicit save plus dirty state.

## State Model

Renderer state:

- Active workspace root metadata.
- Explorer tree.
- Expanded folder ids.
- Selected file path.
- Current editor blocks.
- Dirty flag.
- File operation loading/error states.

Main process state:

- Active workspace root.
- No document content cache in v1.

## Error Handling

Expected errors:

- No workspace selected.
- Folder access canceled.
- File deleted outside the app.
- File read/write permission failure.
- Markdown parse failure or unsupported content.
- Path traversal attempt.

User-facing handling:

- Show concise inline errors in the affected pane.
- Keep editor content intact if save fails.
- Offer "Reload from disk" when selected file no longer exists.

Developer-facing handling:

- Main process errors include operation name and normalized path context.
- Renderer receives safe error messages without raw stack traces.

## Security

Security requirements:

- `contextIsolation: true`.
- `nodeIntegration: false`.
- No raw `ipcRenderer` exposed to renderer.
- Preload exposes method-level APIs only.
- IPC validates input shape.
- File paths are normalized and checked against workspace root.
- No remote content loaded.
- No shell execution in v1.

This is important because a Markdown editor handles arbitrary local files and user-written content.

## Testing Strategy

Unit tests:

- Path validation prevents escaping workspace root.
- Tree scanning filters and sorts files correctly.
- Markdown parse/export transform handles supported block types.
- Dirty state transitions are correct.

Integration tests:

- Open fixture workspace.
- Read Markdown file.
- Save edited Markdown file.
- Create, rename, and delete entries in a temporary workspace.

E2E tests:

- Launch app.
- Open test workspace.
- Select Markdown file.
- Edit a block.
- Save.
- Verify file content changed on disk.

## First Implementation Milestone

The first implementation milestone is a usable local editor:

- Electron app starts.
- User can open a folder.
- Explorer displays nested folders and Markdown files.
- User can open one Markdown file.
- Right pane shows a Notion-like BlockNote editor.
- User can edit and save Markdown back to disk.
- Basic create file/folder works.
- Security-sensitive IPC is covered by tests.

## Deferred

- Multi-tab editing.
- Git integration.
- Search across workspace.
- Rich embeds.
- Image paste/upload.
- Backlinks.
- Sync.
- Plugin system.
- WYSIWYG features that cannot serialize cleanly to Markdown.
