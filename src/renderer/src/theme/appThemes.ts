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
  | 'glacier'
  | 'ivory'
  | 'apricot'
  | 'lilac'
  | 'canopy'
  | 'ledger'
  | 'terracotta'
  | 'lagoon'

export type AppThemeColorGroup =
  | 'neutral'
  | 'blue'
  | 'warm'
  | 'green'
  | 'brass'
  | 'ember'
  | 'teal'
  | 'violet'

export type AppThemeTone = 'dark' | 'light-panel' | 'dark-panel'

export interface AppTheme {
  readonly accent: string
  readonly colorGroup: AppThemeColorGroup
  readonly description: string
  readonly family: AppThemeFamily
  readonly id: AppThemeId
  readonly label: string
  readonly panelFamily: AppThemeFamily
  readonly swatches: readonly string[]
  readonly tone: AppThemeTone
}

export interface AppThemeColorGroupDefinition {
  readonly id: AppThemeColorGroup
  readonly label: string
}

export interface AppThemeRow {
  readonly darkPanelTheme: AppTheme
  readonly darkTheme: AppTheme
  readonly id: AppThemeColorGroup
  readonly label: string
  readonly lightPanelTheme: AppTheme
}

export interface ThemePreference {
  readonly lastDarkThemeId: AppThemeId
  readonly lastLightThemeId: AppThemeId
  readonly mode: AppThemeMode
}

export const APP_THEME_COLOR_GROUPS: readonly AppThemeColorGroupDefinition[] = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'blue', label: 'Blue' },
  { id: 'warm', label: 'Warm' },
  { id: 'green', label: 'Green' },
  { id: 'brass', label: 'Brass' },
  { id: 'ember', label: 'Ember' },
  { id: 'teal', label: 'Teal' },
  { id: 'violet', label: 'Violet' }
]

