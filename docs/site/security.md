---
title: Security model
description: Every rule is enforced in Postgres, not in the browser. What that covers, and how to report a problem.
group: Run
order: 12
---

The hosted Squash is one public instance where strangers share infrastructure, so every rule is enforced in the database. The browser is never trusted to hide anything.

## Access

- **Row Level Security on every table**, plus the storage bucket. You can only read rows from workspaces you belong to.
- **Joining only happens through an RPC** that checks the invite code on the server. Members cannot be added any other way.
- **Screenshots live in a private bucket** under `{workspace_id}/{bug_id}/…`, and are served through signed links that expire after an hour.
- **Column-level grants** on profiles, so you can only change your own name and avatar fields.

## History

- **An append-only activity log.** Every filed, edited, resolved, reopened and commented action is written by database triggers, so it cannot be skipped.
- **A deletion record.** Deleting a bug removes it for good, but its number, title, who deleted it and when stay in a log that members can read and nobody can edit.
- Editing or deleting a comment also updates or clears its text in the activity log.

## Limits

Abuse limits are enforced by triggers and RPCs, with row and advisory locks so they hold under concurrency.

| Limit                     | Value         |
| ------------------------- | ------------- |
| Members per workspace     | 10            |
| Workspaces owned per user | 5             |
| Images per bug            | 10            |
| Bugs filed per user       | 30 per minute |
| Comments per user         | 30 per minute |

## Hardened defaults

PKCE sign-in, validated redirects, framing blocked with `frame-ancestors 'none'`, and no service-role key anywhere in the app. Deleting your account removes your profile and the workspaces you own alone; if you own a shared workspace, you transfer it first.

## The Claude Code helper

The helper runs on your computer and listens only on `127.0.0.1:4317`. It accepts requests only from Squash, downloads screenshots only from your app's own Supabase storage, stops a download past 15 MiB, runs at most 3 Claude sessions at once, and keeps what it writes readable only by you. See [Claude Code](/claude) for how it works.

## Tests

The policy suite is `supabase/tests/rls.sql`. CI runs it on every pull request, together with CodeQL code scanning and a review of new dependencies.

## Reporting a vulnerability

Please don't open a public issue. Report it privately through [GitHub security advisories](https://github.com/ysta32/squash/security/advisories/new), with what you found, how to reproduce it and what an attacker could do with it. You should get a reply within a few days. Only the latest release is supported.

In scope: reading or writing another workspace's data, bypassing the limits above, joining without a valid invite, authentication or redirect flaws, and XSS. Out of scope: denial-of-service volume testing against the hosted instance, social engineering, and issues in Supabase, Vercel or Google themselves.
