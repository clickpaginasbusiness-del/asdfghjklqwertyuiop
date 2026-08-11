'use client'

import { useEffect, useRef, useState, type TouchEvent } from 'react'
import Link from 'next/link'
import { X, ArrowRight, Star, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

const TOTAL_TELAS = 5
const AUTOPLAY_MS = 5000
const VISTO_KEY = 'bb_onboarding_visto'

function marcarVisto() {
  try { localStorage.setItem(VISTO_KEY, '1') } catch {}
}

/* ── Mockup: celular (bezel + notch), reaproveitado nas telas 2 e 4 ── */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative bg-gray-900 rounded-[2.2rem] p-2.5 shadow-[0_30px_80px_rgba(0,0,0,0.18)]" style={{ width: 230 }}>
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-16 h-4 bg-gray-900 rounded-full z-10" />
      <div className="relative bg-gray-50 rounded-[1.7rem] overflow-hidden" style={{ height: 440 }}>
        {children}
      </div>
    </div>
  )
}

/* ── Tela 2: mockup da página pública ── */
function MockupPaginaPublica() {
  const servicos = [
    { nome: 'Manicure completa', preco: 'R$45' },
    { nome: 'Pedicure spa', preco: 'R$55' },
    { nome: 'Alongamento em gel', preco: 'R$120' },
  ]
  return (
    <div className="h-full flex flex-col bg-white">
      <div className="shrink-0 bg-gradient-to-b from-rose-100 to-white px-4 pt-7 pb-4 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full p-[2px]" style={{ background: 'linear-gradient(135deg, #fb7185, #e11d48)' }}>
          <div className="w-full h-full rounded-full bg-rose-100 border-2 border-white flex items-center justify-center">
            <span className="font-serif text-lg font-bold text-rose-500">A</span>
          </div>
        </div>
        <p className="font-serif text-sm font-bold text-gray-900 mt-2">Ana Nails Studio</p>
        <span className="inline-flex items-center gap-1 mt-1.5">
          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
          <span className="text-[10px] font-semibold text-gray-600">4.9</span>
        </span>
      </div>
      <div className="flex-1 min-h-0 px-3 pt-3 space-y-1.5">
        {servicos.map((s) => (
          <div key={s.nome} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
            <span className="text-[10px] font-medium text-gray-800">{s.nome}</span>
            <span className="text-[10px] font-bold text-rose-600 shrink-0">{s.preco}</span>
          </div>
        ))}
      </div>
      <div className="shrink-0 p-3">
        <div className="bg-rose-400 text-white text-center text-[11px] font-semibold rounded-lg py-2.5">
          Agendar agora
        </div>
      </div>
    </div>
  )
}

/* ── Tela 3: mockup de notificação push ── */
function MockupNotificacao() {
  return (
    <div className="bg-white rounded-2xl shadow-xl p-4 flex items-start gap-3 w-full max-w-[280px]">
      <div className="w-9 h-9 rounded-xl bg-rose-400 flex items-center justify-center shrink-0">
        <Bell className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-gray-900">BelleBook</p>
          <span className="text-[10px] text-gray-400 shrink-0">agora</span>
        </div>
        <p className="text-xs font-semibold text-gray-800 mt-1">Maria Silva agendou Manicure</p>
        <p className="text-[11px] text-gray-500 mt-0.5">Hoje às 14h00</p>
      </div>
    </div>
  )
}

