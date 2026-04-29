export type UpdateInstallMode = 'open-dmg' | 'restart-to-install'

export interface AvailableUpdate {
  readonly assetName?: string
  readonly assetSize?: number
  readonly currentVersion: string
  readonly installMode: UpdateInstallMode
  readonly latestVersion: string
  readonly publishedAt: string
  readonly releaseName: string
  readonly releaseNotes: string
  readonly releaseUrl: string
}

export interface UpdateCheckResult {
  readonly currentVersion: string
  readonly message?: string
  readonly update?: AvailableUpdate
  readonly updateAvailable: boolean
}

export interface UpdateDownloadProgress {
  readonly downloadedBytes: number
  readonly percent: number | null
  readonly totalBytes: number | null
}

export interface UpdateInstallResult {
  readonly filePath?: string
  readonly version: string
}

export interface UpdateApi {
  readonly checkForUpdates: () => Promise<UpdateCheckResult>
  readonly downloadAndOpenUpdate: () => Promise<UpdateInstallResult>
  readonly installWindowsUpdate: () => Promise<void>
  readonly onUpdateAvailable: (
    callback: (update: AvailableUpdate) => void
  ) => () => void
  readonly onUpdateDownloadProgress: (
    callback: (progress: UpdateDownloadProgress) => void
  ) => () => void
  readonly onUpdateReady: (
    callback: (update: AvailableUpdate) => void
  ) => () => void
}
