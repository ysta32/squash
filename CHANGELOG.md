# Changelog

## Unreleased

### Added

- A Features tab next to Bugs, so feature requests no longer have to be filed as bugs. The capture bar files into whichever tab is showing, the detail view can move an item between the two, and Claude exports ask Claude to build a feature rather than fix a bug. Needs migration `0002_bug_kind.sql`; existing items stay bugs.
- Send bugs to Claude Code, one at a time or several at once, with their screenshots and comments. One press opens Claude Code on them in a new terminal, in the project folder chosen for that workspace. The first press walks through a one-command setup that installs a small helper which starts at login. A separate copy button copies a ready-to-paste prompt instead.

## v1.1.0 — 2026-10-02

### Changed

- Softer dark theme. The background moves from near-black to charcoal, with brighter muted text and borders, and menus, popovers and dialogs now sit on a raised surface so they stand out from the page.
- The social preview image matches the new dark theme.

### Added

- A setup screen in place of a blank page when a build is missing `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY`. It names the missing variables and links the self-host guide.
- README with screenshots, a security model overview, shortcut and limit tables, and self-host steps.
- Issue templates, a pull request template, a security policy, and Dependabot updates.

### Fixed

- CONTRIBUTING.md now states the correct CI Node.js version (24).

## v1.0.0 — 2026-10-02

Initial release of Squash.

- Shared workspaces with Google and magic-link sign-in, invite links, and member management.
- Bug capture with pasted screenshots, voice input, severity, and per-workspace bug numbers.
- Real-time bugs, comments, activity history, and teammate presence.
- Resolution and reopening notes, workspace statistics, and keyboard shortcuts.
- Responsive UI, dark mode, and an installable PWA with no offline support or service worker.
- Supabase database and storage access policies, Vercel deployment configuration, and CI and release workflows.
