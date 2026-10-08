// Shapes produced by vite-plugin-content.ts: the `virtual:squash-content` manifest and the JSON
// bodies it writes under /content/.

export interface DocHeading {
  id: string
  text: string
  level: 2 | 3
}

export interface DocMeta {
  slug: string
  title: string
  description: string
  /** Sidebar group: using the app, or running your own copy. */
  group: 'Use' | 'Run'
  order: number
  headings: DocHeading[]
}

/** /content/docs/<slug>.json */
export interface DocBody {
  html: string
}

export interface ReleaseEntry {
  version: string
  /** YYYY-MM-DD */
  date: string
  /** Permalink anchor on /changelog (the version, e.g. `v1.7.0`). */
  id: string
  /** The release's one-line summary as inline HTML, when the entry opens with one. */
  summary: string | null
  html: string
}

/** /content/changelog.json */
export interface ChangelogContent {
  unreleased: { html: string; empty: boolean } | null
  releases: ReleaseEntry[]
}

/** A README screenshot published at /press/<name>.png for the press kit. */
export interface PressShot {
  /** Site path, e.g. `/press/hero-light.png`. */
  file: string
  caption: string
  width: number
  height: number
  bytes: number
}

export interface ContentManifest {
  /** Hash of every generated file; appended to fetches so a deploy never serves stale JSON. */
  version: string
  docs: DocMeta[]
  releases: Pick<ReleaseEntry, 'version' | 'date' | 'id'>[]
  press: PressShot[]
}
