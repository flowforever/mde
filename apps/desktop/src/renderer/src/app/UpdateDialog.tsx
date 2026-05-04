import type {
  AvailableUpdate,
  UpdateDownloadProgress,
} from "../../../shared/update";
import type { AppText } from "../i18n/appLanguage";
import { COMPONENT_IDS } from "../componentIds";

export type UpdateDialogStatus =
  | "available"
  | "downloading"
  | "failed"
  | "ready";

interface UpdateDialogProps {
  readonly errorMessage: string | null;
  readonly onDismiss: () => void;
  readonly onInstall: () => void;
  readonly progress: UpdateDownloadProgress | null;
  readonly status: UpdateDialogStatus;
  readonly text: AppText;
  readonly update: AvailableUpdate;
}

const getProgressLabel = (
  progress: UpdateDownloadProgress | null,
  text: AppText,
): string => {
  if (!progress) {
    return text("updates.preparingDownload");
  }

  if (progress.percent !== null) {
    return text("updates.percentDownloaded", { percent: progress.percent });
  }

  return text("updates.bytesDownloaded", { bytes: progress.downloadedBytes });
};

const getPrimaryLabel = (
  update: AvailableUpdate,
  status: UpdateDialogStatus,
  text: AppText,
): string | null => {
  if (update.installMode === "open-dmg" && status !== "ready") {
    return text("updates.downloadAndInstall");
  }

  if (update.installMode === "restart-to-install" && status === "ready") {
    return text("updates.restartToUpdate");
  }

  return null;
};

const getStatusCopy = (
  update: AvailableUpdate,
  status: UpdateDialogStatus,
  text: AppText,
): string => {
  if (status === "ready" && update.installMode === "open-dmg") {
    return text("updates.installerOpened");
  }

  if (status === "ready") {
    return text("updates.ready");
  }

  if (status === "downloading") {
    return update.installMode === "restart-to-install"
      ? text("updates.downloadingWindows")
      : text("updates.downloadingMac");
  }

  if (status === "failed") {
    return text("updates.failed");
  }

  return update.installMode === "open-dmg"
    ? text("updates.installMac")
    : text("updates.installWindows");
};

export const UpdateDialog = ({
  errorMessage,
  onDismiss,
  onInstall,
  progress,
  status,
  text,
  update,
}: UpdateDialogProps): React.JSX.Element => {
  const primaryLabel = getPrimaryLabel(update, status, text);
  const isPrimaryDisabled = status === "downloading";

  return (
    <div className="update-dialog-backdrop">
      <div
        aria-label={text("updates.mdeUpdate")}
        aria-modal="true"
        className="update-dialog"
        data-component-id={COMPONENT_IDS.updates.dialog}
        role="dialog"
      >
        <div className="update-dialog-header">
          <div>
            <p className="update-dialog-kicker">{text("updates.available")}</p>
            <h2>MDE {update.latestVersion}</h2>
          </div>
          <button
            className="update-dialog-secondary"
            onClick={onDismiss}
            type="button"
          >
            {status === "ready" ? text("common.done") : text("common.later")}
          </button>
        </div>
        <div className="update-dialog-content">
          <p className="update-dialog-status">
            {getStatusCopy(update, status, text)}
          </p>
          {status === "downloading" ? (
            <div className="update-progress" aria-live="polite">
              <div className="update-progress-track">
                <div
                  className="update-progress-value"
                  style={{
                    width:
                      progress?.percent !== null &&
                      progress?.percent !== undefined
                        ? `${progress.percent}%`
                        : "18%",
                  }}
                />
              </div>
              <span>{getProgressLabel(progress, text)}</span>
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
              data-component-id={
                update.installMode === "open-dmg"
                  ? COMPONENT_IDS.updates.downloadAndInstallButton
                  : COMPONENT_IDS.updates.restartToUpdateButton
              }
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
  );
};
