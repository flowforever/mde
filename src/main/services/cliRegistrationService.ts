import { access, chmod, mkdir, stat, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { delimiter, join } from 'node:path'

export const DISABLE_MDE_CLI_REGISTRATION_ENV =
  'MDE_DISABLE_CLI_REGISTRATION'

type SupportedCliRegistrationPlatform = NodeJS.Platform

interface CliRegistrationApp {
  readonly isPackaged: boolean
  getPath(name: 'exe' | 'home'): string
}

interface CliRegistrationLogger {
  warn: (...data: unknown[]) => void
}

export type CliRegistrationResult =
  | {
      readonly path: string
      readonly status: 'already-registered' | 'registered'
    }
  | {
      readonly reason:
        | 'disabled'
        | 'no-writable-directory'
        | 'not-packaged'
        | 'unsupported-platform'
      readonly status: 'skipped'
    }

export interface EnsureMdeCliRegisteredOptions {
  readonly app: CliRegistrationApp
  readonly env?: NodeJS.ProcessEnv
  readonly logger?: CliRegistrationLogger
  readonly platform?: SupportedCliRegistrationPlatform
}

export interface RegisterMdeCliInBackgroundOptions
  extends EnsureMdeCliRegisteredOptions {
  readonly ensureRegistered?: () => Promise<CliRegistrationResult>
}

const COMMAND_NAME = 'mde'

const unique = (values: readonly string[]): readonly string[] =>
  Array.from(new Set(values.filter((value) => value.trim().length > 0)))

const shellQuote = (value: string): string =>
  `"${value.replace(/(["\\$`])/gu, '\\$1')}"`

const resolveMacAppBundlePath = (exePath: string): string => {
  const appPathIndex = exePath.indexOf('.app/')

  return appPathIndex === -1 ? exePath : exePath.slice(0, appPathIndex + 4)
}

export const createMdeCliScript = (
  exePath: string,
  platform: SupportedCliRegistrationPlatform = process.platform
): string =>
  platform === 'darwin'
    ? [
        '#!/bin/zsh',
        'resolved_args=()',
        'for arg in "$@"; do',
        '  if [[ "$arg" == /* ]]; then',
        '    resolved_args+=("$arg")',
        '  else',
        '    resolved_args+=("$PWD/$arg")',
        '  fi',
        'done',
        'if (( ${#resolved_args[@]} == 0 )); then',
        `  open -na ${shellQuote(resolveMacAppBundlePath(exePath))}`,
        'else',
        `  open -na ${shellQuote(resolveMacAppBundlePath(exePath))} --args "\${resolved_args[@]}"`,
        'fi',
        ''
      ].join('\n')
    : `#!/bin/sh\nexec ${shellQuote(exePath)} "$@"\n`

const getPathDirectories = (env: NodeJS.ProcessEnv): readonly string[] =>
  unique((env.PATH ?? '').split(delimiter))

const getCommonCommandDirectories = (
  homePath: string,
  platform: SupportedCliRegistrationPlatform
): readonly string[] => {
  if (platform === 'win32') {
    return []
  }

  return platform === 'darwin'
    ? ['/usr/local/bin', '/opt/homebrew/bin', join(homePath, '.local', 'bin')]
    : ['/usr/local/bin', join(homePath, '.local', 'bin')]
}

const getCandidateCommandDirectories = (
  homePath: string,
  env: NodeJS.ProcessEnv,
  platform: SupportedCliRegistrationPlatform
): readonly string[] =>
  unique([
    ...getPathDirectories(env),
    ...getCommonCommandDirectories(homePath, platform)
  ])

const canExecute = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath, constants.X_OK)
    return true
  } catch {
    return false
  }
}

const isWritableDirectory = async (directoryPath: string): Promise<boolean> => {
  try {
    const directoryStat = await stat(directoryPath)

    if (!directoryStat.isDirectory()) {
      return false
    }

    await access(directoryPath, constants.W_OK)
    return true
  } catch {
    return false
  }
}

const ensureWritableCommandDirectory = async (
  directoryPath: string,
  homePath: string
): Promise<boolean> => {
  if (directoryPath === join(homePath, '.local', 'bin')) {
    await mkdir(directoryPath, { recursive: true })
  }

  return isWritableDirectory(directoryPath)
}

const findExistingMdeCommand = async (
  commandDirectories: readonly string[]
): Promise<string | null> => {
  for (const directoryPath of commandDirectories) {
    const commandPath = join(directoryPath, COMMAND_NAME)

    if (await canExecute(commandPath)) {
      return commandPath
    }
  }

  return null
}

const isFileExistsError = (error: unknown): boolean =>
  Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'EEXIST'
  )

export const ensureMdeCliRegistered = async ({
  app,
  env = process.env,
  platform = process.platform
}: EnsureMdeCliRegisteredOptions): Promise<CliRegistrationResult> => {
  if (env[DISABLE_MDE_CLI_REGISTRATION_ENV] === '1') {
    return { reason: 'disabled', status: 'skipped' }
  }

  if (!app.isPackaged) {
    return { reason: 'not-packaged', status: 'skipped' }
  }

  if (platform === 'win32') {
    return { reason: 'unsupported-platform', status: 'skipped' }
  }

  const homePath = app.getPath('home')
  const commandDirectories = getCandidateCommandDirectories(
    homePath,
    env,
    platform
  )
  const existingCommandPath = await findExistingMdeCommand(commandDirectories)

  if (existingCommandPath) {
    return {
      path: existingCommandPath,
      status: 'already-registered'
    }
  }

  const commandScript = createMdeCliScript(app.getPath('exe'), platform)

  for (const directoryPath of commandDirectories) {
    if (!(await ensureWritableCommandDirectory(directoryPath, homePath))) {
      continue
    }

    const commandPath = join(directoryPath, COMMAND_NAME)

    try {
      await writeFile(commandPath, commandScript, {
        flag: 'wx',
        mode: 0o755
      })
      await chmod(commandPath, 0o755)
      return {
        path: commandPath,
        status: 'registered'
      }
    } catch (error) {
      if (isFileExistsError(error) && (await canExecute(commandPath))) {
        return {
          path: commandPath,
          status: 'already-registered'
        }
      }
    }
  }

  return { reason: 'no-writable-directory', status: 'skipped' }
}

export const registerMdeCliInBackground = ({
  ensureRegistered,
  logger = console,
  ...options
}: RegisterMdeCliInBackgroundOptions): void => {
  const runRegistration =
    ensureRegistered ?? (() => ensureMdeCliRegistered(options))

  void runRegistration().catch((error: unknown) => {
    logger.warn('Unable to register mde command', error)
  })
}
