'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Calendar, CalendarDays, Scissors, ImageIcon,
  Clock, Users, LogOut, Menu, X, ExternalLink, UserCircle, UserCircle2, CreditCard, AlertCircle, BarChart3, Headset, Settings, Wallet, CheckCircle2, MessageCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { NotificacoesSino } from '@/components/painel/NotificacoesSino'
import { WelcomeModal } from '@/components/painel/WelcomeModal'
import { PushNotificationPrompt } from '@/components/painel/PushNotificationPrompt'
import { PaymentSoundListener } from '@/components/painel/PaymentSoundListener'
import { InstallPwaModal } from '@/components/painel/InstallPwaModal'
import { FeedbackModal } from '@/components/painel/FeedbackModal'
import { RetrospectivaAutoModal } from '@/components/retrospectiva/RetrospectivaAutoModal'
import { cn } from '@/lib/utils'
import { planoEfetivo, ehStudio } from '@/lib/plano'
import { getTema } from '@/lib/theme'
import type { Prestadora } from '@/lib/types'
import type { ChecklistStatus } from '@/lib/checklist'

// driver.js (o tour em si) só roda de fato pra quem ainda não completou o
// onboarding (checagem via localStorage dentro do próprio componente) — mas
// import estático colocava a lib inteira no chunk compartilhado do layout do
// painel, carregado em toda página autenticada, pra toda prestadora, pra
// sempre. dynamic() tira isso do bundle principal.
const OnboardingTour = dynamic(() => import('@/components/painel/OnboardingTour').then((m) => m.OnboardingTour), { ssr: false })

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
          Seu plano foi ajustado. Algumas funcionalidades foram limitadas.{' '}
          <Link href="/planos" className="font-semibold underline underline-offset-2 hover:no-underline">
            Veja os planos disponíveis
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

