// The "+" tap time, kept outside React so it survives StrictMode remounts and is
// gone after a reload (a reloaded /add has no honest start time, so it goes home).

let startedAt: number | null = null

export function beginAddSession(at: number): void {
  startedAt = at
}

export function addSessionStart(): number | null {
  return startedAt
}

export function endAddSession(): void {
  startedAt = null
}

// After a save the sheet closes at once, so the second tap of a double tap would land on
// the home screen underneath (and open an edit sheet). Home ignores taps for a moment.
let savedAt = Number.NEGATIVE_INFINITY

export function markAddSaved(at: number): void {
  savedAt = at
}

export function justSaved(windowMs = 600): boolean {
  return performance.now() - savedAt < windowMs
}
