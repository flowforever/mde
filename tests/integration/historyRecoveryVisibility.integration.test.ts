import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { appReducer, createInitialAppState } from "../../apps/desktop/src/renderer/src/app/appReducer";
import { ExplorerPane } from "../../apps/desktop/src/renderer/src/explorer/ExplorerPane";
import {
  BUILT_IN_APP_LANGUAGE_PACKS,
  createAppText,
} from "../../apps/desktop/src/renderer/src/i18n/appLanguage";
import type { AppState } from "../../apps/desktop/src/renderer/src/app/appTypes";

const text = createAppText(BUILT_IN_APP_LANGUAGE_PACKS.en);

const renderExplorerMarkup = (state: AppState): string =>
  renderToStaticMarkup(
    createElement(ExplorerPane, {
      deletedDocumentHistory: state.deletedDocumentHistory ?? [],
      onCreateFile: vi.fn(),
      onCreateFolder: vi.fn(),
      onDeleteEntry: vi.fn(),
      onOpenWorkspace: vi.fn(),
      onRenameEntry: vi.fn(),
      onSelectEntry: vi.fn(),
      onSelectFile: vi.fn(),
      onSetDeletedDocumentHistoryVisible: vi.fn(),
      state,
      text,
    }),
  );

describe("history recovery visibility integration", () => {
  it("drives the explorer recovery section from app history state", () => {
    const workspaceState = appReducer(createInitialAppState(), {
      type: "workspace/opened",
      workspace: {
        name: "workspace",
        rootPath: "/workspace",
        tree: [
          {
            name: "README.md",
            path: "README.md",
            type: "file",
          },
        ],
      },
    });
    const visibleState = appReducer(workspaceState, {
      documents: [
        {
          deletedAt: "2026-05-02T01:00:00.000Z",
          documentId: "doc_deleted",
          latestVersionId: "version_deleted",
          path: "deleted.md",
          reason: "deleted-in-mde",
          versionCount: 1,
        },
      ],
      type: "history/deleted-documents-loaded",
      workspaceRoot: "/workspace",
    });
    const hiddenState = appReducer(visibleState, {
      isVisible: false,
      type: "history/deleted-documents-visibility-set",
      workspaceRoot: "/workspace",
    });

    expect(renderExplorerMarkup(visibleState)).toContain("Deleted Documents");
    expect(renderExplorerMarkup(hiddenState)).not.toContain(
      "Deleted Documents",
    );
  });
});
