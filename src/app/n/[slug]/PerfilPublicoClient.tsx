'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import {
  formatCurrency, formatDateTime, formatDateShort, generateTimeSlots,
  maskTelefone, cleanTelefone, buildWhatsappUrl,
} from '@/lib/utils'
import {
  Clock, CheckCircle2, Calendar, ChevronLeft, ChevronRight, X,
  UserCircle2, MessageCircle, AtSign, MapPin, Star, Scissors,
  CalendarPlus, Share2, Quote,
} from 'lucide-react'
import type { Prestadora, Servico, GaleriaItem, Agendamento, Profissional, HorarioFuncionamento, Avaliacao } from '@/lib/types'
import { getTema } from '@/lib/theme'
import toast from 'react-hot-toast'
import { format, addDays, startOfDay, isSameDay, isToday, isBefore, getDay, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export type ServicoComProfissionais = Servico & {
  servico_profissionais: { profissional_id: string }[]
}

interface Props {
  prestadora: Prestadora
  servicos: ServicoComProfissionais[]
  galeria: GaleriaItem[]
  diasBloqueados: string[]
  profissionais: Profissional[]
  horariosFuncionamento: HorarioFuncionamento[]
  avaliacoes: Avaliacao[]
  isDemo?: boolean
}

function buildGoogleCalendarUrl(a: Agendamento, prestadoraNome: string): string {
  const inicio = new Date(a.data_hora)
  const duracao = a.servicos?.duracao_minutos ?? 30
  const fim = new Date(inicio.getTime() + duracao * 60000)
  const toUTC = (d: Date) => format(d, "yyyyMMdd'T'HHmmss")
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${a.servicos?.nome} - ${prestadoraNome}`,
    dates: `${toUTC(inicio)}/${toUTC(fim)}`,
    details: `Agendamento de ${a.servicos?.nome}${a.profissionais ? ` com ${a.profissionais.nome}` : ''} - ${prestadoraNome}`,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

type Step = 'servico' | 'profissional' | 'data' | 'horario' | 'cliente' | 'confirmado'

function formatHora(h: string): string {
  const [hora, min] = h.split(':')
  return min === '00' ? `${parseInt(hora)}h` : `${parseInt(hora)}h${min}`
}

export default function PerfilPublicoClient({
  prestadora, servicos, galeria, diasBloqueados, profissionais, horariosFuncionamento, avaliacoes, isDemo = false,
}: Props) {
  const temMultiplasProfissionais = profissionais.length >= 2

  const [step, setStep] = useState<Step>('servico')
  const [servicoSelecionado, setServicoSelecionado] = useState<ServicoComProfissionais | null>(null)
  const [profissionalSelecionada, setProfissionalSelecionada] = useState<Profissional | null>(
    profissionais.length === 1 ? profissionais[0] : null
  )

  const profissionaisDoServico = useMemo(() => {
    const ids = servicoSelecionado?.servico_profissionais?.map((sp) => sp.profissional_id) ?? []
    // Sem restrição cadastrada → serviço disponível para todas
    return ids.length === 0 ? profissionais : profissionais.filter((p) => ids.includes(p.id))
  }, [servicoSelecionado, profissionais])
  const [dataSelecionada, setDataSelecionada] = useState<Date | null>(null)
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null)
  const [agendamentosExistentes, setAgendamentosExistentes] = useState<{start: number; end: number}[]>([])
  const [loadingHorarios, setLoadingHorarios] = useState(false)
  const [horasDodia, setHorasDodia] = useState({
    abertura: prestadora.hora_abertura,
    fechamento: prestadora.hora_fechamento,
  })

  const [agendando, setAgendando] = useState(false)
  const [agendamentoFeito, setAgendamentoFeito] = useState<Agendamento | null>(null)

  const [loginModal, setLoginModal] = useState(false)
  const [loginStep, setLoginStep] = useState<'telefone' | 'codigo'>('telefone')
  const [telefoneLogin, setTelefoneLogin] = useState('')
  const [codigoLogin, setCodigoLogin] = useState('')
  const [nomeLogin, setNomeLogin] = useState('')
  const [clienteExistenteLogin, setClienteExistenteLogin] = useState(true)
  const [enviandoCodigo, setEnviandoCodigo] = useState(false)
  const [verificandoCodigo, setVerificandoCodigo] = useState(false)
  const [pendingBooking, setPendingBooking] = useState(false)
  const [clienteLogado, setClienteLogado] = useState<{ id: string; nome: string; telefone: string } | null>(null)
  const [meusAgendamentos, setMeusAgendamentos] = useState<Agendamento[]>([])
  const [meusAgendamentosModal, setMeusAgendamentosModal] = useState(false)

  /* Exibe: confirmados futuros + últimos 7 dias (não deleta do banco) */
  const meusAgendamentosVisiveis = useMemo(() => {
    const agora = new Date()
    const limiteHistorico = subDays(agora, 7)
    return meusAgendamentos.filter((a) => {
      const d = new Date(a.data_hora)
      const isFuturoConfirmado = a.status === 'confirmado' && d > agora
      const isRecente = d >= limiteHistorico
      return isFuturoConfirmado || isRecente
    })
  }, [meusAgendamentos])

  const [galeriaIndex, setGaleriaIndex] = useState<number | null>(null)

  const [weekOffset, setWeekOffset] = useState(0)
  const today = startOfDay(new Date())
  const weekStart = addDays(today, weekOffset * 7)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  /* Scroll-triggered fade-in animations */
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
      { threshold: 0.1, rootMargin: '0px 0px -20px 0px' }
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  /* Registra uma visita por sessao (para relatorios de conversao) */
  useEffect(() => {
    if (isDemo) return
    const key = `visita_${prestadora.id}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    createClient().from('visitas_pagina').insert({ prestadora_id: prestadora.id })
  }, [isDemo, prestadora.id])

  async function carregarMeusAgendamentos(clienteId: string) {
    const supabase = createClient()
    const { data: ags } = await supabase
      .from('agendamentos')
      .select('*, servicos(*), profissionais(*)')
      .eq('cliente_id', clienteId)
      .eq('prestadora_id', prestadora.id)
      .order('data_hora', { ascending: false })
      .limit(10)
    setMeusAgendamentos(ags ?? [])
  }

  /* Restaura sessao do cliente a partir do token salvo (valido por 30 dias) */
  useEffect(() => {
    if (isDemo) return
    const token = localStorage.getItem('clienteToken')
    if (!token) return
    fetch('/api/clientes/auth/sessao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ cliente }) => {
        setClienteLogado(cliente)
        carregarMeusAgendamentos(cliente.id)
      })
      .catch(() => localStorage.removeItem('clienteToken'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo])

  /* Today's opening hours */
  const diaHoje = getDay(new Date())
  const horarioHoje = horariosFuncionamento.find((h) => h.dia_semana === diaHoje)
  const aberturaHoje = horarioHoje?.hora_abertura ?? prestadora.hora_abertura
  const fechamentoHoje = horarioHoje?.hora_fechamento ?? prestadora.hora_fechamento
  const abertoHoje = horarioHoje ? horarioHoje.ativo : true

  function getHorarioDia(d: Date): HorarioFuncionamento | undefined {
    return horariosFuncionamento.find((h) => h.dia_semana === getDay(d))
  }

  function isDiaDesativado(d: Date): boolean {
    if (isBefore(d, today)) return true
    if (diasBloqueados.includes(format(d, 'yyyy-MM-dd'))) return true
    const horario = getHorarioDia(d)
    if (horario && !horario.ativo) return true
    if (profissionalSelecionada?.dias_semana && !profissionalSelecionada.dias_semana.includes(getDay(d))) return true
    return false
  }

  function computeHorasDia(d: Date, prof: Profissional | null) {
    const horario = getHorarioDia(d)
    return {
      abertura: prof?.hora_abertura ?? horario?.hora_abertura ?? prestadora.hora_abertura,
      fechamento: prof?.hora_fechamento ?? horario?.hora_fechamento ?? prestadora.hora_fechamento,
    }
  }

  function selecionarServico(s: ServicoComProfissionais) {
    setServicoSelecionado(s)
    setProfissionalSelecionada(profissionais.length === 1 ? profissionais[0] : null)
    if (temMultiplasProfissionais) {
      setStep('profissional')
    } else {
      setStep('data')
    }
  }

  function selecionarProfissional(p: Profissional) {
    setProfissionalSelecionada(p)
    setDataSelecionada(null)
    setHorarioSelecionado(null)
    setStep('data')
  }

  async function selecionarData(d: Date) {
    setDataSelecionada(d)
    setHorarioSelecionado(null)
    if (!servicoSelecionado) return

    const horas = computeHorasDia(d, profissionalSelecionada)
    setHorasDodia(horas)

    setLoadingHorarios(true)

    if (isDemo) {
      setTimeout(() => {
        setAgendamentosExistentes([])
        setLoadingHorarios(false)
        setStep('horario')
      }, 350)
      return
    }

    const supabase = createClient()
    const inicio = startOfDay(d).toISOString()
    const fim = addDays(startOfDay(d), 1).toISOString()

    let query = supabase
      .from('agendamentos')
      .select('data_hora, servicos(duracao_minutos)')
      .eq('prestadora_id', prestadora.id)
      .gte('data_hora', inicio)
      .lt('data_hora', fim)
      .eq('status', 'confirmado')

    if (profissionalSelecionada) {
      query = query.eq('profissional_id', profissionalSelecionada.id)
    }

    const { data } = await query
    const bookings = (data ?? []).map((a: any) => {
      const startMs = new Date(a.data_hora).getTime()
      const durMin = (a.servicos as {duracao_minutos: number} | null)?.duracao_minutos ?? 30
      return { start: startMs, end: startMs + durMin * 60000 }
    })
    setAgendamentosExistentes(bookings)
    setLoadingHorarios(false)
    setStep('horario')
  }

  function loginDemoInstantaneo() {
    setClienteLogado({ id: 'demo-cliente', nome: 'Cliente Demo', telefone: '11999999999' })
    toast('Login simulado (modo demonstração).')
  }

  function fecharLoginModal() {
    setLoginModal(false)
    setLoginStep('telefone')
    setCodigoLogin('')
    setPendingBooking(false)
  }

  async function enviarCodigo() {
    if (cleanTelefone(telefoneLogin).length < 10) {
      toast.error('Telefone inválido')
      return
    }
    setEnviandoCodigo(true)
    try {
      const res = await fetch('/api/clientes/auth/enviar-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: telefoneLogin }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao enviar código')
        return
      }
      setClienteExistenteLogin(data.clienteExistente)
      setLoginStep('codigo')
    } finally {
      setEnviandoCodigo(false)
    }
  }

  async function verificarCodigo() {
    setVerificandoCodigo(true)
    try {
      const res = await fetch('/api/clientes/auth/verificar-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefone: telefoneLogin,
          codigo: codigoLogin,
          nome: clienteExistenteLogin ? undefined : nomeLogin,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Código inválido')
        return
      }
      localStorage.setItem('clienteToken', data.token)
      setClienteLogado(data.cliente)
      await carregarMeusAgendamentos(data.cliente.id)
      const irParaAgendamento = pendingBooking
      fecharLoginModal()
      toast.success(`Olá, ${data.cliente.nome}!`)
      if (irParaAgendamento) setStep('cliente')
    } finally {
      setVerificandoCodigo(false)
    }
  }

  async function confirmarAgendamento() {
    if (!servicoSelecionado || !dataSelecionada || !horarioSelecionado) return
    if (!clienteLogado) {
      toast.error('Faça login para agendar')
      return
    }

    const [h, m] = horarioSelecionado.split(':').map(Number)
    const dataHora = new Date(dataSelecionada)
    dataHora.setHours(h, m, 0, 0)

    if (isDemo) {
      setAgendando(true)
      const servico = servicoSelecionado
      const prof = profissionalSelecionada
      setTimeout(() => {
        setAgendamentoFeito({
          id: 'demo',
          prestadora_id: 'demo',
          profissional_id: prof?.id ?? null,
          servico_id: servico.id,
          cliente_id: 'demo-cliente',
          data_hora: dataHora.toISOString(),
          status: 'confirmado',
          cancelado_por: null,
          arquivado: false,
          created_at: new Date().toISOString(),
          servicos: servico,
          clientes: { id: 'demo-cliente', nome: clienteLogado.nome, telefone: clienteLogado.telefone, verificado_em: null, created_at: '' },
          profissionais: prof ?? undefined,
        })
        setStep('confirmado')
        setAgendando(false)
      }, 900)
      return
    }

    setAgendando(true)
    const token = localStorage.getItem('clienteToken')
    const res = await fetch('/api/agendamentos/criar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        prestadoraId: prestadora.id,
        servicoId: servicoSelecionado.id,
        profissionalId: profissionalSelecionada?.id ?? null,
        dataHora: dataHora.toISOString(),
      }),
    })
    const data = await res.json()
    setAgendando(false)

    if (!res.ok) {
      toast.error(data.error ?? 'Erro ao agendar. Tente novamente.')
      return
    }

    setAgendamentoFeito(data.agendamento)
    setStep('confirmado')
  }

  async function cancelarMeuAgendamento(id: string) {
    const token = localStorage.getItem('clienteToken')
    const res = await fetch('/api/agendamentos/cancelar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, agendamentoId: id }),
    })
    if (!res.ok) {
      toast.error('Erro ao cancelar')
      return
    }
    setMeusAgendamentos((prev) => prev.map((a) => a.id === id ? { ...a, status: 'cancelado' as const } : a))
    toast.success('Agendamento cancelado')
  }

  function resetarFluxo() {
    setStep('servico')
    setServicoSelecionado(null)
    setProfissionalSelecionada(profissionais.length === 1 ? profissionais[0] : null)
    setDataSelecionada(null)
    setHorarioSelecionado(null)
    setAgendamentoFeito(null)
  }

  const horariosDisponiveis = servicoSelecionado && dataSelecionada
    ? generateTimeSlots(horasDodia.abertura, horasDodia.fechamento, servicoSelecionado.duracao_minutos)
        .filter((h) => {
          const [hh, mm] = h.split(':').map(Number)
          const slotStart = new Date(
            dataSelecionada.getFullYear(), dataSelecionada.getMonth(), dataSelecionada.getDate(), hh, mm
          ).getTime()
          const slotEnd = slotStart + servicoSelecionado.duracao_minutos * 60000
          // Bloqueia se o novo slot sobrepõe qualquer agendamento existente
          return !agendamentosExistentes.some(({ start, end }) => slotStart < end && slotEnd > start)
        })
        .filter((h) => {
          if (!isToday(dataSelecionada)) return true
          const [hh, mm] = h.split(':').map(Number)
          const slotDate = new Date()
          slotDate.setHours(hh, mm, 0, 0)
          return !isBefore(slotDate, new Date())
        })
    : []

  const progressSteps = temMultiplasProfissionais
    ? ['Serviço', 'Profissional', 'Data', 'Horário', 'Confirmar']
    : ['Serviço', 'Data', 'Horário', 'Confirmar']

  const allSteps: Step[] = temMultiplasProfissionais
    ? ['servico', 'profissional', 'data', 'horario', 'cliente']
    : ['servico', 'data', 'horario', 'cliente']

  const currentStepIndex = allSteps.indexOf(step)

  const tema = getTema(prestadora.cor_tema)

  const igHandle = prestadora.instagram?.replace('@', '')
  const waUrl = prestadora.whatsapp
    ? buildWhatsappUrl(prestadora.whatsapp, 'Olá! Gostaria de saber mais sobre os serviços 💅')
    : null

  const mediaAvaliacoes = avaliacoes.length > 0
    ? avaliacoes.reduce((acc, a) => acc + a.nota, 0) / avaliacoes.length
    : null

  const avaliacoesDestaque = avaliacoes.filter((a) => a.destaque)
  const avaliacoesExibidas = avaliacoesDestaque.length > 0
    ? avaliacoesDestaque.slice(0, 3)
    : avaliacoes.slice(0, 6)

  async function compartilharAgendamento() {
    if (!agendamentoFeito) return
    const texto = `Acabei de agendar ${agendamentoFeito.servicos?.nome} com ${prestadora.nome}! Agenda você também:`
    const url = `${window.location.origin}/n/${prestadora.slug}`
    if (navigator.share) {
      try {
        await navigator.share({ title: prestadora.nome, text: texto, url })
      } catch {
        // usuária cancelou o compartilhamento — não é um erro
      }
    } else {
      await navigator.clipboard.writeText(`${texto} ${url}`)
      toast.success('Link copiado!')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── HEADER ─────────────────────────────── */}
      <div
        className="relative overflow-hidden pb-14"
        style={{ background: `linear-gradient(to bottom, ${tema.hexHeader}, white)` }}
      >
        {/* Decorative blobs */}
        <div aria-hidden className="absolute -top-20 -right-20 w-72 h-72 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: tema.hex, opacity: 0.18 }} />
        <div aria-hidden className="absolute top-10 -left-16 w-56 h-56 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: tema.hex, opacity: 0.12 }} />

        <div className="max-w-2xl mx-auto px-4 pt-8">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-2 flex-wrap mb-10">
            <span className="font-serif text-xl font-bold text-rose-400 shrink-0">BelleBook</span>
            <div className="flex gap-2 flex-wrap">
              {clienteLogado && (
                <Button variant="outline" size="sm" onClick={() => setMeusAgendamentosModal(true)}>
                  <span className="hidden sm:inline">Meus agendamentos</span>
                  <span className="sm:hidden">Agendamentos</span>
                </Button>
              )}
              <button
                onClick={() => {
                  if (clienteLogado) return
                  if (isDemo) { loginDemoInstantaneo(); return }
                  setLoginModal(true)
                }}
                className="px-3 py-1.5 min-h-11 text-sm font-semibold rounded-xl bg-white border-2 hover:brightness-95 transition-all shadow-sm"
                style={{ borderColor: tema.hex, color: tema.hexDark }}
              >
                {clienteLogado ? clienteLogado.nome.split(' ')[0] : 'Entrar'}
              </button>
            </div>
          </div>

          {/* Profile info */}
          <div className="flex flex-col items-center text-center gap-5">
            {/* Photo with gradient ring */}
            <div className="relative">
              <div
                className="w-28 h-28 rounded-full p-[3px] shadow-xl"
                style={{ background: `linear-gradient(135deg, ${tema.hex}, ${tema.hexDark})` }}
              >
                <div className="w-full h-full rounded-full overflow-hidden border-2 border-white bg-rose-100">
                  {prestadora.foto_url ? (
                    <Image
                      src={prestadora.foto_url}
                      alt={prestadora.nome}
                      width={112}
                      height={112}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white font-bold text-4xl font-serif">
                      {prestadora.nome.charAt(0)}
                    </div>
                  )}
                </div>
              </div>
              {/* Online indicator */}
              <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-white shadow" />
            </div>

            <div className="space-y-3">
              <h1 className="font-serif text-4xl font-bold text-gray-900 leading-tight">{prestadora.nome}</h1>

              {/* 24h + avaliações badges */}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-100 text-amber-600 rounded-full px-4 py-1.5 text-xs font-semibold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  Agendamento online 24h
                </span>
                {mediaAvaliacoes !== null && (
                  <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-100 text-amber-600 rounded-full px-4 py-1.5 text-xs font-semibold">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    {mediaAvaliacoes.toFixed(1)} ({avaliacoes.length} avaliaç{avaliacoes.length > 1 ? 'ões' : 'ão'})
                  </span>
                )}
              </div>

              {prestadora.bio && (
                <p className="text-gray-500 text-sm max-w-md leading-relaxed">{prestadora.bio}</p>
              )}

              {/* Opening hours */}
              {abertoHoje && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" style={{ color: tema.hex }} />
                  Hoje: {formatHora(aberturaHoje)} – {formatHora(fechamentoHoje)}
                </div>
              )}

              {/* Professionals count */}
              {profissionais.length > 0 && (
                <div className="flex items-center justify-center gap-1 text-xs text-gray-400">
                  <UserCircle2 className="w-3.5 h-3.5" />
                  {profissionais.length} profissional{profissionais.length > 1 ? 'is' : ''}
                </div>
              )}
            </div>
          </div>

          {/* Team avatars */}
          {temMultiplasProfissionais && (
            <div className="flex justify-center gap-3 mt-8">
              {profissionais.map((p) => (
                <div key={p.id} className="flex flex-col items-center gap-1">
                  <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white shadow-md bg-rose-100">
                    {p.foto_url ? (
                      <Image src={p.foto_url} alt={p.nome} width={44} height={44} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm font-bold font-serif" style={{ color: tema.hex }}>
                        {p.nome.charAt(0)}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500">{p.nome.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT ───────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-10">

        {/* Map card */}
        {prestadora.endereco && (
          <div data-animate className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: tema.hexLight }}>
              <MapPin className="w-5 h-5" style={{ color: tema.hex }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Localização</p>
              <p className="text-sm text-gray-800 font-medium truncate">{prestadora.endereco}</p>
            </div>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(prestadora.endereco)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1 text-xs font-semibold hover:brightness-90 transition-all whitespace-nowrap"
              style={{ color: tema.hexDark }}
            >
              Como chegar
              <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Gallery */}
        {galeria.length > 0 && (
          <section data-animate>
            <h2 className="font-serif text-xl font-semibold text-gray-900 mb-4">Trabalhos</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {galeria.slice(0, 9).map((item, i) => (
                <div
                  key={item.id}
                  className="aspect-square rounded-2xl overflow-hidden bg-gray-100 cursor-pointer relative group"
                  onClick={() => setGaleriaIndex(i)}
                >
                  {item.tipo === 'video' ? (
                    <video
                      src={item.url}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      muted
                    />
                  ) : (
                    /* Inner div for scale — absolute fills parent, Image fills this div */
                    <div className="absolute inset-0 transition-transform duration-300 group-hover:scale-110">
                      <Image src={item.url} alt="Trabalho" fill className="object-cover" sizes="33vw" />
                    </div>
                  )}
                  {/* Subtle overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" aria-hidden />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Avaliações */}
        {avaliacoes.length > 0 && (
          <section data-animate>
            <h2 className="font-serif text-xl font-semibold text-gray-900 mb-4">O que dizem sobre mim</h2>
            <div className="space-y-3">
              {avaliacoesExibidas.map((av) => (
                <div key={av.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${i < av.nota ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] text-gray-400">{formatDateShort(av.created_at)}</span>
                  </div>
                  {av.comentario && (
                    <p className="text-sm text-gray-600 leading-relaxed flex gap-1.5">
                      <Quote className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: tema.hex }} />
                      {av.comentario}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Booking flow */}
        <section data-animate>
          <h2 className="font-serif text-xl font-semibold text-gray-900 mb-4">Agendar</h2>

          {step === 'confirmado' && agendamentoFeito ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-5">
              <div
                className="w-20 h-20 mx-auto rounded-full flex items-center justify-center animate-check-pop"
                style={{ backgroundColor: tema.hexLight }}
              >
                <CheckCircle2 className="w-12 h-12" style={{ color: tema.hex }} />
              </div>
              <div>
                <h3 className="font-serif text-2xl font-bold text-gray-900">Agendado!</h3>
                <p className="text-sm text-gray-400 mt-1">Te esperamos, {agendamentoFeito.clientes?.nome?.split(' ')[0]}!</p>
              </div>
              <div className="rounded-xl p-4 text-sm text-left space-y-2" style={{ backgroundColor: tema.hexLight }}>
                <div className="flex justify-between">
                  <span className="text-gray-500">Serviço</span>
                  <span className="font-medium">{agendamentoFeito.servicos?.nome}</span>
                </div>
                {agendamentoFeito.profissionais && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Profissional</span>
                    <span className="font-medium">{agendamentoFeito.profissionais.nome}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Data e hora</span>
                  <span className="font-medium">{formatDateTime(agendamentoFeito.data_hora)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Valor</span>
                  <span className="font-medium" style={{ color: tema.hexDark }}>{formatCurrency(agendamentoFeito.servicos?.preco ?? 0)}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <a
                  href={buildGoogleCalendarUrl(agendamentoFeito, prestadora.nome)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <CalendarPlus className="w-4 h-4" />
                  Adicionar ao Google Calendar
                </a>
                <button
                  onClick={compartilharAgendamento}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  Compartilhar
                </button>
              </div>

              <Button variant="outline" onClick={resetarFluxo} className="w-full">
                Fazer outro agendamento
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Progress */}
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2 flex-wrap">
                {progressSteps.map((label, i) => {
                  const active = i <= currentStepIndex
                  return (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className={active ? 'font-medium' : ''} style={active ? { color: tema.hexDark } : undefined}>{label}</span>
                      {i < progressSteps.length - 1 && (
                        <div
                          className="h-px w-3"
                          style={{ backgroundColor: active && i < currentStepIndex ? tema.hex : '#e5e7eb' }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Step 1: Service */}
              {step === 'servico' && (
                <div className="space-y-3">
                  {servicos.length === 0 ? (
                    <p className="text-center text-gray-400 py-8 text-sm">Nenhum serviço disponível</p>
                  ) : (
                    servicos.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => selecionarServico(s)}
                        className="bg-white border border-gray-100 rounded-2xl p-4 cursor-pointer hover:shadow-md transition-all duration-200 group"
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = tema.hex }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '' }}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors" style={{ backgroundColor: tema.hexLight }}>
                            <Scissors className="w-5 h-5" style={{ color: tema.hex }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900">{s.nome}</h4>
                            {s.descricao && <p className="text-xs text-gray-500 mt-0.5 truncate">{s.descricao}</p>}
                            <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                              <Clock className="w-3 h-3" />
                              {s.duracao_minutos} min
                            </div>
                          </div>
                          <span className="font-bold text-lg shrink-0" style={{ color: tema.hexDark }}>{formatCurrency(s.preco)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Step 2: Professional */}
              {step === 'profissional' && servicoSelecionado && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setStep('servico')} className="text-gray-400 hover:text-gray-600">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h3 className="font-medium text-gray-900">Escolha a profissional</h3>
                    <Badge className="ml-auto" style={{ backgroundColor: tema.hexLight, color: tema.hexDark }}>{servicoSelecionado.nome}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {profissionaisDoServico.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => selecionarProfissional(p)}
                        className="flex flex-col items-center gap-3 p-4 rounded-2xl border border-gray-100 transition-all text-center group"
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = tema.hex; e.currentTarget.style.backgroundColor = tema.hexLight }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.backgroundColor = '' }}
                      >
                        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow bg-rose-100 transition-all">
                          {p.foto_url ? (
                            <Image src={p.foto_url} alt={p.nome} width={64} height={64} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl font-bold font-serif" style={{ color: tema.hex }}>
                              {p.nome.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{p.nome}</p>
                          {p.bio && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{p.bio}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Date */}
              {step === 'data' && servicoSelecionado && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      onClick={() => setStep(temMultiplasProfissionais ? 'profissional' : 'servico')}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h3 className="font-medium text-gray-900">{servicoSelecionado.nome}</h3>
                      {profissionalSelecionada && (
                        <p className="text-xs" style={{ color: tema.hex }}>com {profissionalSelecionada.nome}</p>
                      )}
                    </div>
                    <Badge className="ml-auto" style={{ backgroundColor: tema.hexLight, color: tema.hexDark }}>{formatCurrency(servicoSelecionado.preco)}</Badge>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <button
                      onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                      disabled={weekOffset === 0}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-medium text-gray-700">
                      {format(weekStart, "MMMM yyyy", { locale: ptBR })}
                    </span>
                    <button onClick={() => setWeekOffset(weekOffset + 1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {weekDays.map((d) => {
                      const desativado = isDiaDesativado(d)
                      const selecionado = dataSelecionada && isSameDay(d, dataSelecionada)
                      return (
                        <button
                          key={d.toISOString()}
                          disabled={desativado}
                          onClick={() => selecionarData(d)}
                          className={`flex flex-col items-center py-2 rounded-xl transition-all text-xs font-medium
                            ${desativado ? 'opacity-30 cursor-not-allowed' : ''}
                            ${selecionado ? 'text-white' : 'text-gray-700'}
                            ${isToday(d) && !selecionado ? 'border' : ''}
                          `}
                          style={{
                            backgroundColor: selecionado ? tema.hex : !desativado ? undefined : undefined,
                            borderColor: isToday(d) && !selecionado ? tema.hex : undefined,
                          }}
                          onMouseEnter={(e) => { if (!desativado && !selecionado) e.currentTarget.style.backgroundColor = tema.hexLight }}
                          onMouseLeave={(e) => { if (!desativado && !selecionado) e.currentTarget.style.backgroundColor = '' }}
                        >
                          <span className="text-[10px] text-current opacity-70 mb-0.5">
                            {format(d, 'EEE', { locale: ptBR }).slice(0, 3)}
                          </span>
                          {format(d, 'd')}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Step 4: Time */}
              {step === 'horario' && servicoSelecionado && dataSelecionada && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => setStep('data')} className="text-gray-400 hover:text-gray-600">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h3 className="font-medium text-gray-900">{servicoSelecionado.nome}</h3>
                      <p className="text-xs text-gray-400">
                        {format(dataSelecionada, "EEEE, d 'de' MMMM", { locale: ptBR })}
                        {profissionalSelecionada && <span style={{ color: tema.hex }}> · {profissionalSelecionada.nome}</span>}
                      </p>
                    </div>
                  </div>

                  {loadingHorarios ? (
                    <div className="py-8 text-center text-gray-400 text-sm">Carregando horários...</div>
                  ) : horariosDisponiveis.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-sm">
                      <Calendar className="w-6 h-6 mx-auto mb-2 opacity-40" />
                      Sem horários disponíveis neste dia
                      {profissionalSelecionada && temMultiplasProfissionais && (
                        <p className="text-xs mt-1">
                          <button
                            onClick={() => setStep('profissional')}
                            className="text-rose-400 hover:underline"
                          >
                            Tentar outra profissional
                          </button>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {horariosDisponiveis.map((h) => {
                        const selecionadoSlot = horarioSelecionado === h
                        return (
                          <button
                            key={h}
                            onClick={() => {
                              setHorarioSelecionado(h)
                              if (clienteLogado) { setStep('cliente'); return }
                              if (isDemo) { loginDemoInstantaneo(); setStep('cliente'); return }
                              setPendingBooking(true)
                              setLoginModal(true)
                            }}
                            className={`py-2.5 rounded-xl text-sm font-medium transition-all border ${
                              selecionadoSlot ? 'text-white' : 'bg-white border-gray-200 text-gray-700'
                            }`}
                            style={selecionadoSlot ? { backgroundColor: tema.hex, borderColor: tema.hex } : undefined}
                            onMouseEnter={(e) => { if (!selecionadoSlot) { e.currentTarget.style.borderColor = tema.hex; e.currentTarget.style.backgroundColor = tema.hexLight } }}
                            onMouseLeave={(e) => { if (!selecionadoSlot) { e.currentTarget.style.borderColor = ''; e.currentTarget.style.backgroundColor = '' } }}
                          >
                            {h}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Client data */}
              {step === 'cliente' && servicoSelecionado && dataSelecionada && horarioSelecionado && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <button onClick={() => setStep('horario')} className="text-gray-400 hover:text-gray-600">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h3 className="font-medium text-gray-900">Seus dados</h3>
                  </div>

                  <div className="rounded-xl p-3 text-sm space-y-1" style={{ backgroundColor: tema.hexLight }}>
                    <div className="flex justify-between text-gray-600">
                      <span>{servicoSelecionado.nome}</span>
                      <span className="font-medium">{formatCurrency(servicoSelecionado.preco)}</span>
                    </div>
                    {profissionalSelecionada && (
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: tema.hex }}>
                        <UserCircle2 className="w-3 h-3" />
                        {profissionalSelecionada.nome}
                      </div>
                    )}
                    <div className="text-xs text-gray-400">
                      {format(dataSelecionada, "d 'de' MMMM", { locale: ptBR })} às {horarioSelecionado}
                    </div>
                  </div>

                  {clienteLogado ? (
                    <>
                      <div className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2.5 text-sm">
                        <span className="text-gray-600">
                          Agendando como <span className="font-medium text-gray-900">{clienteLogado.nome}</span>
                          {' · '}{maskTelefone(clienteLogado.telefone)}
                        </span>
                        <button
                          onClick={() => setLoginModal(true)}
                          className="text-xs font-medium hover:underline shrink-0 ml-2"
                          style={{ color: tema.hexDark }}
                        >
                          Trocar
                        </button>
                      </div>

                      <Button
                        onClick={confirmarAgendamento}
                        loading={agendando}
                        className="w-full hover:brightness-95"
                        size="lg"
                        style={{ backgroundColor: tema.hex }}
                      >
                        Confirmar agendamento
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => { if (isDemo) { loginDemoInstantaneo() } else { setPendingBooking(true); setLoginModal(true) } }}
                      className="w-full hover:brightness-95"
                      size="lg"
                      style={{ backgroundColor: tema.hex }}
                    >
                      Entrar para confirmar
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ── FLOATING BUTTONS ───────────────────── */}
      {(waUrl || igHandle) && (
        <div className="fixed bottom-6 right-5 flex flex-col gap-3 z-40">
          {igHandle && (
            <a
              href={`https://instagram.com/${igHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`Instagram @${igHandle}`}
              className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:scale-110 transition-transform duration-200"
              style={{ background: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)' }}
            >
              <AtSign className="w-6 h-6" />
            </a>
          )}
          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="WhatsApp"
              className="w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#20c05a] flex items-center justify-center text-white shadow-[0_4px_20px_rgba(37,211,102,0.4)] hover:scale-110 transition-transform duration-200"
            >
              <MessageCircle className="w-6 h-6" />
            </a>
          )}
        </div>
      )}

      {/* ── MODAL LOGIN ────────────────────────── */}
      <Modal open={loginModal} onClose={fecharLoginModal} title="Entrar">
        <div className="p-6 space-y-4">
          {loginStep === 'telefone' ? (
            <>
              <p className="text-sm text-gray-500">Para agendar, confirme seu número de telefone.</p>
              <Input
                label="WhatsApp"
                type="tel"
                placeholder="(11) 99999-9999"
                value={telefoneLogin}
                onChange={(e) => setTelefoneLogin(maskTelefone(e.target.value))}
              />
              <Button
                onClick={enviarCodigo}
                loading={enviandoCodigo}
                className="w-full hover:brightness-95"
                style={{ backgroundColor: tema.hex }}
              >
                Enviar código
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500">
                Digite o código enviado por SMS para {maskTelefone(telefoneLogin)}.
              </p>
              <Input
                label="Código"
                inputMode="numeric"
                placeholder="123456"
                value={codigoLogin}
                onChange={(e) => setCodigoLogin(e.target.value.replace(/\D/g, ''))}
              />
              {!clienteExistenteLogin && (
                <Input
                  label="Seu nome"
                  placeholder="Maria Silva"
                  value={nomeLogin}
                  onChange={(e) => setNomeLogin(e.target.value)}
                />
              )}
              <Button
                onClick={verificarCodigo}
                loading={verificandoCodigo}
                className="w-full hover:brightness-95"
                style={{ backgroundColor: tema.hex }}
              >
                Confirmar
              </Button>
              <button
                onClick={() => setLoginStep('telefone')}
                className="text-xs text-gray-400 hover:underline w-full text-center"
              >
                Trocar número
              </button>
            </>
          )}
        </div>
      </Modal>

      {/* ── MODAL MEUS AGENDAMENTOS ─────────────── */}
      <Modal
        open={meusAgendamentosModal}
        onClose={() => setMeusAgendamentosModal(false)}
        title="Meus agendamentos"
        className="max-w-lg"
      >
        <div className="p-4 space-y-3">
          {meusAgendamentosVisiveis.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">Nenhum agendamento</p>
          ) : (
            meusAgendamentosVisiveis.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{a.servicos?.nome}</p>
                  {a.profissionais && (
                    <p className="text-xs text-rose-500">{a.profissionais.nome}</p>
                  )}
                  <p className="text-xs text-gray-400">{formatDateTime(a.data_hora)}</p>
                </div>
                <Badge variant={a.status === 'confirmado' ? 'success' : 'danger'}>
                  {a.status === 'confirmado' ? 'Confirmado' : 'Cancelado'}
                </Badge>
                {a.status === 'confirmado' && (
                  <button
                    onClick={() => cancelarMeuAgendamento(a.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* ── GALERIA LIGHTBOX ────────────────────── */}
      {galeriaIndex !== null && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setGaleriaIndex(null)}
        >
          <button
            className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-xl transition-colors"
            onClick={() => setGaleriaIndex(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white p-2 hover:bg-white/10 rounded-xl transition-colors"
            onClick={(e) => { e.stopPropagation(); setGaleriaIndex(Math.max(0, galeriaIndex - 1)) }}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="max-w-xl w-full" onClick={(e) => e.stopPropagation()}>
            {galeria[galeriaIndex].tipo === 'video' ? (
              <video src={galeria[galeriaIndex].url} controls className="rounded-2xl w-full max-h-[80vh]" />
            ) : (
              <Image
                src={galeria[galeriaIndex].url}
                alt="Trabalho"
                width={600}
                height={600}
                className="rounded-2xl w-full max-h-[80vh] object-contain"
              />
            )}
          </div>
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white p-2 hover:bg-white/10 rounded-xl transition-colors"
            onClick={(e) => { e.stopPropagation(); setGaleriaIndex(Math.min(galeria.length - 1, galeriaIndex + 1)) }}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          {/* Counter */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-xs">
            {galeriaIndex + 1} / {galeria.length}
          </div>
        </div>
      )}
    </div>
  )
}
