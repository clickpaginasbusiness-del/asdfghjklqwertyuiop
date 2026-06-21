// Substitui o placeholder de versão em public/sw.js (e em src/lib/buildId.generated.ts)
// por um id único deste build, para que o navegador sempre detecte o service worker
// como "atualizado" a cada novo deploy — necessário para o banner de "nova atualização
// disponível" e para o endpoint /api/version usado no polling de atualização.
import { readFileSync, writeFileSync } from 'fs'

const SW_PATH = new URL('../public/sw.js', import.meta.url)
const BUILD_ID_PATH = new URL('../src/lib/buildId.generated.ts', import.meta.url)

const buildId = (process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString(36)).slice(0, 12)

const swOriginal = readFileSync(SW_PATH, 'utf8')
const swUpdated = swOriginal.replace(/bellebook-[A-Za-z0-9_-]+(?=')/, `bellebook-${buildId}`)
writeFileSync(SW_PATH, swUpdated)

const buildIdOriginal = readFileSync(BUILD_ID_PATH, 'utf8')
const buildIdUpdated = buildIdOriginal.replace(/BUILD_ID = '[^']*'/, `BUILD_ID = 'bellebook-${buildId}'`)
writeFileSync(BUILD_ID_PATH, buildIdUpdated)

console.error(`[set-sw-version] CACHE_VERSION = bellebook-${buildId}`)