export const APP_THEMES: readonly AppTheme[] = [
  {
    accent: '#8ea2ae',
    colorGroup: 'neutral',
    description: 'Neutral dark for focused work.',
    family: 'dark',
    id: 'carbon',
    label: 'Carbon',
    panelFamily: 'dark',
    swatches: ['#111418', '#1d242a', '#20262c', '#8ea2ae'],
    tone: 'dark'
  },
  {
    accent: '#6aa7ff',
    colorGroup: 'blue',
    description: 'Cool technical night mode.',
    family: 'dark',
    id: 'blue-hour',
    label: 'Blue Hour',
    panelFamily: 'dark',
    swatches: ['#0d1117', '#171d24', '#17202b', '#6aa7ff'],
    tone: 'dark'
  },
  {
    accent: '#d19a66',
    colorGroup: 'warm',
    description: 'Warm low-light writing.',
    family: 'dark',
    id: 'cedar',
    label: 'Cedar',
    panelFamily: 'dark',
    swatches: ['#171411', '#22201d', '#25211d', '#d19a66'],
    tone: 'dark'
  },
  {
    accent: '#8fbf9b',
    colorGroup: 'green',
    description: 'Soft green-gray dark mode.',
    family: 'dark',
    id: 'moss',
    label: 'Moss',
    panelFamily: 'dark',
    swatches: ['#101511', '#1a221d', '#1d2520', '#8fbf9b'],
    tone: 'dark'
  },
  {
    accent: '#b6a16f',
    colorGroup: 'brass',
    description: 'Deep ink with brass highlights.',
    family: 'dark',
    id: 'ink',
    label: 'Ink',
    panelFamily: 'dark',
    swatches: ['#131312', '#1e1e1b', '#22211d', '#b6a16f'],
    tone: 'dark'
  },
  {
    accent: '#d87852',
    colorGroup: 'ember',
    description: 'Low-glow dark with warm markers.',
    family: 'dark',
    id: 'ember',
    label: 'Ember',
    panelFamily: 'dark',
    swatches: ['#141211', '#221e1b', '#241f1c', '#d87852'],
    tone: 'dark'
  },
  {
    accent: '#7fb0a8',
    colorGroup: 'teal',
    description: 'Graphite dark with mineral teal.',
    family: 'dark',
    id: 'basalt',
    label: 'Basalt',
    panelFamily: 'dark',
    swatches: ['#0f1717', '#192221', '#1c2b2a', '#7fb0a8'],
    tone: 'dark'
  },
  {
    accent: '#b08ac6',
    colorGroup: 'violet',
    description: 'Muted violet for late research.',
    family: 'dark',
    id: 'plum',
    label: 'Plum',
    panelFamily: 'dark',
    swatches: ['#151219', '#201c25', '#251f2b', '#b08ac6'],
    tone: 'dark'
  },
  {
    accent: '#965a33',
    colorGroup: 'warm',
    description: 'Warm paper editor with a soft rail.',
    family: 'light',
    id: 'manuscript',
    label: 'Manuscript',
    panelFamily: 'light',
    swatches: ['#faf7f0', '#ece3d5', '#fffdf8', '#965a33'],
    tone: 'light-panel'
  },
  {
    accent: '#526a80',
    colorGroup: 'neutral',
    description: 'Crisp technical light mode.',
    family: 'light',
    id: 'porcelain',
    label: 'Porcelain',
    panelFamily: 'light',
    swatches: ['#f7f8fa', '#e8edf2', '#ffffff', '#526a80'],
    tone: 'light-panel'
  },
  {
    accent: '#3f704f',
    colorGroup: 'green',
    description: 'Soft green paper for reading.',
    family: 'light',
    id: 'sage-paper',
    label: 'Sage Paper',
    panelFamily: 'light',
    swatches: ['#f5f7f1', '#e2ebdb', '#fcfdf8', '#3f704f'],
    tone: 'light-panel'
  },
  {
    accent: '#566a74',
    colorGroup: 'neutral',
    description: 'Gray stone workspace with a charcoal rail.',
    family: 'light',
    id: 'quarry',
    label: 'Quarry',
    panelFamily: 'dark',
    swatches: ['#f3f4f2', '#1a1f1f', '#fbfcfb', '#566a74'],
    tone: 'dark-panel'
  },
  {
    accent: '#5d4a98',
    colorGroup: 'violet',
    description: 'Cool research-note light mode.',
    family: 'light',
    id: 'binder',
    label: 'Binder',
    panelFamily: 'dark',
    swatches: ['#f6f4fa', '#1d1924', '#fdfcff', '#5d4a98'],
    tone: 'dark-panel'
  },
  {
    accent: '#8f5034',
    colorGroup: 'warm',
    description: 'Warm studio paper and charcoal rail.',
    family: 'light',
    id: 'atelier',
    label: 'Atelier',
    panelFamily: 'dark',
    swatches: ['#f7f2e8', '#211f1b', '#fffaf0', '#8f5034'],
    tone: 'dark-panel'
  },
  {
    accent: '#2f6f65',
    colorGroup: 'teal',
    description: 'Fresh pale workspace with mint ink.',
    family: 'light',
    id: 'mint',
    label: 'Mint',
    panelFamily: 'light',
    swatches: ['#f1f8f6', '#dcebe7', '#fcfffd', '#2f6f65'],
    tone: 'light-panel'
  },
  {
    accent: '#345f82',
    colorGroup: 'blue',
    description: 'Soft blue paper for technical notes.',
    family: 'light',
    id: 'paper-blue',
    label: 'Paper Blue',
    panelFamily: 'dark',
    swatches: ['#f2f6fb', '#171f27', '#fbfdff', '#345f82'],
    tone: 'dark-panel'
  },
  {
    accent: '#2f6f90',
    colorGroup: 'blue',
    description: 'Clear blue light mode with a pale rail.',
    family: 'light',
    id: 'glacier',
    label: 'Glacier',
    panelFamily: 'light',
    swatches: ['#f3f8fb', '#e2edf4', '#ffffff', '#2f6f90'],
    tone: 'light-panel'
  },
  {
    accent: '#755f25',
    colorGroup: 'brass',
    description: 'Ivory paper with restrained brass markers.',
    family: 'light',
    id: 'ivory',
    label: 'Ivory',
    panelFamily: 'light',
    swatches: ['#f8f5eb', '#ebe4d2', '#fffdf5', '#755f25'],
    tone: 'light-panel'
  },
  {
    accent: '#9d5438',
    colorGroup: 'ember',
    description: 'Soft apricot paper for warm writing.',
    family: 'light',
    id: 'apricot',
    label: 'Apricot',
    panelFamily: 'light',
    swatches: ['#fbf2ec', '#efe2d8', '#fffaf6', '#9d5438'],
    tone: 'light-panel'
  },
  {
    accent: '#735594',
    colorGroup: 'violet',
    description: 'Quiet violet notes with a pale side rail.',
    family: 'light',
    id: 'lilac',
    label: 'Lilac',
    panelFamily: 'light',
    swatches: ['#f7f4fa', '#e8e0ef', '#fffefe', '#735594'],
    tone: 'light-panel'
  },
  {
    accent: '#486f37',
    colorGroup: 'green',
    description: 'Green paper paired with a deep canopy rail.',
    family: 'light',
    id: 'canopy',
    label: 'Canopy',
    panelFamily: 'dark',
    swatches: ['#f4f7ee', '#151e15', '#fcfdf8', '#486f37'],
    tone: 'dark-panel'
  },
  {
    accent: '#806426',
    colorGroup: 'brass',
    description: 'Ledger paper with an ink-dark brass rail.',
    family: 'light',
    id: 'ledger',
    label: 'Ledger',
    panelFamily: 'dark',
    swatches: ['#f7f4ea', '#1d1b16', '#fffdf4', '#806426'],
    tone: 'dark-panel'
  },
  {
    accent: '#9f5438',
    colorGroup: 'ember',
    description: 'Warm clay editor with a charcoal rail.',
    family: 'light',
    id: 'terracotta',
    label: 'Terracotta',
    panelFamily: 'dark',
    swatches: ['#faf0ea', '#211b18', '#fff9f4', '#9f5438'],
    tone: 'dark-panel'
  },
  {
    accent: '#336f68',
    colorGroup: 'teal',
    description: 'Pale lagoon editor with a deep teal rail.',
    family: 'light',
    id: 'lagoon',
    label: 'Lagoon',
    panelFamily: 'dark',
    swatches: ['#eef7f5', '#13201f', '#fbfffd', '#336f68'],
    tone: 'dark-panel'
  }
]

const findThemeForRow = (
  themes: readonly AppTheme[],
  colorGroup: AppThemeColorGroup,
  tone: AppThemeTone
): AppTheme => {
  const theme = themes.find(
    (candidateTheme) =>
      candidateTheme.colorGroup === colorGroup && candidateTheme.tone === tone
  )

  if (!theme) {
    throw new Error(`Missing ${tone} theme for ${colorGroup}`)
  }

  return theme
}

export const getAppThemeRows = (
  themes: readonly AppTheme[] = APP_THEMES
): readonly AppThemeRow[] =>
  APP_THEME_COLOR_GROUPS.map((colorGroup) => ({
    darkPanelTheme: findThemeForRow(themes, colorGroup.id, 'dark-panel'),
    darkTheme: findThemeForRow(themes, colorGroup.id, 'dark'),
    id: colorGroup.id,
    label: colorGroup.label,
    lightPanelTheme: findThemeForRow(themes, colorGroup.id, 'light-panel')
  }))

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
