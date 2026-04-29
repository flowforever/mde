export const EDITOR_VIEW_MODE_STORAGE_KEY = 'mde.editorViewMode'

export type EditorViewMode = 'centered' | 'full-width'

export const readEditorViewMode = (
  storage: Pick<Storage, 'getItem'> = globalThis.localStorage
): EditorViewMode => {
  try {
    return storage.getItem(EDITOR_VIEW_MODE_STORAGE_KEY) === 'full-width'
      ? 'full-width'
      : 'centered'
  } catch {
    return 'centered'
  }
}

export const writeEditorViewMode = (
  storage: Pick<Storage, 'setItem'> = globalThis.localStorage,
  viewMode: EditorViewMode
): void => {
  try {
    storage.setItem(EDITOR_VIEW_MODE_STORAGE_KEY, viewMode)
  } catch {
    // Storage may be unavailable in restricted renderer contexts.
  }
}
