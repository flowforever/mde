# Markdown Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable Electron Markdown editor: open a local folder, browse Markdown files in a VS Code-like explorer, edit one file in a Notion-like BlockNote editor, and save back to disk.

**Architecture:** Build in vertical slices so every production-code change has unit, integration, and E2E coverage in the same task. Electron main owns filesystem and dialog access. Preload exposes a narrow `contextBridge` API. React renderer owns layout and editor state. BlockNote provides the Notion-like block editor while Markdown remains the persistence format.

**Tech Stack:** Electron, electron-vite, React, TypeScript, BlockNote, Vitest, Testing Library, Playwright Electron, ESLint.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-04-28-markdown-editor-design.md`
- Required project rule: `AGENT.md`
- Verified docs:
  - electron-vite scripts and structure from `/alex8088/electron-vite-docs`
  - Vitest v4 multi-project testing from `/vitest-dev/vitest/v4.0.7`
  - Playwright v1.58 Electron automation from `/microsoft/playwright/v1.58.2`
  - Electron security guidance from `/electron/electron`
  - BlockNote Markdown import/export from `/websites/blocknotejs`

## Coverage Rule

Every task that adds or changes production code must include:

- UT: unit tests for pure functions, reducers, services, or components.
- IT: integration tests for IPC-facing services, filesystem workflows, or renderer interactions.
- E2E: Playwright Electron tests for the user-visible path touched by the task.

Do not commit production code from a task until `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, and `npm run test:e2e` pass.

## Target File Structure

```text
package.json
electron.vite.config.ts
vitest.config.ts
playwright.config.ts

src/
  main/
    index.ts
    ipc/
      channels.ts
      registerFileHandlers.ts
      registerWorkspaceHandlers.ts
    services/
      markdownFileService.ts
      pathSafety.ts
      workspaceService.ts
  preload/
    index.ts
    editorApi.ts
  renderer/
    index.html
    src/
      main.tsx
      app/
        App.tsx
        appReducer.ts
        appTypes.ts
      editor/
        MarkdownBlockEditor.tsx
        markdownTransforms.ts
      explorer/
        ExplorerPane.tsx
        ExplorerTree.tsx
        explorerTypes.ts
      layout/
        Shell.tsx
      styles/
        theme.css
      test/
        setup.ts
  shared/
    fileTree.ts
    workspace.ts

tests/
  fixtures/workspace/
  integration/
  unit/
  e2e/
    markdown-editor.e2e.test.ts
    support/
      electronApp.ts
      fixtureWorkspace.ts
```

## Final Commands

By the end of implementation, these must pass:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test
npm run build
```

## Task 1: Tooling, App Shell, and Active E2E Harness

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Create: `electron.vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/main/index.ts`
- Create: `src/preload/index.ts`
- Create: `src/renderer/index.html`
- Create: `src/renderer/src/main.tsx`
- Create: `src/renderer/src/app/App.tsx`
- Create: `src/renderer/src/layout/Shell.tsx`
- Create: `src/renderer/src/styles/theme.css`
- Create: `src/renderer/src/test/setup.ts`
- Create: `tests/unit/shell.test.tsx`
- Create: `tests/integration/electronConfig.integration.test.ts`
- Create: `tests/e2e/support/electronApp.ts`
- Create: `tests/e2e/markdown-editor.e2e.test.ts`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install electron react react-dom @blocknote/core @blocknote/react @blocknote/mantine @mantine/core @mantine/hooks
```

- [ ] **Step 2: Install build and test dependencies**

```bash
npm install --save-dev electron-vite vite @vitejs/plugin-react @types/node @types/react @types/react-dom vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test playwright
```

- [ ] **Step 3: Update package scripts**

Use this script set:

```json
{
  "dev": "electron-vite dev",
  "start": "electron-vite preview",
  "build": "electron-vite build",
  "typecheck": "tsc --noEmit",
  "lint": "eslint . --max-warnings=0",
  "lint:fix": "eslint . --fix",
  "test:unit": "vitest run --project unit",
  "test:integration": "vitest run --project integration",
  "test:e2e": "playwright test",
  "test": "npm run test:unit && npm run test:integration && npm run test:e2e"
}
```

- [ ] **Step 4: Update TypeScript includes**

Ensure `tsconfig.json` includes config, source, and test files:

```json
{
  "include": [
    "*.config.ts",
    "src/**/*.ts",
    "src/**/*.tsx",
    "tests/**/*.ts",
    "tests/**/*.tsx"
  ]
}
```

