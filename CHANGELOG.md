# Changelog

## Unreleased

## v1.7.0 — 2026-10-07

Context on every bug, editable comments, a deletion log you can read, and a Claude Code helper that only talks to your own storage.

### Added

- Bugs now record where they happened. When you file a bug, Squash notes your browser, OS and window size, and picks up the first link in the description as the page URL (shown as a chip in the capture bar that you can remove before filing). The bug shows this as a compact line under its title, with the URL as a link, and it is included in exports and in what Claude Code receives.
- Edit or delete your own comments. Comments show "edited" after a change, and <kbd>Esc</kbd> cancels an edit.
- Workspace settings has a "Recently deleted" section listing the last 50 deleted bugs and feature requests (number, title, who deleted it and when). Deleted bugs are gone for good; only this record stays.

### Fixed

- A page that crashes now shows a "Something went wrong" screen with Reload, a link back to your workspaces and error details, instead of a blank page. If a new deploy replaces the page's files, Squash reloads once by itself to pick up the update.

### Security

- Editing or deleting a comment also updates or clears its text in the activity log, so the old text can't be read there. Live updates no longer carry the full old row of a comment or activity event.
- The Claude Code helper (v6) only downloads screenshots from your own app's Supabase storage. The install command now records your project's storage host, and the helper rejects other Supabase projects, other ports and encoded path tricks, including across redirects. Older installs keep the previous rule and print a warning; rerun the install command from the Claude page to update.

**Needs migrations `0006_comment_edit.sql` and `0007_bug_context.sql`.** Run them after `0001`–`0005` (see MAINTAINER.md → Applying migrations to production). Until `0007` runs, bugs are filed without their context; until `0006` runs, editing and deleting comments is refused by the server.

### Developer

- `npm run qa:shots` captures screenshots of every main page at 375, 768, 1280 and 1920 px in light and dark mode, with a contact sheet, for visual review.

## v1.6.0 — 2026-10-07

Trust and hardening: tighter database rules, a safer Claude Code helper, keyboard and screen-reader fixes, list sorting and bulk actions.

### Added

- Sort the list by Newest (default), Oldest, Severity or Recently active from a new Sort chip menu. The choice is kept in the URL as `?sort=`, and <kbd>J</kbd>/<kbd>K</kbd> follow the order on screen.
- Bulk actions. Pick several bugs and resolve, reopen or assign them at once, or send them to Claude Code, from a bar that shows how many are selected. Picks that a filter hides or a teammate deletes drop out of the selection, and a partial failure says how many items failed.

### Security

- Only the member who filed a bug (or feature request) and the workspace owner can delete it. The detail view hides the delete button from everyone else.
- Every deletion is recorded (number, title, kind, who deleted it and when) in a log that workspace members can read and nobody can edit.
- Comments are rate limited to 30 per person per minute, like filing bugs, and the server now sets each comment's time. Claude Code results that hit the limit wait and retry instead of being dropped.
- New indexes speed up filtering the list by status and by kind.
- The Claude Code helper (v5) only downloads screenshots from Squash's storage (Supabase, plus any hosts in `SQUASH_DOWNLOAD_HOSTS`), including across redirects, stops a download as soon as it passes 15 MiB, runs at most 3 Claude sessions at once and starts at most 20 per 10 minutes (more get a "busy" reply), frees a slot as soon as its Terminal closes, and keeps the prompts, screenshots and run records it writes readable only by you. Rerun the install command from the Claude page to update the helper.
- CI now runs CodeQL code scanning and reviews new dependencies on every pull request.

**Needs migration `0005_hardening.sql`.** Run it after `0001`–`0004` (see MAINTAINER.md → Applying migrations to production).

### Accessibility

- Every dialog and popover keeps keyboard focus inside while open and returns it to where you were when it closes, without pulling focus back if you clicked elsewhere. Stacked dialogs hand focus back correctly.
- A "Skip to content" link is the first stop on every page.

### Changed

