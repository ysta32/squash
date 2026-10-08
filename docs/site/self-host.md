---
title: Self-host
description: Run your own Squash on a free Supabase project, locally or on Vercel.
group: Run
order: 10
---

You need Node.js 24 or newer, a free [Supabase](https://supabase.com) project, and optionally a [Vercel](https://vercel.com) account. There are no other services.

## 1. Create the database

Run the files in `supabase/migrations/` in filename order in the Supabase SQL editor, starting with `0001`. Or authenticate the Supabase CLI and push them:

```sh
npx supabase link && npx supabase db push
```

This creates the schema, the Row Level Security policies, the private `screenshots` storage bucket and the Realtime publication. The migrations are re-runnable.

## 2. Set up sign-in

Magic links work with Supabase's built-in email. For Google sign-in, create an OAuth client of type **Web application** in Google Cloud Console:

- Authorized JavaScript origins: `https://<domain>` and `http://localhost:5173`.
- Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.

Then, in Supabase under Authentication → Providers → Google, enter the client ID and secret and enable the provider. Keep the secret there, never in frontend variables.

Under Authentication → URL Configuration, set the Site URL to `https://<domain>` and add `https://<domain>/auth/callback` and `http://localhost:5173/auth/callback` to the redirect URLs.

## 3. Configure

Copy `.env.example` to `.env` and fill it in. Use the anon or publishable key only, never a service-role key: every `VITE_` value ships to the browser.

```sh
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon or publishable key>
VITE_GITHUB_URL=https://github.com/<you>/squash
VITE_SITE_URL=http://localhost:5173
```

## 4. Run

```sh
npm ci
npm run dev   # http://localhost:5173
```

If a build is missing its Supabase settings, the app shows a setup screen naming the missing variables instead of a blank page.

## 5. Deploy

Import the repository into Vercel with the Vite preset, build command `npm run build`, output directory `dist`, and Node.js 24. Add the same variables with your production URL as `VITE_SITE_URL`, then deploy. `vercel.json` already handles client-side routing and security headers. Redeploy after changing a `VITE_` variable: they are read at build time.

Finally, check the social card at `https://<domain>/og.png`, sign in with Google and with a magic link, open an invite link, and confirm two sessions see each other's changes live.

## 6. Verify the policies (optional)

Run `supabase/tests/rls.sql` in the SQL editor of a test project. It runs inside a transaction and rolls back. `npm run test:db` runs every migration twice plus the same suite on an in-process Postgres, with no Supabase project at all.

## Releases

Pushing a `v*` tag builds the app and attaches `squash-dist.zip` to a GitHub release. Set the repository Actions variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GITHUB_URL` and `VITE_SITE_URL` first: these public values are embedded in the release build.
