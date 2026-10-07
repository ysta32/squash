import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { labelClass } from './styles'

export type LabelTone = 'default' | 'muted' | 'accent' | 'danger'

const TONE: Record<LabelTone, string> = {
  default: 'text-ink-2',
  muted: 'text-ink-3',
  accent: 'text-accent',
  danger: 'text-danger',
}

export interface LabelProps extends HTMLAttributes<HTMLElement> {
  /** Element to render: an eyebrow is usually a span or p; table headers pass 'div'. */
  as?: 'span' | 'p' | 'div' | 'h2' | 'h3' | 'dt'
  tone?: LabelTone
  children: ReactNode
}

/** Mono uppercase eyebrow ("DESCRIPTION", "SCREENSHOTS 2"): DESIGN.md's `label` type token. */
export function Label({ as: Tag = 'span', tone = 'default', className, ...props }: LabelProps) {
  return <Tag className={cn('block', labelClass, TONE[tone], className)} {...props} />
}
