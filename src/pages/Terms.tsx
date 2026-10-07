import { Link } from 'react-router-dom'
import { Logo } from '../components/ui'
import { SkipLink } from '../components/SkipLink'

export default function Terms() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <SkipLink />
      <header className="border-b border-border">
        <nav aria-label="Main navigation" className="mx-auto flex h-14 max-w-2xl items-center px-6">
          <Link to="/" aria-label="Squash home" className="focus-ring rounded-md">
            <Logo />
          </Link>
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="focus:outline-none mx-auto max-w-2xl px-6 py-10 text-base leading-7 sm:py-14">
        <h1 className="text-3xl font-semibold tracking-tight">Terms</h1>
        <p className="mt-3 text-sm text-muted">
          Last updated: <time dateTime="2026-10-07">October 7, 2026</time>
        </p>
        <p
          role="note"
          className="mt-6 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm leading-7"
        >
          Maintainer: edit this page before launch (src/pages/Terms.tsx)
        </p>
        <p className="mt-6 leading-7 text-muted">
          These are placeholder sections, not the final terms for this service. The maintainer must
          identify the operator and publish terms appropriate to their installation before launch.
        </p>
        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold">Using Squash</h2>
          <p className="leading-7 text-muted">
            Squash is a shared space for reporting and resolving bugs. Keep your sign-in secure,
            invite only intended teammates, and avoid uploading content you do not have permission
            to share.
          </p>
        </section>
        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold">Your content</h2>
          <p className="leading-7 text-muted">
            The maintainer should explain content ownership and the permissions needed to host and
            display reports, screenshots, and comments to workspace members.
          </p>
        </section>
        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold">Service availability and accounts</h2>
          <p className="leading-7 text-muted">
            The maintainer should describe support, availability, account closure, data export, and
            any limits on use. Include the process for handling abuse and changes to the service.
          </p>
        </section>
        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold">Contact and final terms</h2>
          <p className="leading-7 text-muted">
            Before launch, provide operator contact details, an effective date, and any applicable
            legal terms. The software’s open-source license is separate from the terms of a hosted
            service.
          </p>
        </section>
      </main>
      <footer className="mx-auto flex max-w-2xl flex-wrap items-center gap-5 border-t border-border px-6 py-6 text-sm text-muted">
        <Link to="/" className="focus-ring rounded-md hover:text-fg">
          Squash
        </Link>
        <nav aria-label="Footer" className="flex flex-wrap gap-5">
          <Link to="/claude" className="focus-ring rounded-md hover:text-fg">
            Claude Code guide
          </Link>
          <Link to="/privacy" className="focus-ring rounded-md hover:text-fg">
            Privacy
          </Link>
          <Link to="/terms" className="focus-ring rounded-md hover:text-fg">
            Terms
          </Link>
        </nav>
      </footer>
    </div>
  )
}
