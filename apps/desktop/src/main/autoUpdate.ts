import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'

import type { IpcMain, IpcMainInvokeEvent, WebContents } from 'electron'

import { UPDATE_CHANNELS } from './ipc/channels'
import type {
  AvailableUpdate,
  UpdateCheckResult,
  UpdateDownloadProgress,
  UpdateInstallResult
} from '../shared/update'

export const DISABLE_AUTO_UPDATE_ENV = 'MDE_DISABLE_AUTO_UPDATE'
export const APP_VERSION_ENV = 'MDE_TEST_APP_VERSION'
export const FORCE_AUTO_UPDATE_ENV = 'MDE_TEST_FORCE_AUTO_UPDATE'
export const RELEASE_API_URL_ENV = 'MDE_TEST_RELEASE_API_URL'
export const RELEASE_FEED_URL_ENV = 'MDE_TEST_RELEASE_FEED_URL'
export const GITHUB_LATEST_RELEASE_URL =
  'https://api.github.com/repos/flowforever/mde/releases?per_page=20'
export const GITHUB_RELEASES_FEED_URL =
  'https://github.com/flowforever/mde/releases.atom'

const GITHUB_RELEASE_DOWNLOAD_BASE_URL =
  'https://github.com/flowforever/mde/releases/download'

interface AutoUpdateEnvironment {
  readonly [APP_VERSION_ENV]?: string
  readonly [DISABLE_AUTO_UPDATE_ENV]?: string
  readonly [FORCE_AUTO_UPDATE_ENV]?: string
  readonly [RELEASE_API_URL_ENV]?: string
  readonly [RELEASE_FEED_URL_ENV]?: string
}

interface AutoUpdateApp {
  readonly isPackaged: boolean
  readonly whenReady?: () => Promise<unknown>
  readonly getPath: (name: 'userData') => string
  readonly getVersion: () => string
  readonly quit?: () => void
}

interface AutoUpdateClient {
  autoDownload: boolean
  readonly checkForUpdates: () => Promise<unknown>
  readonly on: unknown
  readonly quitAndInstall: (
    isSilent?: boolean,
    isForceRunAfter?: boolean
  ) => void
}

interface AutoUpdateLogger {
  readonly error: (...args: readonly unknown[]) => void
  readonly info: (...args: readonly unknown[]) => void
}

interface DmgAsset {
  readonly name: string
  readonly size: number
  readonly url: string
}

interface ManualUpdateService {
  readonly checkForUpdates: () => Promise<UpdateCheckResult>
  readonly downloadAndOpenUpdate: (
    onProgress?: (progress: UpdateDownloadProgress) => void
  ) => Promise<UpdateInstallResult>
}

interface ShellLike {
  readonly openPath: (path: string) => Promise<string>
}

interface UpdateWebContents {
  readonly send: WebContents['send']
  readonly isDestroyed?: WebContents['isDestroyed']
}

type FetchLike = typeof fetch
type IpcMainLike = Pick<IpcMain, 'handle'>

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isAutoUpdateClient = (value: unknown): value is AutoUpdateClient =>
  isObjectRecord(value) &&
  typeof value.checkForUpdates === 'function' &&
  typeof value.on === 'function' &&
  typeof value.quitAndInstall === 'function'

export const resolveAutoUpdater = (
  electronUpdaterModule: unknown
): AutoUpdateClient | undefined => {
  if (!isObjectRecord(electronUpdaterModule)) {
    return undefined
  }

  if (isAutoUpdateClient(electronUpdaterModule.autoUpdater)) {
    return electronUpdaterModule.autoUpdater
  }

  const defaultExport = electronUpdaterModule.default

  return isObjectRecord(defaultExport) &&
    isAutoUpdateClient(defaultExport.autoUpdater)
    ? defaultExport.autoUpdater
    : undefined
}

export const shouldCheckForUpdates = ({
  env = process.env,
  isPackaged
}: {
  readonly env?: AutoUpdateEnvironment
  readonly isPackaged: boolean
}): boolean =>
  (isPackaged || env[FORCE_AUTO_UPDATE_ENV] === '1') &&
  env[DISABLE_AUTO_UPDATE_ENV] !== '1'

