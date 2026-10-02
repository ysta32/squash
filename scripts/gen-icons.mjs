import { readFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'icons')
const svg = await readFile(path.join(root, 'public', 'favicon.svg'))
const accent = '#7c3aed'

await mkdir(outDir, { recursive: true })

const render = (size) => sharp(svg, { density: (72 * size) / 64 }).resize(size, size)

await render(192).png().toFile(path.join(outDir, 'icon-192.png'))
await render(512).png().toFile(path.join(outDir, 'icon-512.png'))
await render(180).png().toFile(path.join(outDir, 'apple-touch-icon.png'))

// Maskable: full-bleed accent background, glyph inside the central safe zone (80%).
const size = 512
const inner = Math.round(size * 0.7)
const glyph = await render(inner).png().toBuffer()
await sharp({ create: { width: size, height: size, channels: 4, background: accent } })
  .composite([{ input: glyph, gravity: 'centre' }])
  .png()
  .toFile(path.join(outDir, 'icon-maskable-512.png'))
