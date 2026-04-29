export const APP_THEME_STORAGE_KEY = 'mde.themePreference'

export type AppThemeFamily = 'dark' | 'light'
export type AppThemeMode = 'system' | AppThemeFamily
export type AppThemeId =
  | 'carbon'
  | 'blue-hour'
  | 'cedar'
  | 'moss'
  | 'ink'
  | 'ember'
  | 'basalt'
  | 'plum'
  | 'manuscript'
  | 'porcelain'
  | 'sage-paper'
  | 'quarry'
  | 'binder'
  | 'atelier'
  | 'mint'
  | 'paper-blue'

export interface AppTheme {
  readonly accent: string
  readonly description: string
  readonly family: AppThemeFamily
  readonly id: AppThemeId
  readonly label: string
  readonly panelFamily: AppThemeFamily
  readonly swatches: readonly string[]
}

export interface ThemePreference {
  readonly lastDarkThemeId: AppThemeId
  readonly lastLightThemeId: AppThemeId
  readonly mode: AppThemeMode
}

export const APP_THEMES: readonly AppTheme[] = [
  {
    accent: '#7cb8d6',
    description: 'Neutral dark for focused work.',
    family: 'dark',
    id: 'carbon',
    label: 'Carbon',
    panelFamily: 'dark',
    swatches: ['#111418', '#191d21', '#20262c', '#7cb8d6']
  },
  {
    accent: '#6aa7ff',
    description: 'Cool technical night mode.',
    family: 'dark',
    id: 'blue-hour',
    label: 'Blue Hour',
    panelFamily: 'dark',
    swatches: ['#0d1117', '#111827', '#17202b', '#6aa7ff']
  },
  {
    accent: '#d19a66',
    description: 'Warm low-light writing.',
    family: 'dark',
    id: 'cedar',
    label: 'Cedar',
    panelFamily: 'dark',
    swatches: ['#171411', '#1d1a17', '#25211d', '#d19a66']
  },
  {
    accent: '#8fbf9b',
    description: 'Soft green-gray dark mode.',
    family: 'dark',
    id: 'moss',
    label: 'Moss',
    panelFamily: 'dark',
    swatches: ['#101511', '#151b18', '#1d2520', '#8fbf9b']
  },
  {
    accent: '#b6a16f',
    description: 'Deep ink with brass highlights.',
    family: 'dark',
    id: 'ink',
    label: 'Ink',
    panelFamily: 'dark',
    swatches: ['#101214', '#181a1e', '#22252a', '#b6a16f']
  },
  {
    accent: '#d87852',
    description: 'Low-glow dark with warm markers.',
    family: 'dark',
    id: 'ember',
    label: 'Ember',
    panelFamily: 'dark',
    swatches: ['#151112', '#1d1717', '#29201d', '#d87852']
  },
  {
    accent: '#7fb0a8',
    description: 'Graphite dark with mineral teal.',
    family: 'dark',
    id: 'basalt',
    label: 'Basalt',
    panelFamily: 'dark',
    swatches: ['#0f1314', '#161b1d', '#20282a', '#7fb0a8']
  },
  {
    accent: '#b08ac6',
    description: 'Muted violet for late research.',
    family: 'dark',
    id: 'plum',
    label: 'Plum',
    panelFamily: 'dark',
    swatches: ['#151219', '#1c1722', '#282131', '#b08ac6']
  },
  {
    accent: '#2e6f8f',
    description: 'Warm paper editor with a dark rail.',
    family: 'light',
    id: 'manuscript',
    label: 'Manuscript',
    panelFamily: 'light',
    swatches: ['#faf7f0', '#f0e8dc', '#fffdf8', '#2e6f8f']
  },
  {
    accent: '#356d9f',
    description: 'Crisp technical light mode.',
    family: 'light',
    id: 'porcelain',
    label: 'Porcelain',
    panelFamily: 'light',
    swatches: ['#f7f8fa', '#edf1f5', '#ffffff', '#356d9f']
  },
  {
    accent: '#4f7d60',
    description: 'Soft green paper for reading.',
    family: 'light',
    id: 'sage-paper',
    label: 'Sage Paper',
    panelFamily: 'light',
    swatches: ['#f5f7f1', '#e8efe3', '#fcfdf8', '#4f7d60']
  },
  {
    accent: '#8a6246',
    description: 'Neutral stone workspace.',
    family: 'light',
    id: 'quarry',
    label: 'Quarry',
    panelFamily: 'dark',
    swatches: ['#f3f1ec', '#1d2020', '#fbfaf6', '#8a6246']
  },
  {
    accent: '#6652a3',
    description: 'Cool research-note light mode.',
    family: 'light',
    id: 'binder',
    label: 'Binder',
    panelFamily: 'dark',
    swatches: ['#f6f4fa', '#201c28', '#fdfcff', '#6652a3']
  },
  {
    accent: '#9a5a3c',
    description: 'Warm studio paper and charcoal rail.',
    family: 'light',
    id: 'atelier',
    label: 'Atelier',
    panelFamily: 'dark',
    swatches: ['#f7f2e8', '#211d1a', '#fffaf0', '#9a5a3c']
  },
  {
    accent: '#377a70',
    description: 'Fresh pale workspace with mint ink.',
    family: 'light',
    id: 'mint',
    label: 'Mint',
    panelFamily: 'light',
    swatches: ['#f1f8f6', '#e4f0ed', '#fcfffd', '#377a70']
  },
  {
    accent: '#3f6f91',
    description: 'Soft blue paper for technical notes.',
    family: 'light',
    id: 'paper-blue',
    label: 'Paper Blue',
    panelFamily: 'dark',
    swatches: ['#f2f6fb', '#18212b', '#fbfdff', '#3f6f91']
  }
]