const registerUpdateListener = (
  autoUpdater: AutoUpdateClient,
  eventName: string,
  listener: (...args: readonly unknown[]) => void
): void => {
  const registerListener = autoUpdater.on as (
    eventName: string,
    listener: (...args: readonly unknown[]) => void
  ) => unknown

  registerListener.call(autoUpdater, eventName, listener)
}

const normalizeVersion = (version: string): string => version.replace(/^v/i, '')

const parseSemver = (version: string): readonly [number, number, number] | null => {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/i.exec(version.trim())

  if (!match) {
    return null
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

const compareSemver = (leftVersion: string, rightVersion: string): number => {
  const left = parseSemver(leftVersion)
  const right = parseSemver(rightVersion)

  if (!left || !right) {
    return 0
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index]
    }
  }

  return 0
}

const isVersionNewer = (latestVersion: string, currentVersion: string): boolean => {
  const latest = parseSemver(latestVersion)
  const current = parseSemver(currentVersion)

  if (!latest || !current) {
    return false
  }

  for (let index = 0; index < latest.length; index += 1) {
    if (latest[index] > current[index]) {
      return true
    }

    if (latest[index] < current[index]) {
      return false
    }
  }

  return false
}

const isTrustedGitHubReleaseAssetUrl = (assetUrl: string): boolean => {
  try {
    const url = new URL(assetUrl)

    return (
      url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      /^\/flowforever\/mde\/releases\/download\/v[^/]+\/MDE-[^/]+-mac-(arm64|x64)\.dmg$/.test(
        url.pathname
      )
    )
  } catch {
    return false
  }
}

const getAssetName = (asset: unknown): string | null =>
  isObjectRecord(asset) && typeof asset.name === 'string' ? asset.name : null

const getAssetUrl = (asset: unknown): string | null =>
  isObjectRecord(asset) && typeof asset.browser_download_url === 'string'
    ? asset.browser_download_url
    : null

const getAssetSize = (asset: unknown): number =>
  isObjectRecord(asset) && typeof asset.size === 'number' ? asset.size : 0

const decodeXmlEntities = (value: string): string =>
  value.replace(
    /&(#x[0-9a-f]+|#\d+|amp|apos|gt|lt|quot);/giu,
    (entity: string, code: string) => {
      const normalizedCode = code.toLowerCase()

      if (normalizedCode === 'amp') {
        return '&'
      }

      if (normalizedCode === 'apos') {
        return "'"
      }

      if (normalizedCode === 'gt') {
        return '>'
      }

      if (normalizedCode === 'lt') {
        return '<'
      }

      if (normalizedCode === 'quot') {
        return '"'
      }

      if (normalizedCode.startsWith('#x')) {
        return String.fromCodePoint(Number.parseInt(normalizedCode.slice(2), 16))
      }

      if (normalizedCode.startsWith('#')) {
        return String.fromCodePoint(Number.parseInt(normalizedCode.slice(1), 10))
      }

      return entity
    }
  )

const stripHtmlTags = (value: string): string =>
  value
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<\/(div|h[1-6]|li|ol|p|pre|ul)>/giu, '\n')
    .replace(/<[^>]+>/gu, '')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()

