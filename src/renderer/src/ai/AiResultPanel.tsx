import { LoaderCircle, X } from "lucide-react";
import { type FormEvent, useCallback, useState } from "react";

import type { AiGenerationResult } from "../../../shared/ai";
import { MarkdownBlockEditor } from "../editor/MarkdownBlockEditor";
import type { AppText } from "../i18n/appLanguage";

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
  const ignoreReadOnlyMarkdownChange = useCallback(() => undefined, []);
  const ignoreReadOnlySaveRequest = useCallback(() => undefined, []);

  return (
    <section aria-label={text("ai.aiResult")} className="ai-result-panel">
      <header className="ai-result-header">
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
          onClick={onClose}
          title={text("ai.closeResult")}
          type="button"
        >
          <X aria-hidden="true" size={15} strokeWidth={2} />
        </button>
      </header>
      <p className="ai-result-path">
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
          onSubmit={submitSummaryInstruction}
        >
          <input
            aria-label={text("ai.refineSummaryInstruction")}
            onChange={(event) => {
              setSummaryInstruction(event.target.value);
            }}
            placeholder={text("ai.regenerateSummaryPlaceholder")}
            type="text"
            value={summaryInstruction}
          />
          <button disabled={isRegeneratingSummary} type="submit">
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
