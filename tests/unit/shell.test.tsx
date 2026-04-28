import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { App } from '../../src/renderer/src/app/App'

describe('App shell', () => {
  afterEach(() => {
    cleanup()
    Reflect.deleteProperty(window, 'editorApi')
  })

  it('shows the initial open folder action', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /open folder/i })).toBeInTheDocument()
  })

  it('surfaces a useful error when the preload editor API is missing', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: /open folder/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/editor api unavailable/i)
  })
})
