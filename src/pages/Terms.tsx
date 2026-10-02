import { Link } from 'react-router-dom'

export default function Terms() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-fg">
      <Link to="/" className="t text-sm text-accent hover:underline">
        ← Back to Squash
      </Link>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight">Terms</h1>
      <p
        role="note"
        className="mt-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
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
          invite only intended teammates, and avoid uploading content you do not have permission to
          share.
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
      <Link to="/privacy" className="t mt-10 inline-block text-sm text-accent hover:underline">
        Privacy →
      </Link>
    </main>
  )
}
