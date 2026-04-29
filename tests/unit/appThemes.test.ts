import { describe, expect, it, vi } from 'vitest'

import {
  APP_THEME_STORAGE_KEY,
  APP_THEMES,
  DEFAULT_DARK_THEME_ID,
  DEFAULT_LIGHT_THEME_ID,
  disableSystemThemePreference,
  enableSystemThemePreference,
  getAppThemeRows,
  readThemePreference,
  resolveThemePreference,
  selectAppTheme,
  type ThemePreference,
  writeThemePreference
} from '../../src/renderer/src/theme/appThemes'

const getHexHue = (hexColor: string): number => {
  const normalizedHexColor = hexColor.replace('#', '')
  const red = Number.parseInt(normalizedHexColor.slice(0, 2), 16) / 255
  const green = Number.parseInt(normalizedHexColor.slice(2, 4), 16) / 255
  const blue = Number.parseInt(normalizedHexColor.slice(4, 6), 16) / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min

  if (delta === 0) {
    return 0
  }

  if (max === red) {
    return ((green - blue) / delta + (green < blue ? 6 : 0)) * 60
  }

  if (max === green) {
    return ((blue - red) / delta + 2) * 60
  }

  return ((red - green) / delta + 4) * 60
}

const getHueDistance = (firstHue: number, secondHue: number): number => {
  const distance = Math.abs(firstHue - secondHue)

  return Math.min(distance, 360 - distance)
}

