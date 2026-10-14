import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/rubik/400.css'
import '@fontsource/rubik/500.css'
import '@fontsource/rubik/700.css'
import './index.css'
import { App } from './app/App.tsx'
import { reloadOnStaleCode } from './app/staleCode.ts'
import { initialMode } from './data/mode.ts'
import { appName, DIR, LANG } from './i18n/index.ts'
import { applyTheme, followSystemTheme } from './ui/theme.ts'

// English is in index.html; Hebrew (chosen in settings, kept on this device) turns the page around.
document.documentElement.lang = LANG
document.documentElement.dir = DIR
document.title = appName()
// The name iOS suggests when the app is added to the home screen.
document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', appName())
applyTheme()
followSystemTheme()
reloadOnStaleCode()

// Read ?demo=1 / ?demo=0 before the router sees the URL.
const mode = initialMode()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App initialMode={mode} />
  </StrictMode>,
)
