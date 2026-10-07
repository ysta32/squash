import { ArrowRight, Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ButtonLink, Kbd, Logo, buttonClass } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useTheme, type ResolvedTheme } from '../lib/theme'
import { cn } from '../lib/utils'

const DEFAULT_GITHUB_URL = 'https://github.com/ysta32/squash'

interface Shot {
  /** File in public/product without extension; themed shots get a -light/-dark suffix. */
  name: string
  themed: boolean
  width: number
  height: number
  alt: string
}

const HERO_SHOT: Shot = {
  name: 'workspace',
  themed: true,
  width: 1600,
  height: 1000,
  alt: 'The Squash workspace: a live bug list on the left, and an open bug on the right with its screenshots, activity, comments, and Claude Code working on the fix',
}

interface Feature {
  id: string
  label: string
  title: string
  body: string
  bullets: string[]
  shot: Shot
}

const FEATURES: Feature[] = [
  {
    id: 'capture',
    label: 'Capture',
    title: 'One input, always on screen',
    body: 'No forms, no required fields, no ticket templates. Paste an image, type or dictate what went wrong, and press Enter.',
    bullets: [
      'Paste anywhere with ⌘V and the cursor jumps to the capture bar',
      'Images are compressed to WebP in the browser before upload',
      'Voice dictation with a live transcript in Chrome, Edge and Safari',
    ],
    shot: {
      name: 'capture',
      themed: true,
      width: 1400,
      height: 544,
      alt: 'The capture bar with a typed description and an attached screenshot, above the live bug list',
    },
  },
  {
    id: 'claude',
    label: 'Claude Code',
    title: 'Send it to Claude Code and watch it get fixed',
    body: 'Send one bug or the whole list, with screenshots and comments attached. Squash shows the file Claude is editing, its plan, and its latest message while it works.',
    bullets: [
      'Fixed bugs resolve themselves, with Claude’s summary as the note',
      'Bugs it could not finish stay open with the summary as a comment',
      'Runs through a small local helper you install with one command',
    ],
    shot: {
      name: 'claude',
      themed: true,
      width: 1400,
      height: 548,
      alt: 'A bug with a Claude is working panel: the file being edited, a four-step plan with two steps done, and Claude’s latest explanation',
    },
  },
  {
    id: 'team',
    label: 'Team',
    title: 'Live for everyone on the team',
    body: 'New bugs, edits, comments and resolutions reach every teammate in about a second. Invite up to ten people with a link.',
    bullets: [
      'See who is online and which bug each teammate has open',
      'Filed and resolved counts per member, for the week and all time',
      'Every action is written to an append-only activity log',
    ],
    shot: {
      name: 'stats-light',
      themed: false,
      width: 640,
      height: 340,
      alt: 'The stats popover listing bugs filed and resolved by each teammate over the last 7 days and all time',
    },
  },
]

const STEPS = [
  {
    title: 'Create a workspace',
    body: 'Sign in with Google or a magic link, name the workspace, and share the invite link with your team.',
  },
  {
    title: 'File bugs as you find them',
    body: 'Paste a screenshot, describe it in a sentence, and press Enter. It is on your teammate’s screen a second later.',
  },
  {
    title: 'Fix them',
    body: 'Resolve with a note, or send a batch to Claude Code and let it close the ones it fixes.',
  },
]

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['N'], label: 'New bug' },
  { keys: ['⌘', 'V'], label: 'Paste screenshot' },
  { keys: ['Enter'], label: 'File bug' },
  { keys: ['Alt', '1–4'], label: 'Severity' },
  { keys: ['J', 'K'], label: 'Next, previous' },
  { keys: ['C'], label: 'Send to Claude' },
]

const SELF_HOST = [
  {
    title: 'MIT licensed',
    body: 'Read it, fork it, change it. The whole app is one small React and TypeScript codebase.',
  },
  {
    title: 'Runs on Supabase',
    body: 'Postgres, Auth, Realtime and Storage on a free project, with Row Level Security on every table.',
  },
  {
    title: 'One command for the database',
    body: 'Run npx supabase db push for the schema, then import the repo into Vercel and deploy.',
  },
]

