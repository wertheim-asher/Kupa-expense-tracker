import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// The flow tests are written in Hebrew (right to left), the default. English is covered by lang.test.ts
// and the smoke test.

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})
