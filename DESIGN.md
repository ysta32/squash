# Squash design direction: "Specimen"

Status: proposal from the design lead. It is meant to be built from as written. No web tools were available in this session, so the research comes from the author's working knowledge of each product as of 2026 and was not checked live. Contrast ratios were computed with the WCAG 2.x relative-luminance formula.

---

## 1. Research findings

**Linear**

- Keyboard grammar is consistent: one letter per verb (`A` assign, `L` label, `P` priority), `⌘K` everywhere, and every menu item shows its shortcut, so users learn by using it.
- Optimistic, sync-engine UI: nothing ever waits on a spinner, and changes appear before the server confirms them.
- Triage inbox: incoming items go to a separate queue (accept, decline, duplicate, snooze) before they reach the backlog.
- Risk for us: its look (dark charcoal, violet accent, Inter, glows) is the most-copied SaaS style. Squash's current look is close to it, so we must move away.

**Jam.dev**

- A browser extension captures the screenshot or video **plus console logs, network requests, device, OS, browser, viewport and URL** automatically. Developers trust the report because they don't depend on the reporter's memory.
- "Instant replay": the last 30 s are kept in a buffer, so you can file after the bug has already happened.
- Each report is a shareable link with a dev-tools-like viewer. Integrations push to Linear, Jira and GitHub.

**Marker.io**

- An embeddable widget lets clients and site visitors report bugs with no account. Reports arrive with metadata and annotations.
- Two-way sync with Jira, Linear and GitHub: status changes go back to the reporter ("your issue was fixed").
- Guest/reporter identity is kept separate from team members.

**BugHerd**

- Pins feedback to the **exact DOM element** on a live site, like a sticky note on the page. Has a Kanban board for tasks.
- Non-technical reporters are first-class users. Point-and-click is the whole interaction model.

**Sentry User Feedback**

- The feedback widget links each report to the session replay, the error event and the release, so a vague "it broke" becomes a stack trace.
- Groups duplicates automatically (fingerprints) and shows "N users affected".

**GitHub Issues / Projects**

- `Fixes #123` in a commit or PR closes the issue. The issue timeline shows linked commits and PRs, which gives traceable proof of a fix.
- Issue forms and templates, labels, milestones, saved views with a query language (`is:open label:bug`), and sub-issues.

**Things 3**

- Calm and confident: generous spacing, one accent color, and completion animations that feel physical (the checkbox "fills"). It removes features rather than adding settings.
- Quick Entry from anywhere (a global hotkey), and natural-language dates. A "Today / Logbook" split keeps old work out of sight but easy to reach.

**Raycast**

- One input runs everything. Actions are discoverable through `⌘K` inside the palette, and each list row shows its own contextual action bar.
- Onboarding teaches by doing ("press ⌘K now"), not with tours.

**Arc**

- Its brand identity is carried by **motion and sound-free physical metaphors**: tabs that stack and peel. Personality lives in small moments (the Easel, the boost colors), not in chrome.
- Opinionated defaults with a few well-chosen theme controls.

**Stripe**

- Documentation is part of the product: real code samples with your own keys, and every example can be run. Product screenshots are real or carefully staged, never abstract blobs.
- Fine typographic detail: tabular numerals in every table, consistent 4/8 spacing, and color used to carry meaning.

**Vercel**

- Status, changelog and docs are first-class marketing pages. The deploy log is treated as a hero visual: real system output instead of illustration.
- Geist plus monochrome is now the default "dev tool" look, so it is another style to avoid copying.

**Teenage Engineering**

- Industrial labeling: monospace uppercase micro-labels, numbered parts, color used only to mean something (one orange key). It reads like a manual or spec sheet.
- Product photography is front and center, and copy is dry, short and a little funny.

**Readwise / Reader**

- Highlights work as a core object with a recognizable "marker" color. The weekly digest email is the main retention loop.

**Letterboxd**

- Its personality comes from catalogue conventions (diary, ratings, ledgers) and from what members contribute. Stats are presented as a personal year in review, not as KPIs.

**Apple HIG**

- Hit targets of at least 44 pt on touch. Respect Reduce Motion by swapping motion for cross-fades instead of removing feedback. Avoid relying on color alone. Keep hierarchy clear through type weight and size before using color.

---

## 2. Gaps and standout features

### 2a. Standout features (ranked: build these to own the category)

