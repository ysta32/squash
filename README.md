# Squash

**Live:** https://squash-livid.vercel.app

**Source:** https://github.com/ysta32/squash

**Demo GIF placeholder:** `docs/demo.gif` (recording to be added).

Squash is a real-time bug tracker for small teams, built around quick capture and shared workspaces.

## Features

- Paste screenshots into bug reports and add voice input.
- See bugs, comments, and activity update in real time.
- Resolve or reopen bugs with a note and keep their activity history.
- Invite teammates through a workspace invite link.
- See teammate presence and who is viewing a bug.
- Track filed and resolved bugs with workspace statistics.
- Install the PWA for convenient access.
- Use keyboard shortcuts to navigate and manage bugs.
- Sign in with Google or an email magic link; switch between workspaces and use dark mode.

### PWA

Squash is installable in supported browsers. It has no offline support and no service worker; an internet connection is required.

## Tech stack

React 19, TypeScript 6, Vite 8, Tailwind CSS 4, React Router 7, and Lucide icons. Supabase provides PostgreSQL, Auth, Realtime, and private screenshot storage. Vitest, Testing Library, ESLint, and Prettier support development; Vercel hosts the SPA.

## Self-host

Use Node.js 24 or newer, as declared in `package.json`, and npm.

1. Create a Supabase project.
2. Run `supabase/migrations/0001_init.sql` in the Supabase SQL editor, or authenticate the Supabase CLI and run `npx supabase link && npx supabase db push` from this repository. The migration creates the schema, access policies, storage bucket, and Realtime configuration.
3. Enable the Google provider in Supabase Auth. Configure OAuth origins, callback URLs, and allowed redirects using the exact steps in [MAINTAINER.md](MAINTAINER.md).
4. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GITHUB_URL`, and `VITE_SITE_URL`. Use the public anonymous key, never a service-role key. All `VITE_` values are included in the browser bundle.
5. Run `npm i && npm run dev`, then open `http://localhost:5173`.
6. Import the repository into Vercel, select Vite, set the same environment variables (with the production URL for `VITE_SITE_URL`), and deploy. The build command is `npm run build` and the output directory is `dist`. `vercel.json` handles SPA routes and response headers.
7. Optionally run `supabase/tests/rls.sql` against a test Supabase project to verify access policies.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development checks, [CHANGELOG.md](CHANGELOG.md) for release notes, and [LICENSE](LICENSE) for the MIT license.
