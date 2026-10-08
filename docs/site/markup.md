---
title: Markup
description: Draw arrows, boxes, pen strokes and numbered pins on a screenshot before or after you file it.
group: Use
order: 3
---

An arrow and a box say more than a paragraph about "the button near the bottom". Click a staged screenshot in the capture bar (or **Mark up** on hover) to open the editor.

## Tools

| Tool  | Key          | What it does                                                |
| ----- | ------------ | ----------------------------------------------------------- |
| Arrow | <kbd>A</kbd> | Drag from the tail to the tip.                              |
| Box   | <kbd>B</kbd> | Drag a rectangle around the problem.                        |
| Pen   | <kbd>P</kbd> | Freehand strokes.                                           |
| Pin   | <kbd>N</kbd> | A numbered pin with an optional note, one per thing to fix. |

Pick a colour (danger, warning, success or contrast) before you draw. <kbd>⌘</kbd> <kbd>Z</kbd> or <kbd>Ctrl</kbd> <kbd>Z</kbd> undoes the last shape. <kbd>Esc</kbd> closes the editor, and asks first if you would lose changes.

## Layers, not pixels

Markup is stored as vector layers next to the untouched original screenshot, so it stays sharp at any size and can be changed later. Every shape is listed in the editor's layer list, where you can remove it. A screenshot holds up to 50 shapes.

Only the person who uploaded a screenshot can edit its markup.

## Pins become a checklist

Each numbered pin with a note shows up on the bug as a checklist line ("① Banner overlaps Pay now"), so a teammate, or Claude Code, can work through them one by one.