| #   | Feature                                         | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Scope                              | DB migration                                                                                                                                                         |
| --- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Proof of fix**                                | When Claude Code finishes, the helper reports the commit SHA, branch, PR URL and a diff summary (files, +/−). If the bug has a URL (see #3), the helper re-shoots the page headlessly and attaches an **after** screenshot. The bug detail shows a before/after slider and a "Fix record" specimen label. Fixed bugs resolve with evidence, not just a status change. Builds on the existing Claude fix loop.                                               | L                                  | Yes: `fix_runs` (bug_id, run_id, status, commit_sha, pr_url, files_changed, additions, deletions, after_attachment_id, started_at, finished_at), RLS by workspace    |
| 2   | **Live markup layers**                          | Annotations are saved as vector layers (arrow, box, pen, plus a new **numbered pin**) instead of being baked into the image. Each pin turns into a checklist line on the bug ("① Banner overlaps Pay now"). Comments can reference a pin (`#24.1`). Claude receives the pins as structured regions (normalized x/y/w/h plus note), so "fix the thing in box 2" is precise. Pins tick off as Claude reports steps. Builds on the existing screenshot markup. | M–L                                | Yes: `attachments.annotations jsonb` (versioned schema `{v:1, shapes:[…]}`). The original stays unmarked, and a flattened render is generated client-side for export |
| 3   | **Context-rich capture ("the specimen label")** | Each capture records where and on what: page URL, viewport, OS/browser, app build/commit, and (via an optional browser extension or a 2-line `squash.js` snippet) the last 20 console errors and failed network requests. Shown as a compact mono label on the bug and sent to Claude. The ⌃⌥S macOS hotkey fills in the frontmost app and window title.                                                                                                    | M (fields + label) / L (extension) | Yes: `bugs.context jsonb` (nullable, size-capped by a check constraint ≤ 16 KB)                                                                                      |

These three together form the loop: **capture with context → mark it up precisely → fixed with proof.** No competitor closes that loop. Jam captures, Marker annotates, Sentry gives context, and none of them fixes and proves.

### 2b. Table-stakes gaps (ranked)

| #   | Gap                                                                         | Why                                                                | Scope                                           | Migration                                                                                    |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | Environment metadata on every bug (URL, browser, viewport)                  | Every competitor has it; it's the first thing a developer asks for | S (subset of standout #3 without the extension) | Yes (`bugs.context`)                                                                         |
| 2   | Link to GitHub (PR/commit on the bug; `Fixes SQ-24` resolves it)            | Traceability; proof that a fix happened                            | M                                               | Yes (shared with `fix_runs`, or `bug_links`)                                                 |
| 3   | Labels / areas (≤ 12 per workspace, colored from the severity-free palette) | Grouping beyond Bugs/Features                                      | M                                               | Yes: `labels`, `bug_labels`                                                                  |
| 4   | Duplicates: mark as duplicate of #N, merging screenshots and comments       | Small teams file the same bug twice                                | M                                               | Yes: `bugs.duplicate_of`                                                                     |
| 5   | Email for @mentions/assignments + optional weekly "Field report" digest     | Desktop notifications only work while a tab is open                | M                                               | Yes: `notification_prefs`; needs an Edge Function + email provider (self-hosters bring SMTP) |
| 6   | Outgoing webhooks / Slack post on new critical                              | Founders live in Slack                                             | M                                               | Yes: `webhooks` (url, secret, events)                                                        |
| 7   | Public read-only share link for a bug (for contractors)                     | Getting a bug out of the tool                                      | M                                               | Yes: `bug_shares` (token, expires_at), RLS bypass through an RPC                             |
| 8   | Undo toast for resolve/assign/bulk (5 s)                                    | Keyboard-first means fast mistakes                                 | S                                               | No                                                                                           |
| 9   | Screen recording (≤ 60 s, WebM, compressed)                                 | Some bugs are interactions, not states                             | L                                               | No (storage only), plus a size policy                                                        |
| 10  | Embeddable reporter widget for outsiders                                    | Marker/BugHerd core feature; brings in a new audience              | L                                               | Yes (anonymous reporter, abuse limits)                                                       |

Do **not** add: sprints, story points, due dates or Gantt charts. Squash is for 2–10 people and should stay that way.

---

## 3. Identity: **Specimen**

### Concept

Squash catches bugs, so the interface is a **field collector's specimen cabinet**: each bug is a specimen, pinned, numbered and labeled. Think of the small typed labels under an insect in a natural-history drawer (accession number, date, collector, locality), set in monospace on warm, uncoated paper, with a lab notebook's ruled lines in the background. The ink is near-black. The single brand accent is **Viridian**, the deep green-teal of a jewel beetle's shell and of old lab glass. The only "hand-made" element is the **marker red** from screenshot annotation, which shows the human in the loop. Dense information is set like a spec sheet (Teenage Engineering, museum catalogues), and reading text is set like a book. Nothing glows, floats or uses a gradient. Character comes from typography, rules (1px lines), numbering and the specimen-label motif, not from decoration.

### Type pairing

- **IBM Plex Sans** (UI, body, headings). SIL OFL 1.1. Install `@fontsource-variable/ibm-plex-sans` (wght 100–700). If the variable package is unavailable, use `@fontsource/ibm-plex-sans` with weights 400/500/600. Self-host it; do not use Google's CDN (privacy page claims, offline PWA).
- **IBM Plex Mono** (accession numbers, specimen labels, kbd, code, timestamps, counts). SIL OFL 1.1. Install `@fontsource/ibm-plex-mono` with weights 400 and 500.
- Why: Plex comes from engineering and has warmth (the curved terminals on `a`, `g`, `t`), so it reads as a "lab manual", not "startup". Sans and mono share proportions, so they mix within one line without jitter. Inter is removed completely, including the Google Fonts `<link>` in `index.html`.
- Weights: 400 body; 500 UI controls, labels and row titles; 600 headings and the bug title. **Never 700.** Mono uses 400 for labels and 500 for the accession number.
- Numerals: `font-variant-numeric: tabular-nums` on every number that sits in a column: bug numbers, counts, times, stats, CSV preview. Bug numbers are always mono 500 and zero-padded to at least 3 digits in labels (`No. 024`), but shown unpadded in running text and URLs (`#24`).
- Features: no stylistic sets on Plex Sans (use the defaults). On Plex Mono, turn on `font-variant-numeric: slashed-zero` only in code blocks.

**Root size stays 14px** (`html { font-size: 14px }`) to avoid reflowing the app. All rem values below are against 14px.

| Token       | Use                                                          | Family / weight     | Size (rem / px)  | Line height      | Tracking |
| ----------- | ------------------------------------------------------------ | ------------------- | ---------------- | ---------------- | -------- |
| `label`     | Specimen labels, section eyebrows, table headers (UPPERCASE) | Mono 400            | 0.7857rem / 11px | 1.1429rem / 16px | 0.06em   |
| `xs`        | Meta, timestamps, kbd                                        | Sans 400 / Mono 400 | 0.8571rem / 12px | 1.1429rem / 16px | 0        |
| `sm`        | Secondary UI, chips, menu items                              | Sans 400/500        | 0.9286rem / 13px | 1.4286rem / 20px | 0        |
| `base`      | Default UI, list row titles                                  | Sans 400/500        | 1rem / 14px      | 1.4286rem / 20px | 0        |
| `read`      | Descriptions, comments (reading text)                        | Sans 400            | 1.0714rem / 15px | 1.7143rem / 24px | 0        |
| `lg`        | Dialog titles, settings section headings                     | Sans 600            | 1.2857rem / 18px | 1.7143rem / 24px | -0.01em  |
| `xl`        | Bug detail title                                             | Sans 600            | 1.5714rem / 22px | 2rem / 28px      | -0.015em |
| `2xl`       | Page titles (Settings, Claude guide)                         | Sans 600            | 2rem / 28px      | 2.4286rem / 34px | -0.02em  |
| `display-s` | Marketing section headings                                   | Sans 600            | 2.5714rem / 36px | 2.8571rem / 40px | -0.025em |
| `display-m` | Marketing page heroes (non-home)                             | Sans 600            | 3.4286rem / 48px | 3.5714rem / 50px | -0.03em  |
| `display-l` | Home hero only (≥1024px; 48px below)                         | Sans 600            | 4.5714rem / 64px | 4.5714rem / 64px | -0.035em |

Measure: reading text has a max width of 68ch, and marketing paragraphs 56ch.

### Palette

All text pairs below are WCAG AA (≥ 4.5:1 for text, ≥ 3:1 for UI glyphs and input borders). Severity and status colors are used for **dots, ticks and text**. They are never solid fills behind text, except at their `-tint` background with the same hue as text (checked below).

**Light: "Paper"**

| Role                                            | Token               | Hex                                     | Contrast (on `--bg` #F5F3EE unless noted) |
| ----------------------------------------------- | ------------------- | --------------------------------------- | ----------------------------------------- |
| Background (app canvas)                         | `--bg`              | `#F5F3EE`                               | n/a                                       |
| Surface 1 (list pane, cards)                    | `--surface-1`       | `#FBFAF7`                               | n/a                                       |
| Surface 2 (popovers, dialogs, inputs)           | `--surface-2`       | `#FFFFFF`                               | n/a                                       |
| Surface 3 (hover, wells, kbd, sunken)           | `--surface-3`       | `#ECE9E2`                               | n/a                                       |
| Text 1 (ink)                                    | `--text-1`          | `#1C1B18`                               | 15.53; 17.22 on #FFF                      |
| Text 2                                          | `--text-2`          | `#57534B`                               | 6.90; 6.31 on surface-3                   |
| Text 3 (meta, placeholder)                      | `--text-3`          | `#6E695F`                               | 4.92; 5.46 on #FFF; 4.50 on surface-3     |
| Border 1 (hairlines, dividers)                  | `--border-1`        | `#E2DED5`                               | decorative                                |
| Border 2 (cards, stronger rules)                | `--border-2`        | `#CFCAC0`                               | decorative                                |
| Input border                                    | `--border-input`    | `#8C8679`                               | 3.26 (1.4.11 OK)                          |
| Accent (Viridian)                               | `--accent`          | `#0D6B57`                               | 5.81; 6.45 on #FFF                        |
| Accent hover/pressed                            | `--accent-strong`   | `#0A5948`                               | 7.47                                      |
| Accent foreground (on accent fill)              | `--accent-fg`       | `#FFFFFF`                               | 6.45                                      |
| Accent tint (selected row, chips)               | `--accent-tint`     | `#E3F0EB`                               | accent text on tint 5.50                  |
| Severity low                                    | `--sev-low`         | `#716D64`                               | 4.65                                      |
| Severity medium                                 | `--sev-medium`      | `#8A6A00`                               | 4.57; 5.07 on #FFF                        |
| Severity high                                   | `--sev-high`        | `#C2410C`                               | 4.67; 5.18 on #FFF                        |
| Severity critical                               | `--sev-critical`    | `#C1121F`                               | 5.61; 5.58 on its tint `#FBF0EF`          |
| Status open                                     | `--status-open`     | `#57534B` (= text-2, hollow ring glyph) | 6.90                                      |
| Status in progress (Claude working)             | `--status-progress` | `#0D6B57` (= accent, half-filled glyph) | 5.81                                      |
| Status resolved                                 | `--status-resolved` | `#2F7A2B` (filled check glyph)          | 4.81                                      |
| Success                                         | `--success`         | `#2F7A2B`                               | 4.81                                      |
| Warning                                         | `--warning`         | `#9A5B00`                               | 4.89                                      |
| Danger                                          | `--danger`          | `#B42318`                               | 5.93                                      |
| Focus ring                                      | `--focus`           | `#0D6B57`                               | 5.81 vs bg (≥ 3:1)                        |
| Selection / arrival highlight ("marker yellow") | `--highlight`       | `#F9E27D`                               | text-1 on it 13.29                        |
| Markup red (annotations only, both themes)      | `--markup`          | `#E0321C`                               | 4.52 on #FFF                              |

**Dark: "Darkroom"**

| Role                              | Token             | Hex                               | Contrast (on `--bg` #141412 unless noted) |
| --------------------------------- | ----------------- | --------------------------------- | ----------------------------------------- |
| Background                        | `--bg`            | `#141412`                         | n/a                                       |
| Surface 1                         | `--surface-1`     | `#1A1917`                         | n/a                                       |
| Surface 2                         | `--surface-2`     | `#22211E`                         | n/a                                       |
| Surface 3                         | `--surface-3`     | `#2D2B27`                         | n/a                                       |
| Text 1                            | `--text-1`        | `#EDEAE3`                         | 15.35                                     |
| Text 2                            | `--text-2`        | `#B5B0A5`                         | 8.54; 6.54 on surface-3                   |
| Text 3                            | `--text-3`        | `#9A9589`                         | 6.18; 4.73 on surface-3                   |
| Border 1                          | `--border-1`      | `#2F2D29`                         | decorative                                |
| Border 2                          | `--border-2`      | `#3F3C36`                         | decorative                                |
| Input border                      | `--border-input`  | `#6A655B`                         | 3.18                                      |
| Accent                            | `--accent`        | `#4CC4A3`                         | 8.55; 7.38 on surface-2                   |
| Accent strong                     | `--accent-strong` | `#6FD3B8`                         | 10.26                                     |
| Accent fg                         | `--accent-fg`     | `#0B1F1A`                         | 7.94 on accent                            |
| Accent tint                       | `--accent-tint`   | `#12302A`                         | accent on tint 6.57                       |
| Severity low                      | `--sev-low`       | `#9A9589`                         | 6.18                                      |
| Severity medium                   | `--sev-medium`    | `#E3B341`                         | 9.48                                      |
| Severity high                     | `--sev-high`      | `#FB8C4A`                         | 7.86                                      |
| Severity critical                 | `--sev-critical`  | `#FF6B6B`                         | 6.65                                      |
| Status open / progress / resolved | `--status-*`      | `#B5B0A5` / `#4CC4A3` / `#6CC46A` | 8.54 / 8.55 / 8.56                        |
| Success                           | `--success`       | `#6CC46A`                         | 8.56                                      |
| Warning                           | `--warning`       | `#E9A23B`                         | 8.52                                      |
| Danger                            | `--danger`        | `#FF7A70`                         | 7.26                                      |
| Focus ring                        | `--focus`         | `#4CC4A3`                         | 8.55                                      |
| Highlight                         | `--highlight`     | `#4A4116`                         | text-1 on it 8.49                         |
| Markup red                        | `--markup`        | `#E0321C`                         | (drawn on screenshots)                    |

Severity is never shown by color alone. The glyph is **1–4 vertical ticks** (`|`, `||`, `|||`, `||||`, 2px wide, 8px tall, 2px gap), like a field-notebook tally, and the word appears on hover or focus and in the detail view.

**Color schemes (Appearance setting).** The current six-scheme feature stays, but schemes now override **only** `--accent`, `--accent-strong`, `--accent-fg`, `--accent-tint` and `--focus`. Neutrals are always paper or darkroom. Keep the `data-scheme` IDs for persisted preferences:

| ID (kept)       | New name                                          | Light accent    | Dark accent | AA (light on bg / white on accent; dark on bg) |
| --------------- | ------------------------------------------------- | --------------- | ----------- | ---------------------------------------------- |
| (none, default) | Viridian                                          | `#0D6B57`       | `#4CC4A3`   | 5.81 / 6.45; 8.55                              |
| `forest`        | (folds into the default; alias)                   | same as default | same        | n/a                                            |
| `ocean`         | Cyanotype                                         | `#1F5FA8`       | `#7DB0F0`   | 5.81 / 6.44; 8.20                              |
| `sunset`        | Rust                                              | `#B4470F`       | `#F2925A`   | 4.92 / 5.46; 7.94                              |
| `rose`          | Madder                                            | `#B4235A`       | `#F07AA3`   | 5.69 / 6.31; 7.04                              |
| `graphite`      | Ink                                               | `#1C1B18`       | `#EDEAE3`   | 15.53 / 17.22; 15.35                           |
| `violet`        | (retired; stored value falls back to the default) | n/a             | n/a         | n/a                                            |

Tints per scheme are `color-mix(in oklab, var(--accent) 12%, var(--bg))` in light and 22% in dark.

### Spacing scale (4px base; px values, root 14px so use these exact rems)

`--space-0_5` 2px (0.1429rem) · `--space-1` 4px (0.2857rem) · `--space-1_5` 6px (0.4286rem) · `--space-2` 8px (0.5714rem) · `--space-3` 12px (0.8571rem) · `--space-4` 16px (1.1429rem) · `--space-5` 20px (1.4286rem) · `--space-6` 24px (1.7143rem) · `--space-8` 32px (2.2857rem) · `--space-10` 40px (2.8571rem) · `--space-12` 48px (3.4286rem) · `--space-16` 64px (4.5714rem) · `--space-24` 96px (6.8571rem) · `--space-32` 128px (9.1429rem).

Rules: list row is 36px tall on desktop (8px vertical padding plus a 20px line) and 48px on touch. Pane padding is 16px. Detail column is max 760px with 32px side padding. Marketing sections are 96px apart on desktop and 64px on mobile. Rhythm inside a section: eyebrow → 12 → heading → 16 → body → 32 → visual. Do not use arbitrary values like `mt-7` or `p-5`. Use only the scale above.

### Radius scale

`--radius-xs` 2px (severity ticks, the highlight mark) · `--radius-sm` 4px (chips, kbd, badges, checkboxes) · `--radius-md` 6px (buttons, inputs, menu items) · `--radius-lg` 8px (cards, panels, popovers, screenshots) · `--radius-xl` 12px (dialogs, sheets, marketing screenshot frames) · `--radius-full` (avatars, presence dots only). Nothing uses `rounded-2xl` or pill-shaped buttons.

### Elevation

Light theme (warm ink-tinted shadows, `rgb(28 27 24 / a)`):

- `--elev-0`: none (flat; sections are separated by 1px `--border-1`)
- `--elev-1` (cards, capture bar): `0 1px 0 rgb(28 27 24 / 0.04), 0 1px 2px rgb(28 27 24 / 0.06)`
- `--elev-2` (popovers, menus, toasts): `0 0 0 1px rgb(28 27 24 / 0.06), 0 2px 4px rgb(28 27 24 / 0.04), 0 8px 20px -4px rgb(28 27 24 / 0.12)`
- `--elev-3` (dialogs, palette, lightbox chrome): `0 0 0 1px rgb(28 27 24 / 0.06), 0 4px 8px rgb(28 27 24 / 0.04), 0 24px 48px -12px rgb(28 27 24 / 0.24)`

Dark theme (depth comes from lighter surfaces plus a top highlight line; shadows are mostly invisible):

- `--elev-1`: `inset 0 1px 0 rgb(255 255 255 / 0.03), 0 1px 2px rgb(0 0 0 / 0.4)`
- `--elev-2`: `inset 0 1px 0 rgb(255 255 255 / 0.05), 0 0 0 1px rgb(0 0 0 / 0.5), 0 12px 28px -6px rgb(0 0 0 / 0.6)`
- `--elev-3`: `inset 0 1px 0 rgb(255 255 255 / 0.06), 0 0 0 1px rgb(0 0 0 / 0.6), 0 28px 56px -12px rgb(0 0 0 / 0.7)`

Overlay scrim: light `rgb(28 27 24 / 0.32)`, dark `rgb(0 0 0 / 0.6)`. No `backdrop-blur` anywhere except the sticky marketing nav (`saturate(1.4) blur(8px)` over `--bg` at 85%).

### Motion language

- Curves:
  - `--ease-out` (enter, settle): `cubic-bezier(0.2, 0.8, 0.2, 1)`
  - `--ease-in` (exit): `cubic-bezier(0.4, 0, 1, 1)`
  - `--ease-in-out` (move, resize): `cubic-bezier(0.65, 0, 0.35, 1)`
- Durations: `--dur-micro` 90ms (hover, press, checkbox, color) · `--dur-standard` 160ms (popover, menu, toast in, tab underline) · `--dur-emphasis` 280ms (dialog, lightbox, before/after reveal). Exits are about 70% of the entry time.
- Signature moments, the only three "expressive" animations:
  1. **Arrival**: a new realtime bug row slides in from 4px above at `--dur-standard`, and its background fades from `--highlight` to transparent over 1200ms linear, like a fresh marker stroke drying.
  2. **Resolve**: the status glyph fills (ring → check stroke draws over 180ms), then the row title gets a 1px strikethrough drawn left to right over 160ms before the row leaves the Open filter (exit 120ms opacity plus height collapse).
  3. **Claude step tick**: a step's ring draws into a check (stroke-dashoffset) over 180ms. The current step's ring rotates its dashes (1.2s linear, infinite). That is the one permitted spinner-like element, and only inside the Claude panel.
- Never animate: list reordering under the user's focus or selection (a new item above the selected row adjusts scroll so the selected row stays still), J/K selection movement (instant), text content, layout width or pane resizing, page-level route transitions, skeleton shimmer (skeletons are static `--surface-3` blocks with a 1.6s opacity pulse between 0.6 and 1), scroll position (no smooth-scroll hijacking), or the logo.
- Reduced motion (`prefers-reduced-motion: reduce`): every transform and position animation is removed. Opacity cross-fades are capped at 90ms. The arrival highlight shows as a static tint for 2s and then disappears without a fade. The Claude current-step ring is static, with "Working…" text. The resolve strikethrough appears instantly. Replace the current blanket `0ms !important` rule with these specific rules, so feedback is kept (the Apple HIG pattern).

### Iconography

- Set: **Lucide** (already a dependency), restyled. `strokeWidth={1.5}`, `absoluteStrokeWidth` on, round caps and joins (Lucide's default).
- Sizes: 14px inline with `xs`/`sm` text, 16px in rows, buttons and menus, 20px in empty states and marketing feature rows. Icons are never larger than 20px in the app, with no exceptions.
- Color: icons inherit `currentColor`, which is normally `--text-2`; `--text-1` when the control is active; `--accent` only for the Claude glyph and the active tab.
- Custom glyphs (inline SVG components, drawn on a 16px grid at 1.5 stroke): severity ticks (1–4), status ring/half/check, **specimen pin** (logo mark and "pinned" state), numbered markup pin (a circled numeral in Plex Mono 500).
- Rules: one icon per control (never icon plus emoji). Icon-only buttons need `aria-label` and a tooltip showing the shortcut. Never use filled or duotone variants. Never use an icon purely as decoration next to a heading. Replace Lucide's `Bot` icon for Claude with a dedicated mark (a 4-point asterisk spark in the Claude-panel accent, without imitating Anthropic's logo exactly). Keep it neutral and label it "Claude Code" in text.

### Scrollbar, focus ring, selection

- Scrollbars: `scrollbar-width: thin; scrollbar-color: var(--border-2) transparent;`. WebKit: 10px track, transparent; the thumb is `--border-2` with a 2px transparent border (`background-clip: padding-box`) and a 999px radius; on hover the thumb becomes `--text-3`. Panes reserve gutter space with `scrollbar-gutter: stable` so content doesn't shift.
- Focus ring: `outline: 2px solid var(--focus); outline-offset: 2px;` on `:focus-visible` only. Inside dense lists (rows, menu items) use `outline-offset: -2px` so the ring isn't clipped. Inputs show the ring plus a `--border-input` → `--focus` border change. A focus style must never be removed without a replacement.
- Selection: `::selection { background: var(--highlight); color: var(--text-1); }`, the marker highlight. It is the same color as the arrival flash, which reinforces the "marker" motif.

### Illustration / graphic motif (use sparingly)

1. **Specimen label**: a small bordered block (1px `--border-2`, radius 2px, `--surface-1`), with mono `label` text in uppercase, fields separated by `·`, and a 1px hairline under the top line. Example:
   `NO. 024 · BUG · CRITICAL`
   `COLL. J. ELLIS · 07 OCT 2026 14:02 · /checkout · iOS 18 SAFARI 390×844`
   Used on: the bug detail header, the Claude "Fix record", OG images, and press-kit cards. **Not** on list rows; they stay plain.
2. **Marker strokes**: the only hand-drawn element. Marketing screenshots carry real annotations (made with Squash's own annotate tool, in `--markup`). Never add decorative squiggles beyond those.
3. **Ruled paper**: marketing hero and empty states may use a faint horizontal rule pattern (1px `--border-1` every 24px, masked to fade at the edges). It replaces the current grid-plus-radial-blur background.
4. **Logo**: wordmark "squash" in Plex Sans 600, lowercase, tracking -0.02em, preceded by the specimen-pin mark (a 6px filled circle in `--accent` with a 45° pin line in `--text-1`). The pin head becomes the favicon. The current purple "S" square is retired.

---

## 4. Voice and tone

Principles:

1. **Lab-notebook precise.** Say what happened, with the number: "Filed #24" and not "Success!". Use real nouns from the product: bug, screenshot, teammate, Claude Code.
2. **Calm, a bit dry.** We're among teammates fixing things, not selling. Allow one light touch per surface at most ("Nothing's broken. Suspicious.").
3. **Short.** UI strings ≤ 8 words where possible, buttons 1–3 words, and buttons always state the verb ("Resolve", not "OK").
4. **Honest.** Never claim more than the system knows. "Sent to Claude Code" is fine; "Claude fixed it" only after the run reports success. Never use invented numbers, quotes or logos.
5. **Sentence case** everywhere, including buttons and headings. Use mono UPPERCASE only for specimen labels and eyebrows.

| Do                                                                                 | Don't                                                                                                                               |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| file, fix, resolve, reopen, pin, mark up, send to Claude Code, teammate, workspace | supercharge, unlock, seamless, effortless, revolutionize, magic, AI-powered, leverage, empower, delight, blazing fast, game-changer |
| "about a second" (true)                                                            | "instantly", "real-time" in headlines (fine in docs)                                                                                |
| "You" / "your teammate"                                                            | "users", "folks", "Oops!", "Uh-oh", "Whoops"                                                                                        |
| Specific errors with the next step                                                 | "Something went wrong" with nothing else                                                                                            |
| Numbers as digits (3 bugs)                                                         | Exclamation marks (none in the UI; max one on the entire marketing site)                                                            |
|                                                                                    | Emoji in UI copy or headings                                                                                                        |

Rewrites:

1. Empty list: "No bugs yet 🎉 You're all caught up!" → **"Nothing filed. Paste a screenshot or press N to file the first bug."**
2. Empty filter: "No results found." → **"No open bugs match 'checkout'. Clear filters (Esc)"**
3. Upload error: "Oops! Something went wrong." → **"Screenshot didn't upload: the file is over 5 MB. Try a smaller crop."**
4. Success toast: "Bug created successfully!" → **"Filed #26"** with action **"Undo"** (5 s)
5. Claude result: "Claude has completed the task!" → **"Claude Code finished #24: 3 files changed. Review the PR."**
6. Landing CTA: "Get started for free" / "Supercharge your QA" → **"Open a workspace"** (primary) · **"Self-host it"** (secondary)
7. Offline: "You are offline. Please check your connection." → **"Offline. New bugs are saved and will send when you reconnect."** (only if queued writes are implemented; otherwise "Offline. Changes won't save until you reconnect.")

---

## 5. Per-surface direction

**Landing / marketing home.** Left-aligned, asymmetric 12-column grid (content cols 1–7, visual 6–12 overlapping by one column). The hero heading is `display-l`, left-aligned, max 14 words. Keep "Bug reports your cofounder actually reads." Under it, a mono specimen label of a real (demo-seeded) bug, then two CTAs, then one line of plain facts in mono: `MIT · SELF-HOST ON SUPABASE · NO TRACKING`. The hero visual is the **real product screenshot**, light or dark following the theme, in a 12px-radius frame with `--elev-3`, bleeding off the right edge on desktop. Below that, the story is told as three **numbered chapters**, `01 Capture`, `02 Mark up`, `03 Fix with Claude Code`, alternating text-left/image-right, then image-left/text-right, each with a real screenshot carrying marker annotations. After that, a **dense ledger** of the remaining features as a 2-column definition list (term in sans 500, description in text-2, hairline rules between rows), not cards. Then a "Keyboard" strip showing actual shortcuts as kbd caps in a single row. Then "Self-host in 5 minutes" with a real copyable command block. The footer is a full sitemap in 4 columns. Remove the radial accent blur and the grid background. Remove identical 3-column card grids.

**App shell.** The header is 48px tall on `--bg` with a 1px `--border-1` bottom: logo pin + workspace switcher (left), then presence, Invite, stats, theme and profile (right). The capture bar sits directly below on `--surface-2` with `--elev-1`, full width of the list column plus detail (as now). The list pane (`--surface-1`, 400–480px resizable, width remembered) and the detail pane (`--bg`) are separated by a 1px rule. No pane cards and no rounded pane containers. Bugs/Features tabs become an underline tab bar (2px `--accent` underline, animated at `--dur-standard`), not a segmented pill.

**List rows.** 36px desktop / 48px touch. Columns: severity ticks (16px) · `#24` mono 500 `text-3`, tabular, right-aligned in a fixed 4ch column · title sans 500 `text-1` with ellipsis · meta icons (screenshot count, Claude status) `text-3` · relative time mono `xs` `text-3`, tabular · assignee avatar (20px). Hover: `--surface-3`. Selected: `--accent-tint` background plus a 2px `--accent` left bar inset (no layout shift). Resolved rows: title in `text-3` with strikethrough. Rows are never cards, never get shadows, and never have between-row gaps; they use 1px `--border-1` dividers.

**Bug detail.** Top line: the specimen label (number, kind, severity, collector, date, context). Then the title (`xl`, editable in place) and a toolbar line: severity menu, assignee, **Send to Claude Code** (secondary), **Resolve** (primary, accent fill, the only filled button on screen). Delete goes into a `…` menu, not as a bare icon. Order: description (`read`) → screenshots (a horizontal strip of 8px-radius thumbnails, 4:3, `object-fit: cover`, click for the lightbox; numbered pins visible) → pin checklist (once standout #2 exists) → Claude panel → activity and comments merged into one timeline (activity lines in `xs` `text-3`, comments as `read` text with an author line). Section eyebrows use the mono `label` style ("DESCRIPTION", "SCREENSHOTS 2", "TIMELINE").

**Claude panel.** A bordered (`--border-2`) block on `--surface-1`, headed by a specimen-style label `CLAUDE CODE · RUN 3 · 2M 24S · 14 STEPS`. The current action is a mono line in a `--surface-3` well. Steps use the status glyphs. The result summary is in `read` text. When done, a **Fix record** shows commit, PR link, files ±, and the before/after slider (standout #1).

**Capture bar.** One line until it's focused or holds content, then it grows (max 8 lines, no layout jump below: the list scrolls under it). Placeholder: "Paste a screenshot or describe the bug". Staged screenshots are 56px thumbs with a × button and "Mark up" on hover or focus. Right cluster: severity ticks picker (`Alt+1–4` hint in a tooltip) and **File** with `↵` kbd. The "Press N to focus" text only appears when the bar is unfocused and empty, as `xs` `text-3`.

**Dialogs and toasts.** Dialogs: `--surface-2`, `--radius-xl`, `--elev-3`, 24px padding, title `lg`, actions right-aligned (secondary then primary), Esc closes, enter animation of opacity plus 4px translate at `--dur-emphasis`. Command palette: 640px wide, positioned at 20vh from the top (not centered vertically), input 48px, results grouped under mono labels, shortcut hints right-aligned. Toasts: bottom-left (not center), `--surface-2`, `--elev-2`, max 360px, one line plus an optional action, auto-dismiss after 5s (errors stay until dismissed), stacked with an 8px gap.

**Settings.** Two-column layout: a left nav list (Profile, Workspace, Members, Appearance, Notifications, Claude Code, Danger zone) and the content on the right, max 640px. Each section is a ledger of rows: label + description (left) and control (right), with hairline dividers. No cards. The danger zone is a section with a `--danger` text heading and a bordered block; destructive buttons are outlined in danger and turn filled only inside the confirm dialog, which requires typing the workspace name.

**Auth and onboarding.** Split screen on desktop. Left: a form at 360px width, left-aligned, with the logo at the top. Right: on `--surface-1`, a static, real specimen label and screenshot of a filed bug, with the caption "This is what your teammate sees." Onboarding is 3 steps shown as `01 / 02 / 03` mono: name the workspace → invite a teammate (copy link) → file your first bug (with a live capture bar, plus a pre-made sample screenshot they can paste in). No product tour overlays.

**States.**

- Empty: left-aligned within the pane, a 20px icon, one `base` 500 line plus one `sm` `text-2` line, and an action button. Use the ruled-paper motif faintly behind it. No large illustrations.
- Loading: skeleton rows that exactly match row geometry (36px, tick, number, title bar at 40–70% width, avatar circle). The detail skeleton matches the label, title and description blocks. No spinners anywhere except the Claude current-step ring and inline button "pending" states, where the label changes to "Filing…" and the button width stays fixed.
- Error: inline, at the place of failure, with `--danger` text, a cause, and Retry. A full-page error (the ErrorBoundary) uses the specimen label `ERROR · <code> · <time>`, a Reload button, and a "Copy details" button.
- Offline: a 28px banner under the header on `--surface-3`, with a `--warning` dot and the "Offline…" copy. The ReconnectingPill becomes this banner after 3s of reconnecting.
- Success: no full-screen success states. Success shows as the arrival highlight, the resolve animation, or a toast.

---

## 6. Marketing site IA

All pages share the nav: Logo · Features · Changelog · Docs · Self-host · GitHub (star count fetched at build, or no count; never hardcoded) · **Open a workspace**. The footer has 4 columns: Product (Features, Changelog, Pricing, Status), Resources (Docs, Self-host, Claude Code guide, FAQ, Press kit), Project (About, GitHub, License, Security policy), Legal (Privacy, Terms).

| Route                | Content                                                                                                                                                                                                                                                                            | OG image                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `/`                  | Hero, 3 chapters, feature ledger, keyboard strip, self-host block, footer (section 5)                                                                                                                                                                                              | Specimen label "SQUASH · BUG TRACKER FOR 2–10 PEOPLE" + hero screenshot crop |
| `/features`          | One anchored section per feature group: Capture, Markup, Live, Claude Code, Keyboard, Workspace, Export, Security. Each has a real screenshot and a fact list                                                                                                                      | Label "FEATURES" + capture screenshot                                        |
| `/pricing`           | Honest: "Free. MIT licensed. Use the hosted instance at no cost, or run it on your own Supabase." Two columns (Hosted / Self-hosted) listing who pays for what (Supabase free-tier limits apply when self-hosting; the hosted instance has no paid tier and no SLA). No fake tiers | Label "PRICING · FREE · MIT"                                                 |
| `/changelog`         | Rendered at build time from `CHANGELOG.md` (markdown → HTML, the version heading anchors are permalinks, dates in mono). The "Unreleased" section is shown labeled as such. RSS feed `/changelog.xml`                                                                              | Per release: "v1.6.0 · 2026-10-07" + first sentence                          |
| `/docs` (+ subpages) | Getting started, Capture, Markup, Keyboard, Claude Code (the existing ClaudeGuide content), Self-host, Migrations, Security model, the hotkey setup. Sourced from README/MAINTAINER sections split into MD files                                                                   | Label "DOCS · <page title>"                                                  |
| `/faq`               | 8–12 real questions taken from README content (Where is data stored? Can I self-host? What does Claude Code get access to? Does it work on mobile? Is there an API?)                                                                                                               | Label "FAQ"                                                                  |
| `/about`             | Plain facts: an open-source MIT project, the maintainer's GitHub handle and link (from the repo owner `ysta32`, nothing else invented), how to contribute, how decisions are made (issues and Discussions). No team photos, no mission statements                                  | Label "ABOUT"                                                                |
| `/privacy`, `/terms` | Existing pages restyled with the reading type style and a mono "Last updated" label                                                                                                                                                                                                | Label + title                                                                |
| `/press`             | Logo files (SVG/PNG, light and dark, mark only, wordmark), the color tokens with hex values, type names with links, and the real screenshots from `docs/screenshots` as a zip. Usage notes. No quotes or coverage                                                                  | Label "PRESS KIT"                                                            |
| `/status`            | A self-check page: client-side pings to the app origin, the Supabase REST health endpoint and Realtime connect, shown as three rows with latency. Links out to status.vercel.com and status.supabase.com. States clearly that it is "checked from your browser, now"               | Label "STATUS"                                                               |
| 404                  | Specimen label `NO. 404 · NOT FOUND · <path>` and the line "This page escaped. It may have been moved or squashed." Links: Home, Docs, Changelog                                                                                                                                   | n/a                                                                          |

OG images are generated at build time (Satori or the existing `og.svg` pipeline) at 1200×630 on `--bg` paper, with a specimen label at the top left, the title in Plex Sans 600 at 64px, and the pin logo at the bottom right. There is a dark variant only for the press kit.

---

## 7. Token contract (`src/index.css`)

Implementers replace the existing `:root` / `.dark` / `[data-scheme]` / `@theme inline` blocks with the following. The component class names migrate as follows: `bg-bg`, `text-fg` → `text-ink`, `text-muted` → `text-ink-3` (or `text-ink-2` for secondary), `bg-bg-subtle` → `bg-surface-1`, `bg-bg-elevated` → `bg-surface-2`. Keep temporary aliases (`--color-fg`, `--color-muted`, `--color-bg-subtle`, `--color-bg-elevated`, `--color-border`) mapped to the new values until every component is migrated, then delete them.

```css
@import 'tailwindcss';
@import '@fontsource-variable/ibm-plex-sans';
@import '@fontsource/ibm-plex-mono/400.css';
@import '@fontsource/ibm-plex-mono/500.css';

@custom-variant dark (&:where(.dark, .dark *));

:root {
  /* neutrals: paper */
  --bg: #f5f3ee;
  --surface-1: #fbfaf7;
  --surface-2: #ffffff;
  --surface-3: #ece9e2;
  --text-1: #1c1b18;
  --text-2: #57534b;
  --text-3: #6e695f;
  --border-1: #e2ded5;
  --border-2: #cfcac0;
  --border-input: #8c8679;
  /* accent: viridian */
  --accent: #0d6b57;
  --accent-strong: #0a5948;
  --accent-fg: #ffffff;
  --accent-tint: #e3f0eb;
  --focus: var(--accent);
  /* severity */
  --sev-low: #6c6860;
  --sev-medium: #826400;
  --sev-high: #ba3e0c;
  --sev-critical: #c1121f;
  --sev-critical-tint: #fbf0ef;
  /* status + feedback */
  --status-open: #57534b;
  --status-progress: var(--accent);
  --status-resolved: #2e772a;
  --success: #2e772a;
  --warning: #985a00;
  --danger: #b42318;
  /* motif */
  --highlight: #f9e27d;
  --markup: #e0321c;
  --scrim: rgb(28 27 24 / 0.32);
  /* elevation */
  --elev-1: 0 1px 0 rgb(28 27 24 / 0.04), 0 1px 2px rgb(28 27 24 / 0.06);
  --elev-2:
    0 0 0 1px rgb(28 27 24 / 0.06), 0 2px 4px rgb(28 27 24 / 0.04),
    0 8px 20px -4px rgb(28 27 24 / 0.12);
  --elev-3:
    0 0 0 1px rgb(28 27 24 / 0.06), 0 4px 8px rgb(28 27 24 / 0.04),
    0 24px 48px -12px rgb(28 27 24 / 0.24);
  color-scheme: light;
}

.dark {
  --bg: #141412;
  --surface-1: #1a1917;
  --surface-2: #22211e;
  --surface-3: #2d2b27;
  --text-1: #edeae3;
  --text-2: #b5b0a5;
  --text-3: #9a9589;
  --border-1: #2f2d29;
  --border-2: #3f3c36;
  --border-input: #716c62;
  --accent: #4cc4a3;
  --accent-strong: #6fd3b8;
  --accent-fg: #0b1f1a;
  --accent-tint: #12302a;
  --sev-low: #9a9589;
  --sev-medium: #e3b341;
  --sev-high: #fb8c4a;
  --sev-critical: #ff6b6b;
  --sev-critical-tint: #3a1716;
  --status-open: #b5b0a5;
  --status-resolved: #6cc46a;
  --success: #6cc46a;
  --warning: #e9a23b;
  --danger: #ff7a70;
  --highlight: #4a4116;
  --scrim: rgb(0 0 0 / 0.6);
  --elev-1: inset 0 1px 0 rgb(255 255 255 / 0.03), 0 1px 2px rgb(0 0 0 / 0.4);
  --elev-2:
    inset 0 1px 0 rgb(255 255 255 / 0.05), 0 0 0 1px rgb(0 0 0 / 0.5),
    0 12px 28px -6px rgb(0 0 0 / 0.6);
  --elev-3:
    inset 0 1px 0 rgb(255 255 255 / 0.06), 0 0 0 1px rgb(0 0 0 / 0.6),
    0 28px 56px -12px rgb(0 0 0 / 0.7);
  color-scheme: dark;
}

/* Schemes override accent only. Keep IDs in sync with COLOR_SCHEMES in lib/theme.ts.
   'forest' and 'violet' (legacy) resolve to the default; lib/theme.ts maps them on read. */
[data-scheme='ocean'] {
  --accent: #1f5fa8;
  --accent-strong: #184c87;
  --accent-fg: #ffffff;
}
.dark[data-scheme='ocean'] {
  --accent: #7db0f0;
  --accent-strong: #a3c7f5;
  --accent-fg: #0d1a2b;
}
[data-scheme='sunset'] {
  --accent: #b4470f;
  --accent-strong: #93390b;
  --accent-fg: #ffffff;
}
.dark[data-scheme='sunset'] {
  --accent: #f2925a;
  --accent-strong: #f6ae83;
  --accent-fg: #2a1407;
}
[data-scheme='rose'] {
  --accent: #b4235a;
  --accent-strong: #921b49;
  --accent-fg: #ffffff;
}
.dark[data-scheme='rose'] {
  --accent: #f07aa3;
  --accent-strong: #f49dbb;
  --accent-fg: #2a0d18;
}
[data-scheme='graphite'] {
  --accent: #1c1b18;
  --accent-strong: #000000;
  --accent-fg: #ffffff;
}
.dark[data-scheme='graphite'] {
  --accent: #edeae3;
  --accent-strong: #ffffff;
  --accent-fg: #141412;
}
[data-scheme] {
  --accent-tint: color-mix(in oklab, var(--accent) 12%, var(--bg));
}
.dark[data-scheme] {
  --accent-tint: color-mix(in oklab, var(--accent) 22%, var(--bg));
}

@theme inline {
  --font-sans:
    'IBM Plex Sans Variable', 'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI',
    sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;

  --color-bg: var(--bg);
  --color-surface-1: var(--surface-1);
  --color-surface-2: var(--surface-2);
  --color-surface-3: var(--surface-3);
  --color-ink: var(--text-1);
  --color-ink-2: var(--text-2);
  --color-ink-3: var(--text-3);
  --color-line: var(--border-1);
  --color-line-2: var(--border-2);
  --color-line-input: var(--border-input);
  --color-accent: var(--accent);
  --color-accent-strong: var(--accent-strong);
  --color-accent-fg: var(--accent-fg);
  --color-accent-tint: var(--accent-tint);
  --color-focus: var(--focus);
  --color-sev-low: var(--sev-low);
  --color-sev-medium: var(--sev-medium);
  --color-sev-high: var(--sev-high);
  --color-sev-critical: var(--sev-critical);
  --color-sev-critical-tint: var(--sev-critical-tint);
  --color-status-open: var(--status-open);
  --color-status-progress: var(--status-progress);
  --color-status-resolved: var(--status-resolved);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-danger: var(--danger);
  --color-highlight: var(--highlight);
  --color-markup: var(--markup);
  --color-scrim: var(--scrim);
  /* temporary aliases: delete after migration */
  --color-fg: var(--text-1);
  --color-muted: var(--text-3);
  --color-bg-subtle: var(--surface-1);
  --color-bg-elevated: var(--surface-2);
  --color-border: var(--border-1);
  --color-ring: var(--focus);

  /* type scale (root = 14px) */
  --text-label: 0.7857rem;
  --text-label--line-height: 1.1429rem;
  --text-label--letter-spacing: 0.06em;
  --text-xs: 0.8571rem;
  --text-xs--line-height: 1.1429rem;
  --text-sm: 0.9286rem;
  --text-sm--line-height: 1.4286rem;
  --text-base: 1rem;
  --text-base--line-height: 1.4286rem;
  --text-read: 1.0714rem;
  --text-read--line-height: 1.7143rem;
  --text-lg: 1.2857rem;
  --text-lg--line-height: 1.7143rem;
  --text-lg--letter-spacing: -0.01em;
  --text-xl: 1.5714rem;
  --text-xl--line-height: 2rem;
  --text-xl--letter-spacing: -0.015em;
  --text-2xl: 2rem;
  --text-2xl--line-height: 2.4286rem;
  --text-2xl--letter-spacing: -0.02em;
  --text-display-s: 2.5714rem;
  --text-display-s--line-height: 2.8571rem;
  --text-display-s--letter-spacing: -0.025em;
  --text-display-m: 3.4286rem;
  --text-display-m--line-height: 3.5714rem;
  --text-display-m--letter-spacing: -0.03em;
  --text-display-l: 4.5714rem;
  --text-display-l--line-height: 4.5714rem;
  --text-display-l--letter-spacing: -0.035em;

  /* spacing base: 4px at a 14px root => Tailwind's p-1 = 4px, p-2 = 8px … */
  --spacing: 0.2857rem;

  --radius-xs: 2px;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;

  --shadow-elev-1: var(--elev-1);
  --shadow-elev-2: var(--elev-2);
  --shadow-elev-3: var(--elev-3);
  /* temporary aliases */
  --shadow-xs: var(--elev-1);
  --shadow-card: var(--elev-1);
  --shadow-elevated: var(--elev-2);

  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --animate-in: enter 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
  --animate-fade: fade-in 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
  --animate-dialog: enter 280ms cubic-bezier(0.2, 0.8, 0.2, 1);
  --animate-arrive: arrive 1200ms linear;
}

:root {
  --dur-micro: 90ms;
  --dur-standard: 160ms;
  --dur-emphasis: 280ms;
}

@layer base {
  html {
    font-size: 14px;
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }
  body {
    background: var(--bg);
    color: var(--text-1);
  }
  *,
  ::before,
  ::after {
    border-color: var(--border-1);
  }
  ::selection {
    background: var(--highlight);
    color: var(--text-1);
  }
  * {
    scrollbar-width: thin;
    scrollbar-color: var(--border-2) transparent;
  }
  ::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: var(--border-2);
    border: 2px solid transparent;
    background-clip: padding-box;
    border-radius: 999px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background-color: var(--text-3);
  }
  code,
  kbd,
  samp,
  pre {
    font-family: var(--font-mono);
  }
}

@utility focus-ring {
  outline: none;
  &:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
}
@utility focus-ring-inset {
  outline: none;
  &:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
}
@utility t {
  transition-property: color, background-color, border-color, opacity, box-shadow, transform;
  transition-duration: var(--dur-micro);
  transition-timing-function: var(--ease-out);
}
@utility panel {
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-1);
  background-color: var(--surface-2);
  box-shadow: var(--elev-2);
}
@utility nums {
  font-variant-numeric: tabular-nums;
}
@utility specimen-label {
  font-family: var(--font-mono);
  font-size: var(--text-label);
  line-height: var(--text-label--line-height);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}

@keyframes enter {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes arrive {
  from {
    background-color: var(--highlight);
  }
  to {
    background-color: transparent;
  }
}
@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  ::before,
  ::after {
    animation-duration: 0ms !important;
    animation-iteration-count: 1 !important;
    transition-property: opacity, color, background-color, border-color !important;
    transition-duration: 90ms !important;
    scroll-behavior: auto !important;
  }
  .animate-arrive {
    animation: none !important;
    background-color: var(--highlight);
  }
}
```

Notes for implementers:

- Contrast corrections (applied in `src/index.css`, task D2): light `--success`/`--status-resolved` `#2E772A`, `--warning` `#985A00`, `--sev-low` `#6C6860`, `--sev-medium` `#826400` and `--sev-high` `#BA3E0C` are slightly darker than the section 3 table so they also reach 4.5:1 on `--surface-3` (hovered rows, wells); dark `--border-input` is `#716C62` so input borders reach 3:1 on `--surface-2` (was 2.78).
- `--spacing: 0.2857rem` makes Tailwind's `p-1` exactly 4px at the 14px root. **This changes every existing spacing utility by about 14%** (currently 3.5px per step). Land it in its own task, with a screenshot diff (`scripts/screenshots`), and convert arbitrary `[…px]` values to the scale.
- The `arrive` reduced-motion class needs JS to remove `.animate-arrive` after 2s (the arrival hook already exists for toasts; reuse it).
- `index.html`: remove the Google Fonts Inter `<link>`s and add `<link rel="preload">` for the Plex Sans variable woff2 (latin subset) to prevent text flashing or layout shift. Set `font-display: swap` with a size-adjusted fallback (`@font-face { font-family: 'Plex Fallback'; src: local('Arial'); size-adjust: 100.6%; ascent-override: 102.5%; descent-override: 27.5%; }`) and append it to `--font-sans` after the Plex names.
- Update `lib/theme.ts` COLOR_SCHEMES: default is "Viridian"; `forest` and `violet` map to the default on read; rename labels (Cyanotype, Rust, Madder, Ink). Update the README "Make it yours" section and `schemes.png` at release (Fable owns CHANGELOG per D-11).
- Retire the purple badges in the README (`color=7c3aed`) in favor of `0d6b57`.

---

## 8. Brief v2 amendments (these win over earlier sections where they conflict)

**The bar.** Apple product pages, Linear, Stripe, Vercel, Arc. If a screen could pass for a template, it isn't done. One job and one focal point per screen and per section. A visitor grasps what Squash is within 5 seconds.

**Type.** IBM Plex Sans + IBM Plex Mono stay (Inter, Roboto, Arial, Space Grotesk and system defaults are banned). Display sizes get tighter tracking and dramatic contrast against `label`. Marketing heroes may go to 80–96px at ≥1440px (`display-xl`, -0.04em).

**Depth replaces "no gradients".** Flat default backgrounds are banned. Depth is allowed when it serves the specimen-cabinet concept:

- **Paper grain.** A subtle SVG noise texture (`feTurbulence`, about 3–4% opacity, inlined data URI, one tile) on `--bg` in light mode. In dark mode, a faint "slate" grain at about 2%.
- **Cabinet light.** One soft, warm radial light falloff from the top left of marketing heroes and the auth panel (paper lit by a desk lamp): `radial-gradient` from `--surface-1` to `--bg`, never purple or blue, never a blob.
- **Glass for overlays only.** Command palette, lightbox backdrop and sticky marketing nav use `backdrop-filter: blur(12–16px)` over a translucent surface.
- **Specimen drawer shadow.** Screenshot frames get layered shadows (`--elev-3`, plus a 1px inner highlight), as if laid on paper.
  Still banned: purple or blue AI gradients, gradient-blob heroes, glows on text.

**Motion: purposeful, a few cinematic moments.** Transform and opacity only.

1. Home hero: the specimen label "types" in (mono characters stagger in, 18ms each, about 400ms total), then the product screenshot rises 16px and fades in.
2. Scroll-driven chapter reveals on marketing pages (IntersectionObserver, or CSS `animation-timeline: view()` where supported): the text block, then the screenshot, staggered 80ms; the marker annotation draws its stroke (`stroke-dashoffset`) when it comes into view.
3. In the app: resolve = the row's title strikethrough draws left to right (220ms) and a check pin stamps in (scale 1.15 → 1); a new bug arrival = a 600ms accent-tint highlight fade; a dialog = opacity plus a 4px rise.
   Everything collapses to instant or opacity-only under `prefers-reduced-motion`.

**Narrative order (home).** Hook (hero: what it is plus the product) → Problem (bug reports arriving as Slack screenshots with no context; told concretely with a mock thread built from real UI, not invented testimonials) → Product (3 chapters: capture, mark up, fix with Claude Code, with live UI previews and an interactive mini demo of the capture bar if feasible) → Proof (real facts only: open source MIT, the test count from the repo, the RLS test count, the bundle size budget, the number of releases, the changelog link; numbers computed at build time where possible) → Depth (feature ledger, keyboard strip, security model, self-host) → Action (Open a workspace / Self-host). Other marketing pages follow the same pattern at a smaller scale.

**Process.** DESIGN.md lives in the repo (`/DESIGN.md`) with the progress log below. At least 3 full screenshot critique rounds (375, 768, 1280, 1920 × light/dark, every page and key state), each logged here, iterating while improvements are meaningful. Before/after screenshots: before = `.orch/shots/baseline`, after = `.orch/shots/round-N`.

## 9. Progress log

- 2026-10-07: Direction "Specimen" written (research, identity, tokens, voice, surfaces, IA). Brief v2 amendments added. Baseline screenshots captured (73 shots; 375/768/1280/1920 × light/dark).
- 2026-10-07: Critique round 0 on the baseline (`.orch/critique/round0.md`): 4 P0s (landing/404/auth never reachable in demo capture, placeholder legal copy live, broken demo attachments, dark accent-button contrast) and a stock purple/Inter look across every surface.
- 2026-10-07: D2 landed the foundation: IBM Plex Sans/Mono self-hosted (Inter removed), paper/darkroom tokens, grain, cabinet light, glass, focus ring, scrollbars, reduced motion, schemes reduced to accent-only (purple retired). Several status/severity colours darkened to pass AA.
- 2026-10-07: Restyle passes started: brand mark and UI primitives (B1), bug detail and Claude panel (S2), capture bar, palette, dialogs and toasts (S3), settings, auth and onboarding (S4).
- 2026-10-07: Surface passes landed and integrated: S1 shell/list (ledger rows, tally ticks, segmented status, resizable pane), S2 detail (+ phone resolve sheet, menu, lightbox), S3 capture/palette/dialogs/toasts, S4 settings/auth/onboarding (autosave, split auth), plus the F2 markup layers and F3 fix-record UI. Bundle slimmed by 7.3 kB; size gate now measures the real build (D-15).
- 2026-10-07: **Critique round 1** on the integrated build (364 shots, `.orch/shots/round-1`; `.orch/critique/round-1-workspace.md`, `round-1-overlays.md`). Verdict ITERATE. P0s: touch targets under 44–48px at 375; staged capture bar covering the list toolbar; unassigned rows falling back to the filer's avatar; sign-in primary disabled and low-contrast. P1 themes: the detail pane ignoring loading/empty states, wide-screen balance, one Kbd and one dialog anatomy, the settings header not matching the app, the Claude guide reading as a generic docs template, touch-only wording. Six fix passes dispatched (list/shell, capture/Kbd, detail, dialogs/palette, settings/auth, harness clock freeze + coverage).
