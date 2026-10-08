// Shape of the build-time `virtual:squash-facts` module (see vite-plugin-facts.ts at the repo root).

/** A key in a shortcut chord. `mod` and `alt` are rendered per platform (⌘/Ctrl, ⌥/Alt). */
export type FactKey = { kind: 'mod' } | { kind: 'alt' } | { kind: 'key'; label: string }

export interface Release {
  version: string
  date: string
}

export interface SquashFacts {
  version: string
  license: string
  /** Declared test cases (`it`/`test`) across src/**\/*.test.ts(x). */
  tests: number
  testFiles: number
  /** Distinct numbered assertions in supabase/tests/rls.sql. */
  rlsChecks: number
  releases: number
  latestRelease: Release
  firstRelease: Release
  budgetEntryKb: number
  budgetTotalKb: number
  migrations: number
  shortcuts: { keys: FactKey[]; label: string }[]
}
