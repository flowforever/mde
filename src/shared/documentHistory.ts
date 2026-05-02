export const DOCUMENT_HISTORY_EVENTS = [
  'manual-save',
  'autosave',
  'ai-write',
  'rename',
  'delete',
  'restore',
  'external-delete'
] as const

export type DocumentHistoryEvent = (typeof DOCUMENT_HISTORY_EVENTS)[number]

export const DOCUMENT_HISTORY_EVENT_LABEL_KEYS = Object.freeze({
  autosave: 'history.event.autosave',
  delete: 'history.event.delete',
  'external-delete': 'history.event.externalDelete',
  'ai-write': 'history.event.aiWrite',
  'manual-save': 'history.event.manualSave',
  rename: 'history.event.rename',
  restore: 'history.event.restore'
} satisfies Record<DocumentHistoryEvent, string>)

export type DocumentHistoryFilterId = 'all' | 'saves' | 'ai' | 'delete'

export const DOCUMENT_HISTORY_FILTERS = Object.freeze([
  Object.freeze({ id: 'all', labelKey: 'history.filter.all' }),
  Object.freeze({ id: 'saves', labelKey: 'history.filter.saves' }),
  Object.freeze({ id: 'ai', labelKey: 'history.filter.ai' }),
  Object.freeze({ id: 'delete', labelKey: 'history.filter.delete' })
] satisfies readonly {
  readonly id: DocumentHistoryFilterId
  readonly labelKey: string
}[])

export interface DocumentHistoryEntry {
  readonly byteLength: number
  readonly createdAt: string
  readonly documentId: string
  readonly event: DocumentHistoryEvent
  readonly id: string
  readonly path: string
}

export interface DocumentHistoryVersion extends DocumentHistoryEntry {
  readonly blobHash: string
  readonly previousPath?: string
  readonly sourceVersionId?: string
}

export interface DeletedDocumentHistoryEntry {
  readonly deletedAt: string
  readonly documentId: string
  readonly latestVersionId: string
  readonly path: string
  readonly reason: 'deleted-in-mde' | 'deleted-outside-mde'
  readonly versionCount: number
}

export interface DocumentHistoryPreview {
  readonly contents: string
  readonly version: DocumentHistoryVersion
}

const DOCUMENT_HISTORY_EVENT_SET: ReadonlySet<string> = new Set(
  DOCUMENT_HISTORY_EVENTS
)

export const isDocumentHistoryEvent = (
  value: unknown
): value is DocumentHistoryEvent =>
  typeof value === 'string' && DOCUMENT_HISTORY_EVENT_SET.has(value)
