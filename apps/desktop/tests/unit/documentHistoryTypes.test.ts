import { describe, expect, it } from 'vitest'

import {
  DOCUMENT_HISTORY_EVENT_LABEL_KEYS,
  DOCUMENT_HISTORY_FILTERS,
  isDocumentHistoryEvent
} from '../../src/shared/documentHistory'

describe('documentHistory shared types', () => {
  it('recognizes only supported document history events', () => {
    expect(isDocumentHistoryEvent('manual-save')).toBe(true)
    expect(isDocumentHistoryEvent('autosave')).toBe(true)
    expect(isDocumentHistoryEvent('external-delete')).toBe(true)
    expect(isDocumentHistoryEvent('bad-event')).toBe(false)
    expect(isDocumentHistoryEvent(null)).toBe(false)
  })

  it('maps events and filters to app language keys', () => {
    expect(DOCUMENT_HISTORY_EVENT_LABEL_KEYS.delete).toBe('history.event.delete')
    expect(DOCUMENT_HISTORY_EVENT_LABEL_KEYS['external-delete']).toBe(
      'history.event.externalDelete'
    )
    expect(DOCUMENT_HISTORY_FILTERS.map((filter) => filter.id)).toEqual([
      'all',
      'saves',
      'ai',
      'delete'
    ])
  })
})
