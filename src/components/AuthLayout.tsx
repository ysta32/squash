import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from './ui'

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
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg-subtle px-4 py-10 text-fg">
      <Link to="/" aria-label="Squash home" className="focus-ring mb-6 rounded-md text-fg">
        <Logo />
      </Link>
      <div className="w-full max-w-sm rounded-xl border border-border bg-bg-elevated p-6 shadow-elevated">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <div className="mt-1.5 text-sm text-muted">{description}</div>}
        <div className="mt-6">{children}</div>
        {footer && (
          <div className="mt-6 border-t border-border pt-4 text-sm text-muted">{footer}</div>
        )}
      </div>
      <p className="mt-6 text-xs text-muted">
        <Link to="/terms" className="focus-ring rounded-sm hover:text-fg hover:underline">
          Terms
        </Link>
        <span aria-hidden="true"> · </span>
        <Link to="/privacy" className="focus-ring rounded-sm hover:text-fg hover:underline">
          Privacy
        </Link>
      </p>
    </main>
  )
}
