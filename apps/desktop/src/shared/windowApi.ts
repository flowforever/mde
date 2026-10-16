import type { MdeWindowMode } from "./windowMode";

export interface MdeWindowApi {
  readonly focusWorkspaceWindow: () => Promise<void>;
  readonly getWindowMode: () => MdeWindowMode;
}

export const WINDOW_CHANNELS = Object.freeze({
  focusWorkspaceWindow: "window:focus-workspace-window",
});
