export const AI_TRANSLATION_LANGUAGES_STORAGE_KEY =
  'mde.customTranslationLanguages'

export const DEFAULT_AI_TRANSLATION_LANGUAGES = Object.freeze([
  '\u4e2d\u6587',
  'English'
])

type LanguageStorage = Pick<Storage, 'getItem' | 'setItem'>

const normalizeLanguageKey = (language: string): string =>
  language.trim().toLocaleLowerCase()

const normalizeLanguage = (language: string): string => language.trim()

const isBuiltInLanguage = (language: string): boolean => {
  const languageKey = normalizeLanguageKey(language)

  return DEFAULT_AI_TRANSLATION_LANGUAGES.some(
    (defaultLanguage) => normalizeLanguageKey(defaultLanguage) === languageKey
  )
}

const dedupeLanguages = (languages: readonly string[]): readonly string[] => {
  const seenLanguages = new Set<string>()
  const nextLanguages: string[] = []

  languages.forEach((language) => {
    const normalizedLanguage = normalizeLanguage(language)
    const languageKey = normalizeLanguageKey(normalizedLanguage)

    if (
      normalizedLanguage.length === 0 ||
      isBuiltInLanguage(normalizedLanguage) ||
      seenLanguages.has(languageKey)
    ) {
      return
    }

    seenLanguages.add(languageKey)
    nextLanguages.push(normalizedLanguage)
  })

  return nextLanguages
}

const writeCustomAiTranslationLanguages = (
  storage: LanguageStorage,
  languages: readonly string[]
): void => {
  storage.setItem(
    AI_TRANSLATION_LANGUAGES_STORAGE_KEY,
    JSON.stringify(languages)
  )
}

export const readCustomAiTranslationLanguages = (
  storage: Pick<Storage, 'getItem'> = globalThis.localStorage
): readonly string[] => {
  try {
    const candidate: unknown = JSON.parse(
      storage.getItem(AI_TRANSLATION_LANGUAGES_STORAGE_KEY) ?? '[]'
    )

    return Array.isArray(candidate)
      ? dedupeLanguages(
          candidate.filter((value): value is string => typeof value === 'string')
        )
      : []
  } catch {
    return []
  }
}

export const rememberCustomAiTranslationLanguage = (
  storage: LanguageStorage,
  currentLanguages: readonly string[],
  language: string
): readonly string[] => {
  const nextLanguages = dedupeLanguages([...currentLanguages, language])

  writeCustomAiTranslationLanguages(storage, nextLanguages)

  return nextLanguages
}

export const forgetCustomAiTranslationLanguage = (
  storage: LanguageStorage,
  currentLanguages: readonly string[],
  language: string
): readonly string[] => {
  const removedLanguageKey = normalizeLanguageKey(language)
  const nextLanguages = currentLanguages.filter(
    (currentLanguage) => normalizeLanguageKey(currentLanguage) !== removedLanguageKey
  )

  writeCustomAiTranslationLanguages(storage, nextLanguages)

  return nextLanguages
}
