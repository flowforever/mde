import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { MdeWindowRoot } from './windowRoot'
import { EDITOR_WINDOW_MODE } from '../../shared/windowMode'
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
    <MdeWindowRoot
      windowMode={window.mdeWindow?.getWindowMode() ?? EDITOR_WINDOW_MODE}
    />
  </StrictMode>
)
