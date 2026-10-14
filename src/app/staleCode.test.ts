import { describe, expect, it } from 'vitest'
import { shouldReload } from './staleCode.ts'

describe('reload for a code file gone after a deploy', () => {
  it('reloads under the service worker when online, then not again within a minute', () => {
    const t = 1_000_000
    expect(shouldReload(t, sessionStorage, true, true)).toBe(true)
    expect(shouldReload(t + 59_000, sessionStorage, true, true)).toBe(false)
    expect(shouldReload(t + 61_000, sessionStorage, true, true)).toBe(true)
  })

  it('never without the service worker, offline, or without storage to count reloads', () => {
    expect(shouldReload(1_000_000, sessionStorage, false, true)).toBe(false)
    expect(shouldReload(1_000_000, sessionStorage, true, false)).toBe(false)
    expect(shouldReload(1_000_000, null, true, true)).toBe(false)
    const blocked = {
      getItem: () => {
        throw new Error('blocked')
      },
    } as unknown as Storage
    expect(shouldReload(1_000_000, blocked, true, true)).toBe(false)
  })
})
