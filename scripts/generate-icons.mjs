import sharp from 'sharp'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dirname, '..', 'public')

const baseSvg = readFileSync(resolve(__dirname, 'icon-source.svg'))
const maskableSvg = readFileSync(resolve(__dirname, 'icon-source-maskable.svg'))

async function run() {
  await sharp(baseSvg).resize(192, 192).png().toFile(resolve(publicDir, 'icon-192.png'))
  await sharp(baseSvg).resize(512, 512).png().toFile(resolve(publicDir, 'icon-512.png'))
  await sharp(maskableSvg).resize(512, 512).png().toFile(resolve(publicDir, 'icon-maskable-512.png'))
  await sharp(baseSvg).resize(180, 180).png().toFile(resolve(publicDir, 'apple-touch-icon.png'))
  await sharp(baseSvg).resize(32, 32).png().toFile(resolve(publicDir, 'favicon-32.png'))
  console.log('Icons generated successfully')
}

run()
