import { ArrowRight, Bug, ImagePlus, Mic, Radio, MessageSquare, Users, Code2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LandingDemo } from '../components/LandingDemo'

const features = [
  {
    icon: ImagePlus,
    title: 'Paste a screenshot',
    description: 'A picture beats a paragraph. Paste the problem right into your report.',
  },
  {
    icon: Mic,
    title: 'Speak it',
    description:
      'Say what went wrong while it’s fresh. Voice capture turns your words into a report in supported browsers.',
  },
  {
    icon: Radio,
    title: 'Real-time',
    description: 'Your teammate sees new bugs as they arrive. Keep moving without a refresh.',
  },
  {
    icon: MessageSquare,
    title: 'Resolve with a note',
    description: 'Leave the why alongside the fix, so the next person has the full story.',
  },
  {
    icon: Users,
    title: 'Invite in 30s',
    description: 'Share an invite link with your cofounder and start working in the same space.',
  },
  {
    icon: Code2,
    title: 'Open source',
    description: 'Small, understandable, and yours to explore. Read the code or make it your own.',
  },
]

export default function Landing() {
  const githubUrl: string = import.meta.env.VITE_GITHUB_URL || 'https://github.com/'

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link
          to="/"
          aria-label="Squash home"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <Bug size={22} className="text-accent" /> Squash
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-5 text-sm">
          <a href={githubUrl} className="t flex items-center gap-1.5 text-muted hover:text-fg">
            <Code2 size={16} /> GitHub
          </a>
          <Link
            to="/signin"
            className="t rounded-lg border border-border px-3 py-2 hover:bg-bg-subtle"
          >
            Sign in
          </Link>
        </nav>
      </header>
      <main>
        <section className="mx-auto max-w-6xl px-6 pt-14 pb-20 text-center sm:pt-20">
          <p className="mb-5 text-xs font-medium tracking-widest text-accent uppercase">
            Small team. Short feedback loop.
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
            Bug reports your cofounder actually reads.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg">
            Paste a screenshot. Say what’s broken. Get back to building. Squash keeps your tiny team
            in sync without the overhead.
          </p>
          <Link
            to="/signin"
            className="t mt-8 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-accent-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            Get started free <ArrowRight size={16} />
          </Link>
          <LandingDemo />
        </section>
        <section
          aria-labelledby="features-heading"
          className="border-y border-border bg-bg-subtle px-6 py-16"
        >
          <div className="mx-auto max-w-5xl">
            <h2 id="features-heading" className="text-2xl font-semibold tracking-tight">
              Everything a bug needs. Room to keep building.
            </h2>
            <div className="mt-10 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, description }) => (
                <div key={title}>
                  <Icon size={21} className="mb-4 text-accent" aria-hidden="true" />
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="px-6 py-20 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Your next fix starts here.</h2>
          <p className="mt-3 text-sm text-muted">
            One shared space for the little things that make your product better.
          </p>
          <Link
            to="/signin"
            className="t mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-accent-fg hover:opacity-90"
          >
            Get started free <ArrowRight size={16} />
          </Link>
        </section>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-border px-6 py-6 text-xs text-muted">
        <p>Squash · Built for small teams.</p>
        <nav aria-label="Footer navigation" className="flex gap-5">
          <Link to="/claude" className="t hover:text-fg">
            Claude helper
          </Link>
          <Link to="/privacy" className="t hover:text-fg">
            Privacy
          </Link>
          <Link to="/terms" className="t hover:text-fg">
            Terms
          </Link>
          <a href={githubUrl} className="t hover:text-fg">
            GitHub
          </a>
        </nav>
      </footer>
    </div>
  )
}
