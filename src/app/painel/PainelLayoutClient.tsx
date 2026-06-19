'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Calendar, Scissors, ImageIcon,
  Clock, Users, LogOut, Menu, X, ExternalLink, UserCircle, UserCircle2, CreditCard, AlertCircle, BarChart3, Headset
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { NotificacoesSino } from '@/components/painel/NotificacoesSino'
import { OnboardingTour } from '@/components/painel/OnboardingTour'
import { PushNotificationPrompt } from '@/components/painel/PushNotificationPrompt'
import { cn } from '@/lib/utils'
import type { Prestadora } from '@/lib/types'

function DowngradeBanner({ prestadoraId }: { prestadoraId: string }) {
  const [visivel, setVisivel] = useState(true)

  async function dispensar() {
    setVisivel(false)
    const supabase = createClient()
    await supabase.from('prestadoras').update({ downgrade_aviso: false }).eq('id', prestadoraId)
  }

  if (!visivel) return null

  return (
    <div className="px-4 lg:px-8 py-3 flex items-start justify-between gap-4 bg-amber-50 border-b border-amber-200">
      <div className="flex items-start gap-2 min-w-0">
        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          Você mudou para o Plano Básico. Algumas funcionalidades foram limitadas.{' '}
          <Link href="/planos" className="font-semibold underline underline-offset-2 hover:no-underline">
            Faça upgrade para o Pro
          </Link>{' '}
          para reativá-las.
        </p>
      </div>
      <button
        onClick={dispensar}
        aria-label="Dispensar aviso"
        className="shrink-0 text-amber-400 hover:text-amber-600 transition-colors mt-0.5"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

function TrialBanner({ trialFim }: { trialFim: string }) {
  const dias = Math.max(0, Math.ceil(
    (new Date(trialFim).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  ))
  const urgente = dias <= 7

  return (
    <div className={cn(
      'px-4 lg:px-8 py-2.5 flex items-center justify-between gap-4',
      urgente
        ? 'bg-amber-50 border-b border-amber-200'
        : 'bg-rose-50 border-b border-rose-100'
    )}>
      <div className="flex items-center gap-2 min-w-0">
        <AlertCircle className={cn('w-4 h-4 shrink-0', urgente ? 'text-amber-500' : 'text-rose-400')} />
        <p className={cn('text-sm truncate', urgente ? 'text-amber-800' : 'text-rose-700')} suppressHydrationWarning>
          {dias === 0
            ? 'Seu trial gratuito encerra hoje! Assine para manter o acesso.'
            : `Seu trial gratuito encerra em ${dias} dia${dias > 1 ? 's' : ''}. Assine para continuar.`}
        </p>
      </div>
      <Link
        href="/planos"
        className={cn(
          'shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
          urgente
            ? 'bg-amber-500 hover:bg-amber-600 text-white'
            : 'bg-rose-400 hover:bg-rose-500 text-white'
        )}
      >
        Assinar agora
      </Link>
    </div>
  )
}

const TOUR_NAV_KEYS: Record<string, string> = {
  '/painel/servicos': 'tour-servicos',
  '/painel/horarios': 'tour-horarios',
  '/painel/perfil': 'tour-perfil',
  '/painel/assinatura': 'tour-assinatura',
}

const navItems = [
  { href: '/painel', label: 'Painel', icon: LayoutDashboard },
  { href: '/painel/agendamentos', label: 'Agendamentos', icon: Calendar },
  { href: '/painel/servicos', label: 'Serviços', icon: Scissors },
  { href: '/painel/galeria', label: 'Galeria', icon: ImageIcon },
  { href: '/painel/horarios', label: 'Horários', icon: Clock },
  { href: '/painel/clientes', label: 'Clientes', icon: Users },
  { href: '/painel/relatorios', label: 'Relatórios', icon: BarChart3 },
  { href: '/painel/profissionais', label: 'Profissionais', icon: UserCircle2 },
  { href: '/painel/perfil', label: 'Meu Perfil', icon: UserCircle },
  { href: '/painel/assinatura', label: 'Assinatura', icon: CreditCard },
  { href: '/painel/suporte', label: 'Suporte', icon: Headset },
]

export default function PainelLayoutClient({
  children,
  prestadora,
}: {
  children: React.ReactNode
  prestadora: Prestadora
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/painel/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-100 z-40 flex flex-col transition-transform duration-300',
        'lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="p-6 border-b border-gray-100">
          <span className="font-serif text-2xl font-bold text-rose-400">BelleBook</span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                data-tour={TOUR_NAV_KEYS[item.href]}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all min-h-11',
                  active
                    ? 'bg-rose-50 text-rose-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-2">
          <a
            href={`/n/${prestadora.slug}`}
            target="_blank"
            data-tour="tour-link-publico"
            className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-all min-h-11"
          >
            <ExternalLink className="w-4 h-4" />
            Ver meu perfil
          </a>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-gray-500 hover:bg-gray-50 w-full transition-all min-h-11"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-100 px-4 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
            className="lg:hidden w-11 h-11 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 -ml-1"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex-1 lg:flex-none mx-3 lg:mx-0">
            <span className="font-serif text-lg font-bold text-rose-400 lg:hidden">BelleBook</span>
            <p className="hidden lg:block text-sm text-gray-500">Olá, <span className="font-medium text-gray-900">{prestadora.nome}</span> 👋</p>
          </div>

          <NotificacoesSino prestadoraId={prestadora.id} />
        </header>

        {/* Downgrade banner */}
        {prestadora.downgrade_aviso && (
          <DowngradeBanner prestadoraId={prestadora.id} />
        )}

        {/* Trial banner */}
        {prestadora.e_trial && !prestadora.stripe_subscription_id && prestadora.trial_fim && (
          <TrialBanner trialFim={prestadora.trial_fim} />
        )}

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>

      {pathname === '/painel' && (
        <OnboardingTour
          prestadoraId={prestadora.id}
          onOpenSidebar={() => setSidebarOpen(true)}
          onCloseSidebar={() => setSidebarOpen(false)}
        />
      )}

      <PushNotificationPrompt prestadoraId={prestadora.id} />
    </div>
  )
}
