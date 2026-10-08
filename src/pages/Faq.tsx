import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { arrowLinkClass } from '../components/marketing/ActionBand'
import { facts } from '../components/marketing/facts'
import { githubUrl } from '../components/marketing/links'
import { MK_CONTAINER, MarketingLayout } from '../components/marketing/MarketingLayout'
import { PageHero } from '../components/marketing/PageHero'
import { Reveal } from '../components/marketing/Reveal'
import { usePageTitle } from '../components/marketing/usePageTitle'
import { buttonClass, proseLinkClass } from '../components/ui'
import { cn } from '../lib/utils'

interface Question {
  id: string
  q: string
  a: ReactNode
}

const code = 'rounded-sm border border-line bg-surface-1 px-1 font-mono text-[0.9em] text-ink'

function DocLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={proseLinkClass}>
      {children}
    </Link>
  )
}

const GROUPS: { title: string; questions: Question[] }[] = [
  {
    title: 'Your data',
    questions: [
      {
        id: 'where-is-data-stored',
        q: 'Where is my data stored?',
        a: (
          <>
            <p>
              In a Supabase project: bugs, comments, activity and members in its Postgres database,
              screenshots in a private storage bucket. On the hosted instance that is the hosted
              instance’s project; when you self-host, it is yours.
            </p>
            <p>
              Screenshots are compressed to WebP in your browser before they upload, and are only
              ever served through signed links that expire after an hour.
            </p>
          </>
        ),
      },
      {
        id: 'who-can-see',
        q: 'Who can see my bugs?',
        a: (
          <p>
            Only members of the workspace. Row Level Security on every table and on the storage
            bucket means the database itself refuses everyone else, whatever the browser asks for.
            The policy suite has {facts.rlsChecks} checks; read them in{' '}
            <a href={`${githubUrl()}/blob/main/supabase/tests/rls.sql`} className={proseLinkClass}>
              supabase/tests/rls.sql
            </a>
            .
          </p>
        ),
      },
      {
        id: 'trackers',
        q: 'Does Squash use analytics or trackers?',
        a: (
          <p>
            No. The app has no analytics, advertising or tracking scripts, and its fonts are
            self-hosted. Your browser’s local storage keeps a few preferences, such as the theme,
            the list width and the last workspace you opened. See the{' '}
            <DocLink to="/privacy">privacy notice</DocLink> for everything that is stored.
          </p>
        ),
      },
      {
        id: 'delete-account',
        q: 'Can I delete my account?',
        a: (
          <p>
            Yes, from Settings. It removes your profile, your sign-in and the workspaces you own
            alone. If you own a workspace with other members, transfer it first. Bugs and comments
            you wrote in other people’s workspaces stay, shown as written by “Deleted user”.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Running it',
    questions: [
      {
        id: 'cost',
        q: 'What does it cost?',
        a: (
          <p>
            Nothing. The hosted instance has no paid tier, and the code is {facts.license} licensed.
            If you self-host, you pay your own Supabase and hosting bills.{' '}
            <DocLink to="/pricing">Pricing</DocLink> has the details.
          </p>
        ),
      },
      {
        id: 'self-host',
        q: 'Can I self-host it?',
        a: (
          <p>
            Yes. You need Node.js 24, a free Supabase project and, if you want it online, a static
            host such as Vercel. {facts.migrations} SQL migrations set up everything else. Follow{' '}
            <DocLink to="/docs/self-host">the self-host guide</DocLink>.
          </p>
        ),
      },
      {
        id: 'team-size',
        q: 'How many people can share a workspace?',
        a: (
          <p>
            Up to 10. Each person can own up to 5 workspaces and belong to more. Squash is built for
            small teams; the limits are enforced by the database and, when you self-host, set in the
            migrations you run.
          </p>
        ),
      },
      {
        id: 'api',
        q: 'Is there an API?',
        a: (
          <p>
            Not a separate one. The app talks to Supabase’s standard REST and Realtime APIs, and
            every rule is enforced there, so a script signed in as you can do what you can do in the
            app. That interface is not documented or versioned as a public API, and may change
            between releases.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Using it',
    questions: [
      {
        id: 'claude-access',
        q: 'What does Claude Code get access to?',
        a: (
          <>
            <p>
              The bugs you send, with their comments and screenshot links, go to a small helper on
              your own computer (it listens only on <code className={code}>127.0.0.1:4317</code>
              ). The helper saves them under <code className={code}>.squash/</code> in the project
              folder you chose and starts Claude Code there.
            </p>
            <p>
              Claude Code then works with your normal Claude Code permissions: the folder is its
              working directory, not a sandbox. Squash never receives your code. When a run ends,
              its summary (and the branch, commit and pull request, if it reports them) is saved on
              the bug. <DocLink to="/claude">The Claude Code guide</DocLink> covers the rest.
            </p>
          </>
        ),
      },
      {
        id: 'mobile',
        q: 'Does it work on my phone?',
        a: (
          <p>
            Yes. On a phone the list and the bug detail stack, the file picker opens the camera, and
            you can install Squash to your home screen. It needs a connection: there is no offline
            mode.
          </p>
        ),
      },
      {
        id: 'outside-browser',
        q: 'Can I file a bug without switching to the browser?',
        a: (
          <p>
            On macOS, yes: a small script adds a global hotkey (<kbd className={code}>⌃⌥S</kbd>)
            that grabs a screenshot and brings Squash to the front with it ready to paste. See{' '}
            <DocLink to="/docs/capture#file-from-any-app-on-macos">Capture</DocLink>.
          </p>
        ),
      },
      {
        id: 'voice',
        q: 'Can I dictate a bug?',
        a: (
          <p>
            Yes, in Chrome, Edge and Safari, through the browser’s built-in speech recognition. Your
            browser decides where the audio is processed; in Chrome that is Google’s speech service.
          </p>
        ),
      },
    ],
  },
]

const FAQ_COUNT = GROUPS.reduce((n, group) => n + group.questions.length, 0)

export default function Faq() {
  usePageTitle('FAQ')
  return (
    <MarketingLayout>
      <PageHero
        eyebrow={['FAQ', `${FAQ_COUNT} questions`]}
        title="Questions, answered from the code."
      >
        <p>
          Where your data lives, what Claude Code can see, and what it costs. Every answer here
          describes how Squash works today.
        </p>
      </PageHero>
      {GROUPS.map((group, g) => (
        <section
          key={group.title}
          aria-labelledby={`faq-group-${g}`}
          className="border-t border-line py-14 lg:py-20"
        >
          <div className={cn(MK_CONTAINER, 'grid gap-8 lg:grid-cols-12')}>
            <div className="lg:col-span-3">
              <p className="specimen-label text-ink-3">
                <span className="text-accent">{String(g + 1).padStart(2, '0')}</span> · Topic
              </p>
              <h2
                id={`faq-group-${g}`}
                className="mt-3 text-2xl font-semibold tracking-[-0.02em] lg:sticky lg:top-28"
              >
                {group.title}
              </h2>
            </div>
            <div className="lg:col-span-9">
              {group.questions.map((question, i) => (
                <Reveal key={question.id} delay={i === 0 ? 80 : 0}>
                  <article
                    id={question.id}
                    aria-labelledby={`${question.id}-q`}
                    className="grid scroll-mt-24 gap-3 border-t border-line py-7 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-8"
                  >
                    <h3
                      id={`${question.id}-q`}
                      className="text-lg font-medium tracking-[-0.01em] text-balance"
                    >
                      {question.q}
                    </h3>
                    <div className="space-y-3 text-read text-pretty text-ink-2">{question.a}</div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ))}
      <section aria-labelledby="faq-more" className="cabinet-light border-t border-line">
        <div className={cn(MK_CONTAINER, 'py-16 lg:py-24')}>
          <p className="specimen-label text-ink-3">Still stuck</p>
          <h2
            id="faq-more"
            className="mt-3 max-w-[22ch] text-[2rem]/[2.4rem] font-semibold tracking-[-0.025em] sm:text-display-s"
          >
            Ask on GitHub.
          </h2>
          <p className="mt-4 max-w-[56ch] text-read text-ink-2">
            Open an issue with your question. For a security problem, use a private advisory
            instead.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3">
            <a href={`${githubUrl()}/issues`} className={buttonClass('secondary', 'lg')}>
              Open an issue
            </a>
            <Link to="/docs" className={arrowLinkClass}>
              Read the docs
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  )
}
