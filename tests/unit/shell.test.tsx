import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { App } from '../../src/renderer/src/app/App'

describe('App shell', () => {
  it('shows the initial open folder action', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /open folder/i })).toBeInTheDocument()
  })
})
