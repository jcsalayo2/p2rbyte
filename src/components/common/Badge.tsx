import type { ReactNode } from 'react'

type BadgeVariant = 'muted' | 'success' | 'error' | 'connecting'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
}

export function Badge({ variant = 'muted', children }: BadgeProps) {
  return <span className={`badge badge--${variant}`}>{children}</span>
}