- [ ] **Step 5: Add build/test configs**

Create `electron.vite.config.ts` with main, preload, and renderer inputs matching the target structure. Create `vitest.config.ts` with two projects:

- `unit`: `jsdom`, includes `tests/unit/**/*.test.{ts,tsx}`, setup `src/renderer/src/test/setup.ts`
- `integration`: `node`, includes `tests/integration/**/*.test.ts`

Create `playwright.config.ts` with `testDir: 'tests/e2e'` and `trace: 'retain-on-failure'`.

- [ ] **Step 6: Write failing UT, IT, and E2E tests**

Unit test `tests/unit/shell.test.tsx`:

```ts
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '../../src/renderer/src/app/App'

describe('App shell', () => {
  it('shows the initial open folder action', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /open folder/i })).toBeInTheDocument()
  })
})
```

Integration test `tests/integration/electronConfig.integration.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createWindowOptions } from '../../src/main/index'

describe('Electron window config', () => {
  it('keeps renderer isolated from Node.js', () => {
    const options = createWindowOptions('/tmp/preload.js')

    expect(options.webPreferences?.contextIsolation).toBe(true)
    expect(options.webPreferences?.nodeIntegration).toBe(false)
  })
})
```

E2E helper `tests/e2e/support/electronApp.ts` must launch with Playwright `_electron` and return the first window. E2E test asserts the launched app shows "Open Folder".

- [ ] **Step 7: Run tests and confirm RED**

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```

Expected: tests fail because shell files are not implemented.

- [ ] **Step 8: Implement minimal secure Electron shell**

Requirements:

- `src/main/index.ts` exports `createWindowOptions(preloadPath)`.
- `BrowserWindow` uses `contextIsolation: true`, `nodeIntegration: false`, and preload.
- `src/preload/index.ts` exposes no raw Electron/Node APIs yet.
- Renderer shows two-pane layout: dark left explorer area and warm white editor empty state.
- Button text: `Open Folder`.

- [ ] **Step 9: Run full verification**

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
```

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json electron.vite.config.ts vitest.config.ts playwright.config.ts src tests
git commit -m "chore: scaffold electron app shell"
```

## Task 2: Open Workspace and Explorer Vertical Slice

**Files:**
- Create: `src/shared/fileTree.ts`
- Create: `src/shared/workspace.ts`
- Create: `src/main/services/pathSafety.ts`
- Create: `src/main/services/workspaceService.ts`
- Create: `src/main/ipc/channels.ts`
- Create: `src/main/ipc/registerWorkspaceHandlers.ts`
- Create: `src/preload/editorApi.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/index.ts`
- Create: `src/renderer/src/app/appReducer.ts`
- Create: `src/renderer/src/app/appTypes.ts`
- Create: `src/renderer/src/explorer/ExplorerPane.tsx`
- Create: `src/renderer/src/explorer/ExplorerTree.tsx`
- Create: `src/renderer/src/explorer/explorerTypes.ts`
- Modify: `src/renderer/src/app/App.tsx`
- Create: `tests/fixtures/workspace/README.md`
- Create: `tests/fixtures/workspace/docs/intro.md`
- Create: `tests/fixtures/workspace/docs/nested/deep.md`
- Create: `tests/unit/pathSafety.test.ts`
- Create: `tests/unit/workspaceService.test.ts`
- Create: `tests/unit/appReducer.test.ts`
- Create: `tests/unit/ExplorerTree.test.tsx`
- Create: `tests/integration/workspaceService.integration.test.ts`
- Modify: `tests/e2e/markdown-editor.e2e.test.ts`
- Create: `tests/e2e/support/fixtureWorkspace.ts`

- [ ] **Step 1: Write failing UT tests**

Cover:

- `pathSafety` accepts paths inside workspace and rejects traversal.
- `workspaceService` sorts directories before Markdown files.
- `appReducer` stores opened workspace and selected file.
- `ExplorerTree` renders nested folders and calls `onSelectFile`.

- [ ] **Step 2: Write failing IT test**

`tests/integration/workspaceService.integration.test.ts` uses `tests/fixtures/workspace` and asserts the tree contains:

- `README.md`
- `docs/intro.md`
- `docs/nested/deep.md`

Also test handler functions from `registerWorkspaceHandlers.ts` without booting full Electron IPC.

- [ ] **Step 3: Write failing E2E test**

Use a test launch argument such as `--test-workspace=<tempPath>` so E2E avoids a native folder picker. The test must:

- Launch app.
- Click `Open Folder`.
- See `README.md` and `docs`.
- Expand `docs`.
- See `intro.md`.

- [ ] **Step 4: Run tests and confirm RED**

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```

