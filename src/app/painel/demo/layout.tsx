import type { Metadata } from 'next'
import PainelDemoLayoutClient from './PainelDemoLayoutClient'
import { DEMO_PRESTADORA } from '@/lib/demoData'

export const metadata: Metadata = {
  title: 'Demonstração do painel — BelleBook',
  robots: { index: false, follow: false },
}

export default function PainelDemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <PainelDemoLayoutClient nomeUsuario={DEMO_PRESTADORA.nome}>
      {children}
    </PainelDemoLayoutClient>
  )
}
