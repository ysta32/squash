// Converts the README captures in docs/screenshots/ into the WebP images the marketing pages load
// from public/product/. Run after `npm run screenshots`:
//   npm run screenshots:webp              # every image below
//   npm run screenshots:webp -- claude    # only names containing "claude"
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const docs = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url))
const product = fileURLToPath(new URL('../../public/product/', import.meta.url))
const only = process.argv[2]

/** Output width per image (never upscaled); the height follows the capture's aspect ratio. */
const WIDTHS = {
  workspace: 1600,
  capture: 1400,
  annotate: 1400,
  claude: 1400,
  pins: 1400,
  fix: 1400,
  lightbox: 1400,
  mobile: 1400,
  palette: 1000,
  stats: 720,
}
const THEMED = ['workspace', 'capture', 'annotate', 'claude', 'pins', 'fix', 'palette', 'stats']
const names = [
  ...THEMED.flatMap((name) => [`${name}-light`, `${name}-dark`]),
  'lightbox-dark',
  'mobile',
]

const size = (file) => (existsSync(file) ? statSync(file).size : 0)
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`

let before = 0
let after = 0
for (const name of names) {
  if (only && !name.includes(only)) continue
  const src = `${docs}${name}.png`
  if (!existsSync(src)) throw new Error(`${src} is missing; run npm run screenshots first`)
  const out = `${product}${name}.webp`
  const width = WIDTHS[name.replace(/-(light|dark)$/, '')]
  const old = size(out)
  const info = await sharp(src)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 80, effort: 6, smartSubsample: true })
    .toFile(out)
  before += old
  after += info.size
  console.log(
    `public/product/${name}.webp  ${info.width}x${info.height}  ${old ? kb(old) : 'new'} -> ${kb(info.size)}`,
  )
}
console.log(`total  ${kb(before)} -> ${kb(after)}`)
