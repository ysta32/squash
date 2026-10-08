// The screenshots README.md uses. Each runs in a fresh browser context; `before` sets the scene.
import { fileURLToPath } from 'node:url'

const fixture = (file) =>
  fileURLToPath(new URL(`../../node_modules/.cache/squash-shots/${file}`, import.meta.url))

export const SCHEMES = ['viridian', 'ocean', 'sunset', 'rose', 'graphite']

export function shots({ desktop, mobile }) {
  const ws = '/app/ws-lumen'
  const half = { x: 0, y: 0, width: desktop.width, height: 560 }
  const wide = { width: 1600, height: desktop.height }

  const capture = async (page) => {
    await page.getByTestId('file-input').setInputFiles(fixture('checkout-mobile.png'))
    await page
      .getByRole('textbox')
      .first()
      .fill('Pay now button is hidden behind the cookie banner on mobile')
    await page.waitForTimeout(800)
  }

  /** A box grown by `pad` on every side, shrunk where it would leave the viewport. */
  const around = (box, pad, viewport = desktop) => {
    const x = Math.max(0, box.x - pad)
    const y = Math.max(0, box.y - pad)
    return {
      x,
      y,
      width: Math.min(viewport.width, box.x + box.width + pad) - x,
      height: Math.min(viewport.height, box.y + box.height + pad) - y,
    }
  }

  /** Resolves once every <img> under `locator` has decoded (thumbnails load after the page). */
  const decoded = (locator) =>
    locator.evaluate((root) =>
      Promise.all(
        [...root.querySelectorAll('img')].map((img) =>
          Promise.race([img.decode(), new Promise((resolve) => setTimeout(resolve, 5_000))]),
        ),
      ),
    )

  // The detail pane scrolls on its own, below the header and the capture bar; the Claude panel sits
  // after the screenshots, so it is scrolled into view and shot close up.
  const claudePanel = async (page) => {
    const panel = page.getByRole('region', { name: 'Claude progress' })
    await panel.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await page.waitForTimeout(300)
  }
  const claudeClip = async (page) =>
    around(await page.getByRole('region', { name: 'Claude progress' }).boundingBox(), 32)

  return [
    // Hero: the full workspace, Claude working on the selected bug.
    { name: 'workspace-light', path: `${ws}/bug/24`, viewport: desktop, theme: 'light' },
    { name: 'workspace-dark', path: `${ws}/bug/24`, viewport: desktop, theme: 'dark' },

    // Capture: screenshot pasted, description typed, one keypress from filed.
    {
      name: 'capture-light',
      path: `${ws}/bug/24`,
      viewport: desktop,
      theme: 'light',
      before: capture,
      clip: half,
    },
    {
      name: 'capture-dark',
      path: `${ws}/bug/24`,
      viewport: desktop,
      theme: 'dark',
      before: capture,
      clip: half,
    },

    // Claude Code working on a bug, close up: the detail pane from its header to the progress panel.
    ...['dark', 'light'].map((theme) => ({
      name: `claude-${theme}`,
      path: `${ws}/bug/24`,
      viewport: desktop,
      theme,
      before: claudePanel,
      clip: claudeClip,
    })),

    // Numbered pins: a bug's specimen card, its screenshots with pins 1 and 2, and the pin notes.
    ...['dark', 'light'].map((theme) => ({
      name: `pins-${theme}`,
      path: `${ws}/bug/24`,
      viewport: desktop,
      theme,
      before: (page) => decoded(page.locator('article').first()),
      clip: async (page) => {
        const article = await page.locator('article').first().boundingBox()
        const notes = await page
          .locator('figure', { has: page.getByText(/· Pins$/) })
          .first()
          .boundingBox()
        const pad = 32
        return around(
          {
            x: notes.x,
            y: article.y + pad,
            width: notes.width,
            height: notes.y + notes.height - article.y - pad,
          },
          pad,
        )
      },
    })),

    // Proof of fix on the resolved #18: the fix record with its before/after divider through the
    // avatar, so it is half blurry (before) and half sharp (after).
    ...['dark', 'light'].map((theme) => ({
      name: `fix-${theme}`,
      path: `${ws}/bug/18`,
      viewport: desktop,
      theme,
      before: async (page) => {
        const slider = page.getByRole('slider', { name: /^Before and after/ })
        await slider.waitFor()
        const record = page.getByRole('region', { name: 'Fix record' })
        await decoded(record)
        await record.evaluate((el) => el.scrollIntoView({ block: 'center' }))
        // A press on the frame moves the divider there: through the middle of the avatar.
        const frame = await page.getByAltText('After the fix').boundingBox()
        await page.mouse.click(frame.x + frame.width * 0.42, frame.y + frame.height * 0.85)
        await page.mouse.move(0, desktop.height - 1)
        await slider.blur()
        await page.waitForTimeout(500)
      },
      clip: async (page) =>
        around(await page.getByRole('region', { name: 'Fix record' }).boundingBox(), 32),
    })),

    // Team stats: the popover under the header, in both themes.
    ...['light', 'dark'].map((theme) => ({
      name: `stats-${theme}`,
      // No bug open, and wide enough that the empty pane's text ends left of the popover.
      path: ws,
      viewport: wide,
      theme,
      before: async (page) => {
        await page.getByRole('button', { name: 'Stats' }).click()
        await page.getByRole('dialog', { name: 'Team stats' }).waitFor()
      },
      // The popover and the header buttons it hangs from.
      clip: async (page) => {
        const box = await page.getByRole('dialog', { name: 'Team stats' }).boundingBox()
        const clip = around(box, 32, wide)
        return { ...clip, y: 0, height: clip.y + clip.height }
      },
    })),

    // Command palette with every command listed.
    ...['dark', 'light'].map((theme) => ({
      name: `palette-${theme}`,
      path: `${ws}/bug/24`,
      viewport: desktop,
      theme,
      before: async (page) => {
        await page.keyboard.press('ControlOrMeta+k')
        await page.waitForTimeout(300)
      },
      clip: async (page) =>
        around(await page.getByRole('dialog', { name: 'Command palette' }).boundingBox(), 64),
    })),

    // Marking up a pasted screenshot before filing: a box on the overlapping banner, an arrow and a
    // numbered pin with its note on the hidden button. The editor's canvas is sized from the
    // viewport height, so a narrower viewport keeps the dialog (with three layers) inside it.
    ...['dark', 'light'].map((theme) => ({
      name: `annotate-${theme}`,
      path: `${ws}/bug/24`,
      viewport: { width: 1200, height: desktop.height },
      theme,
      before: async (page) => {
        await page.getByTestId('file-input').setInputFiles(fixture('checkout-desktop.png'))
        await page
          .getByRole('button', { name: /^Mark up / })
          .first()
          .click()
        const canvas = page
          .getByRole('img', { name: 'Image annotation canvas' })
          .or(page.getByLabel('Image annotation canvas'))
          .first()
        await canvas.waitFor()
        await page.waitForTimeout(300)
        const box = await canvas.boundingBox()
        const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy]
        const drag = async ([x1, y1], [x2, y2]) => {
          await page.mouse.move(x1, y1)
          await page.mouse.down()
          await page.mouse.move(x2, y2, { steps: 12 })
          await page.mouse.up()
        }
        await page.keyboard.press('b')
        await drag(at(0.012, 0.865), at(0.988, 0.992))
        await page.keyboard.press('a')
        await drag(at(0.4, 0.8), at(0.6, 0.645))
        await page.keyboard.press('n')
        await page.mouse.click(...at(0.6, 0.53))
        const note = page.getByRole('textbox', { name: 'Note for pin 1' })
        await note.fill('Pay now is hidden on iPhone')
        await note.blur()
        await page.waitForTimeout(200)
      },
      clip: async (page) => {
        const box = await page.getByRole('dialog', { name: /^Mark up / }).boundingBox()
        // As much margin as fits above the dialog, the same on every side.
        return around(box, Math.min(32, Math.floor(box.y)), { width: 1200, height: desktop.height })
      },
    })),

    // Screenshot lightbox.
    {
      name: 'lightbox-dark',
      path: `${ws}/bug/23`,
      viewport: desktop,
      theme: 'dark',
      before: async (page) => {
        await page.getByRole('button', { name: 'Open screenshot 1' }).click()
        await decoded(page.getByRole('dialog', { name: 'Screenshot viewer' }))
      },
    },

    // Mobile: list and detail.
    { name: 'mobile-list', path: ws, viewport: mobile, theme: 'light', composite: true },
    {
      name: 'mobile-detail',
      path: `${ws}/bug/24`,
      viewport: mobile,
      theme: 'dark',
      composite: true,
      // Scrolled so the pins and the live Claude panel share the screen.
      before: async (page) => {
        await page
          .getByRole('region', { name: 'Claude progress' })
          .evaluate((el) => el.scrollIntoView({ block: 'end' }))
        await page.waitForTimeout(300)
      },
    },
    {
      name: 'mobile-voice',
      path: `${ws}/bug/22`,
      viewport: mobile,
      theme: 'light',
      composite: true,
    },

    // Each color scheme, for the grid in compose.mjs.
    ...SCHEMES.map((scheme, i) => ({
      name: `scheme-${scheme}`,
      path: `${ws}/bug/${[24, 23, 22, 21, 20, 25][i]}`,
      viewport: desktop,
      theme: i % 2 ? 'light' : 'dark',
      scheme,
      composite: true,
    })),
  ]
}
