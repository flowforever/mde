import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  Maximize2,
  Minimize2,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  areSameInlineFlowchartTargets,
  EDITOR_COMPONENT_IDS as COMPONENT_IDS,
  getNextMissingInlineFlowchartTargets,
  type EditorText,
  type InlineFlowchartTargets,
} from "@mde/editor-react";

import { extractMermaidBlocks } from "@mde/editor-core/flowcharts";
import type { MermaidBlockReference as MermaidBlock } from "@mde/editor-core/types";
interface MermaidFlowchartPanelProps {
  readonly colorScheme: "dark" | "light";
  readonly markdown: string;
  readonly text: EditorText;
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

interface PreviewDragState {
  readonly originX: number;
  readonly originY: number;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
}

interface PreviewPan {
  readonly x: number;
  readonly y: number;
}

type PreviewDialogViewMode = "centered" | "full";

const INLINE_TARGET_SELECTOR =
  ".markdown-editor-surface .mermaid-flowchart-inline-target";
const PREVIEW_MIN_SCALE = 0.5;
const PREVIEW_MAX_SCALE = 2.5;
const PREVIEW_SCALE_STEP = 0.25;

const clampPreviewScale = (scale: number): number =>
  Math.min(PREVIEW_MAX_SCALE, Math.max(PREVIEW_MIN_SCALE, scale));

const isSelectableFlowchartText = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  Boolean(target.closest("text, tspan, foreignObject, .nodeLabel"));

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const loadMermaid = async (): Promise<MermaidApi> => {
  const mermaidModule = (await import("mermaid")) as unknown as {
    readonly default?: MermaidApi;
  } & MermaidApi;

  return mermaidModule.default ?? mermaidModule;
};

const findInlineFlowchartTargets = (
  root: ParentNode,
  blocks: readonly MermaidBlock[],
): {
  readonly targetCount: number;
  readonly targets: readonly HTMLElement[];
} => {
  const previewTargets = Array.from(
    root.querySelectorAll<HTMLElement>(INLINE_TARGET_SELECTOR),
  );

  return {
    targetCount: previewTargets.length,
    targets: previewTargets.slice(0, blocks.length),
  };
};

export const MermaidFlowchartPanel = ({
  colorScheme,
  markdown,
  text,
}: MermaidFlowchartPanelProps): React.JSX.Element | null => {
  const idPrefix = useId().replaceAll(":", "-");
  const hostRef = useRef<HTMLSpanElement | null>(null);
  const dialogViewportRef = useRef<HTMLDivElement | null>(null);
  const previewDragRef = useRef<PreviewDragState | null>(null);
  const blocks = useMemo(() => extractMermaidBlocks(markdown), [markdown]);
  const [inlineTargets, setInlineTargets] =
    useState<InlineFlowchartTargets | null>(null);
  const [renderedFlowcharts, setRenderedFlowcharts] = useState<
    readonly RenderedFlowchart[]
  >([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState<number | null>(
    null,
  );
  const [previewScale, setPreviewScale] = useState(1);
  const [previewPan, setPreviewPan] = useState<PreviewPan>({ x: 0, y: 0 });
  const [previewViewMode, setPreviewViewMode] =
    useState<PreviewDialogViewMode>("centered");
  const [isPreviewDragging, setIsPreviewDragging] = useState(false);

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

  useEffect(() => {
    if (blocks.length === 0) {
      setInlineTargets(null);
      return undefined;
    }

    const host = hostRef.current;
    const root =
      host?.closest<HTMLElement>(".markdown-editor-root") ??
      host?.ownerDocument.body ??
      document.body;
    let isDisposed = false;
    let animationFrame: number | null = null;
    let retryTimeout: number | null = null;
    const syncInlineTargets = (): void => {
      if (isDisposed) {
        return;
      }

      const { targetCount, targets } = findInlineFlowchartTargets(
        root,
        blocks,
      );

      if (targets.length !== blocks.length) {
        const hasCodeBlocks = targetCount > 0;

        setInlineTargets((currentTargets) =>
          getNextMissingInlineFlowchartTargets(currentTargets, hasCodeBlocks),
        );
        retryTimeout = window.setTimeout(scheduleSyncInlineTargets, 100);
        return;
      }

      const nextTargets = targets.map((target, index) => {
        const block = blocks[index];

        return { blockIndex: block.index, element: target };
      });

      setInlineTargets((currentTargets) =>
        currentTargets?.hasCodeBlocks === true &&
        areSameInlineFlowchartTargets(currentTargets.targets, nextTargets)
          ? currentTargets
          : {
              hasCodeBlocks: true,
              targets: nextTargets,
            },
      );
    };

    const scheduleSyncInlineTargets = (): void => {
      if (animationFrame !== null) {
        return;
      }

      if (retryTimeout !== null) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
      }

      animationFrame = requestAnimationFrame(() => {
        animationFrame = null;
        syncInlineTargets();
      });
    };

    const observer = new MutationObserver(scheduleSyncInlineTargets);

    observer.observe(root, { childList: true, subtree: true });
    scheduleSyncInlineTargets();

    return () => {
      isDisposed = true;
      observer.disconnect();

      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }

      if (retryTimeout !== null) {
        clearTimeout(retryTimeout);
      }
    };
  }, [blocks]);

  const updatePreviewScale = useCallback((delta: number): void => {
    setPreviewScale((currentValue) =>
      clampPreviewScale(currentValue + delta),
    );
  }, []);

  const resetPreviewTransform = (): void => {
    setPreviewScale(1);
    setPreviewPan({ x: 0, y: 0 });
  };

  const handleDialogWheel = useCallback((event: WheelEvent): void => {
    event.preventDefault();

    if (event.ctrlKey) {
      updatePreviewScale(
        event.deltaY < 0 ? PREVIEW_SCALE_STEP : -PREVIEW_SCALE_STEP,
      );
      return;
    }

    setPreviewPan((currentPan) => ({
      x: currentPan.x - event.deltaX,
      y: currentPan.y - event.deltaY,
    }));
  }, [updatePreviewScale]);

  useEffect(() => {
    if (activePreviewIndex === null) {
      return undefined;
    }

    const dialogViewport = dialogViewportRef.current;

    if (!dialogViewport) {
      return undefined;
    }

    dialogViewport.addEventListener("wheel", handleDialogWheel, {
      passive: false,
    });

    return () => {
      dialogViewport.removeEventListener("wheel", handleDialogWheel);
    };
  }, [activePreviewIndex, handleDialogWheel]);

  const handleDialogPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ): void => {
    if (
      (typeof event.button === "number" && event.button !== 0) ||
      isSelectableFlowchartText(event.target)
    ) {
      return;
    }

    previewDragRef.current = {
      originX: previewPan.x,
      originY: previewPan.y,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setIsPreviewDragging(true);
    event.preventDefault();
  };

  const handleDialogPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ): void => {
    const dragState = previewDragRef.current;

    if (dragState?.pointerId !== event.pointerId) {
      return;
    }

    setPreviewPan({
      x: dragState.originX + event.clientX - dragState.startX,
      y: dragState.originY + event.clientY - dragState.startY,
    });
    event.preventDefault();
  };

