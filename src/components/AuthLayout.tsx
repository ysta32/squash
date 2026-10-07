import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from './ui'
import { SkipLink } from './SkipLink'

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <>
      <SkipLink />
      <main
        id="main"
        tabIndex={-1}
        className="flex min-h-dvh flex-col items-center justify-center bg-bg-subtle px-4 py-12 text-fg focus:outline-none"
      >
        <Link to="/" aria-label="Squash home" className="t focus-ring mb-8 rounded-md text-fg">
          <Logo />
        </Link>
        <div className="w-full max-w-[22rem] animate-in rounded-xl border border-border bg-bg-elevated shadow-card">
          <div className="p-6 sm:p-7">
            <h1 className="text-lg leading-7 font-semibold tracking-tight">{title}</h1>
            {description && (
              <div className="mt-1 text-sm leading-relaxed text-pretty text-muted">
                {description}
              </div>
            )}
            <div className="mt-6">{children}</div>
          </div>
          {footer && (
            <div className="rounded-b-xl border-t border-border bg-bg-subtle/60 px-6 py-4 text-sm text-muted sm:px-7">
              {footer}
            </div>
          )}
        </div>
        <nav aria-label="Legal" className="mt-8 flex items-center gap-2 text-xs text-muted">
          <Link to="/terms" className="t focus-ring rounded-sm hover:text-fg">
            Terms
          </Link>
          <span aria-hidden="true" className="text-border">
            /
          </span>
          <Link to="/privacy" className="t focus-ring rounded-sm hover:text-fg">
            Privacy
          </Link>
        </nav>
      </main>
    </>
  )
}
