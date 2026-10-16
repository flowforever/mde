import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { MdeWindowRoot } from './windowRoot'
import type { MdeWindowApi } from '../../shared/windowApi'
import '@mde/editor-react/styles.css'
import './styles/theme.css'

declare global {
  interface Window {
    readonly mdeWindow?: MdeWindowApi
  }
}

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element not found')
}

createRoot(root).render(
  <StrictMode>
    <MdeWindowRoot />
  </StrictMode>
)
