---
title: Capture
description: The capture bar, screenshots, dictation, and the macOS hotkey that files a bug from any app.
group: Use
order: 2
---

One input sits above the list. It takes a screenshot, a sentence, a severity, and <kbd>Enter</kbd>. There are no required fields and no templates.

## Paste a screenshot

Press <kbd>⌘</kbd> <kbd>V</kbd> (<kbd>Ctrl</kbd> <kbd>V</kbd> elsewhere) anywhere on the page: the image lands in the capture bar and the cursor jumps there. You can also drag files onto the page or use the file picker, which opens the camera on a phone.

- Up to 10 images per bug.
- Images are compressed in your browser to WebP before they upload: at most 1920 px on the long edge, about 300 KB each, and a 5 MB cap per original.
- The bug appears in the list as soon as you press <kbd>Enter</kbd>; its screenshots finish uploading in the background.

## Describe it

Type what is broken. Descriptions render Markdown (bold, italics, code, lists, quotes and links) and `@name` mentions, which autocomplete from your teammates. Rendering is done by React, so no HTML from a bug ever reaches the page.

Squash records where the bug happened: your browser, operating system and window size, and the first link in the description as the page URL. The URL shows as a chip in the capture bar that you can remove before filing.

## Pick a severity

Press <kbd>Alt</kbd> <kbd>1</kbd>–<kbd>4</kbd> while the capture bar is focused: low, medium, high or critical. The list shows severity as 1–4 tally ticks.

## Dictate instead of typing

The microphone button uses your browser's Web Speech API and shows a live transcript. It works in Chrome, Edge and Safari. The transcript is saved with the bug and is searchable. Your browser decides where the speech is processed; in Chrome that is Google's speech service.

## File from any app on macOS

A small script gives you a global hotkey. Press <kbd>⌃</kbd> <kbd>⌥</kbd> <kbd>S</kbd>, drag over what is broken, and Squash comes to the front with the screenshot on your clipboard: press <kbd>⌘</kbd> <kbd>V</kbd>, type, and press <kbd>Enter</kbd>. It switches to your open Squash tab in Chrome, Arc, Brave, Edge or Safari, or to the installed app, and otherwise opens a new tab.

Start it once per session from a clone of the repository:

```sh
npm run hotkey                                    # or: swift scripts/squash-hotkey.swift
SQUASH_HOTKEY=cmd+shift+b npm run hotkey          # pick another hotkey
SQUASH_URL=http://localhost:5173/app npm run hotkey
```

It needs the Xcode command line tools (`xcode-select --install`). macOS asks once to let your terminal record the screen and control your browser.
