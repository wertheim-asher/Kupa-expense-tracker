import { cls } from './cls.ts'

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cls('animate-pulse rounded-lg bg-border', className)} />
}
