// Demo data for README screenshots: a small team building "Lumen", a fictional analytics app.
import type { ClaudeRun } from '../../src/lib/claudeExport'
import type { Bug, BugAttachment, BugEvent, Comment, Profile, Workspace } from '../../src/lib/types'

const now = Date.now()
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString()

export const ME = 'u-maya'
export const WORKSPACE_ID = 'ws-lumen'

export const profiles: Profile[] = [
  {
    id: ME,
    display_name: 'Maya Chen',
    avatar_url: null,
    avatar_color: '#7c3aed',
    created_at: ago(60 * 24 * 40),
  },
  {
    id: 'u-jordan',
    display_name: 'Jordan Ellis',
    avatar_url: null,
    avatar_color: '#0891b2',
    created_at: ago(60 * 24 * 39),
  },
  {
    id: 'u-priya',
    display_name: 'Priya Raman',
    avatar_url: null,
    avatar_color: '#db2777',
    created_at: ago(60 * 24 * 20),
  },
]

export const workspaces: Workspace[] = [
  {
    id: WORKSPACE_ID,
    name: 'Lumen',
    invite_code: 'k3x9-lumen',
    owner_id: ME,
    created_at: ago(60 * 24 * 40),
  },
  {
    id: 'ws-side',
    name: 'Side project',
    invite_code: 'p2q8-side',
    owner_id: ME,
    created_at: ago(60 * 24 * 10),
  },
]

export const workspace_members = [
  { workspace_id: WORKSPACE_ID, user_id: ME, role: 'owner', joined_at: ago(60 * 24 * 40) },
  { workspace_id: WORKSPACE_ID, user_id: 'u-jordan', role: 'member', joined_at: ago(60 * 24 * 39) },
  { workspace_id: WORKSPACE_ID, user_id: 'u-priya', role: 'member', joined_at: ago(60 * 24 * 20) },
  { workspace_id: 'ws-side', user_id: ME, role: 'owner', joined_at: ago(60 * 24 * 10) },
]

type Seed = Pick<Bug, 'number' | 'title' | 'severity' | 'filed_by'> &
  Partial<Bug> & { minutes: number }

const seeds: Seed[] = [
  {
    number: 24,
    title: 'Checkout button hidden behind cookie banner on iPhone',
    description:
      'On iOS Safari the cookie banner sits on top of "Pay now", so you can\'t finish checkout until you dismiss it. Happens on every plan page.',
    severity: 'critical',
    filed_by: 'u-jordan',
    minutes: 6,
  },
  {
    number: 23,
    title: 'Revenue chart labels overlap when the range is 90 days',
    description:
      'X-axis labels collide once there are more than ~30 points. Probably need to thin the ticks or rotate them.',
    severity: 'high',
    filed_by: ME,
    minutes: 38,
  },
  {
    number: 22,
    title: 'CSV export drops rows with emoji in the name',
    description:
      'Customer "Café ☕ Co" is missing from the export. Row count is off by 3 for our own workspace.',
    transcript:
      'csv export drops any customer with an emoji in their name, three rows missing for us',
    severity: 'high',
    filed_by: 'u-priya',
    minutes: 95,
  },
  {
    number: 21,
    title: 'Invite email lands in spam for Outlook users',
    description:
      'Two trial users said they never got the invite. Both on Outlook. Check SPF/DKIM on the sending domain.',
    severity: 'medium',
    filed_by: 'u-jordan',
    minutes: 60 * 3,
  },
  {
    number: 20,
    title: 'Dark mode: tooltip text is unreadable on the funnel view',
    description: 'Tooltip uses the light background but inherits the dark-mode text color.',
    severity: 'medium',
    filed_by: 'u-priya',
    minutes: 60 * 5,
  },
  {
    number: 19,
    title: 'Date picker starts weeks on Sunday for UK locale',
    description: 'Should respect the locale and start on Monday.',
    severity: 'low',
    filed_by: ME,
    minutes: 60 * 9,
  },
  {
    number: 18,
    title: 'Settings avatar looks blurry on retina screens',
    description: 'We render the 64px thumbnail at 128px.',
    severity: 'low',
    filed_by: 'u-jordan',
    minutes: 60 * 26,
    status: 'resolved',
    resolved_by: ME,
    resolved_at: ago(60 * 20),
    resolution_note: 'Serve the 2x thumbnail via srcset.',
  },
  {
    number: 17,
    title: 'Search loses focus after applying a filter',
    description: 'Typing, then picking a filter, then typing again goes nowhere.',
    severity: 'medium',
    filed_by: 'u-priya',
    minutes: 60 * 30,
    status: 'resolved',
    resolved_by: 'u-jordan',
    resolved_at: ago(60 * 28),
    resolution_note: 'Return focus to the input after the filter menu closes.',
  },
  {
    number: 16,
    title: 'Signup form accepts an empty company name',
    description: '',
    severity: 'low',
    filed_by: ME,
    minutes: 60 * 50,
    status: 'resolved',
    resolved_by: ME,
    resolved_at: ago(60 * 47),
    resolution_note: null,
  },
  {
    number: 15,
    title: "Weekly digest shows last week's numbers on Mondays",
    description: 'Timezone bug in the cron, runs before midnight UTC for US customers.',
    severity: 'high',
    filed_by: 'u-jordan',
    minutes: 60 * 72,
    status: 'resolved',
    resolved_by: 'u-priya',
    resolved_at: ago(60 * 70),
    resolution_note: 'Schedule per workspace timezone.',
  },
]

