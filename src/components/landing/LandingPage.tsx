'use client'

import { useEffect, useRef, useState, type TouchEvent } from 'react'
import Link from 'next/link'
import {
  Calendar, Globe, Users, Bell, Clock, MessageCircle,
  Check, Star, Zap, Sparkles, ArrowRight, ChevronRight, ChevronLeft,
  Phone, Mail, Scissors, CreditCard, LayoutDashboard, ImageIcon,
  BarChart3, UserCircle2, UserCircle, Headset, CheckCheck,
  DollarSign, Smartphone, Camera, Palette, Gift, CalendarDays,
  Monitor, Menu, Tag, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { InstallAppSection } from './InstallAppSection'
import { useCupom, precoComDesconto } from '@/hooks/use-cupom'
import Lenis from 'lenis'

/* ─── Types ─────────────────────────────────── */
type NavId = 'hero' | 'como-funciona' | 'funcionalidades' | 'depoimentos' | 'precos'

const NAV_ITEMS: { id: NavId; label: string }[] = [
  { id: 'como-funciona', label: 'Como funciona' },
  { id: 'funcionalidades', label: 'Recursos' },
  { id: 'depoimentos', label: 'Depoimentos' },
  { id: 'precos', label: 'Preços' },
]

/* ─── Data ───────────────────────────────────── */
const PROFISSOES = [
  'Nail Designer', 'Manicure', 'Cabeleireira', 'Maquiadora', 'Designer de Sobrancelhas',
  'Design de Cílios', 'Esteticista', 'Depiladora', 'Micropigmentadora', 'Podóloga',
  'Massagista', 'Skincare', 'Lash Designer', 'Colorista', 'Barbeira',
]

const STEPS = [
  {
    num: '01',
    title: 'Crie sua conta',
    desc: 'Em 2 minutos você configura seu perfil, escolhe seu link personalizado e define os serviços que oferece.',
    icon: Globe,
  },
  {
    num: '02',
    title: 'Configure sua agenda',
    desc: 'Adicione horários disponíveis, profissionais e preços. O sistema cuida dos conflitos automaticamente.',
    icon: Calendar,
  },
  {
    num: '03',
    title: 'Receba agendamentos',
    desc: 'Compartilhe seu link e deixe as clientes agendarem sozinhas, 24 horas por dia, 7 dias por semana.',
    icon: Users,
  },
]

const FEATURES = [
  { icon: Calendar, title: 'Agenda inteligente', desc: 'Horários ocupados bloqueados automaticamente, sem conflitos.' },
  { icon: Globe, title: 'Página pública', desc: 'Seu link /n/seu-nome com galeria, serviços e agendamento.' },
  { icon: Users, title: 'Gestão de clientes', desc: 'Histórico completo de cada cliente, com filtros e busca.' },
  { icon: Bell, title: 'Notificações real-time', desc: 'Saiba imediatamente quando alguém agendar ou cancelar.' },
  { icon: Clock, title: 'Horários flexíveis', desc: 'Configure disponibilidade por dia da semana e profissional.' },
  { icon: MessageCircle, title: 'WhatsApp integrado', desc: 'Envie confirmações e lembretes direto pelo WhatsApp.' },
  { icon: CalendarDays, title: 'Calendário de agendamentos', desc: 'Visão completa da agenda por dia, semana ou mês.' },
  { icon: UserCircle2, title: 'Múltiplas profissionais', desc: 'Cada profissional com agenda e disponibilidade próprias.' },
  { icon: Star, title: 'Avaliações de clientes', desc: 'Receba avaliações e mostre sua reputação na página pública.' },
  { icon: Palette, title: 'Personalização de cor', desc: 'Deixe sua página com a cara do seu negócio.' },
  { icon: Gift, title: 'Indique e Ganhe', desc: 'Indique outras profissionais e ganhe dias grátis de assinatura.' },
  { icon: Smartphone, title: 'Aplicativo instalável', desc: 'Instale como app na tela inicial, sem loja de aplicativos.' },
  { icon: BarChart3, title: 'Relatórios e métricas', desc: 'Acompanhe receita, agendamentos e desempenho do negócio.', pro: true },
  { icon: Camera, title: 'Galeria de fotos e vídeos', desc: 'Mostre seus melhores trabalhos direto na sua página.', pro: true },
]

const SIDEBAR_ITEMS = [
  { icon: LayoutDashboard, label: 'Painel',        active: true },
  { icon: Calendar,        label: 'Agendamentos',  active: false },
  { icon: Scissors,        label: 'Serviços',      active: false },
  { icon: ImageIcon,       label: 'Galeria',       active: false },
  { icon: Clock,           label: 'Horários',      active: false },
  { icon: Users,           label: 'Clientes',      active: false },
  { icon: BarChart3,       label: 'Relatórios',    active: false },
  { icon: UserCircle2,     label: 'Profissionais', active: false },
  { icon: UserCircle,      label: 'Meu Perfil',    active: false },
  { icon: CreditCard,      label: 'Assinatura',    active: false },
  { icon: Headset,         label: 'Suporte',       active: false },
]

const MOCKUP_METRICS = [
  { label: 'Agendamentos', value: '8 hoje' },
  { label: 'Receita',      value: 'R$ 360,00' },
  { label: 'Horário',      value: '09h – 18h' },
]

const MOCKUP_APPOINTMENTS = [
  { time: '09:00', nome: 'Maria Silva',    servico: 'Manicure + Gel',  preco: 'R$65' },
  { time: '10:30', nome: 'Fernanda Lima',  servico: 'Unhas em gel',    preco: 'R$90' },
  { time: '13:00', nome: 'Beatriz Santos', servico: 'Alongamento',     preco: 'R$120' },
]

const DASHBOARD_FEATURES = [
  { icon: Calendar,   title: 'Agenda inteligente',        desc: 'Veja todos os agendamentos do dia em um único lugar' },
  { icon: DollarSign, title: 'Receita em tempo real',     desc: 'Acompanhe seus ganhos hoje, semana, mês ou ano' },
  { icon: Users,      title: 'Múltiplas profissionais',   desc: 'Cada profissional com agenda e disponibilidade independentes' },
  { icon: Bell,       title: 'Notificações instantâneas', desc: 'Saiba na hora quando alguém agendar ou cancelar' },
  { icon: Smartphone, title: 'WhatsApp integrado',        desc: 'Fale com a cliente direto pelo WhatsApp com um clique' },
  { icon: Camera,     title: 'Galeria de trabalhos',      desc: 'Mostre seus melhores trabalhos na sua página pública' },
]

const TESTIMONIALS = [
  {
    text: 'Antes eu perdia cliente por não responder rápido. Agora a agenda se organiza sozinha e eu foco só no trabalho.',
    name: 'Amanda Silva',
    role: 'Profissional de beleza · Rio de Janeiro',
    rating: 5,
  },
  {
    text: 'Profissional demais! Minha página ficou linda e minhas clientes adoraram poder agendar pelo celular a qualquer hora.',
    name: 'Carla Mendes',
    role: 'Proprietária · Studio CM Nails · São Paulo',
    rating: 5,
  },
  {
    text: 'Não fico mais no WhatsApp confirmando horário. As clientes agendam sozinhas e eu só apareço para atender.',
    name: 'Juliana Costa',
    role: 'Profissional de beleza · Belo Horizonte',
    rating: 5,
  },
]

/* ─── Telas do carrossel mobile (Painel BelleBook) ────── */
function MockupScreenDashboard() {
  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="shrink-0 bg-white px-3 pt-5 pb-2.5 flex items-center justify-between border-b border-gray-100">
        <Menu className="w-3.5 h-3.5 text-gray-400" />
        <span className="font-serif text-xs font-bold text-rose-400">BelleBook</span>
        <div className="relative w-6 h-6 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
          <Bell className="w-3 h-3 text-rose-400" />
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-rose-400 rounded-full border border-white" />
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden p-2.5">
        <p className="text-[9px] text-gray-400">Boa tarde</p>
        <p className="text-xs font-semibold text-gray-900 mb-2">Olá, Ana</p>
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          <div className="bg-white rounded-lg p-2 border border-gray-100 shadow-sm">
            <p className="text-[7px] text-gray-400 uppercase tracking-wide font-medium">Agendamentos</p>
            <p className="text-sm font-bold text-gray-900 leading-tight">8</p>
          </div>
          <div className="bg-white rounded-lg p-2 border border-gray-100 shadow-sm">
            <p className="text-[7px] text-gray-400 uppercase tracking-wide font-medium">Receita</p>
            <p className="text-sm font-bold text-gray-900 leading-tight">R$360</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-2.5 py-2 border-b border-gray-50">
            <p className="text-[9px] font-semibold text-gray-900">Agenda de hoje</p>
          </div>
          <div className="divide-y divide-gray-50">
            {MOCKUP_APPOINTMENTS.slice(0, 3).map((a, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5">
                <div className="bg-rose-100 text-rose-700 text-[8px] font-bold px-1.5 py-0.5 rounded shrink-0">{a.time}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-medium text-gray-900 truncate">{a.nome}</p>
                </div>
                <span className="text-[8px] font-semibold text-gray-600 shrink-0">{a.preco}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="shrink-0 bg-white border-t border-gray-100 flex items-center justify-around py-2">
        {[LayoutDashboard, Calendar, Users, UserCircle].map((Icon, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center justify-center w-6 h-6 rounded-full',
              i === 0 ? 'bg-rose-50 text-rose-500' : 'text-gray-300'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
          </div>
        ))}
      </div>
    </div>
  )
}

function MockupScreenCalendario() {
  const dias = Array.from({ length: 31 }, (_, i) => i + 1)
  const comAgendamento = new Set([3, 8, 12, 17, 22, 25])
  const diaSelecionado = 17

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="shrink-0 bg-white px-3 pt-5 pb-2.5 flex items-center justify-between border-b border-gray-100">
        <Menu className="w-3.5 h-3.5 text-gray-400" />
        <span className="font-serif text-xs font-bold text-rose-400">BelleBook</span>
        <div className="w-6 h-6" />
      </div>
      <div className="shrink-0 px-3 pt-2.5 pb-1.5 flex items-center justify-between">
        <ChevronLeft className="w-3.5 h-3.5 text-gray-300" />
        <p className="text-[10px] font-semibold text-gray-900">Julho 2026</p>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
      </div>
      <div className="shrink-0 px-3">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
            <div key={i} className="text-center text-[7px] font-semibold text-gray-400">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 3 }).map((_, i) => <div key={`blank${i}`} />)}
          {dias.map((d) => (
            <div
              key={d}
              className={cn(
                'aspect-square flex items-center justify-center rounded-md text-[8px] font-medium relative',
                d === diaSelecionado ? 'bg-rose-400 text-white' : 'text-gray-600'
              )}
            >
              {d}
              {comAgendamento.has(d) && d !== diaSelecionado && (
                <span className="absolute bottom-0.5 w-0.5 h-0.5 rounded-full bg-rose-400" />
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden px-3 pt-2.5 pb-2.5">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden h-full">
          <div className="px-2.5 py-2 border-b border-gray-50">
            <p className="text-[9px] font-semibold text-gray-900">17 de julho</p>
          </div>
          <div className="divide-y divide-gray-50">
            {MOCKUP_APPOINTMENTS.slice(0, 2).map((a, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5">
                <div className="bg-rose-100 text-rose-700 text-[8px] font-bold px-1.5 py-0.5 rounded shrink-0">{a.time}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-medium text-gray-900 truncate">{a.nome}</p>
                  <p className="text-[8px] text-gray-500 truncate">{a.servico}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MockupScreenPerfilPublico() {
  const servicos = [
    { nome: 'Manicure', preco: 'R$35' },
    { nome: 'Pedicure', preco: 'R$55' },
    { nome: 'Nail art básica', preco: 'R$70' },
  ]

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="shrink-0 bg-gradient-to-b from-rose-50 to-white px-4 pt-6 pb-3 flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full bg-rose-100 border-2 border-white shadow-sm flex items-center justify-center mb-1.5">
          <span className="font-serif text-base font-bold text-rose-400">A</span>
        </div>
        <p className="font-serif text-xs font-bold text-gray-900">Ana Nails Studio</p>
        <div className="flex items-center gap-1 mt-1">
          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
          <span className="text-[9px] font-semibold text-gray-700">4.9</span>
          <span className="text-[8px] text-gray-400">(38 avaliações)</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden px-3 pt-3 space-y-1.5">
        {servicos.map((s) => (
          <div key={s.nome} className="flex items-center justify-between bg-gray-50 rounded-lg px-2.5 py-2">
            <p className="text-[9px] font-medium text-gray-800">{s.nome}</p>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-semibold text-gray-700">{s.preco}</span>
              <span className="bg-rose-400 text-white text-[7px] font-semibold px-1.5 py-0.5 rounded-full">Agendar</span>
            </div>
          </div>
        ))}
      </div>
      <div className="shrink-0 p-2.5 border-t border-gray-100">
        <div className="bg-rose-400 text-white text-center text-[9px] font-semibold rounded-lg py-2">
          Agendar horário
        </div>
      </div>
    </div>
  )
}

function MockupScreenNotificacao() {
  return (
    <div className="h-full flex flex-col justify-between px-3 py-6 bg-gradient-to-b from-rose-200 via-rose-300 to-rose-400">
      <div className="text-center pt-3">
        <p className="text-white text-2xl font-light tracking-tight">09:41</p>
        <p className="text-white/80 text-[9px] mt-1">Quinta-feira, 17 de julho</p>
      </div>
      <div className="bg-white/95 rounded-xl shadow-lg p-2.5 flex items-start gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-rose-400 flex items-center justify-center shrink-0">
          <Bell className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-bold text-gray-900">BelleBook</p>
            <span className="text-[8px] text-gray-400">agora</span>
          </div>
          <p className="text-[8px] text-gray-600 mt-0.5 leading-snug">
            🔔 Novo agendamento! Maria Silva marcou Manicure às 14:00.
          </p>
        </div>
      </div>
    </div>
  )
}

const MOCKUP_SCREENS = [
  { label: 'Dashboard', Component: MockupScreenDashboard },
  { label: 'Calendário', Component: MockupScreenCalendario },
  { label: 'Página pública', Component: MockupScreenPerfilPublico },
  { label: 'Notificação push', Component: MockupScreenNotificacao },
]

/* ─── Navbar ─────────────────────────────────── */
function Navbar({
  active,
  onNav,
}: {
  active: NavId
  onNav: (id: NavId) => void
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  function handleNav(id: NavId) {
    setMobileOpen(false)
    onNav(id)
  }

  return (
    <>
      <header className="fixed top-5 inset-x-0 z-[100] flex justify-center px-4 pointer-events-none">
        <nav className="pointer-events-auto flex items-center gap-1 bg-white/90 backdrop-blur-2xl border border-gray-200/70 rounded-full px-1.5 py-1.5 shadow-[0_8px_40px_rgba(0,0,0,0.10),0_1px_0_rgba(255,255,255,0.9)_inset]">
          {/* Brand */}
          <Link
            href="/"
            className="font-serif text-base font-bold text-rose-400 px-4 py-2 rounded-full shrink-0"
          >
            BelleBook
          </Link>

          {/* Divider — desktop only */}
          <div className="hidden sm:block w-px h-4 bg-gray-200 mx-1" />

          {/* Nav items — desktop */}
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.id
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={cn(
                  'relative px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-300 hidden sm:block',
                  isActive ? 'text-rose-600' : 'text-gray-500 hover:text-gray-800'
                )}
              >
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-rose-50 shadow-[0_0_16px_4px_rgba(249,168,201,0.35),inset_0_1px_0_rgba(255,255,255,0.9)]"
                    style={{ transition: 'box-shadow 0.3s ease' }}
                  />
                )}
                <span className="relative">{item.label}</span>
              </button>
            )
          })}

          {/* Divider — desktop */}
          <div className="hidden sm:block w-px h-4 bg-gray-200 mx-1" />

          {/* Entrar — desktop */}
          <Link
            href="/painel/login"
            className="px-3.5 py-2 rounded-full text-sm text-gray-500 hover:text-gray-800 transition-colors hidden sm:block"
          >
            Entrar
          </Link>

          {/* CTA */}
          <Link
            href="/painel/cadastro"
            className="px-4 py-2 rounded-full text-sm font-semibold bg-rose-400 hover:bg-rose-500 text-white transition-colors shadow-[0_2px_12px_rgba(251,113,133,0.35)]"
          >
            Começar grátis
          </Link>

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Menu"
            className="sm:hidden ml-1 w-11 h-11 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <span className="flex flex-col gap-[5px] w-4">
              <span className={cn('block h-px bg-gray-600 transition-all duration-200', mobileOpen && 'rotate-45 translate-y-[6px]')} />
              <span className={cn('block h-px bg-gray-600 transition-all duration-200', mobileOpen && 'opacity-0')} />
              <span className={cn('block h-px bg-gray-600 transition-all duration-200', mobileOpen && '-rotate-45 -translate-y-[6px]')} />
            </span>
          </button>
        </nav>
      </header>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <div className="sm:hidden fixed top-[4.5rem] inset-x-4 z-[99] bg-white/90 backdrop-blur-2xl border border-white/80 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] p-2 pointer-events-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.id
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-rose-50 text-rose-600 shadow-[0_0_12px_rgba(249,168,201,0.25)]'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                {item.label}
              </button>
            )
          })}
          <div className="border-t border-gray-100 mt-1 pt-1">
            <Link
              href="/painel/login"
              onClick={() => setMobileOpen(false)}
              className="block px-4 py-3 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Entrar
            </Link>
          </div>
        </div>
      )}
    </>
  )
}