function TrialBanner({ dias }: { dias: number }) {
  const urgente = dias <= 7

  return (
    <div className={cn(
      'px-4 lg:px-8 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4',
      urgente
        ? 'bg-amber-50 border-b border-amber-200'
        : 'bg-rose-50 border-b border-rose-100'
    )}>
      <div className="flex items-center gap-2 min-w-0">
        <AlertCircle className={cn('w-4 h-4 shrink-0', urgente ? 'text-amber-500' : 'text-rose-400')} />
        <p className={cn('text-sm', urgente ? 'text-amber-800' : 'text-rose-700')}>
          {dias === 0
            ? 'Seu trial gratuito encerra hoje! Assine para manter o acesso.'
            : `Seu trial gratuito encerra em ${dias} dia${dias > 1 ? 's' : ''}. Assine para continuar.`}
        </p>
      </div>
      <Link
        href="/planos"
        className={cn(
          'shrink-0 self-start sm:self-auto px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
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

/** Compacto de propósito — some sozinho quando o checklist chega em 100%. Verde
 * (progresso positivo) contrastando com o "Ver mais" em rosa (cor de ação
 * padrão do app), pra não parecer um aviso/alerta como os outros banners. */
function ChecklistBanner({ status }: { status: ChecklistStatus }) {
  return (
    <div className="px-4 lg:px-8 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 bg-green-50 border-b border-green-200">
      <span className="text-xs font-semibold text-green-700 shrink-0">Complete seu perfil</span>
      <div className="flex-1 min-w-16 max-w-xs h-1.5 rounded-full bg-green-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-green-500 transition-all duration-500"
          style={{ width: `${status.percentual}%` }}
        />
      </div>
      <span className="text-xs font-bold text-green-700 shrink-0">{status.percentual}%</span>
      <Link
        href="/painel/checklist"
        className="shrink-0 text-xs font-semibold text-rose-500 hover:text-rose-600 underline underline-offset-2 whitespace-nowrap"
      >
        Ver mais
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

type NavEntry =
  | { href: string; label: string; icon: typeof LayoutDashboard; accent?: 'green'; badge?: string }
  | { section: string }
  | { divider: true }

const CHECKLIST_NAV_ITEM: NavEntry = { href: '/painel/checklist', label: 'Checklist', icon: CheckCircle2, accent: 'green' }

const navItems: NavEntry[] = [
  { section: 'Operação' },
  { href: '/painel', label: 'Painel', icon: LayoutDashboard },
  { href: '/painel/agendamentos', label: 'Agendamentos', icon: Calendar },
  { href: '/painel/calendario', label: 'Calendário', icon: CalendarDays },

  { section: 'Configuração do negócio' },
  { href: '/painel/servicos', label: 'Serviços', icon: Scissors },
  { href: '/painel/galeria', label: 'Galeria', icon: ImageIcon },
  { href: '/painel/horarios', label: 'Horários', icon: Clock },
  { href: '/painel/profissionais', label: 'Profissionais', icon: UserCircle2 },
  { href: '/painel/whatsapp', label: 'WhatsApp Auto.', icon: MessageCircle, accent: 'green', badge: 'EM BREVE' },

  { section: 'Controle' },
  { href: '/painel/clientes', label: 'Clientes', icon: Users },
  { href: '/painel/relatorios', label: 'Relatórios', icon: BarChart3 },
  { href: '/painel/caixa', label: 'Caixa', icon: Wallet },

  { divider: true },
  { href: '/painel/perfil', label: 'Meu Perfil', icon: UserCircle },
  { href: '/painel/assinatura', label: 'Assinatura', icon: CreditCard },
  { href: '/painel/suporte', label: 'Suporte', icon: Headset },
  { href: '/painel/configuracoes', label: 'Configurações', icon: Settings },
]

export default function PainelLayoutClient({
  children,
  prestadora,
  trialDiasRestantes,
  checklistStatus,
}: {
  children: React.ReactNode
  prestadora: Prestadora
  trialDiasRestantes: number | null
  checklistStatus: ChecklistStatus
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const items = checklistStatus.completo ? navItems : [CHECKLIST_NAV_ITEM, ...navItems]

  // Marca a prestadora como "online" pro indicador em tempo real do painel
  // admin — dispara uma vez quando o painel é aberto (o layout não remonta
  // entre navegações internas de /painel).
  useEffect(() => {
    fetch('/api/ping', { method: 'POST' }).catch(() => {})
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    // Limpa do Cache Storage as páginas do /painel que o service worker
    // guardou (nome/telefone de cliente, agenda, receita...) — sem isso
    // ficavam salvas no aparelho depois do logout e podiam ser servidas
    // pro próximo usuário do mesmo aparelho (achado da auditoria de
    // segurança). Best-effort: se não tiver SW ativo, só segue o logout.
    navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_PAINEL_CACHE' })
    // Reload completo (não router.push) — o layout autenticado é um Server
    // Component que só reavalia a sessão numa navegação de verdade; uma troca
    // client-side deixava a sidebar/topbar da sessão antiga visível por trás
    // da tela de login.
    window.location.href = '/painel/login'
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
        <div className="px-6 pb-6 pt-[calc(1.5rem_+_env(safe-area-inset-top))] border-b border-gray-100 shrink-0">
          <span className="font-serif text-2xl font-bold text-rose-400">BelleBook</span>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1">
          {items.map((item, i) => {
            if ('divider' in item) {
              return <div key={`divider-${i}`} className="my-2 border-t border-gray-100" />
            }
            if ('section' in item) {
              return (
                <p key={item.section} className="px-3 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {item.section}
                </p>
              )
            }
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                data-tour={TOUR_NAV_KEYS[item.href]}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all min-h-11',
                  item.accent === 'green'
                    ? (active ? 'bg-green-50 text-green-600' : 'text-green-600 hover:bg-green-50')
                    : (active ? 'bg-rose-50 text-rose-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge && (
                  <span className="shrink-0 text-[9px] font-bold text-white bg-green-800 px-1.5 py-0.5 rounded-full tracking-wide">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] border-t border-gray-100 space-y-2 shrink-0">
          <a
            href={`/n/${prestadora.slug}`}
            target="_blank"
            rel="noopener noreferrer external"
            data-tour="tour-link-publico"
            className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-all min-h-11"
          >
            {/*
              Antes isso usava e.preventDefault() + window.open() para tentar escapar do
              PWA standalone — mas window.open() disparado via JS é bloqueado/ignorado
              pelo WKWebView do iOS em modo standalone, prendendo a prestadora dentro do
              app. Uma navegação de âncora "de verdade" (sem JS no meio) é o que o Safari
              e o Chrome de fato tratam como abertura em navegador externo.
            */}
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
        <header className="bg-white border-b border-gray-100 px-4 lg:px-8 pb-4 pt-[calc(1rem_+_env(safe-area-inset-top))] flex items-center justify-between sticky top-0 z-20">
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

          <div className="flex items-center gap-1">
            <NotificacoesSino prestadoraId={prestadora.id} />
          </div>
        </header>

        {/* Checklist de ativação — em toda página do painel, some sozinho em 100% */}
        {!checklistStatus.completo && <ChecklistBanner status={checklistStatus} />}

        {/* Downgrade banner */}
        {prestadora.downgrade_aviso && (
          <DowngradeBanner prestadoraId={prestadora.id} />
        )}

        {/* Trial banner — parceira tem Pro vitalício pelo cargo, nunca precisa assinar */}
        {!prestadora.e_parceira && prestadora.e_trial && !prestadora.mp_metodo_pagamento && trialDiasRestantes !== null && (
          <TrialBanner dias={trialDiasRestantes} />
        )}

        {/* Ativar notificações push */}
        <PushNotificationPrompt prestadoraId={prestadora.id} />
        <PaymentSoundListener />

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>

      {pathname === '/painel' && (
        <>
          {/* Ordem sequencial: boas-vindas primeiro, tour só começa depois que
              ela é fechada (ver evento 'bb-welcome-done' em cada componente). */}
          <WelcomeModal prestadoraId={prestadora.id} />
          <OnboardingTour
            prestadoraId={prestadora.id}
            onOpenSidebar={() => setSidebarOpen(true)}
            onCloseSidebar={() => setSidebarOpen(false)}
          />
          <RetrospectivaAutoModal
            prestadoraId={prestadora.id}
            mostrarProfissionalDestaque={ehStudio(planoEfetivo(prestadora))}
            prestadoraNome={prestadora.nome}
            fotoUrl={prestadora.foto_url}
            tema={getTema(prestadora.cor_tema)}
          />
        </>
      )}

      <InstallPwaModal />
      <FeedbackModal prestadoraId={prestadora.id} createdAt={prestadora.created_at} />
    </div>
  )
}