- If the bug list fails to load, it says so and offers Retry instead of showing an empty list. A failed background refresh keeps the list on screen with a small notice.
- Faster list updates: rows that didn't change no longer re-render.
- Link previews use an absolute image URL, and the build now emits `robots.txt` and `sitemap.xml` for your site URL.
- CI enforces a bundle-size budget (`npm run size`).
- MAINTAINER.md documents running every migration in order and the release steps; the README has a roadmap.

### Tests

- New tests for uploads, storage cleanup, sign-in redirects, realtime status, presence, the invite dialog, workspace settings, joining and the auth callback.

## v1.5.0 — 2026-10-07

A design pass over the whole app and a new landing page.

### Changed

- The landing page is rebuilt: a larger hero with a framed product shot, one section grid for every feature, a grid of the smaller features, a compact phone section, a tidier FAQ and a full footer. Product screenshots reserve their real size, so they no longer load as empty boxes.
- Severity is a labelled control ("Medium", with a color dot) in the capture bar and the bug detail, with a menu and the <kbd>1</kbd>–<kbd>4</kbd> keys, instead of four unlabelled dots.
- The capture bar has a real send button with a label and an <kbd>Enter</kbd> hint, a focus state for the whole composer, and consistent toolbar buttons.
- List filters are chip menus instead of native selects. They show the active value, clear with one click, work from the keyboard, and scroll on one line on phones.
- List rows keep a fixed column order: Claude status, screenshot count, time, viewers and the owner's avatar. Tiny thumbnails are gone and the selected row is quieter.
- The bug detail uses a centered reading column, a joined Send to Claude button group, section headings, a larger attachment grid, a timeline line for activity and a comment composer with a send button.
- The header shows who is online in a clean stack, gives Invite a label, and the profile menu shows your email and opens the keyboard shortcuts.
- Buttons, menus, dialogs, toasts, settings and the sign-in pages share one set of surfaces, shadows and states. Disabled buttons are neutral grey instead of a faded accent.

### Fixed

- The bug detail no longer makes the page scroll sideways. A hidden description field kept its full width.
- The join page no longer crashes when the invite lookup returns nothing.
- "No matches" and "Clear filters" now take the assignee filter into account.
- Resizing the bug title no longer logs ResizeObserver loop errors.

## v1.4.0 — 2026-10-07

Screenshot mark-up, shareable views, a getting-started checklist, and an accessibility pass.

### Added

- Mark up a screenshot before filing it. Click a staged image in the capture bar to draw arrows, boxes and freehand strokes in four colors, switch tools with <kbd>A</kbd>, <kbd>B</kbd> and <kbd>P</kbd>, and undo with <kbd>⌘Z</kbd>. The marked-up image replaces the original, and very large results are re-encoded to stay under the upload limit.
- The list's tab, filters and search live in the URL, so a filtered view can be bookmarked or pasted to a teammate, and Back and Forward restore it.
- A getting-started checklist in new workspaces: file a bug, invite a teammate, connect Claude Code and resolve a bug. It tracks progress on its own and can be dismissed.
- `npm run a11y` audits every page in both themes with axe-core and fails on serious or critical issues.

### Changed

- Muted text, avatar initials and inline links now meet WCAG AA contrast in every color scheme. Avatar colors stored before this release are darkened when drawn.
- Workspace pages have a main landmark, a page heading for screen readers and a labelled capture section.
- The demo checkout screenshot no longer comes pre-annotated, since Squash can now mark it up itself.

## v1.3.0 — 2026-10-07

Assignees, notifications, mention autocomplete, and database tests in CI.

### Added

- Assign a bug to a teammate. Pick an owner in the detail view or from the command palette, press <kbd>I</kbd> to take the selected bug yourself or <kbd>A</kbd> to open the picker, and filter the list by assignee, including "Unassigned" and "Me". The list shows the owner of each bug, and the activity timeline records every change. Needs migration `0004_assignees.sql`: only workspace members can be assigned, and a member who leaves is unassigned from their bugs.
- Desktop notifications. While Squash is in a background tab, a teammate filing a bug or assigning one to you raises a notification, and the tab title shows how many arrived. Opt in under Settings → Appearance.
- `@mention` autocomplete in comments. Type `@` to pick a teammate with the arrow keys; names in any script work, and composing with an IME never selects by accident.
- `npm run test:db` applies every migration twice and runs the RLS suite on in-process Postgres (PGlite), with no Supabase project needed. CI runs it on every push.

