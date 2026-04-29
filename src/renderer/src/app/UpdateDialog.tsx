import type {
  AvailableUpdate,
  UpdateDownloadProgress
} from '../../../shared/update'

export type UpdateDialogStatus =
  | 'available'
  | 'downloading'
  | 'failed'
  | 'ready'

interface UpdateDialogProps {
  readonly errorMessage: string | null
  readonly onDismiss: () => void
  readonly onInstall: () => void
  readonly progress: UpdateDownloadProgress | null
  readonly status: UpdateDialogStatus
  readonly update: AvailableUpdate
}

const getProgressLabel = (
  progress: UpdateDownloadProgress | null
): string => {
  if (!progress) {
    return 'Preparing download'
  }

  if (progress.percent !== null) {
    return `${progress.percent}% downloaded`
  }

  return `${progress.downloadedBytes} bytes downloaded`
}

const getPrimaryLabel = (
  update: AvailableUpdate,
  status: UpdateDialogStatus
): string | null => {
  if (update.installMode === 'open-dmg' && status !== 'ready') {
    return 'Download and Install'
  }

  if (update.installMode === 'restart-to-install' && status === 'ready') {
    return 'Restart to Update'
  }

  return null
}

const getStatusCopy = (
  update: AvailableUpdate,
  status: UpdateDialogStatus
): string => {
  if (status === 'ready' && update.installMode === 'open-dmg') {
    return 'The installer has opened. Quit MDE, drag MDE to Applications, replace the old app, then reopen MDE.'
  }

  if (status === 'ready') {
    return 'The update is ready. Restart MDE to finish installation.'
  }

  if (status === 'downloading') {
    return update.installMode === 'restart-to-install'
      ? 'MDE is downloading the Windows update in the background.'
      : 'MDE is downloading the macOS installer.'
  }

  if (status === 'failed') {
    return 'MDE could not finish the update.'
  }

  return update.installMode === 'open-dmg'
    ? 'Download the macOS installer, then use the opened install window to replace MDE.'
    : 'MDE will download the Windows update in the background.'
}

export const UpdateDialog = ({
  errorMessage,
  onDismiss,
  onInstall,
  progress,
  status,
  update
}: UpdateDialogProps): React.JSX.Element => {
  const primaryLabel = getPrimaryLabel(update, status)
  const isPrimaryDisabled = status === 'downloading'

  return (
    <div className="update-dialog-backdrop">
      <div
        aria-label="MDE update"
        aria-modal="true"
        className="update-dialog"
        role="dialog"
      >
        <div className="update-dialog-header">
          <div>
            <p className="update-dialog-kicker">Update available</p>
            <h2>MDE {update.latestVersion}</h2>
          </div>
          <button
            className="update-dialog-secondary"
            onClick={onDismiss}
            type="button"
          >
            {status === 'ready' ? 'Done' : 'Later'}
          </button>
        </div>
        <div className="update-dialog-content">
          <p className="update-dialog-status">
            {getStatusCopy(update, status)}
          </p>
          {status === 'downloading' ? (
            <div className="update-progress" aria-live="polite">
              <div className="update-progress-track">
                <div
                  className="update-progress-value"
                  style={{
                    width:
                      progress?.percent !== null && progress?.percent !== undefined
                        ? `${progress.percent}%`
                        : '18%'
                  }}
                />
              </div>
              <span>{getProgressLabel(progress)}</span>
            </div>
          ) : null}
          {errorMessage ? (
            <p className="update-dialog-error" role="alert">
              {errorMessage}
            </p>
          ) : null}
          {update.releaseNotes ? (
            <div className="update-release-notes">{update.releaseNotes}</div>
          ) : null}
        </div>
        <div className="update-dialog-actions">
          {primaryLabel ? (
            <button
              className="update-dialog-primary"
              disabled={isPrimaryDisabled}
              onClick={onInstall}
              type="button"
            >
              {primaryLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