const getXmlElementText = (source: string, tagName: string): string => {
  const match = new RegExp(
    `<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
    'iu'
  ).exec(source)

  if (!match) {
    return ''
  }

  const text = match[1].trim()
  const cdataMatch = /^<!\[CDATA\[([\s\S]*)\]\]>$/u.exec(text)

  return decodeXmlEntities(cdataMatch?.[1] ?? text)
}

const getXmlAttribute = (
  source: string,
  attributeName: string
): string | null => {
  const match = new RegExp(
    `${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    'iu'
  ).exec(source)

  return match ? decodeXmlEntities(match[1] ?? match[2] ?? '') : null
}

const getAtomReleaseUrl = (entry: string): string => {
  const linkTags = entry.match(/<link\b[^>]*>/giu) ?? []
  const alternateLink =
    linkTags.find((linkTag) => getXmlAttribute(linkTag, 'rel') === 'alternate') ??
    linkTags[0]
  const href = alternateLink ? getXmlAttribute(alternateLink, 'href') : null

  if (!href) {
    throw new Error('GitHub release feed entry is missing a release URL')
  }

  return href
}

const getTagNameFromReleaseUrl = (releaseUrl: string): string => {
  try {
    const url = new URL(releaseUrl)
    const tagName = /\/flowforever\/mde\/releases\/tag\/([^/]+)$/u.exec(
      url.pathname
    )?.[1]

    if (url.protocol === 'https:' && url.hostname === 'github.com' && tagName) {
      return decodeURIComponent(tagName)
    }
  } catch {
    // Fall through to the shared invalid-feed error below.
  }

  throw new Error('GitHub release feed entry has an invalid release URL')
}

const createFeedDmgAsset = (
  version: string,
  arch: 'arm64' | 'x64'
): Record<string, unknown> => {
  const tagName = `v${version}`
  const name = `MDE-${version}-mac-${arch}.dmg`

  return {
    browser_download_url: `${GITHUB_RELEASE_DOWNLOAD_BASE_URL}/${tagName}/${name}`,
    name,
    size: 0
  }
}

const createReleaseFromFeedEntry = (
  entry: string
): Record<string, unknown> => {
  const releaseUrl = getAtomReleaseUrl(entry)
  const tagName = getTagNameFromReleaseUrl(releaseUrl)
  const version = normalizeVersion(tagName)
  const releaseTitle = getXmlElementText(entry, 'title') || `MDE ${version}`
  const releaseNotes = stripHtmlTags(getXmlElementText(entry, 'content'))

  if (!parseSemver(tagName)) {
    throw new Error('GitHub release feed entry has an invalid tag')
  }

  return {
    assets: [
      createFeedDmgAsset(version, 'x64'),
      createFeedDmgAsset(version, 'arm64')
    ],
    body: releaseNotes,
    draft: false,
    html_url: releaseUrl,
    name: releaseTitle,
    prerelease: false,
    published_at: getXmlElementText(entry, 'updated'),
    tag_name: tagName
  }
}

const parseReleaseFeed = (feedText: string): Record<string, unknown> => {
  const releases = [...feedText.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/giu)]
    .map((match) => createReleaseFromFeedEntry(match[1]))
    .filter((release) => parseSemver(getOptionalString(release, 'tag_name')))
    .toSorted((left, right) =>
      compareSemver(
        getOptionalString(right, 'tag_name'),
        getOptionalString(left, 'tag_name')
      )
    )

  if (releases.length === 0) {
    throw new Error('GitHub release feed response is invalid')
  }

  return releases[0]
}

const shouldUseReleaseFeedFallback = (status: number): boolean =>
  status === 403 || status === 429

const getUpdateApp = (
  app: AutoUpdateApp,
  env: AutoUpdateEnvironment
): AutoUpdateApp => {
  const appVersion = env[APP_VERSION_ENV]

  if (!appVersion) {
    return app
  }

  const updateApp: AutoUpdateApp = {
    getPath: (name) => app.getPath(name),
    getVersion: () => appVersion,
    isPackaged: app.isPackaged
  }

  if (app.quit) {
    return {
      ...updateApp,
      quit: () => app.quit?.()
    }
  }

  return updateApp
}

const fetchLatestReleaseFromFeed = async (
  fetchClient: FetchLike,
  releaseFeedUrl: string
): Promise<Record<string, unknown>> => {
  const response = await fetchClient(releaseFeedUrl, {
    headers: {
      accept: 'application/atom+xml, application/xml;q=0.9, text/xml;q=0.8'
    }
  })

  if (!response.ok) {
    throw new Error(
      `GitHub release fallback feed failed with status ${response.status}`
    )
  }

  return parseReleaseFeed(await response.text())
}

