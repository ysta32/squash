import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CHAPTERS, type Shot } from '../components/landing/content'
import { DrawerFrame, MarkerStroke, ShotImage } from '../components/landing/Frames'
import { ActionBand, FactList, arrowLinkClass } from '../components/marketing/ActionBand'
import { facts } from '../components/marketing/facts'
import {
  MK_CONTAINER,
  MarketingLayout,
  OpenWorkspaceLink,
} from '../components/marketing/MarketingLayout'
import { PageHero } from '../components/marketing/PageHero'
import { Reveal } from '../components/marketing/Reveal'
import { buttonClass } from '../components/ui'
import { bugsToCsv, bugsToMarkdown, exportFilename } from '../lib/export'
import { useTheme, type ResolvedTheme } from '../lib/theme'
import type { BugWithMeta } from '../lib/types'
import { cn } from '../lib/utils'
import { usePageTitle } from '../components/marketing/usePageTitle'

const [CAPTURE, MARKUP, CLAUDE] = CHAPTERS

const WORKSPACE_SHOT: Shot = {
  name: 'workspace',
  themed: true,
  width: 1600,
  height: 1000,
  alt: 'The demo workspace: the live bug list with teammates’ avatars, and bug #24 open beside it',
}
const PALETTE_SHOT: Shot = {
  name: 'palette',
  themed: true,
  width: 1000,
  height: 761,
  alt: 'The command palette listing actions, export commands and bugs',
}
const STATS_SHOT: Shot = {
  name: 'stats',
  themed: true,
  width: 720,
  height: 375,
  alt: 'The stats popover: bugs filed and resolved per teammate, for the last 7 days and all time',
}

/** Bug #24 of the demo workspace (scripts/screenshots/seed.ts), for the export sample. */
const DEMO_BUG: BugWithMeta = {
  id: 'demo-24',
  workspace_id: 'ws-lumen',
  number: 24,
  kind: 'bug',
  title: 'Checkout button hidden behind cookie banner on iPhone',
  description:
    'On iOS Safari the cookie banner sits on top of "Pay now", so you can\'t finish checkout until you dismiss it.',
  context: {
    url: 'https://app.lumen.example/checkout?plan=growth',
    viewport: { w: 390, h: 844, dpr: 3 },
    browser: 'Safari 18',
    os: 'iOS',
  },
  transcript: null,
  severity: 'critical',
  status: 'open',
  filed_by: 'u-jordan',
  created_at: '2026-10-06T14:24:00.000Z',
  resolved_by: null,
  resolved_at: null,
  resolution_note: null,
  updated_at: '2026-10-06T14:24:00.000Z',
  assignee_id: 'u-maya',
  attachments: [],
}

interface Group {
  id: string
  name: string
  title: string
  body: ReactNode
  facts: ReactNode[]
  visual: (theme: ResolvedTheme) => ReactNode
  more?: { label: string; to: string }
}

function Screenshot({
  shot,
  theme,
  marker,
  cropHeight,
}: {
  shot: Shot
  theme: ResolvedTheme
  marker?: (typeof CHAPTERS)[number]['marker']
  /** Shows only the top of the image, in image pixels (cuts app chrome below a popover). */
  cropHeight?: number
}) {
  return (
    <figure>
      <DrawerFrame>
        <ShotImage
          shot={shot}
          theme={theme}
          style={cropHeight ? { aspectRatio: `${shot.width} / ${cropHeight}` } : undefined}
          className={cropHeight ? 'object-cover object-top' : undefined}
        />
        {marker && <MarkerStroke shot={shot} marker={marker} />}
      </DrawerFrame>
      {marker && (
        <figcaption className="specimen-label mt-3 flex items-center gap-2 text-ink-3">
          <span aria-hidden="true" className="h-0.5 w-4 rounded-xs bg-markup" />
          Marked: {marker.label}
        </figcaption>
      )}
    </figure>
  )
}

/** The real exporter run on the demo bug: what lands in your Downloads folder. */
const EXPORTED_AT = new Date('2026-10-06T14:30:00Z')

