import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// The flow tests are written in Hebrew (right to left), so they choose it before the app loads,
// as a person would in settings. English, the default, is covered by lang.test.ts and the smoke test.
localStorage.setItem('kupa.lang', 'he')

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})
