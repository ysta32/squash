import { ArrowRight, Check, ChevronDown, Command, Keyboard } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ButtonLink, Kbd, Logo, buttonClass } from '../components/ui'
import {
  DEFAULT_GITHUB_URL,
  DETAILS,
  FAQ,
  FEATURES,
  HERO_SHOT,
  MOBILE_POINTS,
  PALETTE_SHOT,
  SELF_HOST,
  SHORTCUTS,
  STEPS,
  type Feature,
} from '../components/landing/content'
import {
  PhoneFrame,
  ShotFrame,
  ShotImage,
  Stage,
  type PhoneCrop,
} from '../components/landing/Frames'
import { useAuth } from '../lib/auth'
import { useTheme, type ResolvedTheme } from '../lib/theme'
import { cn } from '../lib/utils'

const CONTAINER = 'mx-auto w-full max-w-6xl px-5 sm:px-8'
const SECTION = 'border-t border-border py-16 sm:py-24'

const PHONES: PhoneCrop[] = [
  {
    x: 73,
    y: 104,
    w: 380,
    h: 825,
    alt: 'Squash on a phone in light mode: the capture bar above the live bug list',
  },
  {
    x: 511,
    y: 68,
    w: 378,
    h: 825,
    alt: 'Squash on a phone in dark mode: a bug with Claude Code working on the fix and a teammate’s comments',
  },
]

function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > threshold)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [threshold])
  return scrolled
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

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-sm font-medium text-accent">{children}</p>
}

function SectionIntro({
  id,
  eyebrow,
  title,
  sub,
  className,
}: {
  id: string
  eyebrow?: string
  title: string
  sub?: string
  className?: string
}) {
  return (
    <div className={cn('max-w-2xl', className)}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2
        id={id}
        className={cn(
          'text-[1.75rem] leading-tight font-semibold tracking-tight text-balance sm:text-4xl',
          eyebrow && 'mt-3',
        )}
      >
        {title}
      </h2>
      {sub && (
        <p className="mt-4 text-base leading-7 text-pretty text-muted sm:text-lg sm:leading-8">
          {sub}
        </p>
      )}
    </div>
  )
}

function CheckList({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn('space-y-3 text-base leading-6', className)}>
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"
          >
            <Check size={12} strokeWidth={2.5} />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function FeatureRow({
  feature,
  index,
  theme,
}: {
  feature: Feature
  index: number
  theme: ResolvedTheme
}) {
  const flip = index % 2 === 1
  const small = feature.shot.width < 1000
  return (
    <section
      aria-labelledby={`feature-${feature.id}`}
      className="grid items-center gap-10 py-16 first:pt-0 last:pb-0 sm:py-20 lg:grid-cols-12 lg:gap-16"
    >
      <div className={cn('lg:col-span-5', flip && 'lg:order-2')}>
        <Eyebrow>{feature.label}</Eyebrow>
        <h2
          id={`feature-${feature.id}`}
          className="mt-3 text-[1.75rem] leading-tight font-semibold tracking-tight text-balance sm:text-[2rem]"
        >
          {feature.title}
        </h2>
        <p className="mt-4 text-base leading-7 text-pretty text-muted sm:text-lg sm:leading-8">
          {feature.body}
        </p>
        <CheckList items={feature.bullets} className="mt-7" />
      </div>
      <div className={cn('lg:col-span-7', flip && 'lg:order-1')}>
        <Stage className={cn(small ? 'px-6 py-12 sm:px-12 sm:py-20' : 'p-3 sm:p-5')}>
          <ShotFrame plain className={small ? 'mx-auto max-w-md' : undefined}>
            <ShotImage shot={feature.shot} theme={theme} />
          </ShotFrame>
        </Stage>
      </div>
    </section>
  )
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-border bg-bg-subtle', className)}>
      {children}
    </div>
  )
}

function CardIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-bg text-fg">
      {children}
    </span>
  )
}

