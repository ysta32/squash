# Changelog

## Unreleased

### Added

- A Features tab next to Bugs, so feature requests no longer have to be filed as bugs. The capture bar files into whichever tab is showing, the detail view can move an item between the two, and Claude exports ask Claude to build a feature rather than fix a bug. Needs migration `0002_bug_kind.sql`; existing items stay bugs.
- Send bugs to Claude Code, one at a time or several at once, with their screenshots and comments. One press opens Claude Code on them in a new terminal, in the project folder chosen for that workspace. The first press walks through a one-command setup that installs a small helper which starts at login. A separate copy button copies a ready-to-paste prompt instead.
- Follow Claude from Squash while it works on a bug (bug #5). The bug shows Claude's current step, its plan, its latest message and its final summary, and the list marks bugs Claude is working on or waiting on you for. The helper reports progress through Claude Code hooks; rerun the install command to update an existing helper.
- A Claude Code helper guide at `/claude`: how to install, update and uninstall the helper, what the progress panel shows, troubleshooting, and a live check of whether this computer's helper is missing, outdated or up to date. Linked from the landing page footer and the Send to Claude setup dialog.
- Claude Code now finishes bugs on its own. Sent bugs run unattended; when Claude is done its terminal closes, and Squash marks each bug it fixed as resolved with Claude's summary as the resolution note, or comments on bugs it could not finish. Rerun the install command to update the helper.
- Delete a bug or feature request outright, as an alternative to resolving it (bug #10). The trash button in the detail view asks for confirmation, then removes the item with its screenshots, comments and activity for everyone. Numbers are not reused. Needs migration `0003_bug_delete.sql`.

### Fixed

- On phones, the bug detail header no longer pushes the Resolve button off the screen. Send to Claude shows just its icon below 640 px.

### Docs

- A new README with real product screenshots, an animated capture demo, and a GitHub social preview image. `npm run screenshots` regenerates them all from the real app running on demo data, with no Supabase project needed.

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
