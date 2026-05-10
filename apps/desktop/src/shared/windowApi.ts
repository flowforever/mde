import type { MdeWindowMode } from "./windowMode";

export interface MdeWindowApi {
  readonly focusWorkspaceWindow: () => Promise<void>;
  readonly getWindowMode: () => MdeWindowMode;
  readonly openAutomationCenter: () => Promise<void>;
}

export const WINDOW_CHANNELS = Object.freeze({
  focusWorkspaceWindow: "window:focus-workspace-window",
  openAutomationCenter: "window:open-automation-center",
});
