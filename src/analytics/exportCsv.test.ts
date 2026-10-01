import { describe, expect, it } from 'vitest'
import { csvFileName, eventsCsv, expensesCsv, toCsv } from './exportCsv.ts'
import { budgetBucket } from './track.ts'

describe('CSV export', () => {
  it('starts with a UTF-8 BOM and uses CRLF rows', () => {
    const csv = toCsv(['a', 'b'], [[1, 2]])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toBe('﻿a,b\r\n1,2\r\n')
  })

  it('quotes cells with commas, quotes or newlines', () => {
    const csv = toCsv(['x'], [['a,b'], ['say "hi"'], ['two\nlines'], [null]])
    expect(csv).toBe('﻿x\r\n"a,b"\r\n"say ""hi"""\r\n"two\nlines"\r\n\r\n')
  })

  it('expenses.csv has the SPEC columns and shekel amounts', () => {
    const csv = expensesCsv([
      {
        id: 'e1',
        spentOn: '2026-10-01',
        createdAt: '2026-10-01T08:00:00.000Z',
        memberName: 'נועה',
        category: 'groceries',
        amountAgorot: 4590,
        logDurationMs: 3100,
        deleted: false,
      },
    ])
    const [header, row] = csv.slice(1).split('\r\n')
    expect(header).toBe('id,spent_on,created_at,member_name,category,amount_ils,log_duration_ms,deleted')
    expect(row).toBe('e1,2026-10-01,2026-10-01T08:00:00.000Z,נועה,groceries,45.90,3100,false')
  })

  it('events.csv has the SPEC columns and JSON props', () => {
    const csv = eventsCsv([{ createdAt: 't', memberName: 'דן', name: 'add_save', props: { duration_ms: 1, category: 'fun' } }])
    const [header, row] = csv.slice(1).split('\r\n')
    expect(header).toBe('created_at,member_name,name,props_json')
    expect(row).toBe('t,דן,add_save,"{""duration_ms"":1,""category"":""fun""}"')
  })

  it('file names include the date', () => {
    expect(csvFileName('expenses', '2026-10-01')).toBe('kupa-expenses-2026-10-01.csv')
    expect(csvFileName('events', '2026-10-01')).toBe('kupa-events-2026-10-01.csv')
  })
})

describe('budgetBucket', () => {
  it.each<[number, string]>([
    [499_999, 'under_5k'],
    [500_000, '5k_to_10k'],
    [900_000, '5k_to_10k'],
    [1_000_000, '10k_to_20k'],
    [2_000_000, '10k_to_20k'],
    [2_000_001, 'over_20k'],
  ])('%i agorot → %s', (agorot, bucket) => {
    expect(budgetBucket(agorot)).toBe(bucket)
  })
})
