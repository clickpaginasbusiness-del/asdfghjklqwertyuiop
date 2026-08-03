import sharp from 'sharp'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dirname, '..', 'public')
// PWA LOGO.png: ícones do manifest (tela inicial Android/instalação PWA).
// LOGO QUADRADA.png: favicon da aba do navegador, ícone da tela inicial do
// iOS e splash screen — já é quadrada e com fundo transparente.
const sourcePwa = resolve(publicDir, 'PWA LOGO.png')
const sourceQuadrada = resolve(publicDir, 'LOGO QUADRADA.png')

// Cor de fundo do manifest (background_color) — usada pra compor sobre
// imagens com transparência em contextos que não lidam bem com alpha
// (apple-touch-icon vira preto no iOS se ficar transparente; splash screen
// precisa de um fundo opaco por natureza).
const BACKGROUND_COLOR = '#fff7fa'

// Ícones maskable podem ser recortados pelo SO em formas diferentes (círculo,
// squircle, gota...) — o conteúdo importante precisa caber numa "safe zone"
// central de ~75% do canvas para nunca ser cortado.
const MASKABLE_SAFE_ZONE = 0.75

async function buildMaskable(size, outPath) {
  const inner = Math.round(size * MASKABLE_SAFE_ZONE)
  const resizedInner = await sharp(sourcePwa).resize(inner, inner).toBuffer()
  await sharp({
    create: { width: size, height: size, channels: 3, background: '#ffffff' },
  })
    .composite([{ input: resizedInner, gravity: 'center' }])
    .png()
    .toFile(outPath)
}

/** Compõe o logo (com transparência) sobre um fundo opaco — usado nos
 * contextos que não devem ter transparência (apple-touch-icon, splash). */
async function buildOnBackground(size, outPath, { padding = 0 } = {}) {
  const inner = Math.round(size * (1 - padding))
  const resizedInner = await sharp(sourceQuadrada).resize(inner, inner).toBuffer()
  await sharp({
    create: { width: size, height: size, channels: 3, background: BACKGROUND_COLOR },
  })
    .composite([{ input: resizedInner, gravity: 'center' }])
    .png()
    .toFile(outPath)
}

async function run() {
  await sharp(sourcePwa).resize(192, 192).png().toFile(resolve(publicDir, 'icon-192.png'))
  await sharp(sourcePwa).resize(512, 512).png().toFile(resolve(publicDir, 'icon-512.png'))
  await buildMaskable(512, resolve(publicDir, 'icon-maskable-512.png'))
  await buildOnBackground(180, resolve(publicDir, 'apple-touch-icon.png'))
  await sharp(sourceQuadrada).resize(32, 32).png().toFile(resolve(publicDir, 'favicon-32.png'))
  await buildOnBackground(1024, resolve(publicDir, 'apple-splash.png'), { padding: 0.35 })
  console.log('Icons generated successfully')
}

run()