/* ─── Main component ─────────────────────────── */
export default function LandingPage() {
  const [activeSection, setActiveSection] = useState<NavId>('hero')
  const [cicloPrecos, setCicloPrecos] = useState<'mensal' | 'anual'>('mensal')
  const {
    cupomAberto, setCupomAberto,
    cupomInput, onCupomInputChange,
    cupomStatus, desconto,
    aplicarCupom,
  } = useCupom()
  const [mockupView, setMockupView] = useState<'desktop' | 'mobile'>('desktop')
  const [screenIndex, setScreenIndex] = useState(0)
  const touchStartXRef = useRef<number | null>(null)
  const lenisRef = useRef<Lenis | null>(null)
  const rafRef = useRef<number>(0)

  function goToScreen(i: number) {
    setScreenIndex(Math.max(0, Math.min(MOCKUP_SCREENS.length - 1, i)))
  }

  function handleScreenTouchStart(e: TouchEvent<HTMLDivElement>) {
    const touch = e.touches[0]
    touchStartXRef.current = touch ? touch.clientX : null
  }

  function handleScreenTouchEnd(e: TouchEvent<HTMLDivElement>) {
    if (touchStartXRef.current === null) return
    const touch = e.changedTouches[0]
    const startX = touchStartXRef.current
    touchStartXRef.current = null
    if (!touch) return
    const deltaX = touch.clientX - startX
    const SWIPE_THRESHOLD = 40
    if (deltaX > SWIPE_THRESHOLD) goToScreen(screenIndex - 1)
    else if (deltaX < -SWIPE_THRESHOLD) goToScreen(screenIndex + 1)
  }

  /* Lenis smooth scroll — guarda instância no ref para uso no scrollTo */
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    })
    lenisRef.current = lenis

    function raf(time: number) {
      lenis.raf(time)
      rafRef.current = requestAnimationFrame(raf)
    }
    rafRef.current = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(rafRef.current)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  /* Intersection observer for scroll-in animations */
  useEffect(() => {
    const els = document.querySelectorAll('[data-animate]')
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in-view')
            obs.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -30px 0px' }
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  /* Active section tracker */
  useEffect(() => {
    const ids: NavId[] = ['hero', 'como-funciona', 'funcionalidades', 'depoimentos', 'precos']
    const handler = () => {
      for (const id of [...ids].reverse()) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.45) {
          setActiveSection(id)
          return
        }
      }
      setActiveSection('hero')
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  function scrollTo(id: NavId) {
    const el = document.getElementById(id)
    if (!el) return
    if (lenisRef.current) {
      // Lenis gerencia o scroll — usa a API própria para manter a inércia
      lenisRef.current.scrollTo(el, { offset: 0, immediate: false })
    } else {
      // Fallback se Lenis ainda não inicializou
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="bg-white">
      <Navbar active={activeSection} onNav={scrollTo} />

      {/* ── HERO ─────────────────────────────── */}
      <section
        id="hero"
        className="sticky top-0 z-[1] bg-white min-h-screen flex flex-col items-center justify-center text-center px-6 pt-24 md:pt-36 lg:pt-40 pb-5 overflow-hidden"
      >
        {/* Decorative orbs — drift muito sutil, mesmas cores do fundo */}
        <div aria-hidden className="pointer-events-none select-none absolute inset-0 overflow-hidden">
          <div className="hero-blob-1 absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-rose-100/50 blur-3xl" />
          <div className="hero-blob-2 absolute -bottom-20 -left-20 w-[380px] h-[380px] rounded-full bg-pink-100/60 blur-3xl" />
          <div className="hero-blob-3 absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[200px] rounded-full bg-rose-50/80 blur-2xl" />
        </div>

        <div className="relative max-w-4xl mx-auto">
          <div
            data-animate="fade"
            className="inline-flex items-center gap-2 bg-rose-50 border border-rose-100 text-rose-500 px-4 py-1.5 rounded-full text-sm font-medium mb-10"
          >
            <Sparkles className="w-4 h-4" />
            <span>A plataforma para profissionais de beleza</span>
          </div>

          <h1
            data-animate
            className="font-serif text-[clamp(2.5rem,7vw,5.5rem)] font-bold text-gray-900 leading-[1.05] tracking-tight mb-8"
          >
            O sistema de agendamento online
            <br />
            <em className="not-italic text-rose-400">para profissionais de beleza</em>
          </h1>

          <p
            data-animate
            data-delay="150"
            className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-12 leading-relaxed"
          >
            Crie sua página profissional, receba agendamentos 24h e gerencie clientes
            — tudo em um só lugar, sem complicação.
          </p>

          <div
            data-animate
            data-delay="250"
            className="flex flex-col sm:flex-row items-center gap-4 justify-center"
          >
            <Link
              href="/painel/cadastro"
              className="group flex items-center gap-2 bg-rose-400 hover:bg-rose-500 text-white px-8 py-4 rounded-2xl text-base font-semibold transition-all shadow-[0_8px_30px_rgba(251,113,133,0.35)] hover:shadow-[0_8px_30px_rgba(251,113,133,0.5)] hover:-translate-y-0.5"
            >
              Começar grátis — 30 dias
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/n/demo"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-6 py-4 rounded-2xl border border-gray-200 hover:border-gray-300 bg-white text-base font-medium transition-all hover:shadow-sm"
            >
              Ver exemplo de perfil
              <ChevronRight className="w-4 h-4" />
            </Link>
            <Link
              href="/painel/demo"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-6 py-4 rounded-2xl border border-gray-200 hover:border-gray-300 bg-white text-base font-medium transition-all hover:shadow-sm"
            >
              <LayoutDashboard className="w-4 h-4" />
              Ver o sistema
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Social proof */}
          <p data-animate data-delay="350" className="mt-12 text-sm text-gray-400">
            Sem cartão de crédito · Cancele quando quiser
          </p>

          {/* PWA badge */}
          <div
            data-animate
            data-delay="450"
            className="mt-6 inline-flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 bg-white border border-gray-100 shadow-sm px-5 py-3 rounded-2xl"
          >
            <span className="inline-flex items-center gap-2 text-rose-500 text-sm font-semibold">
              <Smartphone className="w-4 h-4" />
              Disponível como app gratuito
            </span>
            <span className="hidden sm:inline text-gray-300">·</span>
            <span className="text-gray-400 text-xs sm:text-sm">
              Acesse pelo celular e instale direto na tela inicial
            </span>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
          <div className="w-px h-10 bg-gray-400 animate-[scrollCue_1.6s_ease-in-out_infinite]" />
        </div>
      </section>

      {/* ── TICKER DE PROFISSÕES ──────────────── */}
      <section className="relative z-[2] bg-[#fdf2f6] overflow-hidden py-5">
        <span className="sr-only">
          Profissionais atendidos pelo BelleBook: {PROFISSOES.join(', ')}
        </span>
        <div className="flex w-max ticker-track" aria-hidden="true">
          {[...PROFISSOES, ...PROFISSOES].map((profissao, i) => (
            <span
              key={i}
              className="flex items-center shrink-0 text-sm sm:text-base font-medium px-4 sm:px-6"
              style={{ color: '#f472b6' }}
            >
              {profissao}
              <span className="ml-4 sm:ml-6 text-gray-400">✦</span>
            </span>
          ))}
        </div>
      </section>

      {/* ── COMO FUNCIONA ─────────────────────── */}
      <section
        id="como-funciona"
        className="relative z-[2] bg-[#fdf5f8] min-h-screen flex flex-col items-center justify-center px-6 py-24 rounded-t-[40px] shadow-[0_-4px_60px_rgba(0,0,0,0.04)]"
      >
        <div className="max-w-5xl mx-auto w-full">
          <div className="text-center mb-16">
            <p data-animate data-animate-type="fade" className="text-rose-400 text-sm font-semibold uppercase tracking-widest mb-4">
              Como funciona
            </p>
            <h2 data-animate className="font-serif text-[clamp(2rem,5vw,3.5rem)] font-bold text-gray-900 leading-tight">
              Três passos para
              <br />
              <span className="text-rose-400">decolar sua agenda</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                data-animate
                data-delay={String(i * 150)}
                className="relative bg-white rounded-3xl p-8 shadow-[0_4px_40px_rgba(0,0,0,0.06)] border border-white/80"
              >
                <div className="text-[4rem] font-serif font-bold text-rose-100 leading-none mb-4">
                  {step.num}
                </div>
                <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center mb-5">
                  <step.icon className="w-5 h-5 text-rose-400" />
                </div>
                <h3 className="font-semibold text-gray-900 text-lg mb-3">{step.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>

                {/* Connector arrow */}
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 z-10">
                    <ChevronRight className="w-6 h-6 text-rose-200" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PAINEL DEMO ───────────────────────── */}
      <section
        className="relative z-[2] bg-[#fdf5f8] px-6 py-28 rounded-t-[40px] shadow-[0_-4px_60px_rgba(0,0,0,0.04)]"
      >
        <div className="max-w-6xl mx-auto w-full">
          {/* Header */}
          <div className="text-center mb-16">
            <p data-animate className="text-rose-400 text-sm font-semibold uppercase tracking-widest mb-4">
              Painel BelleBook
            </p>
            <h2 data-animate data-delay="100" className="font-serif text-[clamp(2rem,5vw,3.5rem)] font-bold text-gray-900 leading-tight">
              Tudo que você precisa,
              <br />em um só lugar
            </h2>
            <p data-animate data-delay="200" className="text-gray-500 mt-4 max-w-xl mx-auto">
              Painel completo e fácil de usar, feito para profissionais de beleza
            </p>
          </div>

          {/* 60 / 40 split */}
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">

            {/* ── Carrossel mobile (só até lg — mockup desktop não cabe na tela) ── */}
            <div data-animate className="lg:hidden w-full flex flex-col items-center">
              <div className="relative" style={{ width: 250 }}>
                <div className="relative bg-gray-900 rounded-[2.2rem] p-2.5 shadow-[0_30px_80px_rgba(0,0,0,0.22),0_8px_24px_rgba(249,168,201,0.20)]">
                  {/* Notch */}
                  <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-20 h-4 bg-gray-900 rounded-full z-10" />

                  <div
                    className="relative bg-gray-50 rounded-[1.7rem] overflow-hidden select-none"
                    style={{ height: 500 }}
                    onTouchStart={handleScreenTouchStart}
                    onTouchEnd={handleScreenTouchEnd}
                  >
                    <div
                      className="flex h-full transition-transform duration-500 ease-out"
                      style={{ transform: `translateX(-${screenIndex * 100}%)` }}
                    >
                      {MOCKUP_SCREENS.map(({ label, Component }) => (
                        <div key={label} className="w-full h-full shrink-0">
                          <Component />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Setas de navegação */}
                <button
                  onClick={() => goToScreen(screenIndex - 1)}
                  disabled={screenIndex === 0}
                  aria-label="Tela anterior"
                  className="absolute top-1/2 -left-3 -translate-y-1/2 w-9 h-9 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-500 disabled:opacity-0 disabled:pointer-events-none transition-opacity"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => goToScreen(screenIndex + 1)}
                  disabled={screenIndex === MOCKUP_SCREENS.length - 1}
                  aria-label="Próxima tela"
                  className="absolute top-1/2 -right-3 -translate-y-1/2 w-9 h-9 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-500 disabled:opacity-0 disabled:pointer-events-none transition-opacity"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Label + dots */}
              <div className="flex flex-col items-center gap-3 mt-5">
                <p className="text-sm font-medium text-gray-600">{MOCKUP_SCREENS[screenIndex].label}</p>
                <div className="flex items-center gap-2">
                  {MOCKUP_SCREENS.map((s, i) => (
                    <button
                      key={s.label}
                      onClick={() => goToScreen(i)}
                      aria-label={`Ver tela ${s.label}`}
                      className={cn(
                        'h-2 rounded-full transition-all duration-300',
                        i === screenIndex ? 'w-6 bg-rose-400' : 'w-2 bg-gray-200'
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* ── Mockup do painel (60%, escondido no mobile — vira lista de features) ── */}
            <div data-animate className="hidden lg:block w-full lg:w-[60%] shrink-0">
              {/* Toggle Desktop / Mobile */}
              <div className="flex justify-center mb-7">
                <div className="inline-flex items-center bg-gray-100 rounded-full p-1 gap-1">
                  <button
                    onClick={() => setMockupView('desktop')}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                      mockupView === 'desktop'
                        ? 'bg-rose-400 text-white shadow-[0_2px_12px_rgba(251,113,133,0.35)]'
                        : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    <Monitor className="w-4 h-4" />
                    Desktop
                  </button>
                  <button
                    onClick={() => setMockupView('mobile')}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                      mockupView === 'mobile'
                        ? 'bg-rose-400 text-white shadow-[0_2px_12px_rgba(251,113,133,0.35)]'
                        : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    <Smartphone className="w-4 h-4" />
                    Mobile
                  </button>
                </div>
              </div>

              <div className="relative" style={{ height: 720 }}>
                {/* Desktop mockup */}
                <div
                  className={cn(
                    'absolute inset-0 flex items-center transition-all duration-500 ease-out',
                    mockupView === 'desktop'
                      ? 'opacity-100 scale-100'
                      : 'opacity-0 scale-95 pointer-events-none'
                  )}
                >
                  <div className="w-full rounded-2xl overflow-hidden border border-gray-200/60 shadow-[0_30px_80px_rgba(0,0,0,0.13),0_8px_24px_rgba(249,168,201,0.20)]">

                    {/* Chrome bar */}
                    <div className="bg-gray-100 px-4 py-3 flex items-center gap-3 border-b border-gray-200">
                      <div className="flex gap-1.5 shrink-0">
                        <div className="w-3 h-3 rounded-full bg-red-400/80" />
                        <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                        <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
                      </div>
                      <div className="flex-1 bg-white rounded-full px-4 py-1 text-[11px] text-gray-400 text-center shadow-sm">
                        bellebook.com.br/painel
                      </div>
                      <div className="w-14 shrink-0" />
                    </div>

                    {/* Dashboard */}
                    <div className="flex bg-gray-50 select-none" style={{ minHeight: 390 }}>

                      {/* Sidebar */}
                      <div className="bg-white border-r border-gray-100 flex flex-col pt-4 pb-4 shrink-0" style={{ width: 148 }}>
                        <div className="px-4 mb-4">
                          <span className="font-serif text-sm font-bold text-rose-400">BelleBook</span>
                        </div>
                        <div className="px-2 space-y-0.5">
                          {SIDEBAR_ITEMS.map((item) => (
                            <div
                              key={item.label}
                              className={cn(
                                'flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-medium',
                                item.active
                                  ? 'bg-rose-50 text-rose-600'
                                  : 'text-gray-400'
                              )}
                            >
                              <item.icon className="w-3 h-3 shrink-0" />
                              {item.label}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Main area */}
                      <div className="flex-1 min-w-0 p-5">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-5">
                          <div>
                            <p className="text-[10px] text-gray-400">Boa tarde</p>
                            <p className="text-sm font-semibold text-gray-900">Olá, Ana</p>
                          </div>
                          <div className="relative w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                            <Bell className="w-3.5 h-3.5 text-rose-400" />
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-400 rounded-full border border-white" />
                          </div>
                        </div>

                        {/* Metric cards */}
                        <div className="grid grid-cols-3 gap-2.5 mb-5">
                          {MOCKUP_METRICS.map((m) => (
                            <div key={m.label} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                              <p className="text-[9px] text-gray-400 mb-1 uppercase tracking-wide font-medium">{m.label}</p>
                              <p className="text-xs font-bold text-gray-900 leading-tight">{m.value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Appointments list */}
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                          <div className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between">
                            <p className="text-[11px] font-semibold text-gray-700">Agenda de hoje</p>
                            <span className="bg-rose-50 text-rose-500 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                              3 confirmados
                            </span>
                          </div>
                          {MOCKUP_APPOINTMENTS.map((a, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-50 last:border-0"
                            >
                              <div className="bg-rose-100 text-rose-600 text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap shrink-0">
                                {a.time}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold text-gray-800 truncate">{a.nome}</p>
                                <p className="text-[10px] text-gray-400 truncate">{a.servico}</p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[11px] font-semibold text-gray-700">{a.preco}</span>
                                <div className="flex items-center gap-0.5 bg-green-50 border border-green-100 text-green-600 rounded-full px-1.5 py-0.5 text-[9px] font-medium">
                                  <MessageCircle className="w-2 h-2" />
                                  <span>WA</span>
                                </div>
                                <div className="flex items-center justify-center w-4 h-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-full">
                                  <CheckCheck className="w-2 h-2" />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile mockup — réplica fiel do PainelLayoutClient + PainelDashboardClient */}
                <div
                  className={cn(
                    'absolute inset-0 flex items-center justify-center transition-all duration-500 ease-out',
                    mockupView === 'mobile'
                      ? 'opacity-100 scale-100'
                      : 'opacity-0 scale-95 pointer-events-none'
                  )}
                >
                  <div className="relative bg-gray-900 rounded-[2.5rem] p-2.5 shadow-[0_30px_80px_rgba(0,0,0,0.22),0_8px_24px_rgba(249,168,201,0.20)]" style={{ width: 270 }}>
                    {/* Notch */}
                    <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-24 h-5 bg-gray-900 rounded-full z-10" />

                    <div className="relative bg-gray-50 rounded-[2rem] overflow-hidden flex flex-col select-none" style={{ height: 680 }}>
                      {/* Topbar — hamburger + logo + sino, igual ao PainelLayoutClient */}
                      <div className="shrink-0 bg-white px-3.5 pt-7 pb-3 flex items-center justify-between border-b border-gray-100">
                        <div className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500">
                          <Menu className="w-4 h-4" />
                        </div>
                        <span className="font-serif text-sm font-bold text-rose-400">BelleBook</span>
                        <div className="relative w-7 h-7 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                          <Bell className="w-3.5 h-3.5 text-rose-400" />
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-400 rounded-full border border-white" />
                        </div>
                      </div>

                      {/* Conteúdo — réplica do PainelDashboardClient em coluna única (mobile) */}
                      <div className="flex-1 min-h-0 overflow-hidden p-3">
                        <p className="font-serif text-sm font-semibold text-gray-900">Painel</p>
                        <p className="text-[9px] text-gray-500 mb-3">quinta-feira, 17 de julho</p>

                        {/* Cards de métricas empilhados — grid-cols-1 real no mobile */}
                        <div className="space-y-2 mb-3">
                          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-2.5">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="bg-rose-50 p-1.5 rounded-lg">
                                <Calendar className="w-3.5 h-3.5 text-rose-400" />
                              </div>
                              <span className="bg-pink-100 text-rose-700 text-[8px] font-medium rounded-full px-2 py-0.5">Hoje</span>
                            </div>
                            <p className="text-base font-bold text-gray-900 leading-tight">8</p>
                            <p className="text-[9px] text-gray-500">Agendamentos</p>
                          </div>
                          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-2.5">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="bg-emerald-50 p-1.5 rounded-lg">
                                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                              </div>
                              <span className="bg-emerald-100 text-emerald-700 text-[8px] font-medium rounded-full px-2 py-0.5">Estimado</span>
                            </div>
                            <p className="text-base font-bold text-gray-900 leading-tight">R$ 360,00</p>
                            <p className="text-[9px] text-gray-500">Receita — hoje</p>
                          </div>
                        </div>

                        {/* Agenda de hoje — com os botões reais (WhatsApp, Concluído, Cancelar) */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                          <div className="px-3 pt-3 pb-2">
                            <p className="text-sm font-semibold text-gray-900">Agenda de hoje</p>
                          </div>
                          <div className="divide-y divide-gray-50">
                            {MOCKUP_APPOINTMENTS.slice(0, 2).map((a, i) => (
                              <div key={i} className="flex flex-col gap-2 px-3 py-2.5">
                                <div className="flex items-start gap-2">
                                  <div className="shrink-0 bg-rose-100 text-rose-700 text-[9px] font-bold px-1.5 py-1 rounded-md whitespace-nowrap">
                                    {a.time}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-medium text-gray-900 truncate">{a.nome}</p>
                                    <p className="text-[9px] text-gray-500 truncate">{a.servico}</p>
                                    <span className="inline-flex items-center gap-1 bg-green-50 border border-green-100 text-green-600 rounded-full px-2 py-0.5 text-[8px] font-medium mt-1.5">
                                      <MessageCircle className="w-2 h-2" />
                                      WhatsApp
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
                                  <p className="text-[11px] font-semibold text-gray-800">{a.preco}</p>
                                  <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[8px] font-medium rounded-lg px-1.5 py-1">
                                      <CheckCheck className="w-2 h-2" />
                                      Concluído
                                    </span>
                                    <span className="text-[8px] text-red-400 font-medium">Cancelar</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Bottom tab bar */}
                      <div className="shrink-0 bg-white border-t border-gray-100 flex items-center justify-around py-2.5">
                        {[LayoutDashboard, Calendar, Users, UserCircle].map((Icon, i) => (
                          <div
                            key={i}
                            className={cn(
                              'flex items-center justify-center w-8 h-8 rounded-full transition-colors',
                              i === 0 ? 'bg-rose-50 text-rose-500' : 'text-gray-300'
                            )}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Feature list (40% no desktop, full width no mobile) ── */}
            <div className="w-full lg:w-[40%] space-y-7 max-w-md mx-auto lg:max-w-none lg:mx-0">
              {DASHBOARD_FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  data-animate
                  data-delay={String(i * 100)}
                  className="flex items-start gap-4"
                >
                  <div className="w-11 h-11 shrink-0 bg-rose-50 rounded-2xl flex items-center justify-center shadow-sm border border-gray-100">
                    <f.icon className="w-5 h-5 text-rose-400" />
                  </div>
                  <div className="pt-1">
                    <p className="font-semibold text-gray-900">{f.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FUNCIONALIDADES ───────────────────── */}
      <section
        id="funcionalidades"
        className="relative z-[2] bg-white min-h-screen flex flex-col items-center justify-center px-6 py-24 rounded-t-[40px] shadow-[0_-4px_60px_rgba(0,0,0,0.04)]"
      >
        <div className="max-w-5xl mx-auto w-full">
          <div className="text-center mb-16">
            <p data-animate className="text-rose-400 text-sm font-semibold uppercase tracking-widest mb-4">
              Recursos
            </p>
            <h2 data-animate data-delay="100" className="font-serif text-[clamp(2rem,5vw,3.5rem)] font-bold text-gray-900 leading-tight">
              Tudo que você precisa,
              <br />
              nada que não precisa
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                data-animate
                data-delay={String((i % 3) * 100)}
                className="group p-6 rounded-2xl border border-gray-100 hover:border-rose-100 bg-white hover:bg-rose-50/30 transition-all duration-300 cursor-default"
              >
                <div className="w-10 h-10 rounded-xl bg-rose-50 group-hover:bg-rose-100 flex items-center justify-center mb-4 transition-colors">
                  <f.icon className="w-5 h-5 text-rose-400" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900">{f.title}</h3>
                  {f.pro && (
                    <span className="bg-rose-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                      Pro
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS ───────────────────────── */}
      <section
        id="depoimentos"
        className="relative z-[2] bg-[#0f0f0f] min-h-screen flex flex-col items-center justify-center px-6 py-24 rounded-t-[40px]"
      >
        {/* Subtle glow */}
        <div aria-hidden className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-rose-500/10 blur-3xl" />

        <div className="relative max-w-5xl mx-auto w-full">
          <div className="text-center mb-16">
            <p data-animate className="text-rose-400 text-sm font-semibold uppercase tracking-widest mb-4">
              Depoimentos
            </p>
            <h2 data-animate data-delay="100" className="font-serif text-[clamp(2rem,5vw,3.5rem)] font-bold text-white leading-tight">
              Quem usa, não<br />
              consegue largar
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={t.name}
                data-animate
                data-delay={String(i * 120)}
                className="bg-white/[0.06] border border-white/10 rounded-2xl p-7 flex flex-col gap-5 hover:bg-white/10 transition-colors"
              >
                {/* Stars */}
                <div className="flex gap-1">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-rose-400 text-rose-400" />
                  ))}
                </div>

                <p className="text-gray-300 text-sm leading-relaxed flex-1">
                  &ldquo;{t.text}&rdquo;
                </p>

                <div className="border-t border-white/10 pt-5">
                  <p className="text-white font-medium text-sm">{t.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PREÇOS ────────────────────────────── */}
      <section
        id="precos"
        className="relative z-[2] bg-[#fdf5f8] min-h-screen flex flex-col items-center justify-center px-6 py-24"
      >
        <div className="max-w-4xl mx-auto w-full">
          <div className="text-center mb-16">
            <p data-animate className="text-rose-400 text-sm font-semibold uppercase tracking-widest mb-4">
              Preços
            </p>
            <h2 data-animate data-delay="100" className="font-serif text-[clamp(2rem,5vw,3.5rem)] font-bold text-gray-900 leading-tight">
              Simples e transparente
            </h2>
            <p data-animate data-delay="200" className="text-gray-500 mt-4">
              30 dias grátis em qualquer plano. Sem surpresas.
            </p>

            {/* Toggle mensal / anual */}
            <div data-animate data-delay="300" className="mt-8 inline-flex items-center bg-gray-100 rounded-full p-1 gap-1">
              <button
                onClick={() => setCicloPrecos('mensal')}
                className={cn(
                  'px-5 py-2 rounded-full text-sm font-medium transition-all duration-200',
                  cicloPrecos === 'mensal'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                Mensal
              </button>
              <button
                onClick={() => setCicloPrecos('anual')}
                className={cn(
                  'flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200',
                  cicloPrecos === 'anual'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                Anual
                <span className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-colors',
                  cicloPrecos === 'anual'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-200 text-gray-400'
                )}>
                  20% off
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Básico */}
            <div data-animate className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-gray-600" />
                </div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Básico</span>
              </div>
              <div className="mb-6">
                {cicloPrecos === 'mensal' ? (
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      {desconto ? (
                        <>
                          <span className="text-lg font-semibold text-gray-300 line-through">R$49</span>
                          <span className="text-4xl font-bold text-emerald-600">{precoComDesconto('R$49', desconto)}</span>
                        </>
                      ) : (
                        <span className="text-4xl font-bold text-gray-900">R$49</span>
                      )}
                      <span className="text-gray-400 text-sm">/mês</span>
                    </div>
                    <p className="text-sm text-emerald-600 font-medium mt-1">30 dias grátis, depois R$49/mês</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-baseline gap-2">
                      {desconto ? (
                        <>
                          <span className="text-lg font-semibold text-gray-300 line-through">R$470</span>
                          <span className="text-4xl font-bold text-emerald-600">{precoComDesconto('R$470', desconto)}</span>
                        </>
                      ) : (
                        <span className="text-4xl font-bold text-gray-900">R$470</span>
                      )}
                      <span className="text-gray-400 text-sm">/ano</span>
                      <span className="text-[11px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">20% off</span>
                    </div>
                    <p className="text-sm text-emerald-600 font-medium mt-1">30 dias grátis, depois R$470/ano</p>
                    <p className="text-xs text-gray-400 mt-0.5">R$39/mês equivalente</p>
                  </div>
                )}
                <p className="text-sm text-gray-500 mt-1">Ideal para quem está começando</p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {['Agendamentos ilimitados', 'Página pública personalizada', 'Gestão de clientes', 'Notificações WhatsApp', '1 profissional'].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-gray-700">
                    <div className="w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 text-emerald-500" strokeWidth={3} />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={`/planos?ciclo=${cicloPrecos}`}
                className="w-full text-center py-3.5 rounded-2xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:border-gray-300 hover:bg-gray-50 transition-all"
              >
                Começar grátis
              </Link>
            </div>

            {/* Pro */}
            <div data-animate data-delay="150" className="bg-rose-400 rounded-3xl p-8 flex flex-col relative overflow-hidden shadow-[0_16px_60px_rgba(251,113,133,0.3)]">
              <div aria-hidden className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10 pointer-events-none" />
              <div aria-hidden className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />

              <div className="relative flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xs font-bold text-white/80 uppercase tracking-widest">Pro</span>
                </div>
                <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">Mais popular</span>
              </div>

              <div className="relative mb-6">
                {cicloPrecos === 'mensal' ? (
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      {desconto ? (
                        <>
                          <span className="text-lg font-semibold text-white/50 line-through">R$89</span>
                          <span className="text-4xl font-bold text-white">{precoComDesconto('R$89', desconto)}</span>
                        </>
                      ) : (
                        <span className="text-4xl font-bold text-white">R$89</span>
                      )}
                      <span className="text-white/70 text-sm">/mês</span>
                    </div>
                    <p className="text-sm text-white/60 mt-1">Sem trial · R$89/mês</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-baseline gap-2">
                      {desconto ? (
                        <>
                          <span className="text-lg font-semibold text-white/50 line-through">R$855</span>
                          <span className="text-4xl font-bold text-white">{precoComDesconto('R$855', desconto)}</span>
                        </>
                      ) : (
                        <span className="text-4xl font-bold text-white">R$855</span>
                      )}
                      <span className="text-white/70 text-sm">/ano</span>
                      <span className="text-[11px] font-bold bg-white/25 text-white px-1.5 py-0.5 rounded-full">20% off</span>
                    </div>
                    <p className="text-sm text-white/60 mt-1">Sem trial · R$855/ano</p>
                    <p className="text-xs text-white/50 mt-0.5">R$71/mês equivalente</p>
                  </div>
                )}
                <p className="text-sm text-white/75 mt-1">Para estúdios em crescimento</p>
              </div>

              <ul className="relative space-y-3 mb-8 flex-1">
                {['Tudo do Plano Básico', 'Profissionais ilimitadas', 'Galeria de fotos e vídeos', 'Suporte prioritário', 'Novidades em primeira mão'].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-white/90">
                    <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={`/planos?ciclo=${cicloPrecos}&auto=pro`}
                className="relative w-full text-center py-3.5 rounded-2xl bg-white text-rose-500 font-bold text-sm hover:bg-rose-50 transition-all shadow-lg"
              >
                Assinar Pro
              </Link>
            </div>
          </div>

          {/* Cupom de desconto */}
          <div data-animate className="mt-8 flex flex-col items-center gap-3">
            {!cupomAberto ? (
              <button
                onClick={() => setCupomAberto(true)}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Tag className="w-3.5 h-3.5" />
                Tem um cupom?
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={cupomInput}
                    onChange={(e) => onCupomInputChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && aplicarCupom()}
                    placeholder="CÓDIGO DO CUPOM"
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-center uppercase tracking-widest w-48 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300 transition-all"
                    autoFocus
                  />
                  <button
                    onClick={aplicarCupom}
                    disabled={cupomStatus === 'loading' || !cupomInput.trim()}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {cupomStatus === 'loading' ? '...' : 'Aplicar'}
                  </button>
                </div>

                {cupomStatus === 'ok' && (
                  <p className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                    <Check className="w-4 h-4" strokeWidth={2.5} />
                    Cupom aplicado! Ele já aparece no preço acima — informe o mesmo código ao assinar.
                  </p>
                )}
                {cupomStatus === 'erro' && (
                  <p className="flex items-center gap-1.5 text-sm text-red-500">
                    <X className="w-4 h-4" strokeWidth={2.5} />
                    Cupom inválido ou expirado
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── INSTALAR APP ──────────────────────── */}
      <InstallAppSection />

      {/* ── CTA FINAL ─────────────────────────── */}
      <section className="relative z-[2] bg-white px-6 py-32">
        <div className="max-w-3xl mx-auto text-center">
          {/* Pink glow blob */}
          <div aria-hidden className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-rose-100/60 blur-3xl" />

          <div className="relative">
            <p data-animate className="text-rose-400 text-sm font-semibold uppercase tracking-widest mb-6">
              Comece hoje
            </p>
            <h2 data-animate data-delay="100" className="font-serif text-[clamp(2.5rem,6vw,4.5rem)] font-bold text-gray-900 leading-[1.08] tracking-tight mb-6">
              Sua agenda cheia
              <br />
              começa agora
            </h2>
            <p data-animate data-delay="200" className="text-gray-500 text-lg mb-12 max-w-xl mx-auto">
              Junte-se a profissionais de beleza que já economizam horas toda semana com agendamentos automáticos.
            </p>
            <div data-animate data-delay="300" className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/painel/cadastro"
                className="group flex items-center justify-center gap-2 bg-rose-400 hover:bg-rose-500 text-white px-8 py-4 rounded-2xl text-base font-bold transition-all shadow-[0_8px_30px_rgba(251,113,133,0.35)] hover:shadow-[0_8px_30px_rgba(251,113,133,0.5)] hover:-translate-y-0.5"
              >
                Criar conta grátis
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/n/demo"
                className="flex items-center justify-center gap-2 text-gray-600 hover:text-gray-900 px-6 py-4 rounded-2xl border border-gray-200 hover:border-gray-300 bg-white text-base font-medium transition-all"
              >
                Ver demo ao vivo
              </Link>
            </div>
            <p data-animate data-delay="400" className="text-sm text-gray-400 mt-8">
              30 dias grátis · Sem cartão de crédito · Cancele quando quiser
            </p>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <footer className="max-w-5xl mx-auto mt-32 pt-12 border-t border-gray-100">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <span className="font-serif text-xl font-bold text-rose-400">BelleBook</span>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <Link href="/planos" className="hover:text-gray-600 transition-colors">Planos</Link>
              <Link href="/n/demo" className="hover:text-gray-600 transition-colors">Demo</Link>
              <Link href="/painel/login" className="hover:text-gray-600 transition-colors">Entrar</Link>
              <Link href="/painel/cadastro" className="hover:text-gray-600 transition-colors">Cadastrar</Link>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-8 text-sm text-gray-400">
            <a
              href="https://wa.me/5531971192930"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-green-500 transition-colors"
            >
              <Phone className="w-4 h-4" />
              (31) 97119-2930
            </a>
            <a
              href="mailto:clickpaginasbusiness@gmail.com"
              className="flex items-center gap-2 hover:text-rose-400 transition-colors"
            >
              <Mail className="w-4 h-4" />
              clickpaginasbusiness@gmail.com
            </a>
          </div>

          <div className="flex items-center justify-center gap-3 mt-6 text-xs text-gray-400">
            <Link href="/termos" className="hover:text-gray-600 transition-colors">Termos de Uso</Link>
            <span className="text-gray-200">·</span>
            <Link href="/privacidade" className="hover:text-gray-600 transition-colors">Política de Privacidade</Link>
          </div>

          <p className="text-center text-xs text-gray-300 mt-8">
            © 2026 BelleBook · Feito com amor para profissionais de beleza
          </p>
        </footer>
      </section>
    </div>
  )
}
