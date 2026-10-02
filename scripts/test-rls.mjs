// Row level security test against the real Supabase project (SPEC section 14).
// Run: npm run test:rls   (reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from .env.local)
// It creates a few anonymous test users and households named "rls-test-…". They stay in the
// database (the app has no delete), which is harmless.

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (for example in .env.local).')
  process.exit(2)
}

const israelToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date())

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`)
  if (!ok) failures++
}

async function anonymousUser() {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await client.auth.signInAnonymously()
  if (error) throw new Error(`anonymous sign-in failed: ${error.message}`)
  return client
}

const run = Date.now().toString(36)

// --- A creates a household with an expense and an event ---
const a = await anonymousUser()
const created = await a.rpc('create_household', { p_display_name: `rls-test-A-${run}`, p_budget_agorot: 900000, p_cycle_start_day: 10 })
check('A creates a household', !created.error, created.error?.message)
const { household_id: hid, member_id: aMember, invite_code: code } = created.data ?? {}
check('invite code is 6 chars from the safe alphabet', /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/.test(code ?? ''), code)

const expenseId = randomUUID()
const added = await a.from('expenses').insert({
  id: expenseId, household_id: hid, member_id: aMember, amount_agorot: 4500, category: 'groceries', spent_on: israelToday(), log_duration_ms: 3000,
}).select('*').single()
check('A adds an expense', !added.error, added.error?.message)
const again = await a.from('expenses').insert({
  id: expenseId, household_id: hid, member_id: aMember, amount_agorot: 4500, category: 'groceries', spent_on: israelToday(), log_duration_ms: 3000,
})
check('a retried insert with the same id is rejected as a duplicate (client treats it as success)', again.error?.code === '23505', again.error?.code)
const ev = await a.from('events').insert({ household_id: hid, member_id: aMember, name: 'rls_test', props: {} })
check('A tracks an event', !ev.error, ev.error?.message)

// --- B is a stranger: must see nothing of A and change nothing ---
const b = await anonymousUser()
for (const table of ['households', 'members', 'expenses', 'events']) {
  const column = table === 'households' ? 'id' : 'household_id'
  const res = await b.from(table).select('*').eq(column, hid)
  check(`B reads 0 rows of A's ${table}`, !res.error && res.data.length === 0, res.error?.message ?? `${res.data?.length} rows`)
}
const bInsert = await b.from('expenses').insert({
  id: randomUUID(), household_id: hid, member_id: aMember, amount_agorot: 100, category: 'other', spent_on: israelToday(),
})
check('B cannot insert an expense into A', Boolean(bInsert.error), bInsert.error?.code ?? 'insert succeeded!')
const bEvent = await b.from('events').insert({ household_id: hid, member_id: aMember, name: 'x', props: {} })
check('B cannot insert an event into A', Boolean(bEvent.error), bEvent.error?.code ?? 'insert succeeded!')
const bUpdate = await b.from('expenses').update({ amount_agorot: 1 }).eq('id', expenseId).select('id')
check('B cannot update A\'s expense', !bUpdate.error && bUpdate.data.length === 0, bUpdate.error?.message ?? `${bUpdate.data?.length} rows`)
const bBudget = await b.from('households').update({ budget_agorot: 1 }).eq('id', hid).select('id')
check('B cannot change A\'s budget', !bBudget.error && bBudget.data.length === 0, bBudget.error?.message ?? `${bBudget.data?.length} rows`)
const bDelete = await b.from('expenses').delete().eq('id', expenseId).select('id')
check('B cannot hard-delete A\'s expense', Boolean(bDelete.error) || bDelete.data.length === 0, bDelete.error?.code ?? `${bDelete.data?.length} rows`)

// --- Wrong code and signed-out access ---
const wrong = await b.rpc('join_household', { p_code: 'ZZZZZZ', p_display_name: 'x' })
check('a wrong code gives code_not_found', wrong.error?.message?.includes('code_not_found') === true, wrong.error?.message)
const signedOut = createClient(url, key, { auth: { persistSession: false } })
const anonRead = await signedOut.from('expenses').select('*').limit(1)
check('signed-out requests read nothing', Boolean(anonRead.error) || anonRead.data.length === 0, anonRead.error?.code ?? `${anonRead.data?.length} rows`)

// --- A cannot impersonate or rewrite protected columns ---
const aRewrite = await a.from('expenses').update({ member_id: randomUUID() }).eq('id', expenseId)
check('A cannot change member_id on an expense', Boolean(aRewrite.error), aRewrite.error?.code ?? 'update succeeded!')
const aCode = await a.from('households').update({ invite_code: 'AAAAAA' }).eq('id', hid)
check('A cannot change the invite code', Boolean(aCode.error), aCode.error?.code ?? 'update succeeded!')
const future = await a.from('expenses').insert({
  id: randomUUID(), household_id: hid, member_id: aMember, amount_agorot: 100, category: 'fun', spent_on: '2999-01-01',
})
check('a future date is rejected by the server', Boolean(future.error), future.error?.code ?? 'insert succeeded!')

