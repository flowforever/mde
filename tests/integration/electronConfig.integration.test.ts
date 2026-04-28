import { describe, expect, it } from 'vitest'

import { createWindowOptions } from '../../src/main/index'

describe('Electron window config', () => {
  it('keeps renderer isolated from Node.js', () => {
    const options = createWindowOptions('/tmp/preload.js')

    expect(options.webPreferences?.contextIsolation).toBe(true)
    expect(options.webPreferences?.nodeIntegration).toBe(false)
  })
})