- [ ] **Step 5: Implement shared types and path safety**

Create:

- `TreeNode`, `TreeNodeType` in `src/shared/fileTree.ts`
- `Workspace`, `FileContents`, `EditorApi` in `src/shared/workspace.ts`
- `assertPathInsideWorkspace` and `resolveWorkspacePath` in `pathSafety.ts`

All filesystem-facing code must call path safety helpers.

- [ ] **Step 6: Implement workspace service and IPC**

Requirements:

- Include directories and `.md` files only.
- Ignore `.git`, `node_modules`, `.DS_Store`, `dist`, `out`, `release`.
- Return immutable sorted arrays.
- Register only named IPC channels.
- Preload exposes `window.editorApi.openWorkspace()` and `listDirectory()`.
- No raw `ipcRenderer` exposed.

- [ ] **Step 7: Implement explorer UI**

Requirements:

- Dark VS Code-like explorer pane.
- Folder disclosure buttons.
- Markdown files selectable.
- Accessible row buttons with visible active state.
- Empty state remains useful before workspace open.

- [ ] **Step 8: Run full verification**

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
```

- [ ] **Step 9: Commit**

```bash
git add src tests
git commit -m "feat: open workspace explorer"
```

## Task 3: Load Markdown into Block Editor

**Files:**
- Create: `src/main/services/markdownFileService.ts`
- Create: `src/main/ipc/registerFileHandlers.ts`
- Modify: `src/main/ipc/channels.ts`
- Modify: `src/preload/editorApi.ts`
- Modify: `src/preload/index.ts`
- Create: `src/renderer/src/editor/markdownTransforms.ts`
- Create: `src/renderer/src/editor/MarkdownBlockEditor.tsx`
- Modify: `src/renderer/src/app/App.tsx`
- Modify: `src/renderer/src/app/appReducer.ts`
- Create: `tests/unit/markdownFileService.test.ts`
- Create: `tests/unit/markdownTransforms.test.ts`
- Modify: `tests/unit/appReducer.test.ts`
- Create: `tests/integration/fileHandlers.integration.test.ts`
- Modify: `tests/e2e/markdown-editor.e2e.test.ts`

- [ ] **Step 1: Write failing UT tests**

Cover:

- `markdownFileService` reads only `.md` files inside workspace.
- `markdownTransforms` imports headings, paragraphs, bullets, quotes, and code blocks.
- `markdownTransforms` exports those block types back to Markdown.
- reducer handles `fileLoadStarted`, `fileLoaded`, and `fileLoadFailed`.

- [ ] **Step 2: Write failing IT tests**

`fileHandlers.integration.test.ts` must cover:

- read Markdown file from fixture workspace
- reject non-Markdown file
- reject path traversal

- [ ] **Step 3: Write failing E2E test**

Extend E2E:

- Open fixture workspace.
- Select `README.md`.
- Verify the right pane shows the document content in the block editor surface.

- [ ] **Step 4: Run tests and confirm RED**

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```

- [ ] **Step 5: Implement Markdown file read path**

Requirements:

- File service validates workspace root.
- IPC exposes `readMarkdownFile(path)`.
- Preload exposes the typed method.
- Renderer calls it when selected file changes.

- [ ] **Step 6: Implement BlockNote editor adapter**

Requirements:

- `MarkdownBlockEditor` uses `useCreateBlockNote` and `BlockNoteView`.
- Markdown import/export logic stays in `markdownTransforms.ts`.
- First version only enables or exposes Markdown-compatible block types when practical.
- Editor visual style follows the Notion-like direction from the spec.