// --- B joins with the code (lower case, with spaces): now B sees A's data ---
const spaced = `${code.slice(0, 3).toLowerCase()} ${code.slice(3).toLowerCase()}`
const joined = await b.rpc('join_household', { p_code: spaced, p_display_name: `rls-test-B-${run}` })
check('B joins with the code (case and spaces ignored)', !joined.error && joined.data?.household_id === hid, joined.error?.message)
const bSees = await b.from('expenses').select('id').eq('household_id', hid)
check('after joining, B sees the shared expense', !bSees.error && bSees.data.length === 1, bSees.error?.message ?? `${bSees.data?.length} rows`)
const members = await b.from('members').select('color').eq('household_id', hid).order('created_at')
check('colors are teal then violet', members.data?.map((m) => m.color).join(',') === 'teal,violet', members.data?.map((m) => m.color).join(','))
const bAsA = await b.from('expenses').insert({
  id: randomUUID(), household_id: hid, member_id: aMember, amount_agorot: 100, category: 'other', spent_on: israelToday(),
})
check('B cannot add an expense as A', Boolean(bAsA.error), bAsA.error?.code ?? 'insert succeeded!')

// --- Personal codes: private, and the only way to take a seat back ---
const aSecret = await a.from('member_secrets').select('personal_code').eq('member_id', aMember).maybeSingle()
const aPersonal = aSecret.data?.personal_code
check('A can read their own personal code', !aSecret.error && /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{12}$/.test(aPersonal ?? ''), aSecret.error?.message ?? aPersonal)
const bPeek = await b.from('member_secrets').select('personal_code').eq('member_id', aMember)
check('B (a member now) cannot read A\'s personal code', !bPeek.error && bPeek.data.length === 0, bPeek.error?.message ?? `${bPeek.data?.length} rows`)

// --- A third person: full household; a name alone never takes a seat ---
const c = await anonymousUser()
const full = await c.rpc('join_household', { p_code: code, p_display_name: `rls-test-C-${run}` })
check('a third person gets household_full', full.error?.message?.includes('household_full') === true, full.error?.message)
const sameName = await c.rpc('join_household', { p_code: code, p_display_name: `rls-test-A-${run}` })
check('using A\'s name with the code does not take A\'s seat', sameName.error?.message?.includes('household_full') === true, sameName.error?.message ?? 'joined!')
const guess = await c.rpc('join_household', { p_code: code, p_display_name: 'x', p_personal_code: 'AAAAAAAAAAAA' })
check('a wrong personal code is rejected', guess.error?.message?.includes('personal_code_invalid') === true, guess.error?.message ?? 'joined!')
const already = await b.rpc('join_household', { p_code: code, p_display_name: 'again' })
check('joining twice gives already_member', already.error?.message?.includes('already_member') === true, already.error?.message)

// --- A on a new phone takes the seat back with invite code + personal code ---
const newPhone = await anonymousUser()
const rejoin = await newPhone.rpc('join_household', { p_code: code, p_display_name: '', p_personal_code: aPersonal })
check('A on a new phone takes the same seat back with the personal code', !rejoin.error && rejoin.data?.member_id === aMember, rejoin.error?.message)
const oldPhone = await a.from('expenses').select('id').eq('household_id', hid)
check('A\'s old phone no longer sees the household', !oldPhone.error && oldPhone.data.length === 0, oldPhone.error?.message ?? `${oldPhone.data?.length} rows`)
const newSecret = await newPhone.from('member_secrets').select('personal_code').eq('member_id', aMember).maybeSingle()
check('the personal code changed after use', !newSecret.error && newSecret.data?.personal_code && newSecret.data.personal_code !== aPersonal, newSecret.error?.message)
const reuse = await (await anonymousUser()).rpc('join_household', { p_code: code, p_display_name: '', p_personal_code: aPersonal })
check('the old personal code no longer works', reuse.error?.message?.includes('personal_code_invalid') === true, reuse.error?.message ?? 'joined!')

// --- One-member household: after a rejoin the old device cannot walk back in through the free seat ---
const solo = await anonymousUser()
const soloCreated = await solo.rpc('create_household', { p_display_name: `rls-test-solo-${run}`, p_budget_agorot: 100000, p_cycle_start_day: 1 })
const soloSecret = await solo.from('member_secrets').select('personal_code').eq('member_id', soloCreated.data?.member_id).maybeSingle()
const soloNew = await anonymousUser()
const soloRejoin = await soloNew.rpc('join_household', {
  p_code: soloCreated.data?.invite_code, p_display_name: '', p_personal_code: soloSecret.data?.personal_code,
})
check('solo member takes the seat back on a new phone', !soloRejoin.error && soloRejoin.data?.member_id === soloCreated.data?.member_id, soloRejoin.error?.message)
const soloHousehold = await soloNew.from('households').select('invite_code').eq('id', soloCreated.data?.household_id).single()
check('the invite code changed because the second seat was free', !soloHousehold.error && soloHousehold.data.invite_code !== soloCreated.data?.invite_code, soloHousehold.error?.message)
const sneakBack = await solo.rpc('join_household', { p_code: soloCreated.data?.invite_code, p_display_name: 'old phone' })
check('the old phone cannot re-enter with the old invite code', sneakBack.error?.message?.includes('code_not_found') === true, sneakBack.error?.message ?? 'joined!')

console.log(failures === 0 ? '\nAll RLS checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
