import type * as Electron from 'electron'

import { UPDATE_CHANNELS } from '../main/ipc/channels'
import type {
  AvailableUpdate,
  UpdateApi,
  UpdateDownloadProgress,
  UpdateInstallResult
} from '../shared/update'

type IpcRenderer = Pick<
  typeof Electron.ipcRenderer,
  'invoke' | 'on' | 'removeListener'
>

export const createUpdateApi = (ipcRenderer: IpcRenderer): UpdateApi => ({
  checkForUpdates: () =>
    ipcRenderer.invoke(UPDATE_CHANNELS.checkForUpdates) as ReturnType<
      UpdateApi['checkForUpdates']
    >,
  downloadAndOpenUpdate: () =>
    ipcRenderer.invoke(
      UPDATE_CHANNELS.downloadAndOpen
    ) as Promise<UpdateInstallResult>,
  installWindowsUpdate: () =>
    ipcRenderer.invoke(UPDATE_CHANNELS.installWindows) as Promise<void>,
  onUpdateAvailable: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      update: AvailableUpdate
    ): void => {
      callback(update)
    }

    ipcRenderer.on(UPDATE_CHANNELS.updateAvailable, listener)

    return () => {
      ipcRenderer.removeListener(UPDATE_CHANNELS.updateAvailable, listener)
    }
  },
  onUpdateDownloadProgress: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      progress: UpdateDownloadProgress
    ): void => {
      callback(progress)
    }

    ipcRenderer.on(UPDATE_CHANNELS.downloadProgress, listener)

    return () => {
      ipcRenderer.removeListener(UPDATE_CHANNELS.downloadProgress, listener)
    }
  },
  onUpdateReady: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      update: AvailableUpdate
    ): void => {
      callback(update)
    }

    ipcRenderer.on(UPDATE_CHANNELS.updateReady, listener)

    return () => {
      ipcRenderer.removeListener(UPDATE_CHANNELS.updateReady, listener)
    }
  }
})
