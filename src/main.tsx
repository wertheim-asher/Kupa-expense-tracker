import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/rubik/400.css'
import '@fontsource/rubik/500.css'
import '@fontsource/rubik/700.css'
import './index.css'
import { App } from './app/App.tsx'
import { initialMode } from './data/mode.ts'
import { appName, DIR, LANG } from './i18n/index.ts'
import { applyTheme, followSystemTheme } from './ui/theme.ts'

// Hebrew is in index.html; English (chosen in settings, kept on this device) turns the page around.
document.documentElement.lang = LANG
document.documentElement.dir = DIR
document.title = appName()
applyTheme()
followSystemTheme()

// Read ?demo=1 / ?demo=0 before the router sees the URL.
const mode = initialMode()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App initialMode={mode} />
  </StrictMode>,
)
