import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FrontmatterPanel } from "@mde/editor-react";
import type { MarkdownFrontmatterBlock } from "@mde/editor-core/frontmatter";
import {
  BUILT_IN_APP_LANGUAGE_PACKS,
  createAppText,
} from "../../apps/desktop/src/renderer/src/i18n/appLanguage";

const text = createAppText(BUILT_IN_APP_LANGUAGE_PACKS.en);

const createFrontmatter = (
  overrides: Partial<MarkdownFrontmatterBlock> = {},
): MarkdownFrontmatterBlock => ({
  fieldCount: 2,
  fields: [
    { key: "name", value: "auto-pick-tasks" },
    { key: "description", value: "Use ready tasks" },
  ],
  isValid: true,
  raw: "name: auto-pick-tasks\ndescription: Use ready tasks",
  summary: "name: auto-pick-tasks   description: Use ready tasks",
  ...overrides,
});

describe("FrontmatterPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows only the metadata summary in the collapsed row", () => {
    render(
      <FrontmatterPanel
        frontmatter={createFrontmatter()}
        isReadOnly={false}
        onApply={vi.fn()}
        text={text}
      />,
    );

    const summaryButton = screen.getByRole("button", {
      name: /name: auto-pick-tasks/i,
    });

    expect(summaryButton).toBeVisible();
    expect(summaryButton).not.toHaveTextContent(/Frontmatter/i);
    expect(summaryButton).not.toHaveTextContent(/2 fields/i);
  });

  it("opens a lightweight fields view with a single Source switch", async () => {
    const user = userEvent.setup();

    render(
      <FrontmatterPanel
        frontmatter={createFrontmatter()}
        isReadOnly={false}
        onApply={vi.fn()}
        text={text}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /name: auto-pick-tasks/i }),
    );

    const fields = screen.getByRole("list", { name: /^Fields$/i });

    expect(within(fields).getByText("name")).toBeVisible();
    expect(within(fields).getByText("auto-pick-tasks")).toBeVisible();
    expect(within(fields).getByText("description")).toBeVisible();
    expect(within(fields).getByText("Use ready tasks")).toBeVisible();
    expect(screen.getByRole("button", { name: /^Source$/i })).toBeVisible();
    expect(screen.queryByText(/name: auto-pick-tasks/)).not.toHaveClass(
      "frontmatter-raw",
    );
  });

  it("switches from fields to editable source and back", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    render(
      <FrontmatterPanel
        frontmatter={createFrontmatter()}
        isReadOnly={false}
        onApply={onApply}
        text={text}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /name: auto-pick-tasks/i }),
    );
    await user.click(screen.getByRole("button", { name: /^Source$/i }));

    const sourceInput = screen.getByRole("textbox", {
      name: /raw frontmatter yaml/i,
    });

    expect(sourceInput).toHaveValue(
      "name: auto-pick-tasks\ndescription: Use ready tasks",
    );

    await user.clear(sourceInput);
    await user.type(sourceInput, "name: updated");
    await user.click(screen.getByRole("button", { name: /apply frontmatter/i }));

    expect(onApply).toHaveBeenCalledWith("name: updated");

    await user.click(screen.getByRole("button", { name: /^Fields$/i }));
    expect(
      screen.getByRole("list", { name: /^Fields$/i }),
    ).toBeVisible();
  });

  it("opens invalid YAML directly in source view with the preservation warning", () => {
    render(
      <FrontmatterPanel
        frontmatter={createFrontmatter({
          isValid: false,
          parseErrorMessage: "bad YAML",
          raw: "name: [unterminated",
          summary: "name: [unterminated",
        })}
        isReadOnly={false}
        onApply={vi.fn()}
        text={text}
      />,
    );

    expect(
      screen.getByText(/frontmatter parse failed; raw YAML will be preserved/i),
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: /raw frontmatter yaml/i }),
    ).toHaveValue("name: [unterminated");
    expect(screen.getByRole("button", { name: /^Fields$/i })).toBeVisible();
  });
});
