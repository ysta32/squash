// Copy and data for the marketing home. Everything here describes shipped behaviour (README,
// CHANGELOG); numbers that can drift come from `virtual:squash-facts` instead of being typed here.
import type { ResolvedTheme } from '../../lib/theme'

export interface Shot {
  /** File in public/product without extension; themed shots get a -light/-dark suffix. */
  name: string
  themed: boolean
  /** Intrinsic pixel size of the file, so the browser reserves space before it loads. */
  width: number
  height: number
  alt: string
}

export function shotSrc(shot: Shot, theme: ResolvedTheme): string {
  return `/product/${shot.themed ? `${shot.name}-${theme}` : shot.name}.webp`
}

export const HERO_SHOT: Shot = {
  name: 'workspace',
  themed: true,
  width: 1600,
  height: 1000,
  alt: 'The Squash workspace: a live bug list on the left, and bug #24 open on the right with Claude Code working on the fix, its description and two screenshots',
}

/** The demo workspace's bug #24, as its specimen label reads in the app. */
export const HERO_LABEL: string[][] = [
  ['No. 024', 'Bug', 'Critical'],
  ['Coll. J. Ellis', '/checkout', 'iOS Safari 390×844'],
]

/** A hand-drawn marker stroke over a screenshot, in the screenshot's own pixel coordinates. */
export interface Marker {
  d: string
  label: string
}

export interface Chapter {
  id: string
  number: string
  name: string
  title: string
  body: string
  facts: string[]
  shot: Shot
  marker: Marker
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'capture',
    number: '01',
    name: 'Capture',
    title: 'Paste, type, press Enter.',
    body: 'One input sits above the list. Press ⌘V anywhere on the page and the screenshot lands in it with the cursor ready. No forms, no required fields, no templates.',
    facts: [
      'Browser, OS, window size and page URL are recorded with every bug',
      'Images shrink to WebP in the browser, about 300 KB each',
      'Dictate instead of typing in Chrome, Edge and Safari',
      'On macOS, ⌃⌥S files a bug from any app',
    ],
    shot: {
      name: 'capture',
      themed: true,
      width: 1400,
      height: 544,
      alt: 'The capture bar holding a typed description and an attached screenshot, above the live bug list',
    },
    marker: {
      d: 'M262 48 C 520 40, 900 42, 1142 50 C 1150 96, 1148 150, 1140 188 C 900 194, 520 192, 266 186 C 258 140, 256 96, 266 44',
      label: 'The capture bar',
    },
  },
  {
    id: 'markup',
    number: '02',
    name: 'Mark up',
    title: 'Point at the problem, not around it.',
    body: 'Draw on the screenshot before you file it. An arrow and a box say more than a paragraph about “the button near the bottom”.',
    facts: [
      'Arrow, box and pen on A, B and P',
      '⌘Z undoes; Esc asks before throwing work away',
      'Large captures are re-encoded to stay under the 5 MB limit',
    ],
    shot: {
      name: 'annotate',
      themed: true,
      width: 1400,
      height: 1111,
      alt: 'The mark-up editor over a checkout page: a red box around a cookie banner and an arrow pointing at the Pay now button',
    },
    marker: {
      d: 'M58 72 C 52 40, 300 34, 308 64 C 314 98, 70 104, 56 78 C 50 62, 110 44, 190 44',
      label: 'The arrow, box and pen tools',
    },
  },
  {
    id: 'claude',
    number: '03',
    name: 'Fix with Claude Code',
    title: 'Send it to Claude Code. Watch the fix.',
    body: 'Squash opens Claude Code in your project with the bug, its comments and its screenshots, then shows the file it is editing, its plan and its summary. Bugs it fixes resolve themselves.',
    facts: [
      'Pick bugs with X, send them all with C',
      'Bugs it could not finish stay open, with its summary as a comment',
      'A helper you install with one command, listening only on 127.0.0.1',
    ],
    shot: {
      name: 'claude',
      themed: true,
      width: 1400,
      height: 710,
      alt: 'Bug #24 with a Claude is working panel: the file being edited, a four-step plan with two steps done, and Claude’s latest explanation',
    },
    marker: {
      d: 'M40 684 C 170 676, 360 688, 520 678',
      label: 'The file Claude Code is editing',
    },
  },
]