export const findCompatibleDmgAsset = (
  assets: readonly unknown[],
  arch: string
): DmgAsset => {
  if (arch !== 'arm64' && arch !== 'x64') {
    throw new Error(`MDE does not publish macOS updates for ${arch}`)
  }

  const expectedSuffix = `-mac-${arch}.dmg`

  for (const asset of assets) {
    const name = getAssetName(asset)
    const url = getAssetUrl(asset)

    if (!name?.endsWith(expectedSuffix)) {
      continue
    }

    if (!url || !isTrustedGitHubReleaseAssetUrl(url)) {
      throw new Error('MDE update asset is not a trusted GitHub release URL')
    }

    return {
      name,
      size: getAssetSize(asset),
      url
    }
  }

  throw new Error(`No compatible macOS DMG found for ${arch}`)
}

const getRequiredString = (
  record: Record<string, unknown>,
  key: string
): string => {
  const value = record[key]

  if (typeof value !== 'string') {
    throw new Error(`GitHub release response is missing ${key}`)
  }

  return value
}

const getOptionalString = (
  record: Record<string, unknown>,
  key: string
): string => {
  const value = record[key]

  return typeof value === 'string' ? value : ''
}

const fetchLatestRelease = async (
  fetchClient: FetchLike,
  releaseApiUrl: string,
  releaseFeedUrl: string
): Promise<Record<string, unknown>> => {
  const response = await fetchClient(releaseApiUrl, {
    headers: {
      accept: 'application/vnd.github+json'
    }
  })

  if (!response.ok) {
    if (shouldUseReleaseFeedFallback(response.status)) {
      return fetchLatestReleaseFromFeed(fetchClient, releaseFeedUrl)
    }

    throw new Error(`GitHub release check failed with status ${response.status}`)
  }

  const releaseResponse = (await response.json()) as unknown

  if (Array.isArray(releaseResponse)) {
    const release = releaseResponse
      .filter(isObjectRecord)
      .filter((candidate) => candidate.draft !== true)
      .filter((candidate) => candidate.prerelease !== true)
      .filter((candidate) => parseSemver(getOptionalString(candidate, 'tag_name')))
      .toSorted((left, right) =>
        compareSemver(
          getOptionalString(right, 'tag_name'),
          getOptionalString(left, 'tag_name')
        )
      )[0]

    if (!release) {
      throw new Error('GitHub release response is invalid')
    }

    return release
  }

  if (!isObjectRecord(releaseResponse)) {
    throw new Error('GitHub release response is invalid')
  }

  return releaseResponse
}

const createManualUpdateFromRelease = (
  release: Record<string, unknown>,
  asset: DmgAsset,
  currentVersion: string
): AvailableUpdate & { readonly assetUrl: string } => {
  const tagName = getRequiredString(release, 'tag_name')
  const releaseName = getOptionalString(release, 'name') || `MDE ${tagName}`
  const releaseUrl = getRequiredString(release, 'html_url')
  const publishedAt = getOptionalString(release, 'published_at')

  return {
    assetName: asset.name,
    assetSize: asset.size,
    assetUrl: asset.url,
    currentVersion,
    installMode: 'open-dmg',
    latestVersion: normalizeVersion(tagName),
    publishedAt,
    releaseName,
    releaseNotes: getOptionalString(release, 'body'),
    releaseUrl
  }
}

const createNoUpdateResult = (
  currentVersion: string,
  message?: string
): UpdateCheckResult => ({
  currentVersion,
  message,
  updateAvailable: false
})

const getDownloadProgress = (
  downloadedBytes: number,
  totalBytes: number | null
): UpdateDownloadProgress => ({
  downloadedBytes,
  percent:
    totalBytes && totalBytes > 0
      ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
      : null,
  totalBytes
})

