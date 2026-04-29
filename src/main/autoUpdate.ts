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
export const GITHUB_LATEST_RELEASE_URL =
  'https://api.github.com/repos/flowforever/mde/releases/latest'

interface AutoUpdateEnvironment {
  readonly [DISABLE_AUTO_UPDATE_ENV]?: string
}

interface AutoUpdateApp {
  readonly isPackaged: boolean
  readonly whenReady?: () => Promise<unknown>
  readonly getPath: (name: 'userData') => string
  readonly getVersion: () => string
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
}): boolean => isPackaged && env[DISABLE_AUTO_UPDATE_ENV] !== '1'

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
  releaseApiUrl: string
): Promise<Record<string, unknown>> => {
  const response = await fetchClient(releaseApiUrl, {
    headers: {
      accept: 'application/vnd.github+json'
    }
  })

  if (!response.ok) {
    throw new Error(`GitHub release check failed with status ${response.status}`)
  }

  const release = (await response.json()) as unknown

  if (!isObjectRecord(release)) {
    throw new Error('GitHub release response is invalid')
  }

  return release
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
  shell
}: {
  readonly app: AutoUpdateApp
  readonly arch?: string
  readonly enabled?: boolean
  readonly fetch?: FetchLike
  readonly platform?: string
  readonly releaseApiUrl?: string
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

    const release = await fetchLatestRelease(fetchClient, releaseApiUrl)
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

  const enabled = shouldCheckForUpdates({ env, isPackaged: app.isPackaged })

  if (platform === 'darwin') {
    if (!shell) {
      registerUnsupportedUpdateHandlers(ipcMain, app)
      logger.error('MDE macOS update shell integration is unavailable')
      return false
    }

    registerManualUpdateHandlers(
      ipcMain,
      createGitHubManualUpdateService({
        app,
        arch,
        enabled,
        fetch: fetchClient,
        platform,
        shell
      })
    )

    return enabled
  }

  if (platform === 'win32') {
    return configureWindowsUpdates({
      app,
      autoUpdater,
      enabled,
      ipcMain,
      logger
    })
  }

  registerUnsupportedUpdateHandlers(ipcMain, app)
  return false
}
