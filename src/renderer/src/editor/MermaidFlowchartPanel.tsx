import { useEffect, useId, useMemo, useState } from 'react'

import {
  extractMermaidBlocks,
  replaceMermaidBlockSource
} from './flowchartMarkdown'

interface MermaidFlowchartPanelProps {
  readonly markdown: string
  readonly onMarkdownChange: (contents: string) => void
}

interface RenderedFlowchart {
  readonly errorMessage: string | null
  readonly svg: string | null
}

interface MermaidApi {
  readonly initialize: (options: {
    readonly securityLevel: 'strict'
    readonly startOnLoad: boolean
    readonly theme: 'neutral'
  }) => void
  readonly render: (
    id: string,
    source: string
  ) => Promise<{ readonly svg: string }> | { readonly svg: string }
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unable to render flowchart'

const loadMermaid = async (): Promise<MermaidApi> => {
  const mermaidModule = (await import('mermaid')) as unknown as {
    readonly default?: MermaidApi
  } & MermaidApi

  return mermaidModule.default ?? mermaidModule
}

export const MermaidFlowchartPanel = ({
  markdown,
  onMarkdownChange
}: MermaidFlowchartPanelProps): React.JSX.Element | null => {
  const idPrefix = useId().replaceAll(':', '-')
  const blocks = useMemo(() => extractMermaidBlocks(markdown), [markdown])
  const [renderedFlowcharts, setRenderedFlowcharts] = useState<
    readonly RenderedFlowchart[]
  >([])

  useEffect(() => {
    let isCurrent = true

    const renderFlowcharts = async (): Promise<void> => {
      if (blocks.length === 0) {
        setRenderedFlowcharts([])
        return
      }

      try {
        const mermaid = await loadMermaid()

        mermaid.initialize({
          securityLevel: 'strict',
          startOnLoad: false,
          theme: 'neutral'
        })

        const results = await Promise.all(
          blocks.map(async (block) => {
            try {
              const rendered = await mermaid.render(
                `mde-flowchart-${idPrefix}-${block.index}`,
                block.source
              )

              return {
                errorMessage: null,
                svg: rendered.svg
              }
            } catch (error) {
              return {
                errorMessage: getErrorMessage(error),
                svg: null
              }
            }
          })
        )

        if (isCurrent) {
          setRenderedFlowcharts(results)
        }
      } catch (error) {
        if (isCurrent) {
          setRenderedFlowcharts(
            blocks.map(() => ({
              errorMessage: getErrorMessage(error),
              svg: null
            }))
          )
        }
      }
    }

    void renderFlowcharts()

    return () => {
      isCurrent = false
    }
  }, [blocks, idPrefix])

  if (blocks.length === 0) {
    return null
  }

  return (
    <aside aria-label="Flowcharts" className="mermaid-flowchart-panel">
      {blocks.map((block) => {
        const rendered = renderedFlowcharts[block.index]

        return (
          <section className="mermaid-flowchart-card" key={block.index}>
            <div className="mermaid-flowchart-preview-shell">
              <div
                className="mermaid-flowchart-preview"
                data-testid={`mermaid-flowchart-preview-${block.index}`}
              >
                {rendered?.svg ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: rendered.svg }}
                    className="mermaid-flowchart-svg"
                  />
                ) : rendered?.errorMessage ? (
                  <p className="mermaid-flowchart-error" role="alert">
                    {rendered.errorMessage}
                  </p>
                ) : null}
              </div>
            </div>
            <label className="mermaid-flowchart-source-label">
              <span>Mermaid source {block.index + 1}</span>
              <textarea
                aria-label={`Mermaid source ${block.index + 1}`}
                className="mermaid-flowchart-source"
                onChange={(event) => {
                  onMarkdownChange(
                    replaceMermaidBlockSource(
                      markdown,
                      block.index,
                      event.currentTarget.value
                    )
                  )
                }}
                spellCheck={false}
                value={block.source}
              />
            </label>
          </section>
        )
      })}
    </aside>
  )
}
