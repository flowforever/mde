import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AiActionMenu } from "../../src/renderer/src/ai/AiActionMenu";
import { COMPONENT_IDS } from "../../src/renderer/src/componentIds";
import {
  BUILT_IN_APP_LANGUAGE_PACKS,
  createAppText,
} from "../../src/renderer/src/i18n/appLanguage";

type BusyState = "idle" | "refining-summary" | "summarizing" | "translating";

const renderAiActionMenu = (busyState: BusyState): void => {
  const text = createAppText(BUILT_IN_APP_LANGUAGE_PACKS.en);

  render(
    <AiActionMenu
      busyState={busyState}
      customLanguageInput=""
      customLanguages={[]}
      isTranslateMenuOpen={false}
      onAddCustomLanguage={vi.fn()}
      onCustomLanguageInputChange={vi.fn()}
      onForgetCustomLanguage={vi.fn()}
      onSummarize={vi.fn()}
      onToggleTranslateMenu={vi.fn()}
      onTranslate={vi.fn()}
      text={text}
    />,
  );
};

describe("AiActionMenu", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows a spinner only on the summary button while summarizing", () => {
    renderAiActionMenu("summarizing");

    const summaryButton = screen.getByRole("button", {
      name: /summarize markdown/i,
    });
    const translateButton = screen.getByRole("button", {
      name: /translate markdown/i,
    });

    expect(summaryButton).toHaveAttribute("aria-busy", "true");
    expect(translateButton).toHaveAttribute("aria-busy", "false");
    expect(
      within(summaryButton).getByTestId("ai-action-spinner"),
    ).toBeInTheDocument();
    expect(
      within(translateButton).queryByTestId("ai-action-spinner"),
    ).not.toBeInTheDocument();
  });

  it("shows a spinner only on the translate button while translating", () => {
    renderAiActionMenu("translating");

    const summaryButton = screen.getByRole("button", {
      name: /summarize markdown/i,
    });
    const translateButton = screen.getByRole("button", {
      name: /translate markdown/i,
    });

    expect(summaryButton).toHaveAttribute("aria-busy", "false");
    expect(translateButton).toHaveAttribute("aria-busy", "true");
    expect(
      within(summaryButton).queryByTestId("ai-action-spinner"),
    ).not.toBeInTheDocument();
    expect(
      within(translateButton).getByTestId("ai-action-spinner"),
    ).toBeInTheDocument();
  });

  it("does not spin top-level AI action buttons while refining a summary", () => {
    renderAiActionMenu("refining-summary");

    const summaryButton = screen.getByRole("button", {
      name: /summarize markdown/i,
    });
    const translateButton = screen.getByRole("button", {
      name: /translate markdown/i,
    });

    expect(summaryButton).toHaveAttribute("aria-busy", "false");
    expect(translateButton).toHaveAttribute("aria-busy", "false");
    expect(screen.queryByTestId("ai-action-spinner")).not.toBeInTheDocument();
  });

  it("marks AI action controls with internal component ids", () => {
    const text = createAppText(BUILT_IN_APP_LANGUAGE_PACKS.en);

    render(
      <AiActionMenu
        busyState="idle"
        customLanguageInput=""
        customLanguages={["Klingon"]}
        isTranslateMenuOpen
        onAddCustomLanguage={vi.fn()}
        onCustomLanguageInputChange={vi.fn()}
        onForgetCustomLanguage={vi.fn()}
        onSummarize={vi.fn()}
        onToggleTranslateMenu={vi.fn()}
        onTranslate={vi.fn()}
        text={text}
      />,
    );

    expect(screen.getByRole("button", { name: /summarize markdown/i })).toHaveAttribute(
      "data-component-id",
      COMPONENT_IDS.ai.summaryButton,
    );
    expect(screen.getByRole("menu")).toHaveAttribute(
      "data-component-id",
      COMPONENT_IDS.ai.translateMenu,
    );
    expect(screen.getByRole("textbox", { name: /custom translation language/i })).toHaveAttribute(
      "data-component-id",
      COMPONENT_IDS.ai.customTranslationLanguageField,
    );
  });
});
