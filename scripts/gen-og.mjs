import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const source = fileURLToPath(new URL('../public/og.svg', import.meta.url))
const destination = fileURLToPath(new URL('../public/og.png', import.meta.url))

await sharp(source).resize(1200, 630).png().toFile(destination)
console.log('Generated public/og.png (1200×630)')
