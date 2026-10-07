import { Link } from 'react-router-dom'
import { Logo } from '../components/ui'

export default function Privacy() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-border">
        <nav aria-label="Main navigation" className="mx-auto flex h-14 max-w-2xl items-center px-6">
          <Link to="/" aria-label="Squash home" className="focus-ring rounded-md">
            <Logo />
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-10 text-base leading-7 sm:py-14">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
        <p className="mt-3 text-sm text-muted">
          Last updated: <time dateTime="2026-10-07">October 7, 2026</time>
        </p>
        <p
          role="note"
          className="mt-6 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm leading-7"
        >
          Maintainer: edit this page before launch (src/pages/Privacy.tsx)
        </p>
        <p className="mt-6 leading-7 text-muted">
          This is a placeholder privacy notice for a Squash installation. The maintainer must
          replace it with the practices and contact details of the service they operate.
        </p>
        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold">Information in your workspace</h2>
          <p className="leading-7 text-muted">
            Squash uses account and profile information to identify teammates. Bug reports can
            include descriptions, screenshots, comments, and voice transcripts. Only share
            information your team is allowed to store.
          </p>
        </section>
        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold">Hosting and service providers</h2>
          <p className="leading-7 text-muted">
            The maintainer should list their hosting, authentication, database, storage, and other
            service providers here, including how those providers process information. Explain any
            browser speech service, analytics, cookies, and local storage used by this installation.
          </p>
        </section>
        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold">Access, retention, and deletion</h2>
          <p className="leading-7 text-muted">
            The maintainer should explain who can access workspace content, how long information and
            backups are kept, and how someone can request access, correction, export, or deletion.
          </p>
        </section>
        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold">Questions and updates</h2>
          <p className="leading-7 text-muted">
            Before launch, add a working privacy contact, an effective date, and a process for
            notifying people about changes to this notice.
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
