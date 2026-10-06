# Changelog

## Unreleased

### Added

- Send bugs to Claude Code, one at a time or several at once, with their screenshots and comments. With `npm run claude-bridge` running, one press opens Claude Code on them in a new terminal; otherwise the button copies a ready-to-paste prompt.

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