describe('app theme preferences', () => {
  it('defines eight dark themes and sixteen light themes in complete colorway rows', () => {
    expect(APP_THEME_STORAGE_KEY).toBe('mde.themePreference')
    expect(APP_THEMES.filter((theme) => theme.family === 'dark')).toHaveLength(8)
    expect(APP_THEMES.filter((theme) => theme.family === 'light')).toHaveLength(16)
    expect(
      APP_THEMES.filter(
        (theme) => theme.family === 'light' && theme.panelFamily === 'light'
      )
    ).toHaveLength(8)
    expect(
      APP_THEMES.filter(
        (theme) => theme.family === 'light' && theme.panelFamily === 'dark'
      )
    ).toHaveLength(8)
    expect(getAppThemeRows()).toHaveLength(8)
    expect(
      getAppThemeRows().every(
        (row) =>
          row.darkTheme.family === 'dark' &&
          row.lightPanelTheme.family === 'light' &&
          row.lightPanelTheme.panelFamily === 'light' &&
          row.darkPanelTheme.family === 'light' &&
          row.darkPanelTheme.panelFamily === 'dark'
      )
    ).toBe(true)
    expect(getAppThemeRows().find((row) => row.id === 'blue')).toMatchObject({
      darkTheme: { id: 'blue-hour' },
      lightPanelTheme: { id: 'glacier' },
      darkPanelTheme: { id: 'paper-blue' }
    })
    expect(APP_THEMES[0]?.id).toBe(DEFAULT_DARK_THEME_ID)
    expect(APP_THEMES.find((theme) => theme.family === 'light')?.id).toBe(
      DEFAULT_LIGHT_THEME_ID
    )
  })

  it('keeps every colorway row in the same visual color family', () => {
    getAppThemeRows().forEach((row) => {
      const rowThemes = [row.darkTheme, row.lightPanelTheme, row.darkPanelTheme]
      const rowHues = rowThemes.map((theme) => getHexHue(theme.accent))
      const maxHueDistance = Math.max(
        ...rowHues.flatMap((hue) =>
          rowHues.map((comparisonHue) => getHueDistance(hue, comparisonHue))
        )
      )

      expect(
        maxHueDistance,
        `${row.label} row accents should share one color family`
      ).toBeLessThanOrEqual(45)
      expect(rowThemes.map((theme) => theme.swatches.at(-1))).toEqual(
        rowThemes.map((theme) => theme.accent)
      )
    })
  })

  it('falls back to following system with the first dark and light themes', () => {
    expect(readThemePreference({ getItem: () => null })).toEqual({
      lastDarkThemeId: DEFAULT_DARK_THEME_ID,
      lastLightThemeId: DEFAULT_LIGHT_THEME_ID,
      mode: 'system'
    })
    expect(readThemePreference({ getItem: () => 'not-json' })).toEqual({
      lastDarkThemeId: DEFAULT_DARK_THEME_ID,
      lastLightThemeId: DEFAULT_LIGHT_THEME_ID,
      mode: 'system'
    })
  })

  it('recovers from invalid modes and removed theme IDs', () => {
    const preference = readThemePreference({
      getItem: () =>
        JSON.stringify({
          lastDarkThemeId: 'missing-dark',
          lastLightThemeId: 'missing-light',
          mode: 'neon'
        })
    })

    expect(preference).toEqual({
      lastDarkThemeId: DEFAULT_DARK_THEME_ID,
      lastLightThemeId: DEFAULT_LIGHT_THEME_ID,
      mode: 'system'
    })
  })

  it('resolves follow-system mode to the remembered family theme', () => {
    const preference: ThemePreference = {
      lastDarkThemeId: 'cedar',
      lastLightThemeId: 'porcelain',
      mode: 'system'
    }

    expect(resolveThemePreference(preference, 'dark').id).toBe('cedar')
    expect(resolveThemePreference(preference, 'light').id).toBe('porcelain')
  })

  it('selects manual themes while preserving the opposite family memory', () => {
    const preference: ThemePreference = {
      lastDarkThemeId: 'carbon',
      lastLightThemeId: 'manuscript',
      mode: 'dark'
    }

    const darkPreference = selectAppTheme(preference, 'moss')
    const lightPreference = selectAppTheme(darkPreference, 'sage-paper')

    expect(darkPreference).toEqual({
      lastDarkThemeId: 'moss',
      lastLightThemeId: 'manuscript',
      mode: 'dark'
    })
    expect(lightPreference).toEqual({
      lastDarkThemeId: 'moss',
      lastLightThemeId: 'sage-paper',
      mode: 'light'
    })
  })

  it('selects remembered themes without leaving follow-system mode', () => {
    const preference: ThemePreference = {
      lastDarkThemeId: 'carbon',
      lastLightThemeId: 'manuscript',
      mode: 'system'
    }

    expect(selectAppTheme(preference, 'binder')).toEqual({
      lastDarkThemeId: 'carbon',
      lastLightThemeId: 'binder',
      mode: 'system'
    })
  })

  it('toggles system following without losing remembered dark and light choices', () => {
    const preference: ThemePreference = {
      lastDarkThemeId: 'blue-hour',
      lastLightThemeId: 'porcelain',
      mode: 'system'
    }

    expect(disableSystemThemePreference(preference, 'light')).toEqual({
      ...preference,
      mode: 'light'
    })
    expect(enableSystemThemePreference({ ...preference, mode: 'dark' })).toEqual({
      ...preference,
      mode: 'system'
    })
  })

  it('writes preference JSON and ignores storage failures', () => {
    const setItem = vi.fn()

    writeThemePreference(
      { setItem },
      {
        lastDarkThemeId: 'moss',
        lastLightThemeId: 'sage-paper',
        mode: 'light'
      }
    )

    expect(setItem).toHaveBeenCalledWith(
      APP_THEME_STORAGE_KEY,
      JSON.stringify({
        lastDarkThemeId: 'moss',
        lastLightThemeId: 'sage-paper',
        mode: 'light'
      })
    )
    expect(() =>
      writeThemePreference(
        {
          setItem: () => {
            throw new Error('denied')
          }
        },
        {
          lastDarkThemeId: 'moss',
          lastLightThemeId: 'sage-paper',
          mode: 'light'
        }
      )
    ).not.toThrow()
  })
})