### Changed

- The landing page loads about 60 KB less JavaScript (gzip). The app, settings, the Claude Code guide and the legal pages load when you open them, and the workspace is prefetched as soon as you are signed in.

### Fixed

- CSV export neutralizes formula prefixes typed with full-width characters and leading tabs, and the Markdown export escapes raw HTML and headings in titles.

## v1.2.0 — 2026-10-07

A design pass across the whole app, plus a command palette, markdown, and export.

### Added

- A command palette on <kbd>⌘K</kbd> / <kbd>Ctrl+K</kbd>. Jump to any bug by number or title, switch workspaces, export, change theme, invite teammates or open settings without leaving the keyboard.
- Markdown in descriptions and comments: bold, italics, inline code and code blocks, lists, quotes and links, with `@name` mentions highlighted. It is rendered as React elements only, and links are limited to http, https and mailto.
- Export the bugs you are looking at as CSV or as a Markdown report, from the list toolbar or the command palette. CSV cells that would run as spreadsheet formulas are neutralized.

- A Features tab next to Bugs, so feature requests no longer have to be filed as bugs. The capture bar files into whichever tab is showing, the detail view can move an item between the two, and Claude exports ask Claude to build a feature rather than fix a bug. Needs migration `0002_bug_kind.sql`; existing items stay bugs.
- Send bugs to Claude Code, one at a time or several at once, with their screenshots and comments. One press opens Claude Code on them in a new terminal, in the project folder chosen for that workspace. The first press walks through a one-command setup that installs a small helper which starts at login. A separate copy button copies a ready-to-paste prompt instead.
- Follow Claude from Squash while it works on a bug. The bug shows Claude's current step, its plan, its latest message and its final summary, and the list marks bugs Claude is working on or waiting on you for. The helper reports progress through Claude Code hooks; rerun the install command to update an existing helper.
- A Claude Code helper guide at `/claude`: how to install, update and uninstall the helper, what the progress panel shows, troubleshooting, and a live check of whether this computer's helper is missing, outdated or up to date. Linked from the landing page footer and the Send to Claude setup dialog.
- Claude Code now finishes bugs on its own. Sent bugs run unattended; when Claude is done its terminal closes, and Squash marks each bug it fixed as resolved with Claude's summary as the resolution note, or comments on bugs it could not finish. Rerun the install command to update the helper.
- Delete a bug or feature request outright, as an alternative to resolving it. The trash button in the detail view asks for confirmation, then removes the item with its screenshots, comments and activity for everyone. Numbers are not reused. Needs migration `0003_bug_delete.sql`.

### Changed

- A redesigned landing page built around real product screenshots, with a how-it-works section, a self-host section and an FAQ.
- Sign-in, onboarding, invite and sign-in callback screens share one layout, with clearer copy and errors shown next to the field they belong to.
- Settings are grouped into titled sections with a side menu. Save buttons stay disabled until something changes and confirm when saved, and destructive actions sit in a separate danger zone.
- Specific empty states for a new workspace, an empty tab and a search with no matches, with a one-click way to clear filters.
- One consistent set of buttons, inputs, menus and focus rings across the app, and semantic colors for severity, status and errors so every color scheme and both themes stay readable.
- The Claude Code guide has copy buttons on every command and a plain explanation of what the local helper can access. The privacy and terms pages are easier to read.
- The stats popover is wider, so its column headings no longer wrap.

### Fixed

- Long bug titles wrap instead of being cut off on phones.
- Changing the theme from one place now updates every theme control at once.
- Keyboard focus is visible on every menu item.
- On phones, the bug detail header no longer pushes the Resolve button off the screen. Send to Claude shows just its icon below 640 px.

### Docs

- A new README with real product screenshots, including the command palette, an animated capture demo, and a GitHub social preview image. `npm run screenshots` regenerates them all from the real app running on demo data, with no Supabase project needed.

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
