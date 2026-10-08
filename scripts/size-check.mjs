import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

// Budgets are measured on a build WITH Supabase env set (CI passes non-secret placeholders), because
// without it the Supabase client is dead-code-eliminated and the total under-reports what users
// download by ~55 kB. v2.0.0 baseline (real build): entry 68.8 kB, total JS 258.5 kB gzip.
// Budgets are ~10% above that, rounded; 1 kB = 1000 bytes. See .orch/DECISIONS.md D-15.
export const BUDGET_ENTRY_KB = 83
export const BUDGET_TOTAL_KB = 285

/** @param {number} entryBytes @param {number} totalJsBytes */
export function checkBudgets(entryBytes, totalJsBytes) {
  const failures = []
  if (entryBytes > BUDGET_ENTRY_KB * 1000) {
    failures.push(`Entry gzip size exceeds ${BUDGET_ENTRY_KB} kB`)
  }
  if (totalJsBytes > BUDGET_TOTAL_KB * 1000) {
    failures.push(`Total JS gzip size exceeds ${BUDGET_TOTAL_KB} kB`)
  }
  return failures
}

function main() {
  const dist = new URL('../dist/', import.meta.url)
  const html = readFileSync(new URL('index.html', dist), 'utf8')
  const moduleScripts = [...html.matchAll(/<script\b[^>]*>/gi)].filter(([tag]) =>
    /\btype\s*=\s*['"]module['"]/i.test(tag),
  )
  const sources = moduleScripts
    .map(([tag]) => tag.match(/\bsrc\s*=\s*(['"])(.*?)\1/i)?.[2])
    .filter(Boolean)
  if (sources.length !== 1) {
    throw new Error('Expected one module entry script in dist/index.html')
  }
  const entryPath = new URL(sources[0], 'https://bundle.local/').pathname
  const assets = new URL('assets/', dist)
  const sizes = readdirSync(assets)
    .filter((name) => /\.(js|css)$/.test(name))
    .sort()
    .map((name) => ({ name, bytes: gzipSync(readFileSync(new URL(name, assets))).length }))
  const entry = sizes.find(
    ({ name }) => name.endsWith('.js') && entryPath.endsWith(`/assets/${name}`),
  )
  if (!entry) throw new Error(`Entry script ${entryPath} is missing from dist/assets`)
  const totalJsBytes = sizes
    .filter(({ name }) => name.endsWith('.js'))
    .reduce((total, { bytes }) => total + bytes, 0)

  console.table(
    sizes.map(({ name, bytes }) => ({ Asset: name, 'Gzip kB': (bytes / 1000).toFixed(3) })),
  )
  console.log(`Entry: ${(entry.bytes / 1000).toFixed(3)} / ${BUDGET_ENTRY_KB} kB gzip`)
  console.log(`Total JS: ${(totalJsBytes / 1000).toFixed(3)} / ${BUDGET_TOTAL_KB} kB gzip`)
  const failures = checkBudgets(entry.bytes, totalJsBytes)
  for (const failure of failures) console.error(failure)
  if (failures.length) process.exitCode = 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(`Size check failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