/** What a bug report looks like when it arrives in a chat channel, field by field. */
export const MISSING_FIELDS = ['Page', 'Device', 'Steps', 'Owner', 'Status'] as const

/** The same bug once it is filed in Squash (demo workspace, bug #24). */
export const FILED_FIELDS: { term: (typeof MISSING_FIELDS)[number]; value: string }[] = [
  { term: 'Page', value: '/checkout' },
  { term: 'Device', value: 'iOS Safari · 390×844' },
  { term: 'Steps', value: 'Marked up: box on the banner, arrow to Pay now' },
  { term: 'Owner', value: 'M. Chen' },
  { term: 'Status', value: 'Claude Code working · 2 of 4 steps' },
]

export const LEDGER: { term: string; body: string }[] = [
  {
    term: 'Live for the whole team',
    body: 'New bugs, edits, comments and resolutions reach every teammate in about a second.',
  },
  {
    term: 'Presence',
    body: 'See who is online and which bug each teammate has open.',
  },
  {
    term: 'Assignees',
    body: 'Give a bug an owner from the detail view, the palette, or with I to take it yourself.',
  },
  {
    term: 'Search and filters',
    body: 'Full-text search across titles, descriptions and transcripts. Filters live in the URL, so a view can be shared.',
  },
  {
    term: 'Bugs and features',
    body: 'Feature requests get their own tab, and items move between the two.',
  },
  {
    term: 'Markdown and mentions',
    body: 'Bold, code, lists and links, with @name mentions that autocomplete. No HTML from a bug ever reaches the page.',
  },
  {
    term: 'Activity log',
    body: 'Every filed, edited, resolved and commented action is written by database triggers, so none are skipped.',
  },
  {
    term: 'Export',
    body: 'The bugs you are looking at, as CSV that is safe to open in a spreadsheet, or as a Markdown report.',
  },
  {
    term: 'Notifications',
    body: 'In a background tab, a new bug or an assignment raises a desktop notification and an unread count.',
  },
  {
    term: 'On your phone',
    body: 'A list-to-detail layout for one hand. Install it to the home screen; the picker opens the camera.',
  },
]

export const SECURITY: { term: string; body: string }[] = [
  {
    term: 'Row Level Security on every table',
    body: 'Enforced in Postgres, not the browser. You only ever see rows from workspaces you belong to.',
  },
  {
    term: 'Joining only through an RPC',
    body: 'The invite code is checked server-side. Members cannot be added any other way.',
  },
  {
    term: 'Private screenshots',
    body: 'Stored per workspace in a private bucket and served through signed links that expire after an hour.',
  },
  {
    term: 'Limits that hold under load',
    body: '10 members per workspace, 10 images per bug, 30 bugs per user per minute, enforced by triggers with row locks.',
  },
]

export interface SelfHostStep {
  title: string
  body: string
  command: string
}

export const SELF_HOST_STEPS: SelfHostStep[] = [
  {
    title: 'Create the database',
    body: 'On a free Supabase project: schema, policies, storage bucket and Realtime in one push.',
    command: 'npx supabase link && npx supabase db push',
  },
  {
    title: 'Configure',
    body: 'Copy .env.example to .env. Use the anon or publishable key, never a service-role key.',
    command:
      'VITE_SUPABASE_URL=https://<project-ref>.supabase.co\nVITE_SUPABASE_ANON_KEY=<anon or publishable key>',
  },
  {
    title: 'Run it',
    body: 'Node.js 24 or newer. Then import the repo into Vercel with the Vite preset to deploy.',
    command: 'npm ci\nnpm run dev',
  },
]
