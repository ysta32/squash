import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../lib/utils'
import { closeButtonClass, dialogHeaderClass, dialogTitleClass, eyebrowClass } from './dialogStyles'

export interface DialogHeaderProps {
  /** Mono uppercase label above the title, e.g. "Workspace · invite". */
  eyebrow: string
  title: ReactNode
  /** id for the title so the dialog can point aria-labelledby at it. */
  titleId?: string
  /** Optional one-paragraph lede under the title. */
  children?: ReactNode
  onClose: () => void
  closeDisabled?: boolean
  className?: string
}

/** The shared top of every dialog: eyebrow, title, optional lede, and the close X. */
export function DialogHeader({
  eyebrow,
  title,
  titleId,
  children,
  onClose,
  closeDisabled,
  className,
}: DialogHeaderProps) {
  return (
    <div className={cn(dialogHeaderClass, className)}>
      <div className="min-w-0">
        <p className={eyebrowClass}>{eyebrow}</p>
        <h2 id={titleId} className={cn(dialogTitleClass, 'mt-1')}>
          {title}
        </h2>
        {children}
      </div>
      <button
        type="button"
        aria-label="Close"
        disabled={closeDisabled}
        onClick={onClose}
        className={cn(closeButtonClass, 'disabled:pointer-events-none disabled:text-ink-3')}
      >
        <X size={16} absoluteStrokeWidth strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  )
}
