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
      // Rings the typed description and the pasted screenshot's thumbnail, not the empty input.
      d: 'M80 62 C 200 52, 380 54, 490 60 C 498 100, 496 148, 488 180 C 380 188, 200 186, 84 180 C 76 142, 74 100, 86 56',
      label: 'The description and the pasted screenshot',
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
      height: 1105,
      alt: 'The mark-up editor over a checkout page: a red box around a cookie banner and an arrow pointing at the Pay now button',
    },
    marker: {
      // Underlines the Arrow, Box and Pen buttons, which sit flush with the top of the crop.
      d: 'M16 56 C 90 52, 200 58, 292 54',
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
