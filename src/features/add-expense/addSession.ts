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