function ExportFile({
  format,
  mime,
  lines,
}: {
  format: 'csv' | 'md'
  mime: string
  lines: string[]
}) {
  return (
    <figure className="overflow-hidden rounded-xl border border-line-2 bg-surface-2 shadow-elev-2">
      <figcaption className="flex items-center justify-between gap-4 border-b border-line px-4 py-2.5">
        <span className="specimen-label truncate text-ink-2">
          {exportFilename('Lumen', format, EXPORTED_AT)}
        </span>
        <span className="specimen-label shrink-0 text-ink-3">{mime}</span>
      </figcaption>
      <pre className="mk-scroll-mask overflow-x-auto px-4 py-4 text-xs leading-6 text-ink">
        <code>
          {lines.map((line, i) => (
            <span
              key={i}
              className={cn(
                'block min-h-6 whitespace-pre',
                format === 'csv' && i === 0 && 'text-ink-3',
              )}
            >
              {line}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  )
}

function ExportSample() {
  return (
    <div className="grid gap-4">
      <ExportFile
        format="csv"
        mime="text/csv"
        lines={bugsToCsv([DEMO_BUG]).trimEnd().split('\r\n')}
      />
      <ExportFile
        format="md"
        mime="text/markdown"
        lines={bugsToMarkdown([DEMO_BUG], 'Lumen').trimEnd().split('\n')}
      />
    </div>
  )
}

const LIMITS: [string, string][] = [
  ['Members per workspace', '10'],
  ['Workspaces owned per person', '5'],
  ['Images per bug', '10'],
  ['Bugs filed per person', '30 / min'],
  ['Comments per person', '30 / min'],
]

function SecurityPanel() {
  return (
    <div className="rounded-xl border border-line-2 bg-surface-2 p-6 shadow-elev-2 sm:p-8">
      <p className="specimen-label text-ink-3">Enforced by the database</p>
      <p className="mt-4 text-[3.5rem]/none font-semibold tracking-[-0.03em] tabular-nums">
        {facts.rlsChecks}
      </p>
      <p className="mt-2 text-sm font-medium">Row Level Security checks in the policy suite</p>
      <dl className="mt-8 border-b border-line">
        {LIMITS.map(([term, value]) => (
          <div
            key={term}
            className="flex items-baseline justify-between gap-4 border-t border-line py-2.5"
          >
            <dt className="text-sm text-ink-2">{term}</dt>
            <dd className="font-mono text-sm text-ink tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

const GROUPS: Group[] = [
  {
    id: 'capture',
    name: 'Capture',
    title: CAPTURE.title,
    body: CAPTURE.body,
    facts: [...CAPTURE.facts, 'Up to 10 images per bug; they upload while you keep working'],
    visual: (theme) => <Screenshot shot={CAPTURE.shot} theme={theme} marker={CAPTURE.marker} />,
    more: { label: 'Read the capture docs', to: '/docs/capture' },
  },
  {
    id: 'markup',
    name: 'Markup',
    title: MARKUP.title,
    body: 'Draw on a screenshot before you file it, or later. Markup is kept as layers over the untouched original, so it stays sharp and can be changed.',
    facts: [
      'Arrow, box, pen and numbered pin on A, B, P and N',
      'Each pin’s note becomes a checklist line on the bug',
      '⌘Z undoes; Esc asks before throwing work away',
      'Only the person who uploaded a screenshot can edit its markup',
    ],
    visual: (theme) => <Screenshot shot={MARKUP.shot} theme={theme} marker={MARKUP.marker} />,
    more: { label: 'Read the markup docs', to: '/docs/markup' },
  },
  {
    id: 'live',
    name: 'Live',
    title: 'Everyone sees the same list.',
    body: 'New bugs, edits, comments and resolutions reach every teammate in about a second, with no refresh. You can see who is online and which bug they have open.',
    facts: [
      'Presence: who is online, and what they are looking at',
      'A desktop notification and an unread count when Squash is in a background tab',
      'Filters, tabs and sort order live in the URL, so a view can be shared',
      'Full-text search across titles, descriptions and voice transcripts',
    ],
    visual: (theme) => <Screenshot shot={WORKSPACE_SHOT} theme={theme} />,
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    title: CLAUDE.title,
    body: CLAUDE.body,
    facts: [
      ...CLAUDE.facts,
      'A fix record with the branch, commit, PR link and files changed, once a run reports them',
    ],
    visual: (theme) => <Screenshot shot={CLAUDE.shot} theme={theme} marker={CLAUDE.marker} />,
    more: { label: 'Read the Claude Code guide', to: '/claude' },
  },
  {
    id: 'keyboard',
    name: 'Keyboard',
    title: 'Every action has a key.',
    body: (
      <>
        {facts.shortcuts.length} shortcuts, and a command palette on ⌘K or Ctrl K that jumps to any
        bug by number or title, switches workspaces, exports and changes the theme.
      </>
    ),
    facts: [
      'J and K move through the list; R resolves, O reopens',
      'I takes the selected bug yourself; A opens the assignee picker',
      'X picks bugs for Claude Code; C sends them',
      '? shows every shortcut',
    ],
    visual: (theme) => <Screenshot shot={PALETTE_SHOT} theme={theme} />,
    more: { label: 'See every shortcut', to: '/docs/keyboard' },
  },
  {
    id: 'workspace',
    name: 'Workspace',
    title: 'Built for 2–10 people.',
    body: 'One invite link per workspace. Owners rename, regenerate the invite, remove members and transfer ownership; everyone else files, assigns and resolves.',
    facts: [
      'Up to 10 members per workspace',
      'Bugs and feature requests in their own tabs; items move between the two',
      'Assignees, and filters for what is yours or what nobody has picked up',
      'Who is carrying the load: filed and resolved per teammate, all time and last 7 days',
    ],
    visual: (theme) => <Screenshot shot={STATS_SHOT} theme={theme} cropHeight={318} />,
    more: { label: 'Get started', to: '/docs/getting-started' },
  },
  {
    id: 'export',
    name: 'Export',
    title: 'Your bugs, in a file.',
    body: 'Download the bugs you are looking at, with your filters applied, as CSV or as a Markdown report. Below is the demo workspace’s bug #24 run through the same exporter the app uses.',
    facts: [
      'CSV that is safe to open in a spreadsheet: cells that start with =, +, - or @ are neutralised',
      'Each bug’s page, device and browser travel with it',
      'A Markdown report with a summary table and one section per bug',
    ],
    visual: () => <ExportSample />,
  },
  {
    id: 'security',
    name: 'Security',
    title: 'Enforced in Postgres.',
    body: 'Squash is one public instance where strangers share infrastructure, so every rule lives in the database, not the browser.',
    facts: [
      'Row Level Security on every table and on the storage bucket',
      'Joining only through an RPC that checks the invite code',
      'Private screenshots behind signed links that expire after an hour',
      'An append-only activity log written by database triggers',
    ],
    visual: () => <SecurityPanel />,
    more: { label: 'Read the security model', to: '/docs/security' },
  },
]

function Contents() {
  return (
    <nav aria-label="Feature groups" className="lg:pb-2">
      <p className="specimen-label text-ink-3">On this page</p>
      <ol className="mt-3 grid grid-cols-2 border-t border-line sm:grid-cols-4 lg:grid-cols-2">
        {GROUPS.map((group, i) => (
          <li key={group.id} className="border-b border-line">
            <a
              href={`#${group.id}`}
              className="t focus-ring-inset group flex h-11 items-center gap-3 pr-2 text-sm text-ink-2 hover:text-ink"
            >
              <span className="specimen-label text-accent">{String(i + 1).padStart(2, '0')}</span>
              {group.name}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

function GroupSection({
  group,
  index,
  theme,
}: {
  group: Group
  index: number
  theme: ResolvedTheme
}) {
  const flip = index % 2 === 1
  const headingId = `${group.id}-heading`
  return (
    <section
      id={group.id}
      aria-labelledby={headingId}
      className="scroll-mt-20 border-t border-line py-16 lg:py-24"
    >
      <div className={cn(MK_CONTAINER, 'grid items-start gap-10 lg:grid-cols-12 lg:gap-8')}>
        <Reveal className={cn('lg:col-span-5', flip ? 'lg:order-2 lg:col-start-8' : 'lg:pr-8')}>
          <p className="specimen-label text-ink-3">
            <span className="text-accent">{String(index + 1).padStart(2, '0')}</span> · {group.name}
          </p>
          <h2
            id={headingId}
            className="mt-3 text-[2rem]/[2.4rem] font-semibold tracking-[-0.025em] text-balance lg:text-display-s"
          >
            {group.title}
          </h2>
          <p className="mt-4 max-w-[56ch] text-read text-pretty text-ink-2">{group.body}</p>
          <FactList facts={group.facts} className="mt-8" />
          {group.more && (
            <Link to={group.more.to} className={cn(arrowLinkClass, 'mt-3')}>
              {group.more.label}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </Reveal>
        <Reveal delay={80} className={cn('lg:col-span-7', flip && 'lg:order-1')}>
          {group.visual(theme)}
        </Reveal>
      </div>
    </section>
  )
}

export default function Features() {
  usePageTitle('Features')
  const { resolved: theme } = useTheme()
  return (
    <MarketingLayout>
      <PageHero
        eyebrow={['Features', `${GROUPS.length} groups`, `v${facts.version}`]}
        title="Everything Squash does, on one page."
        actions={
          <>
            <OpenWorkspaceLink size="lg" />
            <Link to="/docs/self-host" className={buttonClass('secondary', 'lg')}>
              Self-host it
            </Link>
          </>
        }
        aside={<Contents />}
      >
        <p>
          Bug reports usually arrive as a screenshot in a chat thread, with no page, no device and
          no owner. Squash turns that screenshot into a filed bug in one keystroke, and hands it to
          Claude Code when you want it fixed.
        </p>
        <p className="text-base text-ink-3">
          Every picture below is the real app, running on the demo workspace.
        </p>
      </PageHero>
      {GROUPS.map((group, i) => (
        <GroupSection key={group.id} group={group} index={i} theme={theme} />
      ))}
      <ActionBand title="File the next bug in Squash.">
        <p>
          Free on the hosted instance, with no paid tier. {facts.license} licensed if you would
          rather run your own.
        </p>
      </ActionBand>
    </MarketingLayout>
  )
}
