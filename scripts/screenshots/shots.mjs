// The screenshots README.md uses. Each runs in a fresh browser context; `before` sets the scene.
import { fileURLToPath } from 'node:url'

const fixture = (file) =>
  fileURLToPath(new URL(`../../node_modules/.cache/squash-shots/${file}`, import.meta.url))

export const SCHEMES = ['violet', 'ocean', 'forest', 'sunset', 'rose', 'graphite']

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

    // Team stats.
    {
      name: 'stats-light',
      path: `${ws}/bug/23`,
      viewport: desktop,
      theme: 'light',
      before: (page) => page.getByRole('button', { name: 'Stats' }).click(),
      clip: { x: 800, y: 0, width: 640, height: 340 },
    },

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
