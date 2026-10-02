# Contributing

Use Node.js 24 or newer and npm. Follow [README.md](README.md#self-host) to configure Supabase and your local `.env`, then run `npm ci` and `npm run dev`.

## Changes

Keep pull requests focused and describe the user-visible behavior, relevant checks, and any database or deployment effects. Include screenshots for visual changes and focused tests for behavior changes.

Use strict TypeScript with explicit types and no `any`. Use named exports except for pages, which use default exports. Follow existing Tailwind and CSS-variable styling, use Lucide icons, and preserve workspace access controls in database and storage changes. Never commit `.env` or credentials; frontend `VITE_` variables are public.

## Checks

Run these before submitting a pull request:

```sh
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run build
```

Use `npx prettier --write <changed-files>` to format a focused change and `npx vitest run <test-path>` for focused tests. Database access-policy checks are available in `supabase/tests/rls.sql`; run them against a test project when changing authorization behavior.

CI runs the same checks on pull requests and pushes to `main`. The workflow specifies Node.js 22, while the current package engine requires Node.js >=24; local development should follow the package requirement.
