import { Link } from 'react-router-dom'

export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-fg">
      <Link to="/" className="t text-sm text-accent hover:underline">
        ← Back to Squash
      </Link>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight">Privacy</h1>
      <p
        role="note"
        className="mt-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
      >
        Maintainer: edit this page before launch (src/pages/Privacy.tsx)
      </p>
      <p className="mt-6 leading-7 text-muted">
        This is a placeholder privacy notice for a Squash installation. The maintainer must replace
        it with the practices and contact details of the service they operate.
      </p>
      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">Information in your workspace</h2>
        <p className="leading-7 text-muted">
          Squash uses account and profile information to identify teammates. Bug reports can include
          descriptions, screenshots, comments, and voice transcripts. Only share information your
          team is allowed to store.
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
      <Link to="/terms" className="t mt-10 inline-block text-sm text-accent hover:underline">
        Terms →
      </Link>
    </main>
  )
}
