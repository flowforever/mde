import { FileText, Languages, LoaderCircle, Plus, X } from "lucide-react";
import type { FormEvent } from "react";

import { DEFAULT_AI_TRANSLATION_LANGUAGES } from "./aiLanguages";
import type { AppText } from "../i18n/appLanguage";

export type AiActionBusyState =
  | "idle"
  | "refining-summary"
  | "summarizing"
  | "translating";

interface AiActionMenuProps {
  readonly busyState: AiActionBusyState;
  readonly customLanguageInput: string;
  readonly customLanguages: readonly string[];
  readonly isTranslateMenuOpen: boolean;
  readonly onAddCustomLanguage: () => void;
  readonly onCustomLanguageInputChange: (value: string) => void;
  readonly onForgetCustomLanguage: (language: string) => void;
  readonly onSummarize: () => void;
  readonly onToggleTranslateMenu: () => void;
  readonly onTranslate: (language: string) => void;
  readonly text: AppText;
}

interface AiSummaryActionButtonProps {
  readonly busyState: AiActionBusyState;
  readonly onSummarize: () => void;
  readonly text: AppText;
}

interface AiTranslateActionMenuProps {
  readonly busyState: AiActionBusyState;
  readonly customLanguageInput: string;
  readonly customLanguages: readonly string[];
  readonly isTranslateMenuOpen: boolean;
  readonly onAddCustomLanguage: () => void;
  readonly onCustomLanguageInputChange: (value: string) => void;
  readonly onForgetCustomLanguage: (language: string) => void;
  readonly onToggleTranslateMenu: () => void;
  readonly onTranslate: (language: string) => void;
  readonly text: AppText;
}

const renderActionIcon = (
  isSpinning: boolean,
  icon: React.JSX.Element,
): React.JSX.Element =>
  isSpinning ? (
    <LoaderCircle
      aria-hidden="true"
      className="editor-action-spinner"
      data-testid="ai-action-spinner"
      size={17}
      strokeWidth={2}
    />
  ) : (
    icon
  );

export const AiSummaryActionButton = ({
  busyState,
  onSummarize,
  text,
}: AiSummaryActionButtonProps): React.JSX.Element => {
  const isBusy = busyState !== "idle";
  const isSummarizing = busyState === "summarizing";

  return (
    <button
      aria-label={text("ai.summarizeMarkdown")}
      aria-busy={isSummarizing}
      className="editor-action-button"
      disabled={isBusy}
      onClick={onSummarize}
      title={text("ai.summarizeMarkdown")}
      type="button"
    >
      {renderActionIcon(
        isSummarizing,
        <FileText aria-hidden="true" size={17} strokeWidth={2} />,
      )}
    </button>
  );
};

export const AiTranslateActionMenu = ({
  busyState,
  customLanguageInput,
  customLanguages,
  isTranslateMenuOpen,
  onAddCustomLanguage,
  onCustomLanguageInputChange,
  onForgetCustomLanguage,
  onToggleTranslateMenu,
  onTranslate,
  text,
}: AiTranslateActionMenuProps): React.JSX.Element => {
  const submitCustomLanguage = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const language = customLanguageInput.trim();

    onAddCustomLanguage();
    if (language.length > 0) {
      onTranslate(language);
    }
  };
  const isBusy = busyState !== "idle";
  const isTranslating = busyState === "translating";

  return (
    <div className="editor-translate-menu-shell">
      <button
        aria-expanded={isTranslateMenuOpen}
        aria-haspopup="menu"
        aria-label={text("ai.translateMarkdown")}
        aria-busy={isTranslating}
        className="editor-action-button"
        disabled={isBusy}
        onClick={onToggleTranslateMenu}
        title={text("ai.translateMarkdown")}
        type="button"
      >
        {renderActionIcon(
          isTranslating,
          <Languages aria-hidden="true" size={17} strokeWidth={2} />,
        )}
      </button>
      {isTranslateMenuOpen ? (
        <div
          aria-label={text("ai.translationLanguages")}
          className="editor-translate-menu"
          role="menu"
        >
          <div className="editor-translate-menu-list">
            {DEFAULT_AI_TRANSLATION_LANGUAGES.map((language) => (
              <button
                className="editor-translate-menu-item"
                key={language}
                onClick={() => {
                  onTranslate(language);
                }}
                role="menuitem"
                type="button"
              >
                {language}
              </button>
            ))}
            {customLanguages.map((language) => (
              <div className="editor-translate-custom-item" key={language}>
                <button
                  className="editor-translate-menu-item"
                  onClick={() => {
                    onTranslate(language);
                  }}
                  role="menuitem"
                  type="button"
                >
                  {language}
                </button>
                <button
                  aria-label={text("ai.removeCustomLanguageNamed", {
                    language,
                  })}
                  className="editor-translate-remove-button"
                  onClick={() => {
                    onForgetCustomLanguage(language);
                  }}
                  title={text("ai.removeCustomLanguage")}
                  type="button"
                >
                  <X aria-hidden="true" size={14} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
          <form
            aria-label={text("ai.addCustomTranslationLanguage")}
            className="editor-translate-custom-form"
            onSubmit={submitCustomLanguage}
          >
            <input
              aria-label={text("ai.customTranslationLanguage")}
              onChange={(event) => {
                onCustomLanguageInputChange(event.target.value);
              }}
              placeholder={text("ai.otherLanguage")}
              type="text"
              value={customLanguageInput}
            />
            <button
              aria-label={text("ai.addTranslationLanguage")}
              className="editor-translate-add-button"
              type="submit"
            >
              <Plus aria-hidden="true" size={15} strokeWidth={2} />
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
};

export const AiActionMenu = ({
  busyState,
  customLanguageInput,
  customLanguages,
  isTranslateMenuOpen,
  onAddCustomLanguage,
  onCustomLanguageInputChange,
  onForgetCustomLanguage,
  onSummarize,
  onToggleTranslateMenu,
  onTranslate,
  text,
}: AiActionMenuProps): React.JSX.Element => {
  return (
    <>
      <AiSummaryActionButton
        busyState={busyState}
        onSummarize={onSummarize}
        text={text}
      />
      <AiTranslateActionMenu
        busyState={busyState}
        customLanguageInput={customLanguageInput}
        customLanguages={customLanguages}
        isTranslateMenuOpen={isTranslateMenuOpen}
        onAddCustomLanguage={onAddCustomLanguage}
        onCustomLanguageInputChange={onCustomLanguageInputChange}
        onForgetCustomLanguage={onForgetCustomLanguage}
        onToggleTranslateMenu={onToggleTranslateMenu}
        onTranslate={onTranslate}
        text={text}
      />
    </>
  );
};
