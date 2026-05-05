import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { APP_THEMES } from "../../src/renderer/src/theme/appThemes";

const REQUIRED_THEME_TOKENS = [
  "app-bg",
  "app-text",
  "danger",
  "danger-strong",
  "editor-accent",
  "editor-bg",
  "editor-border",
  "editor-border-strong",
  "editor-muted",
  "editor-muted-subtle",
  "editor-surface",
  "editor-surface-hover",
  "editor-surface-pressed",
  "editor-surface-strong",
  "editor-text",
  "focus-ring",
  "panel-active-bg",
  "panel-active-border",
  "panel-bg",
  "panel-border",
  "panel-border-strong",
  "panel-disabled",
  "panel-input-bg",
  "panel-muted",
  "panel-muted-subtle",
  "panel-surface",
  "panel-surface-hover",
  "panel-surface-strong",
  "panel-text",
  "panel-text-strong",
  "warning",
] as const;

const readThemeCss = (): Promise<string> =>
  readFile(resolve("apps/desktop/src/renderer/src/styles/theme.css"), "utf8");

const normalizeHexColor = (hexColor: string): string => hexColor.toLowerCase();

const getThemeBlock = (css: string, themeId: string): string => {
  const selector = `.app-shell[data-theme="${themeId}"]`;
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockPattern = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`);
  const match = blockPattern.exec(css);

  if (!match) {
    throw new Error(`Missing CSS block for ${selector}`);
  }

  return match[1];
};

const getThemeTokens = (css: string, themeId: string): Record<string, string> =>
  Object.fromEntries(
    [...getThemeBlock(css, themeId).matchAll(/--([\w-]+):\s*([^;]+);/g)].map(
      (match) => [match[1], match[2].trim()],
    ),
  );

const parseHexColor = (hexColor: string): readonly [number, number, number] => {
  const normalizedHexColor = hexColor.trim().replace("#", "");

  if (!/^[0-9a-fA-F]{6}$/.test(normalizedHexColor)) {
    throw new Error(`Expected a six-digit hex color, received ${hexColor}`);
  }

  return [
    Number.parseInt(normalizedHexColor.slice(0, 2), 16) / 255,
    Number.parseInt(normalizedHexColor.slice(2, 4), 16) / 255,
    Number.parseInt(normalizedHexColor.slice(4, 6), 16) / 255,
  ];
};

const toLinearChannel = (channel: number): number =>
  channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;

const getRelativeLuminance = (hexColor: string): number => {
  const [red, green, blue] = parseHexColor(hexColor).map(toLinearChannel);

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const getContrastRatio = (firstColor: string, secondColor: string): number => {
  const firstLuminance = getRelativeLuminance(firstColor);
  const secondLuminance = getRelativeLuminance(secondColor);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
};

describe("app theme CSS tokens", () => {
  it("defines a complete token block for every selectable app theme", async () => {
    const css = await readThemeCss();

    APP_THEMES.forEach((theme) => {
      const tokens = getThemeTokens(css, theme.id);

      REQUIRED_THEME_TOKENS.forEach((tokenName) => {
        expect(
          tokens[tokenName],
          `${theme.id} should define --${tokenName}`,
        ).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });
  });

  it("keeps theme picker swatches aligned with the rendered theme tokens", async () => {
    const css = await readThemeCss();

    APP_THEMES.forEach((theme) => {
      const tokens = getThemeTokens(css, theme.id);
      const renderedTokenValues = new Set(
        [
          tokens["editor-bg"],
          tokens["panel-bg"],
          tokens["editor-surface"],
          tokens["editor-surface-hover"],
          tokens["editor-surface-strong"],
          tokens["editor-accent"],
        ].map(normalizeHexColor),
      );

      expect(theme.swatches.at(0)?.toLowerCase()).toBe(
        normalizeHexColor(tokens["editor-bg"]),
      );
      expect(theme.swatches.at(1)?.toLowerCase()).toBe(
        normalizeHexColor(tokens["panel-bg"]),
      );
      expect(theme.swatches.at(-1)?.toLowerCase()).toBe(
        normalizeHexColor(tokens["editor-accent"]),
      );
      theme.swatches.forEach((swatch) => {
        expect(
          renderedTokenValues.has(normalizeHexColor(swatch)),
          `${theme.id} swatch ${swatch} should come from rendered tokens`,
        ).toBe(true);
      });
    });
  });

  it("keeps text, metadata, focus, and filled accent states readable", async () => {
    const css = await readThemeCss();

    APP_THEMES.forEach((theme) => {
      const tokens = getThemeTokens(css, theme.id);

      expect(
        getContrastRatio(tokens["editor-text"], tokens["editor-bg"]),
        `${theme.id} editor body text should meet enhanced reading contrast`,
      ).toBeGreaterThanOrEqual(7);
      expect(
        getContrastRatio(tokens["editor-muted"], tokens["editor-bg"]),
        `${theme.id} muted editor text should meet AA contrast`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        getContrastRatio(tokens["panel-text"], tokens["panel-bg"]),
        `${theme.id} panel text should meet enhanced reading contrast`,
      ).toBeGreaterThanOrEqual(7);
      expect(
        getContrastRatio(tokens["panel-muted"], tokens["panel-bg"]),
        `${theme.id} muted panel text should meet AA contrast`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        getContrastRatio(tokens["editor-accent"], tokens["editor-bg"]),
        `${theme.id} filled accent states use editor bg as foreground`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        getContrastRatio(tokens["focus-ring"], tokens["editor-bg"]),
        `${theme.id} focus ring should remain visible on editor paper`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        normalizeHexColor(tokens.warning),
        `${theme.id} warning/search marker should not collapse into accent`,
      ).not.toBe(normalizeHexColor(tokens["editor-accent"]));
    });
  });

  it("keeps document, technical, and panel surfaces separated enough to scan", async () => {
    const css = await readThemeCss();

    APP_THEMES.forEach((theme) => {
      const tokens = getThemeTokens(css, theme.id);

      expect(
        getContrastRatio(tokens["editor-surface-strong"], tokens["editor-bg"]),
        `${theme.id} technical editor surface should stand off from document paper`,
      ).toBeGreaterThanOrEqual(1.08);
      expect(
        getContrastRatio(tokens["panel-surface"], tokens["panel-bg"]),
        `${theme.id} panel controls should stand off from the panel rail`,
      ).toBeGreaterThanOrEqual(1.1);
      expect(
        getContrastRatio(tokens["panel-bg"], tokens["editor-bg"]),
        `${theme.id} panel and editor planes should be visually distinct`,
      ).toBeGreaterThanOrEqual(
        theme.family === "light" && theme.panelFamily === "dark" ? 6 : 1.1,
      );
    });
  });
});
