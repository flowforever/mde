import type { TreeNode } from './fileTree'
import type {
  EditorDocumentRef,
  EditorHost,
  EditorHostCapabilities,
  EditorHostResult,
  EditorSaveReason
} from './types'

const defaultCapabilities: EditorHostCapabilities = {
  canCreateLinkedDocument: true,
  canOpenLinks: true,
  canUploadImages: true,
  hasWorkspaceTree: true
}

export interface FakeEditorHostOptions {
  readonly capabilities?: Partial<EditorHostCapabilities>
  readonly documents?: Readonly<Record<string, string>>
  readonly now?: () => string
  readonly workspaceTree?: readonly TreeNode[]
}

export interface FakeEditorHostSaveEvent {
  readonly document: EditorDocumentRef
  readonly markdown: string
  readonly reason: EditorSaveReason
  readonly savedAt: string
}

export interface FakeEditorHost extends EditorHost {
  readonly openedLinks: readonly string[]
  readonly readDocument: (path: string) => string | undefined
  readonly saveEvents: readonly FakeEditorHostSaveEvent[]
}

const ok = <T>(value: T): EditorHostResult<T> =>
  Object.freeze({
    ok: true,
    value
  })

const getWorkspaceRoot = (document: EditorDocumentRef): string =>
  document.workspaceRoot ?? ''

const createAssetPath = (fileName: string): string => `assets/${fileName}`

export const createFakeEditorHost = (
  options: FakeEditorHostOptions = {}
): FakeEditorHost => {
  let documents = Object.freeze({ ...(options.documents ?? {}) })
  let openedLinks: readonly string[] = []
  let saveEvents: readonly FakeEditorHostSaveEvent[] = []
  const capabilities = Object.freeze({
    ...defaultCapabilities,
    ...(options.capabilities ?? {})
  })
  const now = options.now ?? (() => new Date().toISOString())
  const workspaceTree = Object.freeze([...(options.workspaceTree ?? [])])

  return {
    capabilities,
    get openedLinks() {
      return openedLinks
    },
    get saveEvents() {
      return saveEvents
    },
    createLinkedDocument: ({ requestedPath }) => {
      documents = Object.freeze({
        ...documents,
        [requestedPath]: documents[requestedPath] ?? ''
      })

      return Promise.resolve(ok({ path: requestedPath }))
    },
    getWorkspaceTree: (document) =>
      Promise.resolve(ok({
        rootPath: getWorkspaceRoot(document),
        tree: workspaceTree
      })),
    openLink: ({ href }) => {
      openedLinks = Object.freeze([...openedLinks, href])

      return Promise.resolve(ok(undefined))
    },
    readDocument: (path) => documents[path],
    saveDocument: ({ document, markdown, reason }) => {
      const savedAt = now()

      documents = Object.freeze({
        ...documents,
        [document.path]: markdown
      })
      saveEvents = Object.freeze([
        ...saveEvents,
        Object.freeze({
          document: Object.freeze({ ...document }),
          markdown,
          reason,
          savedAt
        })
      ])

      return Promise.resolve(ok({
        normalizedMarkdown: markdown,
        savedAt
      }))
    },
    uploadImage: ({ fileName }) =>
      Promise.resolve(ok({
        src: createAssetPath(fileName)
      }))
  }
}
