// Generates the favicon + PWA icon set from the pin mark (src/components/ui/pinMark.ts) and the
// design tokens in src/index.css. Run `npm run gen:icons` after changing either; outputs are
// committed:
//   public/favicon.svg            mark only, follows prefers-color-scheme (modern browsers)
//   public/favicon.ico            16/32/48 on a paper tile (legacy browsers, RSS readers)
//   public/icons/*.png            apple-touch 180, PWA 192/512, maskable 512
//   public/manifest.webmanifest   theme/background colors from the paper tokens
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { markSvg, readTokens, root } from './brand.mjs'

const { light, dark } = readTokens()
const paper = { needle: light['text-1'], head: light.accent }
const pub = (...parts) => path.join(root, 'public', ...parts)
await mkdir(pub('icons'), { recursive: true })

// favicon.svg: transparent, ink needle on light tabs and paper needle on dark ones. CSS beats
// the presentation attributes, so the media query only has to restate the dark paints.
const faviconSvg = markSvg(paper).replace(
  '>',
  `><style>@media (prefers-color-scheme: dark) { path { stroke: ${dark['text-1']} } circle { fill: ${dark.accent} } }</style>`,
)
await writeFile(pub('favicon.svg'), `${faviconSvg}\n`)

const png = (svg, size) =>
  sharp(Buffer.from(svg), { density: 72 * 8 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer()

// Icons sit on a paper tile so they read on any home screen or tab bar. `pad` is the margin
// around the 16-unit mark, in mark units.
const tile = (pad, radius) => markSvg({ ...paper, background: light.bg, pad, radius })

const outputs = [
  // iOS rounds the corners itself: full bleed.
  ['icons/apple-touch-icon.png', tile(4, 0), 180],
  ['icons/icon-192.png', tile(3, 5), 192],
  ['icons/icon-512.png', tile(3, 5), 512],
  // Maskable: full bleed, mark well inside the 80% safe circle.
  ['icons/icon-maskable-512.png', tile(6, 0), 512],
]
for (const [file, svg, size] of outputs) await writeFile(pub(file), await png(svg, size))

// favicon.ico with PNG-encoded entries (supported by every browser that still asks for .ico).
const icoSizes = [16, 32, 48]
const icoImages = await Promise.all(icoSizes.map((size) => png(tile(1, 3), size)))
const header = Buffer.alloc(6 + 16 * icoImages.length)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(icoImages.length, 4)
let offset = header.length
icoImages.forEach((image, i) => {
  const entry = 6 + 16 * i
  header.writeUInt8(icoSizes[i], entry)
  header.writeUInt8(icoSizes[i], entry + 1)
  header.writeUInt8(0, entry + 2)
  header.writeUInt8(0, entry + 3)
  header.writeUInt16LE(1, entry + 4)
  header.writeUInt16LE(32, entry + 6)
  header.writeUInt32LE(image.length, entry + 8)
  header.writeUInt32LE(offset, entry + 12)
  offset += image.length
})
await writeFile(pub('favicon.ico'), Buffer.concat([header, ...icoImages]))

const manifestPath = pub('manifest.webmanifest')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
manifest.background_color = light.bg
manifest.theme_color = light.bg
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

console.log('Generated favicon.svg, favicon.ico, public/icons/*.png and manifest colors')
