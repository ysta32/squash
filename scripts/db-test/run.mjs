// Applies the stubs, every migration (twice, to prove re-runnability) and supabase/tests/rls.sql
// on in-process Postgres (PGlite). Exits non-zero naming the failing step.
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'

const root = new URL('../../', import.meta.url)
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8')
const db = new PGlite()

async function step(label, sql) {
  try {
    await db.exec(sql)
    console.log(`ok    ${label}`)
  } catch (e) {
    console.error(`FAIL  ${label}: ${e.message}`)
    process.exit(1)
  }
}

// rls.sql targets psql: drop meta-commands and expand the :as_* role-switch variables.
function toPlainSql(script) {
  const vars = {}
  for (const line of script.split('\n')) {
    const m = /^\\set (\w+) '(.*)'$/.exec(line)
    if (m) vars[m[1]] = m[2].replace(/''/g, "'")
  }
  return script
    .split('\n')
    .filter((line) => !line.startsWith('\\'))
    .map((line) => line.replace(/^:(\w+)/, (_, name) => vars[name] ?? `:${name}`))
    .join('\n')
}

const migrations = fs
  .readdirSync(new URL('supabase/migrations/', root))
  .filter((f) => f.endsWith('.sql'))
  .sort()

await step('stubs', read('scripts/db-test/supabase-stubs.sql'))
for (const m of migrations) await step(m, read(`supabase/migrations/${m}`))
for (const m of migrations) await step(`re-run ${m}`, read(`supabase/migrations/${m}`))
await step('rls.sql', toPlainSql(read('supabase/tests/rls.sql')))
console.log('ALL RLS TESTS PASSED')
