// Partner sync without the cost at startup: the Supabase library (about a third of the app's code)
// loads only when this device has, creates or joins a shared budget. A visitor on the welcome
// screen or in the demo never downloads it.

import type { CreateInput, ExpensePatch, Household, HouseholdPatch, NewExpense } from '../domain/types.ts'
import { APP } from '../config.ts'
import { offlineCache } from './offline.ts'
import { RepoError, type Repo } from './repo.ts'
import type { SupabaseRepo } from './supabaseRepo.ts'

/** Events tracked before the library loads (app_open on the welcome screen) wait here. */
const MAX_QUEUED_EVENTS = 20

function hasStoredLogin(): boolean {
  try {
    return localStorage.getItem(`${APP.slug}.auth`) !== null
  } catch {
    return false
  }
}

export class LazySupabaseRepo implements Repo {
  private loading: Promise<SupabaseRepo> | null = null
  private loaded: SupabaseRepo | null = null
  private readonly listeners = new Set<{ onChange: () => void; off: (() => void) | null }>()
  private readonly queued: Array<[string, Record<string, unknown> | undefined]> = []

  /** Loads the library and the real repo once; listeners and events from before are handed over. */
  private load(): Promise<SupabaseRepo> {
    this.loading ??= Promise.all([import('./supabaseRepo.ts'), import('./supabase.ts')])
      .then(([{ SupabaseRepo }, { supabase }]) => {
        const repo = new SupabaseRepo(supabase())
        this.loaded = repo
        for (const entry of this.listeners) entry.off = repo.subscribe(entry.onChange)
        for (const [name, props] of this.queued.splice(0)) repo.track(name, props)
        return repo
      })
      .catch(() => {
        // No connection and not cached yet: try again on the next call.
        this.loading = null
        throw new RepoError('network')
      })
    return this.loading
  }

  async getSession() {
    // Nothing on this device to sign in with (first visit, welcome screen): no library needed.
    if (!this.loaded && !hasStoredLogin() && !offlineCache.get().session) return null
    return (await this.load()).getSession()
  }

  async createHousehold(input: CreateInput) {
    return (await this.load()).createHousehold(input)
  }

  async joinHousehold(code: string, displayName: string, personalCode?: string) {
    return (await this.load()).joinHousehold(code, displayName, personalCode)
  }

  async getMyPersonalCode() {
    return (await this.load()).getMyPersonalCode()
  }

  peekHousehold(): Household | null {
    return offlineCache.get().household ?? null
  }

  peekPersonalCode(): string | null | undefined {
    const { personalCode, session } = offlineCache.get()
    return personalCode && personalCode.memberId === session?.memberId ? personalCode.code : undefined
  }

  async getHousehold() {
    return (await this.load()).getHousehold()
  }

  async getMembers() {
    return (await this.load()).getMembers()
  }

  async listExpenses(range: { from: string; toExclusive: string }) {
    return (await this.load()).listExpenses(range)
  }

  async addExpense(input: NewExpense) {
    return (await this.load()).addExpense(input)
  }

  async updateExpense(id: string, patch: ExpensePatch) {
    return (await this.load()).updateExpense(id, patch)
  }

  async deleteExpense(id: string) {
    return (await this.load()).deleteExpense(id)
  }

  async restoreExpense(id: string) {
    return (await this.load()).restoreExpense(id)
  }

  async updateHousehold(patch: HouseholdPatch) {
    return (await this.load()).updateHousehold(patch)
  }

  async updateMyName(name: string) {
    return (await this.load()).updateMyName(name)
  }

  subscribe(onChange: () => void): () => void {
    const entry = { onChange, off: this.loaded ? this.loaded.subscribe(onChange) : null }
    this.listeners.add(entry)
    return () => {
      this.listeners.delete(entry)
      entry.off?.()
    }
  }

  track(name: string, props?: Record<string, unknown>): void {
    if (this.loaded) this.loaded.track(name, props)
    else if (this.queued.length < MAX_QUEUED_EVENTS) this.queued.push([name, props])
  }

  async exportData() {
    return (await this.load()).exportData()
  }

  async resetDevice() {
    return (await this.load()).resetDevice()
  }
}
