export const LEGACY_IMAGE_ASSET_PREFIX = '.mde/assets/'
export const LOCAL_IMAGE_ASSET_PREFIX = 'mde-assets/'

export type DesktopMarkdownAssetPathKind = 'legacy' | 'local'

export interface NormalizedDesktopMarkdownAssetPath {
  readonly kind: DesktopMarkdownAssetPathKind
  readonly markdownPath: string
  readonly storagePath: string
}

const encodedSlashPattern = /%(?:2f|5c)/iu
const unsafeSlashVariantPattern = /[\\\u2044\u2215\u29f8\uff0f]/u
const absolutePathPattern = /^(?:\/|[a-z][a-z0-9+.-]*:)/iu

const decodeMarkdownPath = (value: string): string | null => {
  let current = value

  for (let decodeIndex = 0; decodeIndex < 4; decodeIndex += 1) {
    if (encodedSlashPattern.test(current)) {
      return null
    }

    let decoded: string
    try {
      decoded = decodeURIComponent(current)
    } catch {
      return null
    }

    if (unsafeSlashVariantPattern.test(decoded)) {
      return null
    }

    if (decoded === current) {
      return decoded
    }

    current = decoded
  }

  return null
}

const normalizeStoragePath = (value: string): string | null => {
  const decodedPath = decodeMarkdownPath(value)

  if (!decodedPath || absolutePathPattern.test(decodedPath)) {
    return null
  }

  const segments = decodedPath.split('/')

  if (
    segments.length === 0 ||
    segments.some(
      (segment) => segment.length === 0 || segment === '.' || segment === '..'
    )
  ) {
    return null
  }

  return segments.join('/')
}

export const normalizeLocalMarkdownAssetStoragePath = (
  storagePath: string
): string | null => normalizeStoragePath(storagePath)

export const normalizeDesktopMarkdownAssetPath = (
  markdownPath: string
): NormalizedDesktopMarkdownAssetPath | null => {
  const decodedPath = decodeMarkdownPath(markdownPath)

  if (!decodedPath || absolutePathPattern.test(decodedPath)) {
    return null
  }

  const matchedPrefix = decodedPath.startsWith(LOCAL_IMAGE_ASSET_PREFIX)
    ? { kind: 'local' as const, prefix: LOCAL_IMAGE_ASSET_PREFIX }
    : decodedPath.startsWith(LEGACY_IMAGE_ASSET_PREFIX)
      ? { kind: 'legacy' as const, prefix: LEGACY_IMAGE_ASSET_PREFIX }
      : null

  if (!matchedPrefix) {
    return null
  }

  const storagePath = normalizeStoragePath(
    decodedPath.slice(matchedPrefix.prefix.length)
  )

  return storagePath
    ? Object.freeze({
        kind: matchedPrefix.kind,
        markdownPath: `${matchedPrefix.prefix}${storagePath}`,
        storagePath
      })
    : null
}

export const isDesktopMarkdownAssetPathCandidate = (
  markdownPath: string
): boolean => {
  const decodedPath = decodeMarkdownPath(markdownPath)

  return Boolean(
    markdownPath.startsWith(LOCAL_IMAGE_ASSET_PREFIX) ||
      markdownPath.startsWith(LEGACY_IMAGE_ASSET_PREFIX) ||
      (decodedPath !== null &&
        (decodedPath.startsWith(LOCAL_IMAGE_ASSET_PREFIX) ||
          decodedPath.startsWith(LEGACY_IMAGE_ASSET_PREFIX)))
  )
}
