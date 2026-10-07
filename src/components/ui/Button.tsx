import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ComponentProps, MouseEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { buttonClass, type ButtonSize, type ButtonVariant } from './styles'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Work in flight: the button stays focusable but ignores clicks and is marked aria-busy. */
  pending?: boolean
  /** Label shown while pending ("Filing…"). The button keeps the width of the wider label. */
  pendingLabel?: ReactNode
}

// Both labels share one grid cell; the hidden one still reserves its width, so swapping
// "File" for "Filing…" never shifts the layout. visibility:hidden also drops it from the
// accessible name.
const LABEL_CELL = 'col-start-1 row-start-1 inline-flex items-center justify-center gap-[inherit]'

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant,
    size,
    className,
    type = 'button',
    pending = false,
    pendingLabel,
    children,
    onClick,
    'aria-disabled': ariaDisabled,
    ...props
  },
  ref,
) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (pending) {
      // Also stops a pending submit button from submitting its form again.
      event.preventDefault()
      return
    }
    onClick?.(event)
  }
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, className)}
      {...props}
      aria-busy={pending || props['aria-busy'] || undefined}
      aria-disabled={pending || ariaDisabled || undefined}
      onClick={handleClick}
    >
      {pendingLabel === undefined ? (
        children
      ) : (
        <span className="grid gap-[inherit]">
          <span className={LABEL_CELL} style={pending ? { visibility: 'hidden' } : undefined}>
            {children}
          </span>
          <span className={LABEL_CELL} style={pending ? undefined : { visibility: 'hidden' }}>
            {pendingLabel}
          </span>
        </span>
      )}
    </button>
  )
})

export interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />
}
