import {
  CAPTURE_STARTUP_DIAGNOSTICS_ENV,
  DISABLE_SINGLE_INSTANCE_ENV,
  E2E_USER_DATA_PATH_ENV,
  E2E_WINDOW_MODE_ENV,
} from '../../../src/shared/appIdentity'

const DEFAULT_E2E_WINDOW_MODE = 'hidden'

const toDefinedStringEnv = (env: NodeJS.ProcessEnv): Record<string, string> =>
  Object.fromEntries(
    Object.entries(env).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  )

export const createElectronLaunchEnv = ({
  baseEnv = process.env,
  e2eUserDataPath,
  overrideEnv = {},
}: {
  readonly baseEnv?: NodeJS.ProcessEnv
  readonly e2eUserDataPath: string
  readonly overrideEnv?: NodeJS.ProcessEnv
}): Record<string, string> => ({
  ...toDefinedStringEnv(baseEnv),
  ...toDefinedStringEnv(overrideEnv),
  [CAPTURE_STARTUP_DIAGNOSTICS_ENV]: '1',
  [DISABLE_SINGLE_INSTANCE_ENV]: '1',
  [E2E_USER_DATA_PATH_ENV]: e2eUserDataPath,
  [E2E_WINDOW_MODE_ENV]:
    overrideEnv[E2E_WINDOW_MODE_ENV] ??
    baseEnv[E2E_WINDOW_MODE_ENV] ??
    DEFAULT_E2E_WINDOW_MODE,
})
