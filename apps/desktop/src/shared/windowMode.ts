export const EDITOR_WINDOW_MODE = "editor";
export const AUTOMATION_CENTER_WINDOW_MODE = "automation-center";
export const WINDOW_MODE_ARGUMENT_PREFIX = "--mde-window-mode=";

export type MdeWindowMode =
  | typeof EDITOR_WINDOW_MODE
  | typeof AUTOMATION_CENTER_WINDOW_MODE;

export const isMdeWindowMode = (value: unknown): value is MdeWindowMode =>
  value === EDITOR_WINDOW_MODE || value === AUTOMATION_CENTER_WINDOW_MODE;

export const getWindowModeFromArgv = (
  argv: readonly string[],
): MdeWindowMode => {
  const modeArgument = [...argv]
    .reverse()
    .find((value) => value.startsWith(WINDOW_MODE_ARGUMENT_PREFIX));
  const mode = modeArgument?.slice(WINDOW_MODE_ARGUMENT_PREFIX.length);

  return isMdeWindowMode(mode) ? mode : EDITOR_WINDOW_MODE;
};
