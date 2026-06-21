'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function isAndroid() {
  return /android/i.test(window.navigator.userAgent)
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isDismissed(key: string) {
  const until = localStorage.getItem(key)
  return !!until && Date.now() < Number(until)
}

function dismissForDays(key: string, days: number) {
  localStorage.setItem(key, String(Date.now() + days * 24 * 60 * 60 * 1000))
}

export function useInstallPrompt(dismissKey: string, dismissDays = 7) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isDismissed(dismissKey)) return
    if (isStandalone()) return
    if (!isAndroid() && !isIos()) return

    function handleBeforeInstall(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    if (isIos()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- detecção de plataforma só é possível após montar (window/navigator)
      setShowIosHint(true)
      setVisible(true)
    }

    function handleInstalled() {
      setVisible(false)
    }
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [dismissKey])

  function dismiss() {
    setVisible(false)
    dismissForDays(dismissKey, dismissDays)
  }

  async function install() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setVisible(false)
  }

  return { visible, showIosHint, install, dismiss }
}
