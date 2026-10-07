// The screenshots README.md uses. Each runs in a fresh browser context; `before` sets the scene.
import { fileURLToPath } from 'node:url'

const fixture = (file) =>
  fileURLToPath(new URL(`../../node_modules/.cache/squash-shots/${file}`, import.meta.url))

export const SCHEMES = ['viridian', 'ocean', 'sunset', 'rose', 'graphite']

export function shots({ desktop, mobile }) {
  const ws = '/app/ws-lumen'
  const half = { x: 0, y: 0, width: desktop.width, height: 560 }

  const capture = async (page) => {
    await page.getByTestId('file-input').setInputFiles(fixture('checkout-mobile.png'))
    await page
      .getByRole('textbox')
      .first()
      .fill('Pay now button is hidden behind the cookie banner on mobile')
    await page.waitForTimeout(800)
  }

  const claudeClip = async (page) => {
    const panel = await page.getByRole('region', { name: 'Claude progress' }).boundingBox()
    const pane = await page
      .getByRole('heading', { level: 1 })
      .or(page.getByLabel('Title'))
      .first()
      .boundingBox()
    const y = pane.y - 54
    return { x: panel.x, y, width: desktop.width - panel.x, height: panel.y + panel.height - y }
  }

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
      clip: claudeClip,
    })),

    // Team stats: the popover under the header, in both themes.
    ...['light', 'dark'].map((theme) => ({
      name: `stats-${theme}`,
      path: `${ws}/bug/23`,
      viewport: desktop,
      theme,
      before: (page) => page.getByRole('button', { name: 'Stats' }).click(),
      clip: async (page) => {
        const box = await page.getByText('Member', { exact: true }).locator('../..').boundingBox()
        const pad = 48
        return {
          x: box.x - pad,
          y: 0,
          width: Math.min(box.width + pad * 2, desktop.width - box.x + pad),
          height: box.y + box.height + pad,
        }
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
      clip: async (page) => {
        const box = await page.getByRole('dialog', { name: 'Command palette' }).boundingBox()
        const pad = 64
        return {
          x: box.x - pad,
          y: box.y - pad,
          width: box.width + pad * 2,
          height: box.height + pad * 2,
        }
      },
    })),

    // Marking up a pasted screenshot before filing: an arrow and a box on the overlapping banner.
    ...['dark', 'light'].map((theme) => ({
      name: `annotate-${theme}`,
      path: `${ws}/bug/24`,
      viewport: desktop,
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
        await drag(at(0.36, 0.8), at(0.59, 0.67))
        await page.waitForTimeout(200)
      },
      clip: async (page) => {
        const box = await page.getByRole('dialog', { name: /^Mark up / }).boundingBox()
        const pad = 48
        return {
          x: box.x - pad,
          y: box.y - pad,
          width: box.width + pad * 2,
          height: box.height + pad * 2,
        }
      },
    })),

    // Screenshot lightbox.
    {
      name: 'lightbox-dark',
      path: `${ws}/bug/23`,
      viewport: desktop,
      theme: 'dark',
      before: (page) => page.locator('button.cursor-zoom-in').first().click(),
    },

    // Mobile: list and detail.
    { name: 'mobile-list', path: ws, viewport: mobile, theme: 'light', composite: true },
    {
      name: 'mobile-detail',
      path: `${ws}/bug/24`,
      viewport: mobile,
      theme: 'dark',
      composite: true,
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
