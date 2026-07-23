import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DEFAULT_SETTINGS } from '@jimeng-flow/shared'
import './index.css'
import App from './App.tsx'
import { applyCanvasTheme } from './utils/canvasTheme'

applyCanvasTheme(DEFAULT_SETTINGS.canvasTheme)
if (window.mokDesktop?.isDesktop) {
  document.documentElement.classList.add('is-desktop')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
