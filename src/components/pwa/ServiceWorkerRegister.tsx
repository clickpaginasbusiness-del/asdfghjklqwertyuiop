'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000
const VERSION_POLL_INTERVAL_MS = 5 * 60 * 1000

export function ServiceWorkerRegister() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    function trackInstallingWorker(worker: ServiceWorker) {
      worker.addEventListener('statechange', () => {
        console.log('[sw] novo service worker mudou de estado:', worker.state)
        // "installed" + já existir um controller ativo = isto é uma atualização
        // (não a primeira instalação do SW neste dispositivo)
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[sw] novo service worker instalado e aguardando ativação — exibindo banner')
          setWaitingWorker(worker)
        }
      })
    }

    let updateInterval: ReturnType<typeof setInterval> | undefined
    let versionInterval: ReturnType<typeof setInterval> | undefined
    let registration: ServiceWorkerRegistration | undefined
    let buildIdInicial: string | null = null

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      console.log('[sw] app voltou ao foco — checando atualização do service worker')
      registration?.update().catch((err) => console.warn('[sw] falha ao checar atualização:', err))
    }

    async function checarVersao() {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        const data = await res.json()
        if (buildIdInicial === null) {
          buildIdInicial = data.buildId
          console.log('[version-poll] build atual desta página:', buildIdInicial)
          return
        }
        console.log('[version-poll] build no servidor:', data.buildId, '| build desta página:', buildIdInicial)
        if (data.buildId !== buildIdInicial) {
          console.log('[version-poll] nova versão detectada — forçando checagem do service worker')
          registration?.update().catch((err) => console.warn('[sw] falha ao checar atualização:', err))
        }
      } catch (err) {
        console.warn('[version-poll] falha ao consultar /api/version:', err)
      }
    }

    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        registration = reg
        console.log('[sw] registrado com sucesso, scope:', reg.scope)

        if (reg.waiting && navigator.serviceWorker.controller) {
          console.log('[sw] já havia um service worker em espera na primeira checagem')
          setWaitingWorker(reg.waiting)
        }

        reg.addEventListener('updatefound', () => {
          console.log('[sw] updatefound — novo service worker sendo instalado')
          if (reg.installing) trackInstallingWorker(reg.installing)
        })

        updateInterval = setInterval(() => {
          console.log('[sw] checagem periódica de atualização (1h)')
          reg.update().catch((err) => console.warn('[sw] falha ao checar atualização:', err))
        }, UPDATE_CHECK_INTERVAL_MS)

        checarVersao()
        versionInterval = setInterval(checarVersao, VERSION_POLL_INTERVAL_MS)

        document.addEventListener('visibilitychange', onVisible)
      })
      .catch((err) => console.warn('[sw] falha ao registrar:', err))

    let reloading = false
    function handleControllerChange() {
      if (reloading) return
      reloading = true
      console.log('[sw] novo service worker assumiu controle — recarregando página')
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      document.removeEventListener('visibilitychange', onVisible)
      if (updateInterval) clearInterval(updateInterval)
      if (versionInterval) clearInterval(versionInterval)
    }
  }, [])

  function atualizarAgora() {
    if (!waitingWorker) return
    console.log('[sw] usuária confirmou atualização — enviando SKIP_WAITING')
    setUpdating(true)
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })
    // O reload acontece via o listener de "controllerchange" assim que o novo SW
    // assumir o controle (clients.claim()) — o banner já desaparece (updating=true)
    // dando feedback imediato enquanto isso ocorre.
  }

  if (!waitingWorker || updating) return null

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:left-4 sm:right-auto sm:max-w-sm z-[200] bg-white rounded-2xl shadow-xl border border-rose-100 p-4 flex items-start gap-3">
      <div className="w-11 h-11 shrink-0 rounded-xl bg-rose-50 flex items-center justify-center">
        <RefreshCw className="w-5 h-5 text-rose-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">Nova atualização disponível!</p>
        <p className="text-xs text-gray-500 mt-0.5">Toque para atualizar e ver as novidades</p>
        <button
          onClick={atualizarAgora}
          className="mt-2.5 text-xs font-semibold text-white bg-rose-400 hover:bg-rose-500 rounded-lg px-3 py-2 min-h-9 transition-colors"
        >
          Atualizar agora
        </button>
      </div>
    </div>
  )
}
