# Database tests

`rls.sql` is a self-contained psql script that checks RLS policies, RPC auth errors, abuse limits
(`member_limit`, `workspace_limit`, `attachment_limit`, `rate_limited`), `bug_events` triggers and the
`screenshots` storage policies.

## Run locally without a database

`npm run test:db` runs the stubs in `scripts/db-test/supabase-stubs.sql`, every migration (twice, to prove they
are re-runnable) and `rls.sql` on in-process Postgres ([PGlite](https://pglite.dev)). No Postgres or Supabase
project is needed, and CI runs it on every pull request. It prints one line per step and ends with
`ALL RLS TESTS PASSED`, or exits non-zero naming the failing step and the Postgres error.

## Run against a real project

Run it after every file in `supabase/migrations/` has been applied, against a fresh or scratch project (never
production data: it creates fake `auth.users`, though it rolls back at the end):

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
```

Use the direct/pooler connection string for the `postgres` role. The script runs in one transaction,
simulates users via `request.jwt.claims` + `set local role authenticated`, and ends with `rollback`.
Success prints `ALL RLS TESTS PASSED`; a failure aborts with `FAIL[n]: ...` naming the assertion.
