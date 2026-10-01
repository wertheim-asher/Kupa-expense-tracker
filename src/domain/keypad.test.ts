import { describe, expect, it } from 'vitest'
import { agorotToKeypad, keypadReducer, type KeypadAction } from './keypad.ts'

function type(keys: string, start = ''): string {
  return [...keys].reduce<string>((state, key) => {
    const action: KeypadAction =
      key === '.' ? { type: 'dot' } : key === '<' ? { type: 'backspace' } : { type: 'digit', digit: key }
    return keypadReducer(state, action)
  }, start)
}

describe('keypadReducer', () => {
  it('a leading "." becomes "0."', () => {
    expect(type('.')).toBe('0.')
    expect(type('.5')).toBe('0.5')
  })

  it('drops leading zeros ("007" shows "7")', () => {
    expect(type('007')).toBe('7')
    expect(type('00')).toBe('0')
    expect(type('0.07')).toBe('0.07')
  })

  it('allows max 2 decimals, a third decimal digit is ignored', () => {
    expect(type('12.345')).toBe('12.34')
  })

  it('allows max 6 integer digits', () => {
    expect(type('1234567')).toBe('123456')
    expect(type('123456.78')).toBe('123456.78')
  })

  it('ignores a second dot', () => {
    expect(type('1.2.3')).toBe('1.23')
  })

  it('backspace removes the last character and stops at empty', () => {
    expect(type('12.5<')).toBe('12.')
    expect(type('12.5<<')).toBe('12')
    expect(type('1<<<')).toBe('')
  })

  it('typing 4, 5 gives 45', () => {
    expect(type('45')).toBe('45')
  })

  it('clear and set', () => {
    expect(keypadReducer('123', { type: 'clear' })).toBe('')
    expect(keypadReducer('', { type: 'set', value: '45' })).toBe('45')
  })

  it('ignores non-digit input', () => {
    expect(keypadReducer('1', { type: 'digit', digit: 'a' })).toBe('1')
  })
})

describe('agorotToKeypad', () => {
  it.each<[number, string]>([
    [4500, '45'],
    [1290, '12.9'],
    [1205, '12.05'],
    [1, '0.01'],
  ])('%i → "%s"', (agorot, text) => {
    expect(agorotToKeypad(agorot)).toBe(text)
  })
})
