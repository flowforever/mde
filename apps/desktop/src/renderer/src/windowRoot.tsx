import type { ReactElement } from "react";

import { App } from "./app/App";
import { AutomationCenterWindow } from "./automation/AutomationCenterWindow";
import {
  AUTOMATION_CENTER_WINDOW_MODE,
  type MdeWindowMode,
} from "../../shared/windowMode";

interface MdeWindowRootProps {
  readonly windowMode: MdeWindowMode;
}

export const MdeWindowRoot = ({
  windowMode,
}: MdeWindowRootProps): ReactElement =>
  windowMode === AUTOMATION_CENTER_WINDOW_MODE ? (
    <AutomationCenterWindow />
  ) : (
    <App />
  );
