---
title: Getting started
description: Sign up, open a workspace, invite your teammates, file the first bug and take the tour.
group: Use
order: 1
---

Squash is a free bug tracker for teams of 2–10 people. There is one input for filing, one live list everybody shares, and one detail view per item. Nothing has to be configured before the first bug, and anyone can sign up.

## Sign in

Open the app and sign in with Google or with a magic link sent to your email address. There is no password, and signing in for the first time creates your account. A new account gets a profile with your name and avatar from Google, or the part of your email address before the `@` if you used a magic link. You can change your name in Settings.

## Create a workspace

A workspace is the shared list of bugs for one team or product. Give it a name and you are its owner. You can own up to 5 workspaces and belong to more.

Setup takes three steps: name the workspace, copy its invite link, and see how to file the first bug. When the workspace opens for the first time, a short tour walks through the rest. You can take it again at any time with **Take the tour** in the command palette, in your profile menu, or beside the **Get started** checklist.

## Invite your teammates

Every workspace has an invite link. Copy it from the header (**Invite**) or from Settings and send it however you like. Anyone with the link can join until the owner regenerates it. A workspace holds up to 10 members.

- The owner can rename the workspace, regenerate the invite, remove members, transfer ownership or delete it.
- Members can file, edit, comment on, assign and resolve every bug in the workspace.
- Only the member who filed a bug and the workspace owner can delete it.

## File the first bug

Paste a screenshot anywhere on the page, type what is wrong, and press <kbd>Enter</kbd>. The bug is on every teammate's screen about a second later. See [Capture](/docs/capture) for everything the capture bar does.

Until you dismiss it, a **Get started** checklist above the list tracks four first steps: file a bug, invite a teammate, connect Claude Code and resolve a bug.

## Work the list

- **Open**, **Resolved** and **All** tabs show live counts. Filters and the sort order are kept in the URL, so a filtered view can be shared as a link.
- Select a bug with <kbd>J</kbd> / <kbd>K</kbd>, resolve it with <kbd>R</kbd>, reopen it with <kbd>O</kbd>, and take it yourself with <kbd>I</kbd>.
- **Bugs**, **Features**, **Tests** and **To-dos** each have a tab with an open count. The capture bar files into the tab you are on, and an item can move to another kind from its … menu.
- The **Running** tab follows every Claude Code run in the workspace live. See [Claude Code](/claude).
- Export what you are looking at as CSV or as a Markdown report from the command palette (<kbd>⌘</kbd> <kbd>K</kbd> or <kbd>Ctrl</kbd> <kbd>K</kbd>).

## Hand work to Claude Code

With the free helper installed, **Send to Claude Code** opens Claude Code on an item, screenshots included, in your project folder. Claude fixes it, verifies it, commits and pushes. **Ship to main** lands an item's work on the default branch and checks the deploy, and **Auto-fix** (Settings → Claude Code) sends each new item to Claude as you file it. The [Claude Code guide](/claude) covers setup.

## Install it

Squash is a progressive web app. In Chrome, Edge or Safari, use **Install** or **Add to Home Screen** to give it its own window and icon. It needs a connection: there is no offline mode.
