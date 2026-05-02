import {
  type CSSProperties,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";

import {
  extractMermaidBlocks,
  replaceMermaidBlockSource,
} from "./flowchartMarkdown";
import type { AppText } from "../i18n/appLanguage";

interface MermaidFlowchartPanelProps {
  readonly colorScheme: "dark" | "light";
  readonly isReadOnly?: boolean;
  readonly markdown: string;
  readonly onMarkdownChange: (contents: string) => void;
  readonly text: AppText;
}

interface RenderedFlowchart {
  readonly errorMessage: string | null;
  readonly svg: string | null;
}

interface MermaidApi {
  readonly initialize: (options: {
    readonly securityLevel: "strict";
    readonly startOnLoad: boolean;
    readonly theme: "dark" | "neutral";
  }) => void;
  readonly render: (
    id: string,
    source: string,
  ) => Promise<{ readonly svg: string }> | { readonly svg: string };
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const loadMermaid = async (): Promise<MermaidApi> => {
  const mermaidModule = (await import("mermaid")) as unknown as {
    readonly default?: MermaidApi;
  } & MermaidApi;

  return mermaidModule.default ?? mermaidModule;
};

export const MermaidFlowchartPanel = ({
  colorScheme,
  isReadOnly = false,
  markdown,
  onMarkdownChange,
  text,
}: MermaidFlowchartPanelProps): React.JSX.Element | null => {
  const idPrefix = useId().replaceAll(":", "-");
  const blocks = useMemo(() => extractMermaidBlocks(markdown), [markdown]);
  const [renderedFlowcharts, setRenderedFlowcharts] = useState<
    readonly RenderedFlowchart[]
  >([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState<number | null>(
    null,
  );
  const [previewScale, setPreviewScale] = useState(1);

  useEffect(() => {
    let isCurrent = true;

    const renderFlowcharts = async (): Promise<void> => {
      if (blocks.length === 0) {
        setRenderedFlowcharts([]);
        return;
      }

      try {
        const mermaid = await loadMermaid();

        mermaid.initialize({
          securityLevel: "strict",
          startOnLoad: false,
          theme: colorScheme === "dark" ? "dark" : "neutral",
        });

        const results = await Promise.all(
          blocks.map(async (block) => {
            try {
              const rendered = await mermaid.render(
                `mde-flowchart-${idPrefix}-${block.index}`,
                block.source,
              );

              return {
                errorMessage: null,
                svg: rendered.svg,
              };
            } catch (error) {
              return {
                errorMessage: getErrorMessage(
                  error,
                  text("flowchart.renderFailed"),
                ),
                svg: null,
              };
            }
          }),
        );

        if (isCurrent) {
          setRenderedFlowcharts(results);
        }
      } catch (error) {
        if (isCurrent) {
          setRenderedFlowcharts(
            blocks.map(() => ({
              errorMessage: getErrorMessage(
                error,
                text("flowchart.renderFailed"),
              ),
              svg: null,
            })),
          );
        }
      }
    };

    void renderFlowcharts();

    return () => {
      isCurrent = false;
    };
  }, [blocks, colorScheme, idPrefix, text]);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <>
      <aside
        aria-label={text("flowchart.label")}
        className="mermaid-flowchart-panel"
      >
        {blocks.map((block) => {
          const rendered = renderedFlowcharts[block.index];

          return (
            <section className="mermaid-flowchart-card" key={block.index}>
              <div className="mermaid-flowchart-preview-shell">
                {rendered?.svg ? (
                  <button
                    aria-label={text("flowchart.openPreview", {
                      index: block.index + 1,
                    })}
                    className="mermaid-flowchart-preview"
                    data-testid={`mermaid-flowchart-preview-${block.index}`}
                    onClick={() => {
                      setActivePreviewIndex(block.index);
                      setPreviewScale(1);
                    }}
                    type="button"
                  >
                    <span
                      dangerouslySetInnerHTML={{ __html: rendered.svg }}
                      className="mermaid-flowchart-svg"
                    />
                  </button>
                ) : (
                  <div
                    className="mermaid-flowchart-preview"
                    data-testid={`mermaid-flowchart-preview-${block.index}`}
                  >
                    {rendered?.errorMessage ? (
                      <p className="mermaid-flowchart-error" role="alert">
                        {rendered.errorMessage}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
              <label className="mermaid-flowchart-source-label">
                <span>
                  {text("flowchart.source", { index: block.index + 1 })}
                </span>
                <textarea
                  aria-label={text("flowchart.source", {
                    index: block.index + 1,
                  })}
                  className="mermaid-flowchart-source"
                  disabled={isReadOnly}
                  onChange={(event) => {
                    onMarkdownChange(
                      replaceMermaidBlockSource(
                        markdown,
                        block.index,
                        event.currentTarget.value,
                      ),
                    );
                  }}
                  spellCheck={false}
                  value={block.source}
                />
              </label>
            </section>
          );
        })}
      </aside>
      {activePreviewIndex !== null &&
      renderedFlowcharts[activePreviewIndex]?.svg ? (
        <div
          aria-label={text("flowchart.previewDialog")}
          aria-modal="true"
          className="mermaid-flowchart-dialog-backdrop"
          role="dialog"
        >
          <section className="mermaid-flowchart-dialog">
            <div className="mermaid-flowchart-dialog-toolbar">
              <button
                onClick={() => {
                  setPreviewScale((currentValue) =>
                    Math.max(0.5, currentValue - 0.25),
                  );
                }}
                type="button"
              >
                {text("flowchart.zoomOut")}
              </button>
              <button
                onClick={() => {
                  setPreviewScale(1);
                }}
                type="button"
              >
                {text("flowchart.resetZoom")}
              </button>
              <button
                onClick={() => {
                  setPreviewScale((currentValue) =>
                    Math.min(2.5, currentValue + 0.25),
                  );
                }}
                type="button"
              >
                {text("flowchart.zoomIn")}
              </button>
              <button
                aria-label={text("flowchart.closePreview")}
                onClick={() => {
                  setActivePreviewIndex(null);
                }}
                type="button"
              >
                {text("common.close")}
              </button>
            </div>
            <div className="mermaid-flowchart-dialog-viewport">
              <div
                dangerouslySetInnerHTML={{
                  __html: renderedFlowcharts[activePreviewIndex]?.svg ?? "",
                }}
                className="mermaid-flowchart-dialog-preview"
                data-testid="mermaid-flowchart-dialog-preview"
                style={
                  {
                    "--flowchart-preview-scale": String(previewScale),
                  } as CSSProperties
                }
              />
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
};
