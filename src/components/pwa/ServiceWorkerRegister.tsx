'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000

export function ServiceWorkerRegister() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [updating, setUpdating] = useState(false)
  const [forcedDevOverlay, setForcedDevOverlay] = useState(false)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    function trackInstallingWorker(worker: ServiceWorker) {
      worker.addEventListener('statechange', () => {
        console.log('[sw] novo service worker mudou de estado:', worker.state)
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[sw] novo service worker instalado e aguardando ativação — exibindo overlay obrigatório')
          setWaitingWorker(worker)
        }
      })
    }

    let updateInterval: ReturnType<typeof setInterval> | undefined
    let registration: ServiceWorkerRegistration | undefined

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      console.log('[sw] app voltou ao foco — checando atualização do service worker')
      registration?.update().catch((err) => console.warn('[sw] falha ao checar atualização:', err))
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

        if (reg.installing) {
          console.log('[sw] service worker em instalação no momento do registro')
          trackInstallingWorker(reg.installing)
        }

        reg.addEventListener('updatefound', () => {
          console.log('[sw] updatefound — novo service worker sendo instalado')
          if (reg.installing) trackInstallingWorker(reg.installing)
        })

        updateInterval = setInterval(() => {
          console.log('[sw] checagem periódica de atualização (30min)')
          reg.update().catch((err) => console.warn('[sw] falha ao checar atualização:', err))
        }, UPDATE_CHECK_INTERVAL_MS)

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
    }
  }, [])

  function atualizarAgora() {
    if (forcedDevOverlay) {
      console.log('[sw][dev] simulação — fechando overlay sem service worker real')
      setForcedDevOverlay(false)
      return
    }
    if (!waitingWorker) return
    console.log('[sw] usuária confirmou atualização — enviando SKIP_WAITING')
    setUpdating(true)
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })
    // O reload acontece via o listener de "controllerchange" assim que o novo SW
    // assumir o controle (clients.claim()).
  }

  const mostrarOverlay = forcedDevOverlay || (!!waitingWorker && !updating)

  return (
    <>
      {process.env.NODE_ENV === 'development' && (
        <button
          onClick={() => setForcedDevOverlay(true)}
          className="fixed bottom-4 right-4 z-[250] text-xs font-semibold text-white bg-gray-800 hover:bg-gray-900 rounded-lg px-3 py-2 shadow-lg"
        >
          🐛 Simular atualização
        </button>
      )}

      {mostrarOverlay && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center space-y-5">
            <Image
              src="/icon-192.png"
              alt="BelleBook"
              width={64}
              height={64}
              className="mx-auto rounded-2xl"
            />
            <div>
              <h2 className="font-serif text-xl font-bold text-gray-900">Nova versão disponível! 🎉</h2>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                Atualizamos o BelleBook com melhorias e novidades. Clique abaixo para atualizar agora.
              </p>
            </div>
            <button
              onClick={atualizarAgora}
              className="w-full bg-rose-400 hover:bg-rose-500 text-white font-semibold rounded-2xl py-3.5 text-base transition-colors"
            >
              Atualizar agora
            </button>
          </div>
        </div>
      )}
    </>
  )
}
