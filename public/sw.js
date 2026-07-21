// __BUILD_ID__ é substituído em build time (scripts/set-sw-version.mjs) por um hash
// único do deploy, garantindo que o navegador sempre detecte este arquivo como
// "mudou" a cada novo deploy na Vercel — mesmo quando só o código do app mudou e
// este arquivo em si ficaria byte-a-byte idêntico.
const CACHE_VERSION = 'bellebook-mrv9ldot'
const PRECACHE_URLS = ['/', '/painel', '/painel/login', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  )
  // Não chama skipWaiting() aqui de propósito: o novo SW fica em "waiting" até o
  // cliente confirmar via postMessage (botão "Atualizar" no banner), para que o
  // usuário veja o aviso antes da página trocar de versão sob os pés dele.
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
    )
  )
  self.clients.claim()
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // Páginas: network-first com fallback para cache (conteúdo sempre atualizado quando online)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    )
    return
  }

  // Assets estáticos (_next/static, imagens, ícones): cache-first
  if (url.pathname.startsWith('/_next/static/') || url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          const copy = response.clone()
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy))
          return response
        })
      })
    )
  }
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {}

  const title = data.title || 'BelleBook'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/painel/agendamentos' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/painel/agendamentos'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => new URL(c.url).pathname === url)
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    })
  )
})