  const endDialogPointerDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
  ): void => {
    const dragState = previewDragRef.current;

    if (dragState?.pointerId !== event.pointerId) {
      return;
    }

    previewDragRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsPreviewDragging(false);
  };

  if (blocks.length === 0) {
    return null;
  }

  const renderFlowchartCard = (block: MermaidBlock): React.JSX.Element => {
    const rendered = renderedFlowcharts[block.index];

    return (
      <section
        aria-label={text("flowchart.label")}
        className="mermaid-flowchart-card"
        data-component-id={COMPONENT_IDS.flowchart.previewCard}
        key={block.index}
      >
        <div className="mermaid-flowchart-preview-shell">
          {rendered?.svg ? (
            <button
              aria-label={text("flowchart.openPreview", {
                index: block.index + 1,
              })}
              className="mermaid-flowchart-preview"
              data-component-id={COMPONENT_IDS.flowchart.previewButton}
              data-testid={`mermaid-flowchart-preview-${block.index}`}
              onClick={() => {
                setActivePreviewIndex(block.index);
                setPreviewViewMode("centered");
                resetPreviewTransform();
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
              data-component-id={COMPONENT_IDS.flowchart.errorState}
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
      </section>
    );
  };

  return (
    <>
      <span
        aria-hidden="true"
        className="mermaid-flowchart-host"
        ref={hostRef}
      />
      {inlineTargets?.hasCodeBlocks === true
        ? inlineTargets.targets.map((target) => {
            const block = blocks.find(
              (candidateBlock) => candidateBlock.index === target.blockIndex,
            );

            return block
              ? createPortal(
                  <div
                    className="mermaid-flowchart-inline-card"
                    contentEditable={false}
                  >
                    {renderFlowchartCard(block)}
                  </div>,
                  target.element,
                  `mermaid-flowchart-inline-${target.blockIndex}`,
                )
              : null;
          })
        : null}
      {inlineTargets?.hasCodeBlocks === false ? (
        <aside
          aria-label={text("flowchart.label")}
          className="mermaid-flowchart-panel"
        >
          {blocks.map(renderFlowchartCard)}
        </aside>
      ) : null}
      {activePreviewIndex !== null &&
      renderedFlowcharts[activePreviewIndex]?.svg ? (
        <div
          aria-label={text("flowchart.previewDialog")}
          aria-modal="true"
          className="mermaid-flowchart-dialog-backdrop"
          data-component-id={COMPONENT_IDS.flowchart.previewDialog}
          data-view-mode={previewViewMode}
          role="dialog"
        >
          <section
            className="mermaid-flowchart-dialog"
            data-view-mode={previewViewMode}
          >
            <div
              className="mermaid-flowchart-dialog-toolbar"
              data-component-id={COMPONENT_IDS.flowchart.dialogToolbar}
            >
              <button
                aria-label={text("flowchart.zoomOut")}
                data-component-id={COMPONENT_IDS.flowchart.zoomOutButton}
                onClick={() => {
                  updatePreviewScale(-PREVIEW_SCALE_STEP);
                }}
                title={text("flowchart.zoomOut")}
                type="button"
              >
                <ZoomOut aria-hidden="true" size={16} />
              </button>
              <button
                aria-label={text("flowchart.resetView")}
                data-component-id={COMPONENT_IDS.flowchart.resetViewButton}
                onClick={() => {
                  resetPreviewTransform();
                }}
                title={text("flowchart.resetView")}
                type="button"
              >
                <RotateCcw aria-hidden="true" size={16} />
              </button>
              <button
                aria-label={text("flowchart.zoomIn")}
                data-component-id={COMPONENT_IDS.flowchart.zoomInButton}
                onClick={() => {
                  updatePreviewScale(PREVIEW_SCALE_STEP);
                }}
                title={text("flowchart.zoomIn")}
                type="button"
              >
                <ZoomIn aria-hidden="true" size={16} />
              </button>
              <button
                aria-label={
                  previewViewMode === "centered"
                    ? text("flowchart.useFullPagePreview")
                    : text("flowchart.useCenteredPreview")
                }
                data-component-id={COMPONENT_IDS.flowchart.previewLayoutToggle}
                onClick={() => {
                  setPreviewViewMode((currentMode) =>
                    currentMode === "centered" ? "full" : "centered",
                  );
                }}
                title={
                  previewViewMode === "centered"
                    ? text("flowchart.useFullPagePreview")
                    : text("flowchart.useCenteredPreview")
                }
                type="button"
              >
                {previewViewMode === "centered" ? (
                  <Maximize2 aria-hidden="true" size={16} />
                ) : (
                  <Minimize2 aria-hidden="true" size={16} />
                )}
              </button>
              <button
                aria-label={text("flowchart.closePreview")}
                data-component-id={
                  COMPONENT_IDS.flowchart.closeFlowchartPreviewButton
                }
                onClick={() => {
                  setActivePreviewIndex(null);
                  previewDragRef.current = null;
                  setIsPreviewDragging(false);
                }}
                title={text("flowchart.closePreview")}
                type="button"
              >
                <X aria-hidden="true" size={16} />
              </button>
            </div>
            <div
              className="mermaid-flowchart-dialog-viewport"
              data-component-id={COMPONENT_IDS.flowchart.viewport}
              data-dragging={isPreviewDragging}
              data-testid="mermaid-flowchart-dialog-viewport"
              onPointerCancel={endDialogPointerDrag}
              onPointerDown={handleDialogPointerDown}
              onPointerMove={handleDialogPointerMove}
              onPointerUp={endDialogPointerDrag}
              ref={dialogViewportRef}
            >
              <div
                dangerouslySetInnerHTML={{
                  __html: renderedFlowcharts[activePreviewIndex]?.svg ?? "",
                }}
                className="mermaid-flowchart-dialog-preview"
                data-testid="mermaid-flowchart-dialog-preview"
                style={
                  {
                    "--flowchart-preview-scale": String(previewScale),
                    "--flowchart-preview-pan-x": `${previewPan.x}px`,
                    "--flowchart-preview-pan-y": `${previewPan.y}px`,
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
