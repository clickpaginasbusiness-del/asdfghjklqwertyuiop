'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Calendar, CalendarDays, Scissors, ImageIcon,
  Clock, Users, LogOut, Menu, X, ExternalLink, UserCircle, UserCircle2, CreditCard, BarChart3, Headset, Bell, Sparkles,
} from 'lucide-react'
import { demoToast } from '@/lib/demoData'
import { cn } from '@/lib/utils'

const BANNER_HEIGHT = 'h-11'

const navItems = [
  { href: '/painel/demo', label: 'Painel', icon: LayoutDashboard },
  { href: '/painel/demo/agendamentos', label: 'Agendamentos', icon: Calendar },
  { href: '/painel/demo/calendario', label: 'Calendário', icon: CalendarDays },
  { href: '/painel/demo/servicos', label: 'Serviços', icon: Scissors },
  { href: '/painel/demo/galeria', label: 'Galeria', icon: ImageIcon },
  { href: '/painel/demo/horarios', label: 'Horários', icon: Clock },
  { href: '/painel/demo/clientes', label: 'Clientes', icon: Users },
  { href: '/painel/demo/relatorios', label: 'Relatórios', icon: BarChart3 },
  { href: '/painel/demo/profissionais', label: 'Profissionais', icon: UserCircle2 },
  { href: '/painel/demo/perfil', label: 'Meu Perfil', icon: UserCircle },
  { href: '/painel/demo/assinatura', label: 'Assinatura', icon: CreditCard },
  { href: '/painel/demo/suporte', label: 'Suporte', icon: Headset },
]

export default function PainelDemoLayoutClient({
  children,
  nomeUsuario,
}: {
  children: React.ReactNode
  nomeUsuario: string
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Banner fixo de modo demonstração */}
      <div className={cn('fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-rose-400 text-white text-xs sm:text-sm font-medium px-4 text-center', BANNER_HEIGHT)}>
        <Sparkles className="w-3.5 h-3.5 shrink-0 hidden sm:block" />
        <span>👀 Modo demonstração</span>
        <span className="opacity-60">—</span>
        <Link href="/painel/cadastro" className="underline underline-offset-2 font-semibold hover:opacity-90 whitespace-nowrap">
          Criar minha conta grátis →
        </Link>
      </div>

      <div className="flex flex-1 pt-11">
        {/* Sidebar overlay mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={cn(
          'fixed left-0 top-11 h-[calc(100%-2.75rem)] w-64 bg-white border-r border-gray-100 z-40 flex flex-col transition-transform duration-300',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}>
          <div className="p-6 border-b border-gray-100 shrink-0">
            <span className="font-serif text-2xl font-bold text-rose-400">BelleBook</span>
          </div>

          <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
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

          <div className="p-4 border-t border-gray-100 space-y-2 shrink-0">
            <a
              href="/n/demo"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-all min-h-11"
            >
              <ExternalLink className="w-4 h-4" />
              Ver meu perfil
            </a>
            <Link
              href="/"
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-gray-500 hover:bg-gray-50 w-full transition-all min-h-11"
            >
              <LogOut className="w-4 h-4" />
              Sair da demonstração
            </Link>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
          {/* Topbar */}
          <header className="bg-white border-b border-gray-100 px-4 lg:px-8 py-4 flex items-center justify-between sticky top-11 z-20">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
              className="lg:hidden w-11 h-11 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 -ml-1"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex-1 lg:flex-none mx-3 lg:mx-0">
              <span className="font-serif text-lg font-bold text-rose-400 lg:hidden">BelleBook</span>
              <p className="hidden lg:block text-sm text-gray-500">Olá, <span className="font-medium text-gray-900">{nomeUsuario}</span> 👋</p>
            </div>

            <button
              onClick={demoToast}
              aria-label="Notificações"
              className="relative w-11 h-11 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-400 rounded-full border border-white" />
            </button>
          </header>

          {/* Page content */}
          <main className="flex-1 p-4 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
