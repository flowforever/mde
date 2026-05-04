const SEARCH_EXCLUDED_DERIVED_CONTENT_SELECTOR = [
  ".mermaid-flowchart-card",
  ".mermaid-flowchart-host",
  ".mermaid-flowchart-inline-card",
  ".mermaid-flowchart-inline-target",
].join(",");

const isEditorSearchNodeExcluded = (node: Node): boolean => {
  const element = node instanceof Element ? node : node.parentElement;

  return Boolean(
    element?.closest(SEARCH_EXCLUDED_DERIVED_CONTENT_SELECTOR),
  );
};

export const isEditorSearchMutationRelevant = (
  mutations: readonly MutationRecord[],
): boolean =>
  mutations.some((mutation) => {
    if (isEditorSearchNodeExcluded(mutation.target)) {
      return false;
    }

    if (mutation.type === "childList") {
      const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];

      if (changedNodes.length > 0) {
        return changedNodes.some((node) => !isEditorSearchNodeExcluded(node));
      }
    }

    return !isEditorSearchNodeExcluded(mutation.target);
  });

export const createSearchRanges = (
  container: HTMLElement,
  query: string,
): readonly Range[] => {
  const normalizedQuery = query.trim();

  if (normalizedQuery.length === 0) {
    return [];
  }

  const lowerQuery = normalizedQuery.toLocaleLowerCase();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const ranges: Range[] = [];
  let node = walker.nextNode();

  while (node) {
    if (isEditorSearchNodeExcluded(node)) {
      node = walker.nextNode();
      continue;
    }

    const text = node.textContent ?? "";
    const lowerText = text.toLocaleLowerCase();
    let index = lowerText.indexOf(lowerQuery);

    while (index !== -1) {
      const range = document.createRange();

      range.setStart(node, index);
      range.setEnd(node, index + normalizedQuery.length);
      ranges.push(range);
      index = lowerText.indexOf(lowerQuery, index + normalizedQuery.length);
    }

    node = walker.nextNode();
  }

  return ranges;
};
