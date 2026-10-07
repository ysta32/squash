# Changelog

## Unreleased

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
