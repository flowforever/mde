import type { Block } from "@blocknote/core";

interface SupportedCodeLanguage {
  aliases?: string[];
  readonly name: string;
}

export const SUPPORTED_CODE_LANGUAGES: Record<string, SupportedCodeLanguage> = {
  bash: { aliases: ["sh", "shell", "zsh"], name: "Bash" },
  css: { name: "CSS" },
  html: { name: "HTML" },
  javascript: { aliases: ["js"], name: "JavaScript" },
  json: { name: "JSON" },
  markdown: { aliases: ["md"], name: "Markdown" },
  mermaid: { name: "Mermaid" },
  python: { aliases: ["py"], name: "Python" },
  text: { aliases: ["plaintext", "txt"], name: "Plain text" },
  tsx: { name: "TSX" },
  typescript: { aliases: ["ts"], name: "TypeScript" },
  yaml: { aliases: ["yml"], name: "YAML" },
};

const codeLanguageAliasMap = new Map<string, string>(
  Object.entries(SUPPORTED_CODE_LANGUAGES).flatMap(([languageId, config]) =>
    (config.aliases ?? []).map((alias) => [alias, languageId]),
  ),
);

export const normalizeCodeBlockLanguageId = (languageId: string): string =>
  codeLanguageAliasMap.get(languageId) ?? languageId;

const normalizeChildren = (
  children: Block[] | undefined,
): { readonly children: Block[] | undefined; readonly changed: boolean } => {
  if (!children) {
    return { changed: false, children };
  }

  let changed = false;
  const normalizedChildren = children.map((child) => {
    const normalizedChild = normalizeImportedCodeBlock(child);

    if (normalizedChild !== child) {
      changed = true;
    }

    return normalizedChild;
  });

  return { changed, children: normalizedChildren };
};

const normalizeImportedCodeBlock = (block: Block): Block => {
  const normalizedChildren = normalizeChildren(block.children);

  if (block.type !== "codeBlock") {
    return normalizedChildren.changed
      ? { ...block, children: normalizedChildren.children ?? block.children }
      : block;
  }

  const language = block.props.language;
  const normalizedLanguage =
    typeof language === "string" ? normalizeCodeBlockLanguageId(language) : language;
  const hasNormalizedLanguage = normalizedLanguage !== language;

  if (!normalizedChildren.changed && !hasNormalizedLanguage) {
    return block;
  }

  return {
    ...block,
    children: normalizedChildren.children ?? block.children,
    props: {
      ...block.props,
      language: normalizedLanguage,
    },
  };
};

export const normalizeImportedCodeBlockLanguages = (
  blocks: readonly Block[],
): readonly Block[] =>
  blocks.map(normalizeImportedCodeBlock);