/* ── Tela 4: mockup do painel/dashboard ── */
function MockupPainel() {
  const agendamentos = [
    { hora: '09:00', nome: 'Maria Silva', status: 'confirmado' as const },
    { hora: '11:30', nome: 'Fernanda Lima', status: 'confirmado' as const },
    { hora: '14:00', nome: 'Beatriz Santos', status: 'concluido' as const },
  ]
  return (
    <div className="h-full flex flex-col bg-gray-50 px-3 pt-7 pb-3">
      <p className="text-[10px] text-gray-400 mb-2">Hoje</p>
      <div className="grid grid-cols-2 gap-2 mb-3 shrink-0">
        <div className="bg-white rounded-xl p-2.5 border border-gray-100 shadow-sm">
          <p className="text-[7px] text-gray-400 uppercase tracking-wide font-medium">Agendamentos</p>
          <p className="text-base font-bold text-gray-900 leading-tight">4</p>
        </div>
        <div className="bg-white rounded-xl p-2.5 border border-gray-100 shadow-sm">
          <p className="text-[7px] text-gray-400 uppercase tracking-wide font-medium">Faturamento</p>
          <p className="text-base font-bold text-gray-900 leading-tight">R$320</p>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex-1 min-h-0">
        <div className="px-3 py-2 border-b border-gray-50">
          <p className="text-[10px] font-semibold text-gray-900">Agenda de hoje</p>
        </div>
        <div className="divide-y divide-gray-50">
          {agendamentos.map((a) => (
            <div key={a.hora} className="flex items-center gap-2 px-3 py-2">
              <div className="bg-rose-100 text-rose-700 text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0">{a.hora}</div>
              <span className="flex-1 min-w-0 text-[10px] font-medium text-gray-800 truncate">{a.nome}</span>
              <span className={cn(
                'text-[8px] font-semibold px-1.5 py-0.5 rounded-full shrink-0',
                a.status === 'concluido' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
              )}>
                {a.status === 'concluido' ? 'Concluído' : 'Confirmado'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Layout compartilhado das telas 2, 3 e 4: mockup em cima, título/subtítulo embaixo ── */
function TelaComMockup({ mockup, titulo, subtitulo }: { mockup: React.ReactNode; titulo: string; subtitulo: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 pt-16 pb-28 bg-white overflow-y-auto">
      {mockup}
      <div className="text-center mt-8 max-w-xs shrink-0">
        <h2 className="font-serif text-xl sm:text-2xl font-bold text-gray-900">{titulo}</h2>
        <p className="text-gray-500 text-sm mt-2 leading-relaxed">{subtitulo}</p>
      </div>
    </div>
  )
}

export default function OnboardingClient() {
  const [index, setIndex] = useState(0)
  const pausadoRef = useRef(false)
  const touchStartXRef = useRef<number | null>(null)

  // Chegar na tela final (CTA) — por auto-play, dot, "Pular" ou swipe — já
  // conta como "viu o onboarding", então os botões dessa tela (que saem do
  // app pra /painel/cadastro etc.) não voltam a mostrar o onboarding de novo.
  useEffect(() => {
    if (index === TOTAL_TELAS - 1) marcarVisto()
  }, [index])

  useEffect(() => {
    if (pausadoRef.current || index === TOTAL_TELAS - 1) return
    const id = setTimeout(() => setIndex((i) => Math.min(i + 1, TOTAL_TELAS - 1)), AUTOPLAY_MS)
    return () => clearTimeout(id)
  }, [index])

  function irPara(i: number) {
    pausadoRef.current = true
    setIndex(Math.max(0, Math.min(TOTAL_TELAS - 1, i)))
  }

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    pausadoRef.current = true
    touchStartXRef.current = e.touches[0]?.clientX ?? null
  }

  function handleTouchEnd(e: TouchEvent<HTMLDivElement>) {
    if (touchStartXRef.current === null) return
    const touch = e.changedTouches[0]
    const startX = touchStartXRef.current
    touchStartXRef.current = null
    if (!touch) return
    const deltaX = touch.clientX - startX
    const SWIPE_THRESHOLD = 40
    if (deltaX > SWIPE_THRESHOLD) irPara(index - 1)
    else if (deltaX < -SWIPE_THRESHOLD) irPara(index + 1)
  }

  const naUltimaTela = index === TOTAL_TELAS - 1

  return (
    <div className="fixed inset-0 bg-white overflow-hidden select-none">
      <div
        className="flex h-full transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* ── Tela 1: Boas-vindas ── */}
        <div className="w-full h-full shrink-0">
          <div
            className="h-full flex flex-col items-center justify-center text-center px-8"
            style={{ background: 'linear-gradient(160deg, #fce4ec, #f9a8c9)' }}
          >
            <span className="font-serif text-5xl sm:text-6xl font-bold text-rose-600 mb-8">BelleBook</span>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900 leading-snug">Bem-vinda ao BelleBook</h1>
            <p className="text-rose-800/80 text-sm sm:text-base mt-3 max-w-xs">
              A plataforma feita para profissionais de beleza crescerem
            </p>
          </div>
        </div>

        {/* ── Tela 2: Página pública ── */}
        <div className="w-full h-full shrink-0">
          <TelaComMockup
            mockup={<PhoneFrame><MockupPaginaPublica /></PhoneFrame>}
            titulo="Sua página profissional"
            subtitulo="Suas clientes agendam pelo link, sem te chamar no WhatsApp"
          />
        </div>

        {/* ── Tela 3: Notificações ── */}
        <div className="w-full h-full shrink-0">
          <TelaComMockup
            mockup={<MockupNotificacao />}
            titulo="Saiba na hora"
            subtitulo="Receba um aviso assim que alguém agendar, confirmar ou cancelar"
          />
        </div>

        {/* ── Tela 4: Painel ── */}
        <div className="w-full h-full shrink-0">
          <TelaComMockup
            mockup={<PhoneFrame><MockupPainel /></PhoneFrame>}
            titulo="Tudo sob controle"
            subtitulo="Agendamentos, clientes e faturamento em um só lugar"
          />
        </div>

        {/* ── Tela 5: CTA ── */}
        <div className="w-full h-full shrink-0">
          <div className="h-full flex flex-col items-center justify-center text-center px-8" style={{ backgroundColor: '#f472b6' }}>
            <span className="font-serif text-4xl font-bold text-white mb-6">BelleBook</span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white">30 dias grátis</h2>
            <p className="text-white/90 text-sm mt-2 max-w-xs">Sem cartão de crédito. Cancele quando quiser.</p>

            <div className="mt-10 w-full max-w-xs space-y-4">
              <Link
                href="/painel/cadastro"
                onClick={marcarVisto}
                className="block bg-white text-rose-600 font-semibold text-sm rounded-2xl py-3.5 shadow-lg hover:brightness-95 transition-all"
              >
                Criar minha conta grátis
              </Link>
              <Link
                href="/painel/login"
                onClick={marcarVisto}
                className="block text-white text-sm font-semibold hover:opacity-80 transition-opacity"
              >
                Já tenho conta → Entrar
              </Link>
              <Link
                href="/n/demo"
                onClick={marcarVisto}
                className="block text-white/70 text-xs hover:opacity-80 transition-opacity"
              >
                Ver como funciona
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Pular — direto pra tela final */}
      {!naUltimaTela && (
        <button
          onClick={() => irPara(TOTAL_TELAS - 1)}
          className="absolute top-5 right-5 z-20 flex items-center gap-1 bg-black/10 backdrop-blur-sm text-gray-700 text-xs font-semibold rounded-full pl-3 pr-2 py-1.5 hover:bg-black/15 transition-colors"
        >
          Pular
          <X className="w-3 h-3" />
        </button>
      )}

      {/* Próximo */}
      {!naUltimaTela && (
        <button
          onClick={() => irPara(index + 1)}
          aria-label="Próximo"
          className="absolute bottom-8 right-5 z-20 w-14 h-14 rounded-full bg-rose-500 text-white shadow-lg flex items-center justify-center hover:bg-rose-600 transition-colors"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      )}

      {/* Dots — acima do botão Próximo, pra não colidir com ele */}
      {!naUltimaTela && (
        <div className="absolute bottom-24 inset-x-0 flex items-center justify-center gap-2 z-20">
          {Array.from({ length: TOTAL_TELAS }).map((_, i) => (
            <button
              key={i}
              onClick={() => irPara(i)}
              aria-label={`Ir para tela ${i + 1}`}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index ? 'w-6 bg-rose-500' : 'w-1.5 bg-gray-300'
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}