export default function Landing() {
  const githubUrl: string = import.meta.env.VITE_GITHUB_URL || DEFAULT_GITHUB_URL
  const { user } = useAuth()
  const signedIn = Boolean(user)
  const { resolved: theme } = useTheme()
  const scrolled = useScrolled()
  const navLink =
    't focus-ring rounded-md px-2.5 py-1.5 text-sm text-muted hover:bg-bg-subtle hover:text-fg'
  const footLink = 't focus-ring rounded-sm text-sm text-muted hover:text-fg'

  return (
    <div className="min-h-screen overflow-x-clip bg-bg text-fg">
      <header
        className={cn(
          't sticky top-0 z-40 border-b',
          scrolled
            ? 'border-border bg-bg/80 backdrop-blur-md supports-[backdrop-filter]:bg-bg/70'
            : 'border-transparent bg-bg',
        )}
      >
        <div className={cn(CONTAINER, 'flex h-14 items-center justify-between gap-4')}>
          <div className="flex items-center gap-6">
            <Link to="/" aria-label="Squash home" className="focus-ring rounded-md">
              <Logo className="text-base" />
            </Link>
            <nav aria-label="Main navigation" className="hidden items-center gap-0.5 sm:flex">
              <Link to="/claude" className={navLink}>
                Claude Code
              </Link>
              <a href={githubUrl} className={navLink}>
                GitHub
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-1.5">
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
        </div>
      </header>

      <main>
        <section aria-labelledby="hero-heading" className="relative isolate">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[44rem] bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black_20%,transparent_100%)] bg-[size:64px_64px] opacity-50"
          />
          <div className={cn(CONTAINER, 'pt-16 sm:pt-28')}>
            <div className="max-w-4xl">
              <h1
                id="hero-heading"
                className="text-[2.75rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-6xl sm:leading-[1.02] lg:text-[5rem]"
              >
                Bug tracking at the speed of a screenshot
              </h1>
              <p className="mt-6 max-w-[36rem] text-base leading-7 text-pretty text-muted sm:text-xl sm:leading-8">
                Paste a screenshot, type what broke, and press Enter: your team sees it in about a
                second, and Claude Code can fix it from there.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <PrimaryCta signedIn={signedIn} />
                <a href={githubUrl} className={buttonClass('secondary', 'lg')}>
                  Self-host it
                </a>
              </div>
              <p className="mt-6 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted">
                <span>Free</span>
                <span aria-hidden="true" className="text-border">
                  /
                </span>
                <span>Open source (MIT)</span>
                <span aria-hidden="true" className="text-border">
                  /
                </span>
                <span>Self-host in minutes</span>
              </p>
            </div>
          </div>
          <div className={cn(CONTAINER, 'relative mt-14 pb-16 sm:mt-20 sm:pb-24')}>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-[15%] top-[10%] -z-10 h-2/3 rounded-full bg-accent/15 blur-[96px] dark:bg-accent/10"
            />
            {/* On phones the shot runs off the right edge so the bug list stays legible. */}
            <ShotFrame className="w-[180%] sm:w-full">
              <ShotImage shot={HERO_SHOT} theme={theme} lazy={false} />
            </ShotFrame>
          </div>
        </section>

        <div id="features" className="scroll-mt-14 border-t border-border py-16 sm:py-24">
          <div className={cn(CONTAINER, 'divide-y divide-border')}>
            {FEATURES.map((f, i) => (
              <FeatureRow key={f.id} feature={f} index={i} theme={theme} />
            ))}
          </div>
        </div>

        <section aria-labelledby="details-heading" className={SECTION}>
          <div className={CONTAINER}>
            <SectionIntro
              id="details-heading"
              eyebrow="And the rest"
              title="The small things, done properly"
              sub="Everything a small team reaches for every day, without settings to configure first."
            />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="flex flex-col sm:col-span-2">
                <div className="p-5 sm:p-8">
                  <CardIcon>
                    <Command size={16} aria-hidden="true" />
                  </CardIcon>
                  <h3 className="mt-5 text-base font-semibold">Command palette</h3>
                  <p className="mt-2 max-w-md text-base leading-6 text-muted">
                    Press ⌘K to jump to any bug by number or title, switch workspaces, export,
                    change theme, or open settings.
                  </p>
                </div>
                <div className="relative mt-auto h-56 overflow-hidden sm:h-64">
                  <div className="absolute inset-x-6 top-0 sm:inset-x-12">
                    <ShotFrame plain>
                      <ShotImage shot={PALETTE_SHOT} theme={theme} />
                    </ShotFrame>
                  </div>
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-bg-subtle to-transparent"
                  />
                </div>
              </Card>
              <Card className="p-5 sm:col-span-2 sm:p-8 lg:col-span-1 lg:row-span-2">
                <CardIcon>
                  <Keyboard size={16} aria-hidden="true" />
                </CardIcon>
                <h3 className="mt-5 text-base font-semibold">Keyboard first</h3>
                <p className="mt-2 text-base leading-6 text-muted">
                  Every action has a key. Press ? in the app for the full list.
                </p>
                <ul aria-label="Keyboard shortcuts" className="mt-6 divide-y divide-border">
                  {SHORTCUTS.map((s) => (
                    <li
                      key={s.label}
                      className="flex items-center justify-between gap-4 py-3 text-sm"
                    >
                      <span className="text-muted">{s.label}</span>
                      <span className="flex gap-1">
                        {s.keys.map((k) => (
                          <Kbd key={k} className="bg-bg">
                            {k}
                          </Kbd>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
              {DETAILS.map(({ icon: Icon, title, body }) => (
                <Card key={title} className="p-5 sm:p-8">
                  <CardIcon>
                    <Icon size={16} aria-hidden="true" />
                  </CardIcon>
                  <h3 className="mt-4 text-base font-semibold sm:mt-5">{title}</h3>
                  <p className="mt-2 text-base leading-6 text-muted">{body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="mobile-heading" className={SECTION}>
          <div className={cn(CONTAINER, 'grid items-center gap-12 lg:grid-cols-12 lg:gap-16')}>
            <div className="lg:col-span-5">
              <SectionIntro
                id="mobile-heading"
                eyebrow="Mobile"
                title="On your phone, too"
                sub="A list-to-detail layout built for one hand, with the same live updates as the desktop."
              />
              <CheckList items={MOBILE_POINTS} className="mt-7" />
            </div>
            <div className="lg:col-span-7">
              <Stage className="px-6 pt-10 sm:px-12 sm:pt-14">
                <div className="mx-auto flex max-w-lg items-start justify-center gap-4 sm:gap-6">
                  <PhoneFrame crop={PHONES[0]} className="-mb-24 w-1/2 sm:-mb-32" />
                  <PhoneFrame crop={PHONES[1]} className="mt-10 -mb-24 w-1/2 sm:mt-14 sm:-mb-32" />
                </div>
              </Stage>
            </div>
          </div>
        </section>

        <section aria-labelledby="how-heading" className={SECTION}>
          <div className={CONTAINER}>
            <SectionIntro
              id="how-heading"
              eyebrow="Getting started"
              title="How it works"
              sub="From sign-in to your first filed bug in under a minute."
            />
            <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="bg-bg p-6 sm:p-8">
                  <span className="font-mono text-sm text-accent">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
                  <p className="mt-2 text-base leading-6 text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="oss-heading" className={cn(SECTION, 'bg-bg-subtle')}>
          <div className={CONTAINER}>
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <SectionIntro
                id="oss-heading"
                eyebrow="Open source"
                title="Open source and yours to run"
                sub="Use the hosted version, or run your own copy on infrastructure you control."
              />
              <a
                href={`${githubUrl}#self-host`}
                className={buttonClass('secondary', 'lg', 'self-start lg:self-auto')}
              >
                Read the self-host guide
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
            <dl className="mt-12 grid gap-8 border-t border-border pt-10 sm:grid-cols-3 sm:gap-10">
              {SELF_HOST.map((s) => (
                <div key={s.title}>
                  <dt className="text-base font-semibold">{s.title}</dt>
                  <dd className="mt-2 text-base leading-6 text-muted">{s.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section aria-labelledby="faq-heading" className={SECTION}>
          <div className={cn(CONTAINER, 'grid gap-10 lg:grid-cols-12 lg:gap-16')}>
            <div className="lg:col-span-4">
              <SectionIntro id="faq-heading" eyebrow="FAQ" title="Questions" />
              <p className="mt-4 text-base leading-7 text-muted">
                Something else?{' '}
                <a
                  href={`${githubUrl}/issues`}
                  className="t focus-ring rounded-sm text-fg underline decoration-border underline-offset-4 hover:decoration-fg"
                >
                  Open an issue
                </a>
                .
              </p>
            </div>
            <div className="divide-y divide-border border-y border-border lg:col-span-8">
              {FAQ.map((item) => (
                <details key={item.q} className="group">
                  <summary className="t focus-ring flex cursor-pointer list-none items-center justify-between gap-6 rounded-md py-5 text-base font-medium hover:text-fg [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <ChevronDown
                      size={16}
                      aria-hidden="true"
                      className="shrink-0 text-muted transition-transform duration-200 ease-out group-open:rotate-180"
                    />
                  </summary>
                  <p className="-mt-1 max-w-2xl pr-10 pb-5 text-base leading-7 text-muted">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="cta-heading" className={cn(CONTAINER, 'pb-16 sm:pb-24')}>
          <div className="relative isolate overflow-hidden rounded-2xl border border-border bg-bg-subtle px-6 py-16 text-center sm:py-20">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_80%_at_50%_100%,black,transparent)] bg-[size:48px_48px] opacity-60"
            />
            <h2
              id="cta-heading"
              className="mx-auto max-w-xl text-[1.75rem] leading-tight font-semibold tracking-tight text-balance sm:text-4xl"
            >
              File your first bug in under a minute
            </h2>
            <p className="mt-4 text-base text-muted sm:text-lg">
              Sign in, paste a screenshot, press Enter.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <PrimaryCta signedIn={signedIn} />
              <Link to="/claude" className={buttonClass('secondary', 'lg')}>
                Set up Claude Code
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className={cn(CONTAINER, 'grid gap-10 py-12 sm:py-16 md:grid-cols-12')}>
          <div className="md:col-span-6">
            <Logo size={20} className="text-sm" />
            <p className="mt-4 max-w-xs text-sm leading-6 text-muted">
              Real-time bug tracking for founding teams of two to ten.
            </p>
          </div>
          <nav aria-label="Footer navigation" className="grid grid-cols-3 gap-6 md:col-span-6">
            <div>
              <p className="text-sm font-medium">Product</p>
              <ul className="mt-4 space-y-3">
                <li>
                  <a href="#features" className={footLink}>
                    Features
                  </a>
                </li>
                <li>
                  <Link to="/claude" className={footLink}>
                    Claude Code
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium">Source</p>
              <ul className="mt-4 space-y-3">
                <li>
                  <a href={githubUrl} className={footLink}>
                    GitHub
                  </a>
                </li>
                <li>
                  <a href={`${githubUrl}/releases`} className={footLink}>
                    Releases
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium">Legal</p>
              <ul className="mt-4 space-y-3">
                <li>
                  <Link to="/privacy" className={footLink}>
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className={footLink}>
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </nav>
        </div>
        <div className={CONTAINER}>
          <p className="border-t border-border py-6 text-xs text-muted">
            © {new Date().getFullYear()} Squash contributors. Released under the MIT License.
          </p>
        </div>
      </footer>
    </div>
  )
}
