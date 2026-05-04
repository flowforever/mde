import { E2E_WINDOW_MODE_ENV } from '../shared/appIdentity'

export type E2EWindowMode = 'hidden' | 'inactive' | 'visible'
export type ReadyToShowWindowAction = 'none' | 'show' | 'showInactive'

interface ReadyToShowWindow {
  show(): void
  showInactive(): void
}

export const parseE2EWindowMode = (
  value: string | undefined
): E2EWindowMode | null => {
  if (!value) {
    return null
  }

  if (value === 'hidden' || value === 'inactive' || value === 'visible') {
    return value
  }

  return 'hidden'
}

export const resolveReadyToShowWindowAction = (
  env: NodeJS.ProcessEnv = process.env
): ReadyToShowWindowAction => {
  const mode = parseE2EWindowMode(env[E2E_WINDOW_MODE_ENV])

  if (mode === 'hidden') {
    return 'none'
  }

  if (mode === 'inactive') {
    return 'showInactive'
  }

  return 'show'
}

export const applyReadyToShowWindowMode = (
  window: ReadyToShowWindow,
  env: NodeJS.ProcessEnv = process.env
): void => {
  const action = resolveReadyToShowWindowAction(env)

  if (action === 'none') {
    return
  }

  if (action === 'showInactive') {
    window.showInactive()
    return
  }

  window.show()
}
