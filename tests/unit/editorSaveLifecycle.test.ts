import { describe, expect, it } from 'vitest'

import {
  chooseMarkdownContentsToSave,
  shouldClearLocalChangesAfterUnchangedSave,
  shouldRetryUnchangedSave
} from '../../apps/desktop/src/renderer/src/editor/editorSaveLifecycle'

describe('editor save lifecycle helpers', () => {
  it('preserves the latest non-empty draft when serialization returns empty markdown', () => {
    expect(
      chooseMarkdownContentsToSave({
        currentMarkdown: '# Persisted',
        lastSerializedEditorMarkdown: '# Draft',
        latestDraftMarkdown: '# Draft',
        serializedMarkdown: ''
      })
    ).toBe('# Draft')
  })

  it('uses the latest draft when serialization matches current markdown but app state has unsaved content', () => {
    expect(
      chooseMarkdownContentsToSave({
        currentMarkdown: '# Persisted',
        lastSerializedEditorMarkdown: '# Persisted',
        latestDraftMarkdown: '# Persisted\n\nUnsaved',
        serializedMarkdown: '# Persisted'
      })
    ).toBe('# Persisted\n\nUnsaved')
  })

  it('uses serialized markdown when it contains the actual editor change', () => {
    expect(
      chooseMarkdownContentsToSave({
        currentMarkdown: '# Persisted',
        lastSerializedEditorMarkdown: '# Persisted',
        latestDraftMarkdown: '# Persisted',
        serializedMarkdown: '# Persisted\n\nEditor change'
      })
    ).toBe('# Persisted\n\nEditor change')
  })

  it('decides retry and local-change clearing for unchanged blur saves', () => {
    expect(
      shouldRetryUnchangedSave({
        contentsToSave: '# Persisted',
        currentMarkdown: '# Persisted',
        preserveLocalChangesWhenUnchanged: true,
        retryUnchangedCount: 2
      })
    ).toBe(true)
    expect(
      shouldClearLocalChangesAfterUnchangedSave({
        preserveLocalChangesWhenUnchanged: true
      })
    ).toBe(false)
    expect(
      shouldClearLocalChangesAfterUnchangedSave({
        preserveLocalChangesWhenUnchanged: false
      })
    ).toBe(true)
  })
})
