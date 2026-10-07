import { AtSign, FileDown, History, ListFilter, SunMoon, type LucideIcon } from 'lucide-react'

import type { ResolvedTheme } from '../../lib/theme'

export const DEFAULT_GITHUB_URL = 'https://github.com/ysta32/squash'

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
  alt: 'The Squash workspace: a live bug list on the left, and an open bug on the right with its screenshots, activity, comments, and Claude Code working on the fix',
}

export interface Feature {
  id: string
  label: string
  title: string
  body: string
  bullets: string[]
  shot: Shot
}

export const FEATURES: Feature[] = [
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
    id: 'markup',
    label: 'Mark up',
    title: 'Point at the problem, not around it',
    body: 'Draw on a screenshot before you file it. An arrow and a box say more than a paragraph of “the button near the bottom”.',
    bullets: [
      'Arrow, box and pen, with A, B and P to switch',
      'Undo with ⌘Z, and Escape asks before throwing work away',
      'Large captures are re-encoded to stay under the upload limit',
    ],
    shot: {
      name: 'annotate',
      themed: true,
      width: 1400,
      height: 991,
      alt: 'The mark-up editor over a checkout page: a red box around a cookie banner and an arrow pointing at the Pay now button',
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
      height: 1010,
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
      'Assign an owner, and filter to what is yours or what nobody has picked up',
      'Filed and resolved counts per member, for the week and all time',
    ],
    shot: {
      name: 'stats',
      themed: true,
      width: 720,
      height: 375,
      alt: 'The stats popover listing bugs filed and resolved by each teammate over the last 7 days and all time',
    },
  },
]

export const PALETTE_SHOT: Shot = {
  name: 'palette',
  themed: true,
  width: 1000,
  height: 761,
  alt: 'The command palette listing actions, export commands and matching bugs',
}

export interface Detail {
  title: string
  body: string
  icon: LucideIcon
}

export const DETAILS: Detail[] = [
  {
    icon: FileDown,
    title: 'Export',
    body: 'Download the bugs you are looking at as CSV, safe to open in a spreadsheet, or as a Markdown report.',
  },
  {
    icon: AtSign,
    title: 'Markdown and mentions',
    body: 'Bold, code, lists and links in descriptions and comments, with @name mentions that autocomplete.',
  },
  {
    icon: ListFilter,
    title: 'Search and filters',
    body: 'Full-text search across titles, descriptions and transcripts. Filters live in the URL, so views are shareable.',
  },
  {
    icon: SunMoon,
    title: 'Light, dark and six schemes',
    body: 'Follows your system theme, with Violet, Ocean, Forest, Sunset, Rose and Graphite accents.',
  },
  {
    icon: History,
    title: 'Append-only activity log',
    body: 'Every filed, edited, resolved and commented action is recorded by database triggers, so none are skipped.',
  },
]

export const STEPS = [
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

export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['N'], label: 'New bug' },
  { keys: ['⌘', 'V'], label: 'Paste screenshot' },
  { keys: ['Enter'], label: 'File bug' },
  { keys: ['Alt', '1–4'], label: 'Severity' },
  { keys: ['/'], label: 'Search' },
  { keys: ['J', 'K'], label: 'Next, previous' },
  { keys: ['R'], label: 'Resolve' },
  { keys: ['I'], label: 'Assign to yourself' },
  { keys: ['C'], label: 'Send to Claude' },
]

export const MOBILE_POINTS = [
  'Install it to your home screen from the browser',
  'The file picker opens the camera, straight into the capture bar',
  'Follow Claude’s progress and resolve from wherever you are',
]

export const SELF_HOST = [
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

export const FAQ = [
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
