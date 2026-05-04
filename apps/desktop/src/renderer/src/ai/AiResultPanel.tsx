import { LoaderCircle, X } from "lucide-react";
import { MarkdownBlockEditor } from "@mde/editor-react";
import { type FormEvent, useCallback, useMemo, useState } from "react";

import type { AiGenerationResult } from "../../../shared/ai";
import { createDesktopMarkdownAssetResolver } from "../editorHost/desktopMarkdownAssetResolver";
import type { AppText } from "../i18n/appLanguage";
import { COMPONENT_IDS } from "../componentIds";

interface AiResultPanelProps {
  readonly colorScheme: "dark" | "light";
  readonly isRegeneratingSummary: boolean;
  readonly onClose: () => void;
  readonly onRegenerateSummary: (instruction: string) => void;
  readonly result: AiGenerationResult;
  readonly text: AppText;
  readonly workspaceRoot: string;
}

export const AiResultPanel = ({
  colorScheme,
  isRegeneratingSummary,
  onClose,
  onRegenerateSummary,
  result,
  text,
  workspaceRoot,
}: AiResultPanelProps): React.JSX.Element => {
  const [summaryInstruction, setSummaryInstruction] = useState("");
  const resultTitle =
    result.kind === "summary"
      ? text("ai.summary")
      : result.language
        ? text("ai.translationWithLanguage", { language: result.language })
        : text("ai.translation");
  const submitSummaryInstruction = (
    event: FormEvent<HTMLFormElement>,
  ): void => {
    event.preventDefault();
    const instruction = summaryInstruction.trim();

    if (instruction.length === 0 || isRegeneratingSummary) {
      return;
    }

    onRegenerateSummary(instruction);
    setSummaryInstruction("");
  };
  const rejectReadOnlyImageUpload = useCallback(
    () => Promise.reject(new Error(text("errors.readOnlyAiResult"))),
    [text],
  );
  const markdownAssetResolver = useMemo(
    () =>
      createDesktopMarkdownAssetResolver({
        markdownFilePath: result.path,
        workspaceRoot,
      }),
    [result.path, workspaceRoot],
  );
  const ignoreReadOnlyMarkdownChange = useCallback(() => undefined, []);
  const ignoreReadOnlySaveRequest = useCallback(() => undefined, []);

  return (
    <section
      aria-label={text("ai.aiResult")}
      className="ai-result-panel"
      data-component-id={COMPONENT_IDS.ai.resultPanel}
    >
      <header
        className="ai-result-header"
        data-component-id={COMPONENT_IDS.ai.resultHeader}
      >
        <div className="ai-result-heading">
          <span>{resultTitle}</span>
          <span>
            {result.cached
              ? text("ai.cachedReadOnly")
              : text("ai.generatedReadOnly", { toolName: result.tool.name })}
          </span>
        </div>
        <button
          aria-label={text("ai.closeResult")}
          className="ai-result-close-button"
          data-component-id={COMPONENT_IDS.ai.resultCloseButton}
          onClick={onClose}
          title={text("ai.closeResult")}
          type="button"
        >
          <X aria-hidden="true" size={15} strokeWidth={2} />
        </button>
      </header>
      <p
        className="ai-result-path"
        data-component-id={COMPONENT_IDS.ai.resultPathLabel}
      >
        {text("ai.savedTo", { path: result.path })}
      </p>
      <div className="ai-result-editor-scroll">
        <MarkdownBlockEditor
          colorScheme={colorScheme}
          draftMarkdown={result.contents}
          errorMessage={null}
          isDirty={false}
          isReadOnly
          isSaving={false}
          key={`${result.kind}:${result.path}:${result.contents}`}
          markdown={result.contents}
          markdownAssetResolver={markdownAssetResolver}
          onImageUpload={rejectReadOnlyImageUpload}
          onMarkdownChange={ignoreReadOnlyMarkdownChange}
          onSaveRequest={ignoreReadOnlySaveRequest}
          path={result.path}
          text={text}
          workspaceRoot={workspaceRoot}
        />
      </div>
      {result.kind === "summary" ? (
        <form
          aria-label={text("ai.refineSummary")}
          className="ai-summary-refine-bar"
          data-component-id={COMPONENT_IDS.ai.refineSummaryBar}
          onSubmit={submitSummaryInstruction}
        >
          <input
            aria-label={text("ai.refineSummaryInstruction")}
            data-component-id={COMPONENT_IDS.ai.refineSummaryField}
            onChange={(event) => {
              setSummaryInstruction(event.target.value);
            }}
            placeholder={text("ai.regenerateSummaryPlaceholder")}
            type="text"
            value={summaryInstruction}
          />
          <button
            data-component-id={COMPONENT_IDS.ai.regenerateSummaryButton}
            disabled={isRegeneratingSummary}
            type="submit"
          >
            {isRegeneratingSummary ? (
              <>
                <LoaderCircle
                  aria-hidden="true"
                  className="editor-action-spinner"
                  size={15}
                  strokeWidth={2}
                />
                <span>{text("ai.regenerating")}</span>
              </>
            ) : (
              text("ai.regenerateSummary")
            )}
          </button>
        </form>
      ) : null}
    </section>
  );
};