const writeChunk = (
  stream: ReturnType<typeof createWriteStream>,
  chunk: Uint8Array
): Promise<void> =>
  new Promise((resolve, reject) => {
    stream.write(Buffer.from(chunk), (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })

const finishStream = (
  stream: ReturnType<typeof createWriteStream>
): Promise<void> =>
  new Promise((resolve, reject) => {
    stream.once('error', reject)
    stream.once('finish', resolve)
    stream.end()
  })

const downloadFile = async (
  fetchClient: FetchLike,
  asset: Pick<DmgAsset, 'url'>,
  filePath: string,
  onProgress?: (progress: UpdateDownloadProgress) => void
): Promise<void> => {
  const response = await fetchClient(asset.url)

  if (!response.ok) {
    throw new Error(`Update download failed with status ${response.status}`)
  }

  const totalBytesHeader = response.headers.get('content-length')
  const parsedTotalBytes = totalBytesHeader ? Number(totalBytesHeader) : NaN
  const totalBytes = Number.isFinite(parsedTotalBytes) ? parsedTotalBytes : null
  const tempPath = `${filePath}.download`
  const output = createWriteStream(tempPath)
  let downloadedBytes = 0

  try {
    if (response.body) {
      const reader = response.body.getReader()

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        downloadedBytes += value.byteLength
        await writeChunk(output, value)
        onProgress?.(getDownloadProgress(downloadedBytes, totalBytes))
      }
    } else {
      const buffer = new Uint8Array(await response.arrayBuffer())

      downloadedBytes = buffer.byteLength
      await writeChunk(output, buffer)
      onProgress?.(getDownloadProgress(downloadedBytes, totalBytes))
    }

    await finishStream(output)
    await rename(tempPath, filePath)
  } catch (error) {
    output.destroy()
    await rm(tempPath, { force: true })
    throw error
  }
}

export const createGitHubManualUpdateService = ({
  app,
  arch = process.arch,
  enabled = true,
  fetch: fetchClient = globalThis.fetch,
  platform = process.platform,
  releaseApiUrl = GITHUB_LATEST_RELEASE_URL,
  releaseFeedUrl = GITHUB_RELEASES_FEED_URL,
  shell
}: {
  readonly app: AutoUpdateApp
  readonly arch?: string
  readonly enabled?: boolean
  readonly fetch?: FetchLike
  readonly platform?: string
  readonly releaseApiUrl?: string
  readonly releaseFeedUrl?: string
  readonly shell: ShellLike
}): ManualUpdateService => {
  let selectedUpdate: (AvailableUpdate & { readonly assetUrl: string }) | null =
    null

  const checkForUpdates = async (): Promise<UpdateCheckResult> => {
    const currentVersion = app.getVersion()

    if (!enabled) {
      return createNoUpdateResult(currentVersion, 'Update checks are disabled.')
    }

    if (platform !== 'darwin') {
      return createNoUpdateResult(
        currentVersion,
        'Manual DMG updates are only available on macOS.'
      )
    }

    const release = await fetchLatestRelease(
      fetchClient,
      releaseApiUrl,
      releaseFeedUrl
    )
    const tagName = getRequiredString(release, 'tag_name')
    const latestVersion = normalizeVersion(tagName)

    if (!isVersionNewer(latestVersion, currentVersion)) {
      selectedUpdate = null
      return createNoUpdateResult(currentVersion, 'MDE is up to date.')
    }

    const assets = release.assets

    if (!Array.isArray(assets)) {
      throw new Error('GitHub release response is missing assets')
    }

    selectedUpdate = createManualUpdateFromRelease(
      release,
      findCompatibleDmgAsset(assets, arch),
      currentVersion
    )

    return {
      currentVersion,
      update: selectedUpdate,
      updateAvailable: true
    }
  }

  return {
    checkForUpdates,
    downloadAndOpenUpdate: async (onProgress) => {
      if (!selectedUpdate) {
        const checkResult = await checkForUpdates()

        if (!checkResult.updateAvailable) {
          throw new Error(checkResult.message ?? 'No MDE update is available')
        }
      }

      if (!selectedUpdate) {
        throw new Error('No MDE update is available')
      }

      const updatesDirectory = join(app.getPath('userData'), 'updates')
      const filePath = join(updatesDirectory, selectedUpdate.assetName ?? 'MDE.dmg')

      await mkdir(updatesDirectory, { recursive: true })
      await downloadFile(
        fetchClient,
        { url: selectedUpdate.assetUrl },
        filePath,
        onProgress
      )

      const openError = await shell.openPath(filePath)

      if (openError) {
        throw new Error(`Unable to open downloaded installer: ${openError}`)
      }

      app.quit?.()

      return {
        filePath,
        version: selectedUpdate.latestVersion
      }
    }
  }
}

const sendToWebContents = (
  webContents: UpdateWebContents | null,
  channel: string,
  payload: unknown
): void => {
  if (!webContents || webContents.isDestroyed?.()) {
    return
  }

  webContents.send(channel, payload)
}

const normalizeReleaseNotes = (releaseNotes: unknown): string => {
  if (typeof releaseNotes === 'string') {
    return releaseNotes
  }

  if (!Array.isArray(releaseNotes)) {
    return ''
  }

  return releaseNotes
    .map((note) => {
      if (typeof note === 'string') {
        return note
      }

      if (!isObjectRecord(note)) {
        return ''
      }

      const title = typeof note.version === 'string' ? note.version : ''
      const noteText = typeof note.note === 'string' ? note.note : ''

      return [title, noteText].filter(Boolean).join('\n')
    })
    .filter(Boolean)
    .join('\n\n')
}

const createWindowsUpdateFromInfo = (
  info: unknown,
  currentVersion: string
): AvailableUpdate => {
  const record = isObjectRecord(info) ? info : {}
  const latestVersion =
    typeof record.version === 'string' ? record.version : currentVersion
  const releaseName =
    typeof record.releaseName === 'string'
      ? record.releaseName
      : `MDE ${latestVersion}`
  const publishedAt =
    typeof record.releaseDate === 'string' ? record.releaseDate : ''

  return {
    currentVersion,
    installMode: 'restart-to-install',
    latestVersion,
    publishedAt,
    releaseName,
    releaseNotes: normalizeReleaseNotes(record.releaseNotes),
    releaseUrl: `https://github.com/flowforever/mde/releases/tag/v${latestVersion}`
  }
}

const mapWindowsDownloadProgress = (
  progress: unknown
): UpdateDownloadProgress => {
  const record = isObjectRecord(progress) ? progress : {}
  const downloadedBytes =
    typeof record.transferred === 'number' ? record.transferred : 0
  const totalBytes = typeof record.total === 'number' ? record.total : null
  const percent =
    typeof record.percent === 'number'
      ? Math.min(100, Math.round(record.percent))
      : totalBytes && totalBytes > 0
        ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
        : null

  return {
    downloadedBytes,
    percent,
    totalBytes
  }
}

const registerManualUpdateHandlers = (
  ipcMain: IpcMainLike,
  service: ManualUpdateService
): void => {
  ipcMain.handle(UPDATE_CHANNELS.checkForUpdates, () => service.checkForUpdates())
  ipcMain.handle(
    UPDATE_CHANNELS.downloadAndOpen,
    (event: IpcMainInvokeEvent) =>
      service.downloadAndOpenUpdate((progress) => {
        sendToWebContents(event.sender, UPDATE_CHANNELS.downloadProgress, progress)
      })
  )
  ipcMain.handle(UPDATE_CHANNELS.installWindows, () => {
    throw new Error('Windows installer updates are not available on macOS.')
  })
}

const registerUnsupportedUpdateHandlers = (
  ipcMain: IpcMainLike,
  app: AutoUpdateApp
): void => {
  ipcMain.handle(UPDATE_CHANNELS.checkForUpdates, () =>
    createNoUpdateResult(
      app.getVersion(),
      'Automatic updates are available on macOS and Windows only.'
    )
  )
  ipcMain.handle(UPDATE_CHANNELS.downloadAndOpen, () => {
    throw new Error('Automatic updates are available on macOS and Windows only.')
  })
  ipcMain.handle(UPDATE_CHANNELS.installWindows, () => {
    throw new Error('Automatic updates are available on macOS and Windows only.')
  })
}

const configureWindowsUpdates = ({
  app,
  autoUpdater,
  enabled,
  ipcMain,
  logger
}: {
  readonly app: AutoUpdateApp
  readonly autoUpdater: AutoUpdateClient | undefined
  readonly enabled: boolean
  readonly ipcMain: IpcMainLike
  readonly logger: AutoUpdateLogger
}): boolean => {
  let activeWebContents: UpdateWebContents | null = null
  let latestUpdate: AvailableUpdate | null = null

  ipcMain.handle(UPDATE_CHANNELS.checkForUpdates, async (event) => {
    activeWebContents = event.sender
    const currentVersion = app.getVersion()

    if (!enabled) {
      return createNoUpdateResult(currentVersion, 'Update checks are disabled.')
    }

    if (!autoUpdater) {
      return createNoUpdateResult(
        currentVersion,
        'Windows auto updater is unavailable.'
      )
    }

    await autoUpdater.checkForUpdates()

    return createNoUpdateResult(
      currentVersion,
      'Checking for Windows updates.'
    )
  })
  ipcMain.handle(UPDATE_CHANNELS.downloadAndOpen, () => {
    throw new Error('Windows updates download automatically in the background.')
  })
  ipcMain.handle(UPDATE_CHANNELS.installWindows, () => {
    if (!enabled || !autoUpdater) {
      throw new Error('Windows auto updater is unavailable.')
    }

    autoUpdater.quitAndInstall(true, true)
  })

  if (!enabled) {
    return false
  }

  if (!autoUpdater) {
    logger.error('MDE Windows auto updater is unavailable')
    return false
  }

  autoUpdater.autoDownload = true
  registerUpdateListener(autoUpdater, 'checking-for-update', () => {
    logger.info('Checking for MDE Windows updates')
  })
  registerUpdateListener(autoUpdater, 'update-available', (info) => {
    latestUpdate = createWindowsUpdateFromInfo(info, app.getVersion())
    logger.info('MDE Windows update is available', latestUpdate.latestVersion)
    sendToWebContents(
      activeWebContents,
      UPDATE_CHANNELS.updateAvailable,
      latestUpdate
    )
  })
  registerUpdateListener(autoUpdater, 'update-not-available', () => {
    logger.info('MDE Windows app is up to date')
  })
  registerUpdateListener(autoUpdater, 'download-progress', (progress) => {
    sendToWebContents(
      activeWebContents,
      UPDATE_CHANNELS.downloadProgress,
      mapWindowsDownloadProgress(progress)
    )
  })
  registerUpdateListener(autoUpdater, 'update-downloaded', (info) => {
    latestUpdate = createWindowsUpdateFromInfo(info, app.getVersion())
    logger.info('MDE Windows update downloaded', latestUpdate.latestVersion)
    sendToWebContents(activeWebContents, UPDATE_CHANNELS.updateReady, latestUpdate)
  })
  registerUpdateListener(autoUpdater, 'error', (error) => {
    logger.error('MDE Windows auto update failed', error)
  })

  return true
}

export const configureAutoUpdates = ({
  app,
  arch = process.arch,
  autoUpdater,
  env = process.env,
  fetch: fetchClient = globalThis.fetch,
  ipcMain,
  logger = console,
  platform = process.platform,
  shell
}: {
  readonly app: AutoUpdateApp
  readonly arch?: string
  readonly autoUpdater?: AutoUpdateClient
  readonly env?: AutoUpdateEnvironment
  readonly fetch?: FetchLike
  readonly ipcMain?: IpcMainLike
  readonly logger?: AutoUpdateLogger
  readonly platform?: string
  readonly shell?: ShellLike
}): boolean => {
  if (!ipcMain) {
    logger.error('MDE auto update IPC is unavailable')
    return false
  }

  const updateApp = getUpdateApp(app, env)
  const enabled = shouldCheckForUpdates({ env, isPackaged: app.isPackaged })

  if (platform === 'darwin') {
    if (!shell) {
      registerUnsupportedUpdateHandlers(ipcMain, updateApp)
      logger.error('MDE macOS update shell integration is unavailable')
      return false
    }

    registerManualUpdateHandlers(
      ipcMain,
      createGitHubManualUpdateService({
        app: updateApp,
        arch,
        enabled,
        fetch: fetchClient,
        platform,
        releaseApiUrl: env[RELEASE_API_URL_ENV] ?? GITHUB_LATEST_RELEASE_URL,
        releaseFeedUrl: env[RELEASE_FEED_URL_ENV] ?? GITHUB_RELEASES_FEED_URL,
        shell
      })
    )

    return enabled
  }

  if (platform === 'win32') {
    return configureWindowsUpdates({
      app: updateApp,
      autoUpdater,
      enabled,
      ipcMain,
      logger
    })
  }

  registerUnsupportedUpdateHandlers(ipcMain, updateApp)
  return false
}
