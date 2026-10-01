// CSV export (SPEC section 11): UTF-8 with BOM so Excel shows Hebrew, comma separated,
// quoted where needed.

import { APP } from '../config.ts'
import { agorotToDecimalString } from '../domain/money.ts'
import type { ExportEvent, ExportExpense, IsoDate } from '../domain/types.ts'

const BOM = '﻿'

function cell(value: string | number | boolean | null): string {
  const text = value === null ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(header: string[], rows: Array<Array<string | number | boolean | null>>): string {
  return BOM + [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n'
}

export function expensesCsv(expenses: ExportExpense[]): string {
  return toCsv(
    ['id', 'spent_on', 'created_at', 'member_name', 'category', 'amount_ils', 'log_duration_ms', 'deleted'],
    expenses.map((e) => [
      e.id,
      e.spentOn,
      e.createdAt,
      e.memberName,
      e.category,
      agorotToDecimalString(e.amountAgorot),
      e.logDurationMs,
      e.deleted,
    ]),
  )
}

export function eventsCsv(events: ExportEvent[]): string {
  return toCsv(
    ['created_at', 'member_name', 'name', 'props_json'],
    events.map((e) => [e.createdAt, e.memberName, e.name, JSON.stringify(e.props)]),
  )
}

export function csvFileName(type: 'expenses' | 'events', today: IsoDate): string {
  return `${APP.slug}-${type}-${today}.csv`
}

export function downloadText(fileName: string, text: string): void {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