export const DEFAULT_DARK_THEME_ID = APP_THEMES.find(
  (theme) => theme.family === 'dark'
)!.id
export const DEFAULT_LIGHT_THEME_ID = APP_THEMES.find(
  (theme) => theme.family === 'light'
)!.id

const DEFAULT_THEME_PREFERENCE: ThemePreference = {
  lastDarkThemeId: DEFAULT_DARK_THEME_ID,
  lastLightThemeId: DEFAULT_LIGHT_THEME_ID,
  mode: 'system'
}

export const getThemeById = (themeId: string): AppTheme | null =>
  APP_THEMES.find((theme) => theme.id === themeId) ?? null

const getThemeFamily = (themeId: AppThemeId): AppThemeFamily =>
  getThemeById(themeId)?.family ?? 'dark'

const normalizeThemeId = (
  themeId: unknown,
  family: AppThemeFamily
): AppThemeId =>
  typeof themeId === 'string' && getThemeById(themeId)?.family === family
    ? (themeId as AppThemeId)
    : family === 'dark'
      ? DEFAULT_DARK_THEME_ID
      : DEFAULT_LIGHT_THEME_ID

const normalizeThemeMode = (mode: unknown): AppThemeMode =>
  mode === 'dark' || mode === 'light' || mode === 'system' ? mode : 'system'

export const readThemePreference = (
  storage: Pick<Storage, 'getItem'> = globalThis.localStorage
): ThemePreference => {
  try {
    const storedValue = storage.getItem(APP_THEME_STORAGE_KEY)

    if (!storedValue) {
      return DEFAULT_THEME_PREFERENCE
    }

    const parsedValue = JSON.parse(storedValue) as Record<string, unknown>

    return {
      lastDarkThemeId: normalizeThemeId(parsedValue.lastDarkThemeId, 'dark'),
      lastLightThemeId: normalizeThemeId(parsedValue.lastLightThemeId, 'light'),
      mode: normalizeThemeMode(parsedValue.mode)
    }
  } catch {
    return DEFAULT_THEME_PREFERENCE
  }
}

export const writeThemePreference = (
  storage: Pick<Storage, 'setItem'> = globalThis.localStorage,
  preference: ThemePreference
): void => {
  try {
    storage.setItem(APP_THEME_STORAGE_KEY, JSON.stringify(preference))
  } catch {
    // Storage may be unavailable in restricted renderer contexts.
  }
}

export const resolveThemePreference = (
  preference: ThemePreference,
  systemFamily: AppThemeFamily
): AppTheme => {
  const themeId =
    preference.mode === 'system'
      ? systemFamily === 'dark'
        ? preference.lastDarkThemeId
        : preference.lastLightThemeId
      : preference.mode === 'dark'
        ? preference.lastDarkThemeId
        : preference.lastLightThemeId

  return getThemeById(themeId) ?? getThemeById(
    systemFamily === 'dark' ? DEFAULT_DARK_THEME_ID : DEFAULT_LIGHT_THEME_ID
  )!
}

export const selectAppTheme = (
  preference: ThemePreference,
  themeId: AppThemeId
): ThemePreference => {
  const family = getThemeFamily(themeId)
  const mode = preference.mode === 'system' ? 'system' : family

  return family === 'dark'
    ? {
        ...preference,
        lastDarkThemeId: themeId,
        mode
      }
    : {
        ...preference,
        lastLightThemeId: themeId,
        mode
      }
}

export const enableSystemThemePreference = (
  preference: ThemePreference
): ThemePreference => ({
  ...preference,
  mode: 'system'
})

export const disableSystemThemePreference = (
  preference: ThemePreference,
  currentFamily: AppThemeFamily
): ThemePreference => ({
  ...preference,
  mode: currentFamily
})
