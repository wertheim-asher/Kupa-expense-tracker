import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ToastApi } from '../../ui/Toast.tsx'
import { normalizePersonalCode } from './Join.tsx'
import { returnLink, sendReturnLink } from './InviteShare.tsx'

const toast = (): ToastApi => ({ show: vi.fn(), dismiss: vi.fn() })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('return link ("Send to myself")', () => {
  it('keeps the personal code after the #, so it never reaches a server', () => {
    const link = returnLink('ABCDEFGHJKMN')
    expect(link).toBe(`${window.location.origin}/back#ABCDEFGHJKMN`)
    expect(normalizePersonalCode(link)).toBe('ABCDEFGHJKMN')
  })

  it('opens the share sheet with a message that holds the link', async () => {
    const share = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { ...navigator, share })
    const t = toast()
    await sendReturnLink('ABCDEFGHJKMN', t)
    expect(share).toHaveBeenCalledWith({ text: expect.stringContaining(returnLink('ABCDEFGHJKMN')) })
    expect(t.show).not.toHaveBeenCalled()
  })

  it('closing the share sheet is not an error', async () => {
    vi.stubGlobal('navigator', { ...navigator, share: vi.fn(async () => Promise.reject(new DOMException('closed', 'AbortError'))) })
    const t = toast()
    await sendReturnLink('ABCDEFGHJKMN', t)
    expect(t.show).not.toHaveBeenCalled()
  })

  it('without a share sheet, copies the link and says so', async () => {
    const writeText = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } })
    const t = toast()
    await sendReturnLink('ABCDEFGHJKMN', t)
    expect(writeText).toHaveBeenCalledWith(returnLink('ABCDEFGHJKMN'))
    expect(t.show).toHaveBeenCalledWith({ message: 'הקישור הועתק. אפשר להדביק אותו בהודעה לעצמך.' })
  })
})