const featureSeeds: Seed[] = [
  {
    number: 25,
    title: 'Slack alert when a critical bug is filed',
    description: 'Ping #eng when severity is Critical so it gets eyes in minutes, not hours.',
    severity: 'medium',
    filed_by: 'u-priya',
    minutes: 20,
    kind: 'feature',
  },
  {
    number: 14,
    title: 'Saved dashboard views per teammate',
    description: 'Let each person pin their own default filters.',
    severity: 'low',
    filed_by: 'u-jordan',
    minutes: 60 * 80,
    kind: 'feature',
  },
]

export const bugs: Bug[] = [...seeds, ...featureSeeds].map((s) => ({
  id: `bug-${s.number}`,
  workspace_id: WORKSPACE_ID,
  number: s.number,
  title: s.title,
  description: s.description ?? '',
  transcript: s.transcript ?? null,
  severity: s.severity,
  status: s.status ?? 'open',
  kind: s.kind ?? 'bug',
  filed_by: s.filed_by,
  created_at: ago(s.minutes),
  resolved_by: s.resolved_by ?? null,
  resolved_at: s.resolved_at ?? null,
  resolution_note: s.resolution_note ?? null,
  updated_at: s.resolved_at ?? ago(s.minutes),
}))

/** Screenshot fixtures are rendered by capture.mjs and served under /__shots/. */
const attachment = (
  bug: number,
  file: string,
  i: number,
  width: number,
  height: number,
): BugAttachment => ({
  id: `att-${bug}-${i}`,
  bug_id: `bug-${bug}`,
  storage_path: `${WORKSPACE_ID}/bug-${bug}/${file}`,
  width,
  height,
  size_bytes: 180_000,
  created_at: ago(5),
})

export const bug_attachments: BugAttachment[] = [
  attachment(24, 'checkout-desktop.png', 0, 1600, 1000),
  attachment(24, 'checkout-mobile.png', 1, 780, 1400),
  attachment(23, 'chart-labels.png', 0, 2400, 1120),
  attachment(20, 'tooltip-dark.png', 0, 1600, 1000),
]

export const comments: Comment[] = [
  {
    id: 'c-1',
    bug_id: 'bug-24',
    author_id: ME,
    body: 'Reproduced on iPhone 15 and the Pixel 8 too. The banner is position: fixed with z-index 9999.',
    created_at: ago(4),
  },
  {
    id: 'c-2',
    bug_id: 'bug-24',
    author_id: 'u-jordan',
    body: 'This is costing us conversions, sending it to Claude now.',
    created_at: ago(3),
  },
]

export const bug_events: BugEvent[] = [
  ...bugs
    .filter((b) => b.number !== 24)
    .flatMap((b): BugEvent[] => [
      {
        id: `e-f${b.number}`,
        bug_id: b.id,
        actor_id: b.filed_by,
        type: 'filed',
        note: null,
        created_at: b.created_at,
      },
      ...(b.resolved_by && b.resolved_at
        ? [
            {
              id: `e-r${b.number}`,
              bug_id: b.id,
              actor_id: b.resolved_by,
              type: 'resolved' as const,
              note: b.resolution_note,
              created_at: b.resolved_at,
            },
          ]
        : []),
    ]),
  {
    id: 'e-1',
    bug_id: 'bug-24',
    actor_id: 'u-jordan',
    type: 'filed',
    note: null,
    created_at: ago(6),
  },
  { id: 'e-2', bug_id: 'bug-24', actor_id: ME, type: 'edited', note: null, created_at: ago(5) },
  { id: 'e-3', bug_id: 'bug-24', actor_id: ME, type: 'commented', note: null, created_at: ago(4) },
  {
    id: 'e-4',
    bug_id: 'bug-24',
    actor_id: 'u-jordan',
    type: 'commented',
    note: null,
    created_at: ago(3),
  },
]

/** Teammates online right now, and the bug each one has open. */
export const presence = [
  { user_id: ME, viewing: 'bug-24', online_at: ago(0) },
  { user_id: 'u-jordan', viewing: 'bug-24', online_at: ago(1) },
  { user_id: 'u-priya', viewing: 'bug-22', online_at: ago(2) },
]

/** What the local Claude Code helper reports while it works on #24. */
export const claudeRuns: ClaudeRun[] = [
  {
    id: 'run-1',
    bugs: [24],
    folder: '~/code/lumen',
    startedAt: ago(2.4),
    updatedAt: ago(0.1),
    state: 'working',
    activity: 'Editing src/components/CookieBanner.tsx',
    message:
      'The banner is fixed to the bottom with z-index 9999, so it covers the sticky checkout bar on small screens. Moving it above the bar and adding bottom padding to the page while it is visible.',
    todos: [
      { text: 'Reproduce at 390px width', status: 'completed' },
      { text: 'Find what overlaps the Pay now button', status: 'completed' },
      { text: 'Offset the banner above the checkout bar', status: 'in_progress' },
      { text: 'Run the checkout e2e tests', status: 'pending' },
    ],
    steps: [
      { t: ago(2.2), text: 'Read src/pages/Checkout.tsx' },
      { t: ago(1.8), text: 'Searched for "z-index: 9999"' },
      { t: ago(1.1), text: 'Read src/components/CookieBanner.tsx' },
      { t: ago(0.2), text: 'Editing src/components/CookieBanner.tsx' },
    ],
    stepCount: 14,
  },
]

/** Per-person totals for the stats popover (the workspace_stats RPC). */
export const workspaceStats = [
  { user_id: ME, filed_total: 41, resolved_total: 37, filed_7d: 9, resolved_7d: 11 },
  { user_id: 'u-jordan', filed_total: 33, resolved_total: 24, filed_7d: 7, resolved_7d: 5 },
  { user_id: 'u-priya', filed_total: 19, resolved_total: 22, filed_7d: 6, resolved_7d: 8 },
]
