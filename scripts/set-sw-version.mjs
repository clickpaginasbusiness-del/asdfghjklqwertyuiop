// Substitui o placeholder de versão em public/sw.js por um id único deste build,
// para que o navegador sempre detecte o service worker como "atualizado" a cada
// novo deploy — necessário para o banner de "nova atualização disponível".
import { readFileSync, writeFileSync } from 'fs'

const SW_PATH = new URL('../public/sw.js', import.meta.url)

const buildId = (process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString(36)).slice(0, 12)

const original = readFileSync(SW_PATH, 'utf8')
const updated = original.replace(/bellebook-[A-Za-z0-9_-]+(?=')/, `bellebook-${buildId}`)

writeFileSync(SW_PATH, updated)
console.log(`[set-sw-version] CACHE_VERSION = bellebook-${buildId}`)
