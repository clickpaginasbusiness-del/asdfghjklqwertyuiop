import sharp from 'sharp'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dirname, '..', 'public')
const source = resolve(publicDir, 'PWA LOGO.png')

// Ícones maskable podem ser recortados pelo SO em formas diferentes (círculo,
// squircle, gota...) — o conteúdo importante precisa caber numa "safe zone"
// central de ~75% do canvas para nunca ser cortado.
const MASKABLE_SAFE_ZONE = 0.75

async function buildMaskable(size, outPath) {
  const inner = Math.round(size * MASKABLE_SAFE_ZONE)
  const resizedInner = await sharp(source).resize(inner, inner).toBuffer()
  await sharp({
    create: { width: size, height: size, channels: 3, background: '#ffffff' },
  })
    .composite([{ input: resizedInner, gravity: 'center' }])
    .png()
    .toFile(outPath)
}

async function run() {
  await sharp(source).resize(192, 192).png().toFile(resolve(publicDir, 'icon-192.png'))
  await sharp(source).resize(512, 512).png().toFile(resolve(publicDir, 'icon-512.png'))
  await buildMaskable(512, resolve(publicDir, 'icon-maskable-512.png'))
  await sharp(source).resize(180, 180).png().toFile(resolve(publicDir, 'apple-touch-icon.png'))
  await sharp(source).resize(32, 32).png().toFile(resolve(publicDir, 'favicon-32.png'))
  console.log('Icons generated successfully')
}

run()
