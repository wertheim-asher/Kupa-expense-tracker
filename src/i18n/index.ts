// Tiny i18n: two dictionaries (Hebrew, English) and t(). The language is fixed for a page load.

import { createElement, Fragment, type ReactNode } from 'react'
import { APP } from '../config.ts'
import { en } from './en.ts'
import { he, type MessageKey } from './he.ts'
import { LANG } from './lang.ts'
import type { CategoryId } from '../domain/categories.ts'

export type { MessageKey }
export { DIR, LANG, LOCALE, setLang, type Lang } from './lang.ts'

const dict: Record<MessageKey, string> = LANG === 'en' ? en : he

const TOKEN = /\{(\w+)\}/g

/** Plain string with {var} placeholders filled in. */
export function t(key: MessageKey, vars: Record<string, string | number> = {}): string {
  return dict[key].replace(TOKEN, (match, name: string) => (name in vars ? String(vars[name]) : match))
}

/** Same as t(), but placeholders can be React nodes (for <bdi> amounts). */
export function tx(key: MessageKey, vars: Record<string, ReactNode>): ReactNode {
  return splitTemplate(dict[key]).map((part, i) =>
    createElement(Fragment, { key: i }, part.type === 'text' ? part.value : (vars[part.name] ?? `{${part.name}}`)),
  )
}

/** Text before and after one placeholder, for layouts that place the value on its own line. */
export function around(key: MessageKey, name: string): { before: string; after: string } {
  const [before = '', after = ''] = dict[key].split(`{${name}}`)
  return { before: before.trim(), after: after.trim() }
}

type Part = { type: 'text'; value: string } | { type: 'var'; name: string }

function splitTemplate(template: string): Part[] {
  const parts: Part[] = []
  let last = 0
  for (const m of template.matchAll(TOKEN)) {
    if (m.index > last) parts.push({ type: 'text', value: template.slice(last, m.index) })
    parts.push({ type: 'var', name: m[1] })
    last = m.index + m[0].length
  }
  if (last < template.length) parts.push({ type: 'text', value: template.slice(last) })
  return parts
}

// SPEC section 8.
const CATEGORY_NAMES: Record<'he' | 'en', Record<CategoryId, string>> = {
  he: {
    groceries: 'סופר',
    eating_out: 'אוכל בחוץ',
    transport: 'רכב ותחבורה',
    home: 'בית',
    kids: 'ילדים',
    health: 'בריאות',
    fun: 'פנאי',
    other: 'אחר',
  },
  en: {
    groceries: 'Groceries',
    eating_out: 'Eating out',
    transport: 'Car and transport',
    home: 'Home',
    kids: 'Kids',
    health: 'Health',
    fun: 'Fun',
    other: 'Other',
  },
}

export function categoryName(id: CategoryId): string {
  return CATEGORY_NAMES[LANG][id]
}

/** The app's name and owner in the current language (config.ts keeps both). */
export const appName = (): string => APP.name
export const ownerName = (): string => (LANG === 'en' ? APP.ownerEn : APP.owner)