const FAQ = [
  {
    q: 'Is Squash free?',
    a: 'Yes. The hosted version is free to use, and the code is MIT licensed if you would rather run your own copy.',
  },
  {
    q: 'Who is it built for?',
    a: 'Founding teams of two to ten people who keep losing bug reports in a chat channel. A workspace holds up to ten members.',
  },
  {
    q: 'What do I need for the Claude Code integration?',
    a: 'Claude Code on your Mac and a small helper that Squash installs with one Terminal command. The helper listens only on 127.0.0.1 and accepts requests only from Squash.',
  },
  {
    q: 'Where are my screenshots stored?',
    a: 'In a private Supabase storage bucket, served through signed links that expire after an hour. Only members of your workspace can read them.',
  },
  {
    q: 'How long does self-hosting take?',
    a: 'About five minutes with Node.js 24, a free Supabase project, and optionally a Vercel account. The README walks through every step.',
  },
]

function Screenshot({
  shot,
  theme,
  lazy = true,
  className,
}: {
  shot: Shot
  theme: ResolvedTheme
  lazy?: boolean
  className?: string
}) {
  const src = `/product/${shot.themed ? `${shot.name}-${theme}` : shot.name}.webp`
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-elevated',
        className,
      )}
    >
      <img
        src={src}
        alt={shot.alt}
        width={shot.width}
        height={shot.height}
        loading={lazy ? 'lazy' : 'eager'}
        fetchPriority={lazy ? undefined : 'high'}
        decoding="async"
        className="block h-auto w-full"
      />
    </div>
  )
}

function PrimaryCta({ signedIn, className }: { signedIn: boolean; className?: string }) {
  return (
    <ButtonLink
      to={signedIn ? '/app' : '/signin'}
      variant="primary"
      size="lg"
      className={className}
    >
      {signedIn ? 'Open app' : 'Get started'}
      <ArrowRight size={16} aria-hidden="true" />
    </ButtonLink>
  )
}

function SectionHeading({ id, children, sub }: { id: string; children: ReactNode; sub?: string }) {
  return (
    <div className="max-w-2xl">
      <h2 id={id} className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {children}
      </h2>
      {sub && <p className="mt-3 text-base leading-7 text-muted">{sub}</p>}
    </div>
  )
}

