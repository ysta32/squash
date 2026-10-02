# Database tests

`rls.sql` is a self-contained psql script that checks RLS policies, RPC auth errors, abuse limits
(`member_limit`, `workspace_limit`, `attachment_limit`, `rate_limited`), `bug_events` triggers and the
`screenshots` storage policies. Run it after `supabase/migrations/0001_init.sql` has been applied, against a
fresh or scratch project (never production data: it creates fake `auth.users`, though it rolls back at the end):

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
```

Use the direct/pooler connection string for the `postgres` role. The script runs in one transaction,
simulates users via `request.jwt.claims` + `set local role authenticated`, and ends with `rollback`.
Success prints `ALL RLS TESTS PASSED`; a failure aborts with `FAIL[n]: ...` naming the assertion.
