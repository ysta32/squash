// Assembles framed README images from the raw captures: the hero, the phone trio and the
// color-scheme grid. Run by capture.mjs after shooting; reads parts from the cache.
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { readTokens } from '../brand.mjs'
import { PNG_OPTIONS } from './png-options.mjs'
import { SCHEMES } from './shots.mjs'

const docs = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url))
const parts = fileURLToPath(new URL('../../node_modules/.cache/squash-shots/', import.meta.url))

// Paper and darkroom from the design tokens, fading into the accent tint.
const tokens = readTokens()
const BACKDROP = {
  light: [tokens.light['surface-3'], tokens.light['accent-tint']],
  dark: [tokens.dark['surface-3'], tokens.dark['accent-tint']],
}

const backdrop = (width, height, [from, to]) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/></svg>`)

/** Rounds an image's corners and adds a hairline border. */
async function rounded(input, width, radius, border = 'rgba(0,0,0,0.12)') {
  const resized = await sharp(input).resize({ width }).toBuffer()
  const { height } = await sharp(resized).metadata()
  const img = sharp(resized)
  const mask = Buffer.from(
    `<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" fill="#fff"/></svg>`,
  )
  const outline = Buffer.from(
    `<svg width="${width}" height="${height}"><rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="${radius - 1}" fill="none" stroke="${border}" stroke-width="2"/></svg>`,
  )
  const buffer = await img
    .composite([
      { input: mask, blend: 'dest-in' },
      { input: outline, blend: 'over' },
    ])
    .png()
    .toBuffer()
  return { buffer, width, height }
}

/** Soft drop shadow for a rounded rectangle, as a separate layer. */
async function shadow(width, height, radius, blur, opacity) {
  const pad = blur * 3
  const svg = Buffer.from(
    `<svg width="${width + pad * 2}" height="${height + pad * 2}"><rect x="${pad}" y="${pad}" width="${width}" height="${height}" rx="${radius}" fill="rgba(20,20,18,${opacity})"/></svg>`,
  )
  return { buffer: await sharp(svg).blur(blur).png().toBuffer(), pad }
}

/** Lays cards out on a gradient backdrop. `cards`: [{ file, left, top, width, radius }]. */
async function scene(out, width, height, mode, cards) {
  const layers = []
  for (const card of cards) {
    const img = await rounded(
      card.file,
      card.width,
      card.radius,
      mode === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)',
    )
    const sh = await shadow(img.width, img.height, card.radius, 28, mode === 'dark' ? 0.55 : 0.22)
    layers.push({ input: sh.buffer, left: card.left - sh.pad, top: card.top - sh.pad + 18 })
    layers.push({ input: img.buffer, left: card.left, top: card.top })
  }
  await sharp(backdrop(width, height, BACKDROP[mode]))
    .composite(layers)
    .png(PNG_OPTIONS)
    .toFile(out)
  console.log(out.replace(docs, 'docs/screenshots/'))
}

// Hero: the workspace, framed, in both themes.
for (const mode of ['light', 'dark']) {
  await scene(`${docs}hero-${mode}.png`, 2880, 1880, mode, [
    { file: `${docs}workspace-${mode}.png`, left: 120, top: 100, width: 2640, radius: 28 },
  ])
}

// Mobile: three phones side by side.
{
  const phone = 640
  const gap = 90
  const files = ['mobile-list', 'mobile-detail', 'mobile-voice'].map((n) => `${parts}${n}.png`)
  const width = phone * 3 + gap * 2 + 240
  await scene(
    `${docs}mobile.png`,
    width,
    1640,
    'dark',
    files.map((file, i) => ({
      file,
      left: 120 + i * (phone + gap),
      top: 110 + (i === 1 ? 0 : 60),
      width: phone,
      radius: 56,
    })),
  )
}

// Color schemes: rows of three (the last row centred), alternating dark and light.
{
  const tile = 900
  const tileH = Math.round((tile * 900) / 1440)
  const gap = 60
  const width = tile * 3 + gap * 2 + 200
  const rows = Math.ceil(SCHEMES.length / 3)
  const height = tileH * rows + gap * (rows - 1) + 200
  await scene(
    `${docs}schemes.png`,
    width,
    height,
    'dark',
    SCHEMES.map((s, i) => {
      const inRow = Math.min(3, SCHEMES.length - Math.floor(i / 3) * 3)
      const indent = ((3 - inRow) * (tile + gap)) / 2
      return {
        file: `${parts}scheme-${s}.png`,
        left: Math.round(100 + indent + (i % 3) * (tile + gap)),
        top: 100 + Math.floor(i / 3) * (tileH + gap),
        width: tile,
        radius: 18,
      }
    }),
  )
}