export default function Landing() {
  const githubUrl: string = import.meta.env.VITE_GITHUB_URL || DEFAULT_GITHUB_URL
  const { user } = useAuth()
  const signedIn = Boolean(user)
  const { resolved: theme } = useTheme()
  const navLink = 't focus-ring rounded-md px-2 py-1 text-sm text-muted hover:text-fg'

  return (
    <div className="min-h-screen overflow-x-hidden bg-bg text-fg">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-6">
        <div className="flex items-center gap-6">
          <Link to="/" aria-label="Squash home" className="focus-ring rounded-md">
            <Logo className="text-base" />
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-1 sm:flex">
            <Link to="/claude" className={navLink}>
              Claude Code
            </Link>
            <a href={githubUrl} className={navLink}>
              GitHub
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <ButtonLink to="/app" variant="primary">
              Open app
            </ButtonLink>
          ) : (
            <>
              <ButtonLink to="/signin" variant="ghost">
                Sign in
              </ButtonLink>
              <ButtonLink to="/signin" variant="primary">
                Get started
              </ButtonLink>
            </>
          )}
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-6xl">
              Bug tracking at the speed of a screenshot
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-pretty text-muted sm:text-lg">
              Paste a screenshot, type what broke, and press Enter: your team sees it in about a
              second, and Claude Code can fix it from there.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <PrimaryCta signedIn={signedIn} />
              <a href={githubUrl} className={buttonClass('secondary', 'lg')}>
                Self-host it
              </a>
            </div>
            <p className="mt-4 text-xs text-muted">Free to use. Open source under MIT.</p>
          </div>
          <Screenshot shot={HERO_SHOT} theme={theme} lazy={false} className="mt-14 sm:mt-20" />
        </section>

        <div className="mx-auto max-w-6xl space-y-24 px-5 py-24 sm:space-y-32 sm:px-6 sm:py-32">
          {FEATURES.map((f, i) => (
            <section
              key={f.id}
              aria-labelledby={`feature-${f.id}`}
              className="grid items-center gap-10 lg:grid-cols-5 lg:gap-16"
            >
              <div className={cn('lg:col-span-2', i % 2 === 1 && 'lg:order-2')}>
                <p className="text-sm font-medium text-accent">{f.label}</p>
                <h2
                  id={`feature-${f.id}`}
                  className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
                >
                  {f.title}
                </h2>
                <p className="mt-4 text-base leading-7 text-muted">{f.body}</p>
                <ul className="mt-6 space-y-3 text-sm">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex gap-3">
                      <Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={cn('lg:col-span-3', i % 2 === 1 && 'lg:order-1')}>
                <Screenshot
                  shot={f.shot}
                  theme={theme}
                  className={f.shot.width < 1000 ? 'mx-auto max-w-xl' : undefined}
                />
              </div>
            </section>
          ))}
        </div>

        <section aria-labelledby="how-heading" className="border-y border-border bg-bg-subtle">
          <div className="mx-auto max-w-6xl px-5 py-24 sm:px-6">
            <SectionHeading id="how-heading">How it works</SectionHeading>
            <ol className="mt-12 grid gap-10 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="flex size-7 items-center justify-center rounded-full border border-border bg-bg text-xs font-medium text-muted">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
            <div className="mt-14 rounded-xl border border-border bg-bg p-5">
              <h3 className="text-sm font-medium">Keyboard first</h3>
              <ul aria-label="Keyboard shortcuts" className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
                {SHORTCUTS.map((s) => (
                  <li key={s.label} className="flex items-center gap-2 text-sm text-muted">
                    <span className="flex gap-1">
                      {s.keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </span>
                    {s.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="mobile-heading"
          className="mx-auto max-w-6xl px-5 py-24 sm:px-6 sm:py-32"
        >
          <SectionHeading
            id="mobile-heading"
            sub="Install it from the browser like an app. Take a photo straight into the capture bar, follow Claude’s progress, and resolve from wherever you are."
          >
            On your phone, too
          </SectionHeading>
          <img
            src="/product/mobile.webp"
            alt="Squash on three phones: the bug list with the capture bar, a bug with Claude Code working on it, and a bug with a voice transcript"
            width={1400}
            height={981}
            loading="lazy"
            decoding="async"
            className="mt-12 block h-auto w-full rounded-xl"
          />
        </section>

        <section aria-labelledby="oss-heading" className="border-y border-border bg-bg-subtle">
          <div className="mx-auto max-w-6xl px-5 py-24 sm:px-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <SectionHeading
                id="oss-heading"
                sub="Use the hosted version, or run your own copy on infrastructure you control."
              >
                Open source and yours to run
              </SectionHeading>
              <a href={`${githubUrl}#self-host`} className={buttonClass('secondary', 'md')}>
                Read the self-host guide
              </a>
            </div>
            <dl className="mt-12 grid gap-8 sm:grid-cols-3">
              {SELF_HOST.map((s) => (
                <div key={s.title}>
                  <dt className="text-base font-semibold">{s.title}</dt>
                  <dd className="mt-2 text-sm leading-6 text-muted">{s.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section
          aria-labelledby="faq-heading"
          className="mx-auto max-w-3xl px-5 py-24 sm:px-6 sm:py-32"
        >
          <SectionHeading id="faq-heading">Questions</SectionHeading>
          <div className="mt-10 divide-y divide-border border-y border-border">
            {FAQ.map((item) => (
              <details key={item.q} className="group">
                <summary className="t focus-ring flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-4 text-base font-medium [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span
                    aria-hidden="true"
                    className="text-lg text-muted transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="pb-5 text-sm leading-6 text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="px-5 pb-24 text-center sm:px-6 sm:pb-32">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            File your first bug in under a minute
          </h2>
          <p className="mt-3 text-base text-muted">Sign in, paste a screenshot, press Enter.</p>
          <PrimaryCta signedIn={signedIn} className="mt-8" />
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo size={18} className="text-sm text-fg" />
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/claude" className="t focus-ring rounded-md hover:text-fg">
              Claude Code
            </Link>
            <Link to="/privacy" className="t focus-ring rounded-md hover:text-fg">
              Privacy
            </Link>
            <Link to="/terms" className="t focus-ring rounded-md hover:text-fg">
              Terms
            </Link>
            <a href={githubUrl} className="t focus-ring rounded-md hover:text-fg">
              GitHub
            </a>
          </nav>
          <p className="text-xs">© {new Date().getFullYear()} Squash contributors</p>
        </div>
      </footer>
    </div>
  )
}
