import type { ButtonHTMLAttributes } from 'react'
import { cls } from './cls.ts'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary active:brightness-95',
  secondary: 'border border-border bg-surface text-text active:bg-bg',
  ghost: 'text-primary active:bg-primary-soft/60',
  danger: 'bg-over text-on-over active:brightness-95',
  'danger-ghost': 'text-over active:bg-over-soft',
}

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={cls(
        'inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-full px-6 text-base font-medium transition-[filter,background-color,opacity] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  )
}
