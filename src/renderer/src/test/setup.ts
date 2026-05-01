import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

const createMemoryStorage = (): Storage => {
  const values = new Map<string, string>()

  return {
    clear: () => {
      values.clear()
    },
    getItem: (key) => values.get(String(key)) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size
    },
    removeItem: (key) => {
      values.delete(String(key))
    },
    setItem: (key, value) => {
      values.set(String(key), String(value))
    }
  }
}

const ensureLocalStorage = (): void => {
  const storage = window.localStorage as Partial<Storage> | undefined

  if (
    typeof storage?.getItem === 'function' &&
    typeof storage.setItem === 'function' &&
    typeof storage.removeItem === 'function' &&
    typeof storage.clear === 'function'
  ) {
    return
  }

  const memoryStorage = createMemoryStorage()

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: memoryStorage
  })
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: memoryStorage
  })
}

ensureLocalStorage()

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn()
  }))
})
