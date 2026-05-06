export const EDITOR_SEARCH_HISTORY_STORAGE_KEY = "mde.editorSearchHistory";
export const GLOBAL_SEARCH_HISTORY_STORAGE_KEY = "mde.globalSearchHistory";
export const SEARCH_HISTORY_LIMIT = 12;
export const GLOBAL_SEARCH_HISTORY_LIMIT = 16;
export const PINNED_SEARCH_QUERY_LIMIT = 6;

export type SearchShortcutScope = "editor" | "workspace" | "workspacePath";

const normalizeSearchTerm = (query: string): string => query.trim();

const searchTermKey = (query: string): string =>
  normalizeSearchTerm(query).toLocaleLowerCase();

export const rememberSearchHistoryItem = (
  history: readonly string[],
  query: string,
  limit = SEARCH_HISTORY_LIMIT,
): readonly string[] => {
  const normalizedQuery = normalizeSearchTerm(query);

  if (normalizedQuery.length === 0 || limit <= 0) {
    return history.slice(0, Math.max(limit, 0));
  }

  const normalizedKey = searchTermKey(normalizedQuery);
  const dedupedHistory = history.filter(
    (entry) => searchTermKey(entry) !== normalizedKey,
  );

  return [normalizedQuery, ...dedupedHistory].slice(0, limit);
};

export const filterSearchHistory = (
  history: readonly string[],
  query: string,
): readonly string[] => {
  const normalizedQuery = searchTermKey(query);

  if (normalizedQuery.length === 0) {
    return history;
  }

  return history.filter((entry) => searchTermKey(entry).includes(normalizedQuery));
};

export const togglePinnedSearchQuery = (
  pinnedQueries: readonly string[],
  query: string,
  limit = PINNED_SEARCH_QUERY_LIMIT,
): readonly string[] => {
  const normalizedQuery = normalizeSearchTerm(query);

  if (normalizedQuery.length === 0 || limit <= 0) {
    return pinnedQueries.slice(0, Math.max(limit, 0));
  }

  const normalizedKey = searchTermKey(normalizedQuery);
  const isPinned = pinnedQueries.some(
    (entry) => searchTermKey(entry) === normalizedKey,
  );

  if (isPinned) {
    return pinnedQueries.filter((entry) => searchTermKey(entry) !== normalizedKey);
  }

  return [...pinnedQueries, normalizedQuery].slice(-limit);
};

export const isSearchQueryPinned = (
  pinnedQueries: readonly string[],
  query: string,
): boolean => {
  const normalizedKey = searchTermKey(query);

  return (
    normalizedKey.length > 0 &&
    pinnedQueries.some((entry) => searchTermKey(entry) === normalizedKey)
  );
};

export const readSearchHistory = (
  storageKey: string,
  storage: Pick<Storage, "getItem"> = globalThis.localStorage,
  limit = SEARCH_HISTORY_LIMIT,
): readonly string[] => {
  try {
    const rawValue = storage.getItem(storageKey);

    if (!rawValue) {
      return [];
    }

    const parsedValue: unknown = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .filter((value): value is string => typeof value === "string")
      .map(normalizeSearchTerm)
      .filter((value) => value.length > 0)
      .slice(0, limit);
  } catch {
    return [];
  }
};

export const writeSearchHistory = (
  storageKey: string,
  history: readonly string[],
  storage: Pick<Storage, "setItem"> = globalThis.localStorage,
  limit = SEARCH_HISTORY_LIMIT,
): void => {
  storage.setItem(storageKey, JSON.stringify(history.slice(0, limit)));
};

export const getSearchShortcutLabel = (
  scope: SearchShortcutScope,
  platform = globalThis.navigator?.platform ?? "",
): string => {
  const isMac = /Mac|iPhone|iPad/i.test(platform);

  if (scope === "workspace") {
    return isMac ? "⌘⇧F" : "Ctrl+Shift+F";
  }

  if (scope === "workspacePath") {
    return isMac ? "⌘P" : "Ctrl+P";
  }

  return isMac ? "⌘F" : "Ctrl+F";
};
