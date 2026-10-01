// Tiny i18n: one dictionary (Hebrew; English is cut in the fast lane) and t().

import { createElement, Fragment, type ReactNode } from 'react'
import { he, type MessageKey } from './he.ts'
import type { CategoryId } from '../domain/categories.ts'

export type { MessageKey }

export const LANG = 'he'
export const DIR = 'rtl'

const TOKEN = /\{(\w+)\}/g

/** Plain string with {var} placeholders filled in. */
export function t(key: MessageKey, vars: Record<string, string | number> = {}): string {
  return he[key].replace(TOKEN, (match, name: string) => (name in vars ? String(vars[name]) : match))
}

/** Same as t(), but placeholders can be React nodes (for <bdi> amounts). */
export function tx(key: MessageKey, vars: Record<string, ReactNode>): ReactNode {
  return splitTemplate(he[key]).map((part, i) =>
    createElement(Fragment, { key: i }, part.type === 'text' ? part.value : (vars[part.name] ?? `{${part.name}}`)),
  )
}

/** Text before and after one placeholder, for layouts that place the value on its own line. */
export function around(key: MessageKey, name: string): { before: string; after: string } {
  const [before = '', after = ''] = he[key].split(`{${name}}`)
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

const CATEGORY_NAMES: Record<CategoryId, string> = {
  groceries: 'סופר',
  eating_out: 'אוכל בחוץ',
  transport: 'רכב ותחבורה',
  home: 'בית',
  kids: 'ילדים',
  health: 'בריאות',
  fun: 'פנאי',
  other: 'אחר',
}

export function categoryName(id: CategoryId): string {
  return CATEGORY_NAMES[id]
}
