---
title: Migrations
description: How database changes ship, and how to apply them to a production project.
group: Run
order: 11
---

The whole database (tables, policies, triggers, functions, storage and Realtime) lives in numbered SQL files in `supabase/migrations/`. Every file is re-runnable, so applying one twice is safe.

## Applying migrations to production

Production migrations are applied by hand; the release workflow never touches your database.

1. Run `npm run test:db`. It applies every migration twice and runs the Row Level Security suite on an in-process Postgres.
2. In the production project's Supabase SQL editor, run each pending file in filename order. Or run `npx supabase link` to select the production project and `npx supabase db push`.
3. Confirm the target project before you apply anything.

## When a release needs one

The [changelog](/changelog) says so in bold under the release, with the file names, for example "Needs migrations `0006_comment_edit.sql` and `0007_bug_context.sql`." Until a migration runs, the features that depend on it are refused by the server or skipped, and the rest of the app keeps working.

## Writing a new migration

- Name it with the next number: `00NN_short_name.sql`.
- Guard every statement (`if not exists`, `create or replace`, `drop … if exists`) so the file can run again.
- Enable and force Row Level Security on every new table, and add policies before any grants.
- Add assertions for new rules to `supabase/tests/rls.sql`, and run `npm run test:db`.
