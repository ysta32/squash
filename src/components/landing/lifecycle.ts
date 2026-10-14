/**
 * Bug #24's life, as the demo workspace records it. The home page's stage walks through these
 * five states: the scroll moves between them, and so do the single keys in the status bar, which
 * are the keys the workspace itself uses.
 */
export interface Step {
  /** The key that jumps to this state, both in the app and in the page's status bar. */
  key: string
  /** The word the status line uses for it. */
  state: string
  /** 24-hour clock, as the app writes it. */
  time: string
  title: string
  body: string
}

export const STEPS: Step[] = [
  {
    key: 'f',
    state: 'filed',
    time: '14:02',
    title: 'Paste, type, press Enter.',
    body: 'One input above the list. ⌘V anywhere on the page drops the screenshot into it with the cursor ready, and the page, the browser and the window size are written down without anyone filling in a form.',
  },
  {
    key: 'm',
    state: 'marked up',
    time: '14:06',
    title: 'Point at it, don’t describe it.',
    body: 'Arrow, box and pen, on A, B and P. A box around the consent banner and an arrow to the button under it says more than a paragraph about “the thing near the bottom”.',
  },
  {
    key: 'l',
    state: 'on three screens',
    time: '14:06',
    title: 'Everyone sees it land.',
    body: 'New bugs, edits, comments and resolutions reach every teammate in about a second over one Postgres subscription. Nobody has to be told to refresh.',
  },
  {
    key: 'c',
    state: 'claude code',
    time: '14:21',
    title: 'Hand it to Claude Code.',
    body: 'Squash opens Claude Code in your project with the bug, its comments and its screenshots, then shows the file it is editing and how far through its plan it is.',
  },
  {
    key: 'r',
    state: 'resolved',
    time: '14:24',
    title: 'Closed by the thing that fixed it.',
    body: 'Bugs Claude Code finishes resolve themselves. The ones it could not finish stay open with its summary as a comment, so nothing closes quietly.',
  },
]

/** The teammates the bug reaches, and how long it took to get there. */
export const WITNESSES = [
  { who: 'M. Chen', device: 'MacBook', at: '0.6s' },
  { who: 'J. Ellis', device: 'iPad', at: '0.9s' },
  { who: 'You', device: 'iPhone', at: '1.1s' },
]

/** Claude Code's plan on bug #24, in the order it worked through it. */
export const PLAN = [
  'Read the bug, its comments and both screenshots',
  'Give the consent banner a safe-area inset',
  'Lift the checkout footer above it on small screens',
  'Check it at 390×844 and resolve the bug',
]
