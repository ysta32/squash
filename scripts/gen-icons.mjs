// Generates the favicon + PWA icon set from the app icon (src/components/ui/pinMark.ts) and the
// design tokens in src/index.css. Run `npm run gen:icons` after changing either; outputs are
// committed:
//   public/favicon.svg            the app icon squircle (modern browsers)
//   public/favicon.ico            16/32/48 of the same (legacy browsers, RSS readers)
//   public/icons/*.png            apple-touch 180, PWA 192/512, maskable 512
//   public/manifest.webmanifest   theme/background colors from the paper tokens
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { appIconSvg } from '../src/components/ui/pinMark.ts'
import { readTokens, root } from './brand.mjs'

const { light } = readTokens()
const pub = (...parts) => path.join(root, 'public', ...parts)
await mkdir(pub('icons'), { recursive: true })

await writeFile(pub('favicon.svg'), `${appIconSvg()}\n`)

const png = (svg, size) =>
  sharp(Buffer.from(svg), { density: 72 * 8 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer()

const outputs = [
  // iOS and maskable icons get rounded by the platform: full bleed. The pin sits well inside
  // the maskable 80% safe circle.
  ['icons/apple-touch-icon.png', appIconSvg({ bleed: true }), 180],
  ['icons/icon-192.png', appIconSvg(), 192],
  ['icons/icon-512.png', appIconSvg(), 512],
  ['icons/icon-maskable-512.png', appIconSvg({ bleed: true }), 512],
]
for (const [file, svg, size] of outputs) await writeFile(pub(file), await png(svg, size))

// favicon.ico with PNG-encoded entries (supported by every browser that still asks for .ico).
const icoSizes = [16, 32, 48]
const icoImages = await Promise.all(icoSizes.map((size) => png(appIconSvg(), size)))
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
