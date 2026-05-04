import { createHighlighter, createJavaScriptRegexEngine } from "shiki";

import { SUPPORTED_CODE_LANGUAGES } from "./codeBlockLanguages";

export const LIGHT_EDITOR_CODE_THEME = "github-light";
export const DARK_EDITOR_CODE_THEME = "github-dark";

export type EditorCodeTheme =
  | typeof LIGHT_EDITOR_CODE_THEME
  | typeof DARK_EDITOR_CODE_THEME;

type EditorCodeHighlighter = Awaited<ReturnType<typeof createHighlighter>>;
type HighlighterMethod = (...args: unknown[]) => unknown;

export const getEditorCodeThemeForThemeFamily = (
  themeFamily: string | null | undefined,
): EditorCodeTheme =>
  themeFamily === "dark" ? DARK_EDITOR_CODE_THEME : LIGHT_EDITOR_CODE_THEME;

const getCurrentEditorCodeTheme = (): EditorCodeTheme => {
  const appShell = globalThis.document?.querySelector?.(".app-shell");

  return getEditorCodeThemeForThemeFamily(
    appShell?.getAttribute?.("data-theme-family") ?? null,
  );
};

export const createEditorCodeHighlighter =
  async (): Promise<EditorCodeHighlighter> => {
    const highlighter = await createHighlighter({
      engine: createJavaScriptRegexEngine(),
      langs: Object.keys(SUPPORTED_CODE_LANGUAGES),
      themes: [LIGHT_EDITOR_CODE_THEME, DARK_EDITOR_CODE_THEME],
    });

    return new Proxy<EditorCodeHighlighter>(highlighter, {
      get(target, property, receiver): unknown {
        if (property === "getLoadedThemes") {
          const getLoadedThemes: EditorCodeHighlighter["getLoadedThemes"] =
            () => [getCurrentEditorCodeTheme()];

          return getLoadedThemes;
        }

        const value = Reflect.get(target, property, receiver) as unknown;

        return typeof value === "function"
          ? (...args: unknown[]) =>
              (value as HighlighterMethod).apply(target, args)
          : value;
      },
    });
  };
