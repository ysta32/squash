// Build-time facts for the marketing site. Every number on the home page "record" comes from the
// repository itself (tests, RLS checks, releases, size budget, shortcuts), never from copy.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import type { FactKey, SquashFacts } from './src/components/marketing/facts-types'

export const FACTS_MODULE_ID = 'virtual:squash-facts'
const RESOLVED_ID = `\0${FACTS_MODULE_ID}`

function walk(dir: string, match: (file: string) => boolean, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path, match, out)
    else if (match(entry.name)) out.push(path)
  }
  return out
}

/** Counts declared test cases (`it(`, `test(`, `it.each(…)(`) at the start of a line. */
export function countTests(source: string): number {
  return source.match(/^\s*(?:it|test)(?:\.each)?\(/gm)?.length ?? 0
}

/** Distinct numbered assertions (`FAIL[n]`) in the RLS suite. */
export function countRlsChecks(sql: string): number {
  return new Set([...sql.matchAll(/FAIL\[(\d+)\]/g)].map((m) => m[1])).size
}

/** Released versions from `## vX.Y.Z — YYYY-MM-DD` headings, newest first. */
export function parseReleases(changelog: string): { version: string; date: string }[] {
  return [...changelog.matchAll(/^## (v\d+\.\d+\.\d+)\s+[—–-]\s+(\d{4}-\d{2}-\d{2})\s*$/gm)].map(
    (m) => ({ version: m[1], date: m[2] }),
  )
}

export function parseBudgets(script: string): { entry: number; total: number } {
  const read = (name: string) => {
    const value = new RegExp(`export const ${name} = (\\d+(?:\\.\\d+)?)`).exec(script)?.[1]
    if (!value) throw new Error(`facts: ${name} not found in scripts/size-check.mjs`)
    return Number(value)
  }
  return { entry: read('BUDGET_ENTRY_KB'), total: read('BUDGET_TOTAL_KB') }
}

function parseKey(token: string): FactKey {
  const t = token.trim()
  // Named key constants used by ShortcutsSheet (src/components/ui/keys.ts).
  if (t === 'MOD' || t === 'MOD_KEY') return { kind: 'mod' }
  if (t === 'ALT' || t === 'ALT_KEY') return { kind: 'alt' }
  if (t === 'ENTER' || t === 'ENTER_KEY') return { kind: 'key', label: '↵' }
  if (t === 'SHIFT' || t === 'SHIFT_KEY') return { kind: 'key', label: 'Shift' }
  const quoted = /^(['"])(.*)\1$/.exec(t)
  if (!quoted) throw new Error(`facts: unexpected shortcut key ${t}`)
  return { kind: 'key', label: quoted[2] }
}

/** Reads the `SHORTCUTS` table the app's shortcut sheet renders, so the landing page never drifts. */
export function parseShortcuts(source: string): SquashFacts['shortcuts'] {
  const shortcuts = [
    ...source.matchAll(/\{\s*keys:\s*\[([^\]]*)\],\s*label:\s*(['"])(.*?)\2\s*\}/g),
  ].map((m) => ({
    keys: m[1]
      .split(',')
      .filter((k) => k.trim())
      .map(parseKey),
    label: m[3],
  }))
  if (shortcuts.length === 0) {
    throw new Error('facts: no shortcuts found in src/components/ShortcutsSheet.tsx')
  }
  return shortcuts
}

export function computeFacts(root: string): { facts: SquashFacts; files: string[] } {
  const file = (path: string) => join(root, path)
  const read = (path: string) => readFileSync(file(path), 'utf8')

  const testFiles = walk(file('src'), (name) => /\.test\.tsx?$/.test(name))
  const tests = testFiles.reduce((sum, path) => sum + countTests(readFileSync(path, 'utf8')), 0)
  const releases = parseReleases(read('CHANGELOG.md'))
  if (releases.length === 0) throw new Error('facts: no releases found in CHANGELOG.md')
  const budgets = parseBudgets(read('scripts/size-check.mjs'))
  const license = /^(\S+) License/.exec(read('LICENSE'))?.[1]
  if (!license) throw new Error('facts: LICENSE has no "<name> License" first line')
  const pkg = JSON.parse(read('package.json')) as { version: string }

  const facts: SquashFacts = {
    version: pkg.version,
    license,
    tests,
    testFiles: testFiles.length,
    rlsChecks: countRlsChecks(read('supabase/tests/rls.sql')),
    releases: releases.length,
    latestRelease: releases[0],
    firstRelease: releases[releases.length - 1],
    budgetEntryKb: budgets.entry,
    budgetTotalKb: budgets.total,
    migrations: readdirSync(file('supabase/migrations')).filter((n) => n.endsWith('.sql')).length,
    shortcuts: parseShortcuts(read('src/components/ShortcutsSheet.tsx')),
  }
  const files = [
    ...testFiles,
    'CHANGELOG.md',
    'LICENSE',
    'package.json',
    'scripts/size-check.mjs',
    'supabase/tests/rls.sql',
    'src/components/ShortcutsSheet.tsx',
  ].map((path) => (path.startsWith(root) ? path : file(path)))
  return { facts, files }
}

export function factsPlugin(): Plugin {
  let root = process.cwd()
  return {
    name: 'squash-facts',
    configResolved(config) {
      root = config.root
    },
    resolveId(id) {
      return id === FACTS_MODULE_ID ? RESOLVED_ID : null
    },
    load(id) {
      if (id !== RESOLVED_ID) return null
      const { facts, files } = computeFacts(root)
      // Editing any source re-runs this module in dev, so the numbers never go stale.
      for (const path of files) this.addWatchFile(path)
      return `export default ${JSON.stringify(facts)}`
    },
  }
}