- [ ] **Step 7: Run full verification**

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
```

- [ ] **Step 8: Commit**

```bash
git add src tests
git commit -m "feat: load markdown into block editor"
```

## Task 4: Save and Manage Markdown Files

**Files:**
- Modify: `src/main/services/markdownFileService.ts`
- Modify: `src/main/ipc/registerFileHandlers.ts`
- Modify: `src/preload/editorApi.ts`
- Modify: `src/renderer/src/app/App.tsx`
- Modify: `src/renderer/src/app/appReducer.ts`
- Modify: `src/renderer/src/explorer/ExplorerPane.tsx`
- Modify: `src/renderer/src/explorer/ExplorerTree.tsx`
- Modify: `src/renderer/src/editor/MarkdownBlockEditor.tsx`
- Modify: `tests/unit/markdownFileService.test.ts`
- Modify: `tests/unit/appReducer.test.ts`
- Modify: `tests/integration/fileHandlers.integration.test.ts`
- Modify: `tests/e2e/markdown-editor.e2e.test.ts`

- [ ] **Step 1: Write failing UT tests**

Cover:

- write, create file, create folder, rename, delete in `markdownFileService`
- dirty state after editor change
- save success clears dirty state
- save failure preserves dirty state

- [ ] **Step 2: Write failing IT tests**

Use a temp workspace and assert disk state after:

- save edited Markdown
- create file
- create folder
- rename entry
- delete entry

- [ ] **Step 3: Write failing E2E tests**

E2E must:

- Copy fixture workspace to a temp directory.
- Open temp workspace.
- Open `README.md`.
- Edit a block.
- Save by button and by keyboard shortcut.
- Verify file content changed on disk.
- Create a new Markdown file and see it in explorer.

- [ ] **Step 4: Run tests and confirm RED**

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```

- [ ] **Step 5: Implement save flow**

Requirements:

- Save button visible when a file is open.
- `Meta+S` and `Control+S` save current file.
- Serialize current BlockNote blocks to Markdown before writing.
- Save failure shows inline error and keeps dirty state.

- [ ] **Step 6: Implement file operations**

Requirements:

- Explorer toolbar supports create file and create folder.
- Selected row actions support rename and delete.
- Delete requires confirmation.
- Tree refreshes after operations.
- If selected file is removed, clear editor state.

- [ ] **Step 7: Run full verification**

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
```

- [ ] **Step 8: Commit**

```bash
git add src tests
git commit -m "feat: save and manage markdown files"
```

## Task 5: Visual Polish, Accessibility, and Build Docs

**Files:**
- Modify: `src/renderer/src/styles/theme.css`
- Modify: `src/renderer/src/layout/Shell.tsx`
- Modify: `src/renderer/src/explorer/ExplorerPane.tsx`
- Modify: `src/renderer/src/explorer/ExplorerTree.tsx`
- Modify: `src/renderer/src/editor/MarkdownBlockEditor.tsx`
- Create: `README.md`
- Modify: renderer unit tests as needed
- Modify: `tests/e2e/markdown-editor.e2e.test.ts`

- [ ] **Step 1: Write failing UT accessibility tests**

Assert:

- `Open Folder`, `Save`, create file, create folder, rename, and delete controls have accessible names.
- Explorer rows are buttons or treeitems with useful labels.
- Empty states are visible by text.

- [ ] **Step 2: Expand E2E visual behavior checks**

Assert:

- selected file active state exists
- dirty state appears after edit
- dirty state disappears after save
- app is usable at 1280x720

- [ ] **Step 3: Run tests and confirm RED if states are missing**

```bash
npm run test:unit
npm run test:e2e
```

- [ ] **Step 4: Polish UI**

Requirements:

- Left explorer is compact, dark, and scannable.
- Right document surface has Notion-like whitespace and calm typography.
- No decorative icons without function.
- Text does not overlap or overflow common desktop sizes.
- Empty state clearly tells the user what to do.

- [ ] **Step 5: Add README**

Document:

- install command
- dev command
- build command
- lint/typecheck/test commands
- v1 limitation: BlockNote to Markdown conversion is intentionally Markdown-compatible and may be lossy for future rich blocks.

- [ ] **Step 6: Run final verification**

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test
npm run build
git diff --check
```

- [ ] **Step 7: Commit**

```bash
git add src tests README.md
git commit -m "style: polish markdown editor"
```

## Execution Notes

- Do not weaken Electron security settings to make tests easier.
- Do not expose raw `ipcRenderer`, Node `fs`, or shell execution to renderer code.
- Keep Markdown-compatible block constraints explicit.
- Use temporary workspaces for integration and E2E tests. Never write test output into `tests/fixtures/workspace`.
- If Playwright Electron launch is unstable, first verify `npm run dev`, then adjust `tests/e2e/support/electronApp.ts` to launch the built electron-vite entrypoint.
- Keep commits in task order.
