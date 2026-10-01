import { describe, expect, it } from 'vitest'
import { normalizeCode, normalizePersonalCode } from './Join.tsx'

describe('normalizeCode (invite code field)', () => {
  it.each<[string, string]>([
    ['abc234', 'ABC234'],
    ['ABC 234', 'ABC234'],
    ['  a b c 2 3 4  ', 'ABC234'],
    ['https://kupa-expense-tracker.netlify.app/join/ABC234', 'ABC234'],
    ['הצטרפו לקופה המשותפת שלנו: https://x.app/join/abc234', 'ABC234'],
    ['ABC2345678', 'ABC234'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeCode(input)).toBe(expected)
  })
})

describe('normalizePersonalCode (12 characters)', () => {
  it.each<[string, string]>([
    ['ABCD EFGH JKMN', 'ABCDEFGHJKMN'],
    ['abcd-efgh-jkmn', 'ABCDEFGHJKMN'],
    ['ABCDEFGHJKMNPQ', 'ABCDEFGHJKMN'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePersonalCode(input)).toBe(expected)
  })
})
