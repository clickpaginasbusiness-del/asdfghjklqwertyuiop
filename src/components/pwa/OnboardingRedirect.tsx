'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const VISTO_KEY = 'bb_onboarding_visto'

/**
 * Manda pra /onboarding só na primeira vez que o app é aberto como PWA
 * instalado (standalone) por alguém ainda não logado — visitante comum
 * pelo navegador (não-standalone) nunca vê isso, só quem abriu pelo ícone
 * na tela inicial. `router.replace` (não `push`) pra não empilhar histórico
 * atrás da tela de onboarding.
 */
export function OnboardingRedirect() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (pathname?.startsWith('/onboarding')) return
    if (typeof window === 'undefined') return
    if (localStorage.getItem(VISTO_KEY)) return
    if (!window.matchMedia('(display-mode: standalone)').matches) return

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace('/onboarding')
    })
  }, [pathname, router])

  return null
}
