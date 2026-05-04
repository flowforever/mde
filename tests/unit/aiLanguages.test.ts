import { describe, expect, it } from 'vitest'

import {
  AI_TRANSLATION_LANGUAGES_STORAGE_KEY,
  DEFAULT_AI_TRANSLATION_LANGUAGES,
  forgetCustomAiTranslationLanguage,
  readCustomAiTranslationLanguages,
  rememberCustomAiTranslationLanguage
} from '../../apps/desktop/src/renderer/src/ai/aiLanguages'

describe('aiLanguages', () => {
  it('keeps built-in translation languages stable', () => {
    expect(DEFAULT_AI_TRANSLATION_LANGUAGES).toEqual(['中文', 'English'])
  })

  it('persists custom translation languages without duplicates', () => {
    const storage = window.localStorage

    const nextLanguages = rememberCustomAiTranslationLanguage(
      storage,
      [],
      'Japanese'
    )
    const dedupedLanguages = rememberCustomAiTranslationLanguage(
      storage,
      nextLanguages,
      ' japanese '
    )

    expect(dedupedLanguages).toEqual(['Japanese'])
    expect(readCustomAiTranslationLanguages(storage)).toEqual(['Japanese'])
    expect(storage.getItem(AI_TRANSLATION_LANGUAGES_STORAGE_KEY)).toBe(
      JSON.stringify(['Japanese'])
    )
  })

  it('removes custom translation languages case-insensitively', () => {
    const storage = window.localStorage

    storage.setItem(
      AI_TRANSLATION_LANGUAGES_STORAGE_KEY,
      JSON.stringify(['Japanese', 'French'])
    )

    const nextLanguages = forgetCustomAiTranslationLanguage(
      storage,
      readCustomAiTranslationLanguages(storage),
      'japanese'
    )

    expect(nextLanguages).toEqual(['French'])
    expect(readCustomAiTranslationLanguages(storage)).toEqual(['French'])
  })
})
