'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ImageWithSkeleton } from '@/components/ui/image-with-skeleton'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import {
  formatCurrency, formatDateTime, formatDateShort, generateTimeSlots,
  maskTelefone, cleanTelefone, buildWhatsappUrl, diaAtivoPadrao,
  computeHorasDoDia, diaIndisponivelParaAgendar,
} from '@/lib/utils'
import {
  Clock, CheckCircle2, Calendar, ChevronLeft, ChevronRight, X,
  UserCircle2, MessageCircle, AtSign, MapPin, Star,
  CalendarPlus, Share2, Quote, Trash2, Home, Eye, Sparkles, ArrowRight,
} from 'lucide-react'
import { getServicoIcone } from '@/lib/servicoIcones'
import { calcularValorSinal } from '@/lib/sinal'
import type { PrestadoraPublica, Servico, GaleriaItem, Agendamento, Profissional, HorarioFuncionamento, Avaliacao } from '@/lib/types'
import { getTema } from '@/lib/theme'
import { planoEfetivo, ehPro } from '@/lib/plano'
import { limitesPlano } from '@/lib/planoLimites'
import { PlanosSection, type PlanoPublico } from '@/components/perfil-publico/PlanosSection'
import { usePlanoCredito, calcularValorComDesconto } from '@/components/perfil-publico/usePlanoCredito'
import { CreditoPlanoCard } from '@/components/perfil-publico/CreditoPlanoCard'
import { MeusPlanosModal } from '@/components/perfil-publico/MeusPlanosModal'
import {
  buildGoogleCalendarUrl, formatHora,
  type Step, type ServicoComProfissionais,
} from './PerfilPublicoClient'
import toast from 'react-hot-toast'
import { format, addDays, startOfDay, isSameDay, isToday, isBefore, getDay, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/** Deriva um "rgba(...)" a partir do hex da cor_tema — usado nos lugares que
 * antes eram amber-300/NN (borda ou fundo com opacidade reduzida). Estilo
 * inline não tem variante de opacidade do Tailwind, então calcula na mão. */
function hexComOpacidade(hex: string, alpha: number): string {
  const limpo = hex.replace('#', '')
  const cheio = limpo.length === 3 ? limpo.split('').map((c) => c + c).join('') : limpo
  const num = parseInt(cheio, 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

interface Props {
  prestadora: PrestadoraPublica
  servicos: ServicoComProfissionais[]
  galeria: GaleriaItem[]
  diasBloqueados: string[]
  profissionais: Profissional[]
  horariosFuncionamento: HorarioFuncionamento[]
  avaliacoes: Avaliacao[]
  planos: PlanoPublico[]
  isDemo?: boolean
}

/** Grid editorial escuro: fotos grandes, espaçamento mínimo, sem moldura nos
 * cards — só a foto. flex-wrap + justify-center pra centralizar de verdade
 * quando há poucas fotos (um grid-cols fixo deixaria células vazias e o
 * conteúdo pareceria alinhado à esquerda). */
function GaleriaEditorial({
  itens, altPrefixo, nomePrestadora, onItemClick,
}: {
  itens: GaleriaItem[]
  altPrefixo: string
  nomePrestadora: string
  onItemClick: (index: number) => void
}) {
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {itens.map((item, i) => (
        <div
          key={item.id}
          className="w-[calc(50%_-_2px)] sm:w-[calc(33.333%_-_3px)] max-w-[280px] aspect-square overflow-hidden bg-[#1a1a1a] cursor-pointer relative group"
          onClick={() => onItemClick(i)}
        >
          {item.tipo === 'video' ? (
            <video
              src={item.url}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              muted
            />
          ) : (
            <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
              <ImageWithSkeleton
                src={item.url}
                alt={`${altPrefixo} ${i + 1} de ${nomePrestadora}`}
                fill
                className="object-cover"
                sizes="33vw"
              />
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" aria-hidden />
        </div>
      ))}
    </div>
  )
}

export default function PerfilPublicoLandingPremiumClient({
  prestadora, servicos, galeria, diasBloqueados, profissionais, horariosFuncionamento, avaliacoes, planos, isDemo = false,
}: Props) {
  const temMultiplasProfissionais = profissionais.length >= 2

  const [step, setStep] = useState<Step>('servico')
  const [servicoSelecionado, setServicoSelecionado] = useState<ServicoComProfissionais | null>(null)
  const [profissionalSelecionada, setProfissionalSelecionada] = useState<Profissional | null>(
    profissionais.length === 1 ? profissionais[0] : null
  )

  const profissionaisDoServico = useMemo(() => {
    const ids = servicoSelecionado?.servico_profissionais?.map((sp) => sp.profissional_id) ?? []
    return ids.length === 0 ? profissionais : profissionais.filter((p) => ids.includes(p.id))
  }, [servicoSelecionado, profissionais])
  const [dataSelecionada, setDataSelecionada] = useState<Date | null>(null)
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null)
  const [agendamentosExistentes, setAgendamentosExistentes] = useState<{start: number; end: number}[]>([])
  const [loadingHorarios, setLoadingHorarios] = useState(false)
  const [horasDodia, setHorasDodia] = useState<{
    abertura: string
    fechamento: string
    turno2Inicio: string | null
    turno2Fim: string | null
  }>({
    abertura: prestadora.hora_abertura,
    fechamento: prestadora.hora_fechamento,
    turno2Inicio: null,
    turno2Fim: null,
  })

  const [agendando, setAgendando] = useState(false)
  const [agendamentoFeito, setAgendamentoFeito] = useState<Agendamento | null>(null)

  const [concordaNaoReembolsavel, setConcordaNaoReembolsavel] = useState(false)
  const [mostrarPagamentoOpcional, setMostrarPagamentoOpcional] = useState(false)

  const [loginModal, setLoginModal] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'cadastro' | 'recuperacao'>('login')
  const [authStep, setAuthStep] = useState<'inicio' | 'codigo' | 'finalizar'>('inicio')
  const [telefoneAuth, setTelefoneAuth] = useState('')
  const [senhaAuth, setSenhaAuth] = useState('')
  const [codigoAuth, setCodigoAuth] = useState('')
  const [nomeAuth, setNomeAuth] = useState('')
  const [verificationToken, setVerificationToken] = useState('')
  const [enviandoAuth, setEnviandoAuth] = useState(false)
  const [numeroNaoEncontrado, setNumeroNaoEncontrado] = useState(false)
  const [pendingBooking, setPendingBooking] = useState(false)
  const [clienteLogado, setClienteLogado] = useState<{ id: string; nome: string; telefone: string } | null>(null)
  const [meusAgendamentos, setMeusAgendamentos] = useState<Agendamento[]>([])
  const [meusAgendamentosModal, setMeusAgendamentosModal] = useState(false)
  const [meusPlanosModal, setMeusPlanosModal] = useState(false)
  const [agendamentoParaCancelar, setAgendamentoParaCancelar] = useState<Agendamento | null>(null)
  const [cancelando, setCancelando] = useState(false)
  const [googleEmail, setGoogleEmail] = useState('')

  const [perfilAberto, setPerfilAberto] = useState(false)
  const [editandoNome, setEditandoNome] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [salvandoNome, setSalvandoNome] = useState(false)
  const perfilRef = useRef<HTMLDivElement>(null)

  const [logoMenuAberto, setLogoMenuAberto] = useState(false)
  const logoMenuRef = useRef<HTMLDivElement>(null)

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

  const [lightbox, setLightbox] = useState<{ lista: GaleriaItem[]; index: number } | null>(null)

  const [weekOffset, setWeekOffset] = useState(0)
  const today = startOfDay(new Date())
  const weekStart = addDays(today, weekOffset * 7)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  useEffect(() => {
    if (isDemo) return
    const key = `visita_${prestadora.id}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    createClient().from('visitas_pagina').insert({ prestadora_id: prestadora.id }).then(({ error }) => {
      if (error) console.error('[visitas_pagina] erro ao registrar visita:', error.message)
    })
  }, [isDemo, prestadora.id])

  async function carregarMeusAgendamentos(token: string) {
    const res = await fetch('/api/agendamentos/meus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, prestadoraId: prestadora.id }),
    })
    const { agendamentos } = res.ok ? await res.json() : { agendamentos: [] }
    setMeusAgendamentos(agendamentos ?? [])
  }

  useEffect(() => {
    if (isDemo) return

    const params = new URLSearchParams(window.location.search)
    const googleLogin = params.get('google_login')
    const ge = params.get('ge')
    const gn = params.get('gn')
    const googleError = params.get('google_error')

    if (googleLogin || ge || googleError) {
      window.history.replaceState({}, '', window.location.pathname)
    }

    if (googleError) {
      toast.error('Erro ao autenticar com Google. Tente novamente.')
    }

    if (ge) {
      const emailDecodado = decodeURIComponent(ge)
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDecodado)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- inicialização única a partir de URL params após retorno do Google OAuth
        setGoogleEmail(emailDecodado)
        if (gn) setNomeAuth(decodeURIComponent(gn))
        setAuthMode('cadastro')
        setAuthStep('inicio')
        setLoginModal(true)
      }
      return
    }

    if (googleLogin) {
      fetch('/api/clientes/auth/sessao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(({ cliente, token }) => {
          localStorage.setItem('clienteToken', token)
          setClienteLogado(cliente)
          carregarMeusAgendamentos(token)
          toast.success(`Olá, ${cliente.nome}!`)
        })
        .catch(() => {
          toast.error('Erro ao finalizar login com Google')
        })
      return
    }

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
        carregarMeusAgendamentos(token)
      })
      .catch(() => {
        localStorage.removeItem('clienteToken')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo])

  useEffect(() => {
    if (isDemo) return
    if (window.location.hash === '#meus-agendamentos') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza estado a partir do hash da URL (não dá pra ler window.location no SSR)
      setMeusAgendamentosModal(true)
    }
  }, [isDemo])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (perfilRef.current && !perfilRef.current.contains(e.target as Node)) {
        setPerfilAberto(false)
        setEditandoNome(false)
      }
      if (logoMenuRef.current && !logoMenuRef.current.contains(e.target as Node)) {
        setLogoMenuAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const diaHoje = getDay(new Date())
  const horarioHoje = horariosFuncionamento.find((h) => h.dia_semana === diaHoje)
  const aberturaHoje = horarioHoje?.hora_abertura ?? prestadora.hora_abertura
  const fechamentoHoje = horarioHoje?.hora_fechamento ?? prestadora.hora_fechamento
  const abertoHoje = horarioHoje ? horarioHoje.ativo : diaAtivoPadrao(diaHoje)

  function isDiaDesativado(d: Date): boolean {
    if (isBefore(d, today)) return true
    return diaIndisponivelParaAgendar(getDay(d), format(d, 'yyyy-MM-dd'), diasBloqueados, horariosFuncionamento, profissionalSelecionada)
  }

  function computeHorasDia(d: Date, prof: Profissional | null) {
    return computeHorasDoDia(getDay(d), horariosFuncionamento, prof, prestadora.hora_abertura, prestadora.hora_fechamento)
  }

  function scrollParaAgendar() {
    document.getElementById('agendar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

  /** Usado pelos cards da seção "Serviços" (fora do #agendar) — escolhe o
   * serviço e já leva a cliente pro passo seguinte da vitrine de agendamento. */
  function selecionarServicoEIrParaAgendar(s: ServicoComProfissionais) {
    selecionarServico(s)
    scrollParaAgendar()
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

    const params = new URLSearchParams({
      prestadoraId: prestadora.id,
      data: format(d, 'yyyy-MM-dd'),
    })
    if (profissionalSelecionada) params.set('profissionalId', profissionalSelecionada.id)

    const res = await fetch(`/api/agendamentos/horarios-ocupados?${params.toString()}`)
    const { ocupados } = res.ok ? await res.json() : { ocupados: [] }
    setAgendamentosExistentes(ocupados)
    setLoadingHorarios(false)
    setStep('horario')
  }

  function loginDemoInstantaneo() {
    setClienteLogado({ id: 'demo-cliente', nome: 'Cliente Demo', telefone: '11999999999' })
    toast('Login simulado (modo demonstração).')
  }

  function fecharLoginModal() {
    setLoginModal(false)
    setAuthMode('login')
    setAuthStep('inicio')
    setTelefoneAuth('')
    setSenhaAuth('')
    setCodigoAuth('')
    setNomeAuth('')
    setVerificationToken('')
    setPendingBooking(false)
    setNumeroNaoEncontrado(false)
    setGoogleEmail('')
  }

  async function loginComGoogle() {
    if (isDemo) { loginDemoInstantaneo(); return }
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/clientes/auth/google/callback?slug=${prestadora.slug}`,
      },
    })
    if (error) toast.error('Erro ao iniciar login com Google')
  }

  async function aoLogarComSucesso(token: string, cliente: { id: string; nome: string; telefone: string }) {
    localStorage.setItem('clienteToken', token)
    setClienteLogado(cliente)
    await carregarMeusAgendamentos(token)
    const irParaAgendamento = pendingBooking
    fecharLoginModal()
    toast.success(`Olá, ${cliente.nome}!`)
    if (irParaAgendamento) setStep('cliente')
  }

  async function submitLogin() {
    if (cleanTelefone(telefoneAuth).length < 10 || !senhaAuth) {
      toast.error('Informe telefone e senha')
      return
    }
    setEnviandoAuth(true)
    try {
      const res = await fetch('/api/clientes/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: telefoneAuth, senha: senhaAuth }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao entrar')
        return
      }
      await aoLogarComSucesso(data.token, data.cliente)
    } finally {
      setEnviandoAuth(false)
    }
  }

  async function enviarCodigo() {
    if (cleanTelefone(telefoneAuth).length < 10) {
      toast.error('Telefone inválido')
      return
    }
    setNumeroNaoEncontrado(false)
    setEnviandoAuth(true)
    try {
      const res = await fetch('/api/clientes/auth/enviar-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: telefoneAuth, finalidade: authMode }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (authMode === 'recuperacao' && res.status === 404) {
          setNumeroNaoEncontrado(true)
          return
        }
        toast.error(data.error ?? 'Erro ao enviar código')
        return
      }
      setAuthStep('codigo')
    } finally {
      setEnviandoAuth(false)
    }
  }

  async function verificarCodigo() {
    setEnviandoAuth(true)
    try {
      const res = await fetch('/api/clientes/auth/verificar-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: telefoneAuth, codigo: codigoAuth, finalidade: authMode }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Código inválido')
        return
      }
      setVerificationToken(data.verificationToken)
      setAuthStep('finalizar')
    } finally {
      setEnviandoAuth(false)
    }
  }

  async function finalizarCadastro() {
    if (nomeAuth.trim().length < 2) {
      toast.error('Informe seu nome')
      return
    }
    if (senhaAuth.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres')
      return
    }
    setEnviandoAuth(true)
    try {
      const res = await fetch('/api/clientes/auth/finalizar-cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationToken, nome: nomeAuth, senha: senhaAuth, ...(googleEmail ? { email: googleEmail } : {}) }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao concluir cadastro')
        return
      }
      await aoLogarComSucesso(data.token, data.cliente)
    } finally {
      setEnviandoAuth(false)
    }
  }

  async function redefinirSenha() {
    if (senhaAuth.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres')
      return
    }
    setEnviandoAuth(true)
    try {
      const res = await fetch('/api/clientes/auth/redefinir-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationToken, novaSenha: senhaAuth }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao redefinir senha')
        return
      }
      await aoLogarComSucesso(data.token, data.cliente)
    } finally {
      setEnviandoAuth(false)
    }
  }

  async function salvarNome() {
    if (!clienteLogado || novoNome.trim().length < 2) {
      toast.error('Informe um nome válido')
      return
    }
    setSalvandoNome(true)
    try {
      const token = localStorage.getItem('clienteToken')
      const res = await fetch('/api/clientes/auth/atualizar-nome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nome: novoNome }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao atualizar nome')
        return
      }
      setClienteLogado((prev) => prev ? { ...prev, nome: data.nome } : prev)
      setEditandoNome(false)
      setPerfilAberto(false)
      toast.success('Nome atualizado!')
    } finally {
      setSalvandoNome(false)
    }
  }

  function sair() {
    localStorage.removeItem('clienteToken')
    setClienteLogado(null)
    setMeusAgendamentos([])
    setPerfilAberto(false)
    setEditandoNome(false)
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
        const novoAgendamento: Agendamento = {
          id: 'demo',
          prestadora_id: 'demo',
          profissional_id: prof?.id ?? null,
          servico_id: servico.id,
          cliente_id: 'demo-cliente',
          data_hora: dataHora.toISOString(),
          status: 'confirmado',
          cancelado_por: null,
          arquivado: false,
          cliente_e_prestadora: false,
          agendamento_manual: false,
          created_at: new Date().toISOString(),
          servicos: servico,
          clientes: { id: 'demo-cliente', nome: clienteLogado.nome, telefone: clienteLogado.telefone, cliente_manual: false, verificado_em: null, data_nascimento: null, notas: null, created_at: '' },
          profissionais: prof ?? undefined,
        }
        setAgendamentoFeito(novoAgendamento)
        setMeusAgendamentos((prev) => [novoAgendamento, ...prev])
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
        usarCreditoPlano: !!assinaturaComCredito && usarCredito,
      }),
    })
    const data = await res.json()
    setAgendando(false)

    if (!res.ok) {
      toast.error(data.error ?? 'Erro ao agendar. Tente novamente.')
      return
    }

    setAgendamentoFeito(data.agendamento)
    setMeusAgendamentos((prev) => [data.agendamento, ...prev])
    setStep('confirmado')
  }

  async function pagarEIrParaCheckout() {
    if (!servicoSelecionado || !dataSelecionada || !horarioSelecionado || !clienteLogado) return

    const [h, m] = horarioSelecionado.split(':').map(Number)
    const dataHora = new Date(dataSelecionada)
    dataHora.setHours(h, m, 0, 0)

    setAgendando(true)
    const token = localStorage.getItem('clienteToken')
    const res = await fetch('/api/agendamentos/criar-pendente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        prestadoraId: prestadora.id,
        servicoId: servicoSelecionado.id,
        profissionalId: profissionalSelecionada?.id ?? null,
        dataHora: dataHora.toISOString(),
        usarCreditoPlano: !!assinaturaComCredito && usarCredito,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      setAgendando(false)
      toast.error(data.error ?? 'Erro ao agendar. Tente novamente.')
      return
    }

    window.location.href = `/agendamento/checkout?agendamento_temp=${data.agendamentoId}`
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

  async function confirmarCancelamento() {
    if (!agendamentoParaCancelar) return
    setCancelando(true)
    await cancelarMeuAgendamento(agendamentoParaCancelar.id)
    setCancelando(false)
    setAgendamentoParaCancelar(null)
  }

  function resetarFluxo() {
    setStep('servico')
    setServicoSelecionado(null)
    setProfissionalSelecionada(profissionais.length === 1 ? profissionais[0] : null)
    setDataSelecionada(null)
    setHorarioSelecionado(null)
    setAgendamentoFeito(null)
    setConcordaNaoReembolsavel(false)
    setMostrarPagamentoOpcional(false)
  }

  const horariosDisponiveis = servicoSelecionado && dataSelecionada
    ? generateTimeSlots(
        horasDodia.abertura, horasDodia.fechamento, servicoSelecionado.duracao_minutos,
        horasDodia.turno2Inicio, horasDodia.turno2Fim
      )
        .filter((h) => {
          const [hh, mm] = h.split(':').map(Number)
          const slotStart = new Date(
            dataSelecionada.getFullYear(), dataSelecionada.getMonth(), dataSelecionada.getDate(), hh, mm
          ).getTime()
          const slotEnd = slotStart + servicoSelecionado.duracao_minutos * 60000
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

  const igHandle = prestadora.instagram?.replace('@', '')
  const waUrl = prestadora.whatsapp
    ? buildWhatsappUrl(prestadora.whatsapp, 'Olá! Gostaria de saber mais sobre os serviços 💅')
    : null

  const mediaAvaliacoes = avaliacoes.length > 0
    ? avaliacoes.reduce((acc, a) => acc + a.nota, 0) / avaliacoes.length
    : null

  // Fundo escuro é fixo do preset Premium, mas o dourado de destaque (bordas,
  // ícones, preço, CTA) usa a cor_tema da prestadora — mesma fonte que
  // PerfilPublicoClient.tsx usa pro gradiente do header.
  const tema = getTema(prestadora.cor_tema)

  const { assinatura: assinaturaComCredito, usarCredito, setUsarCredito } = usePlanoCredito({
    clienteLogado,
    prestadoraId: prestadora.id,
    servicoId: servicoSelecionado?.id ?? null,
  })

  /** Só é usado como preview: o valor cobrado de verdade é recalculado no
   * servidor (ver /api/agendamentos/pagar) a partir de plano_assinatura_id. */
  function valorComDescontoDoPlano(valor: number): number {
    if (assinaturaComCredito && usarCredito) {
      return calcularValorComDesconto(valor, assinaturaComCredito.descontoTipo, assinaturaComCredito.descontoValor)
    }
    return valor
  }

  // O gate de plano (Studio) já é aplicado antes de chegar nesse
  // componente (ver src/app/n/[slug]/page.tsx), mas a galeria/avaliações
  // ainda respeitam os limites do plano ao exibir, pro caso de downgrade.
  const planoAtual = planoEfetivo({ plano: prestadora.plano, e_parceira: prestadora.e_parceira })
  const limitesAtuais = limitesPlano(planoAtual)

  const avaliacoesDestaque = prestadora.pagina_mostrar_avaliacoes && ehPro(planoAtual)
    ? avaliacoes.filter((a) => a.destaque)
    : []
  const avaliacoesExibidas = avaliacoesDestaque.slice(0, 3)

  const galeriaCompleta = prestadora.pagina_mostrar_galeria ? galeria : []
  const galeriaVisivel = (
    prestadora.pagina_galeria_fotos_ids.length > 0
      ? prestadora.pagina_galeria_fotos_ids
          .map((id) => galeriaCompleta.find((g) => g.id === id))
          .filter((g): g is GaleriaItem => !!g)
      : galeriaCompleta
  ).slice(0, limitesAtuais.fotos_trabalhos)

  const estabelecimentoFotos = prestadora.pagina_mostrar_estabelecimento && limitesAtuais.fotos_estabelecimento > 0
    ? prestadora.pagina_estabelecimento_fotos_ids
        .map((id) => galeria.find((g) => g.id === id))
        .filter((g): g is GaleriaItem => !!g)
        .slice(0, limitesAtuais.fotos_estabelecimento)
    : []

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
    <div className="min-h-screen bg-[#0f0f0f]">

      {/* ── NAVBAR ─────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#0f0f0f]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="relative shrink-0" ref={logoMenuRef}>
            <button
              onClick={() => setLogoMenuAberto((v) => !v)}
              aria-expanded={logoMenuAberto}
              aria-haspopup="menu"
              className="font-serif text-lg font-bold text-white rounded-lg px-1 py-1 hover:opacity-80 transition-opacity"
            >
              BelleBook
            </button>

            {logoMenuAberto && (
              <div
                role="menu"
                className="animate-dropdown-in absolute left-0 mt-2 w-64 bg-[#1a1a1a] rounded-xl border border-white/10 shadow-lg z-30 p-2"
              >
                <Link
                  href="/"
                  role="menuitem"
                  onClick={() => setLogoMenuAberto(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/5 transition-colors"
                >
                  <Home className="w-4 h-4 text-gray-500 shrink-0" />
                  Conheça o BelleBook
                </Link>
                <Link
                  href="/painel/demo"
                  role="menuitem"
                  onClick={() => setLogoMenuAberto(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/5 transition-colors"
                >
                  <Eye className="w-4 h-4 text-gray-500 shrink-0" />
                  Ver demonstração
                </Link>
                <div className="my-1 border-t border-white/10" />
                <Link
                  href="/painel/cadastro"
                  role="menuitem"
                  onClick={() => setLogoMenuAberto(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-[#0f0f0f] hover:brightness-95 transition-all"
                  style={{ backgroundColor: tema.hex }}
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  Crie sua página grátis
                </Link>
              </div>
            )}
          </div>

          <p className="hidden sm:block flex-1 text-center font-serif text-base font-semibold text-white truncate">
            {prestadora.nome}
          </p>

          <div className="flex items-center gap-2 shrink-0">
            {clienteLogado && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMeusAgendamentosModal(true)}
                className="hidden sm:inline-flex !border-white/30 !text-white hover:!bg-white/10 !bg-transparent"
              >
                Meus agendamentos
              </Button>
            )}

            {clienteLogado ? (
              <div className="relative" ref={perfilRef}>
                <button
                  onClick={() => { setPerfilAberto((v) => !v); setEditandoNome(false) }}
                  className="px-3 py-1.5 min-h-11 text-sm font-semibold rounded-xl bg-transparent border-2 border-white/40 text-white hover:bg-white/10 transition-all"
                >
                  {clienteLogado.nome.split(' ')[0]}
                </button>

                {perfilAberto && (
                  <div className="absolute right-0 mt-2 w-56 bg-[#1a1a1a] rounded-xl border border-white/10 shadow-lg z-30 p-2">
                    {editandoNome ? (
                      <div className="p-2 space-y-2">
                        <Input
                          placeholder="Seu nome"
                          value={novoNome}
                          onChange={(e) => setNovoNome(e.target.value)}
                          autoFocus
                        />
                        <Button onClick={salvarNome} loading={salvandoNome} className="w-full text-[#0f0f0f] hover:brightness-95" style={{ backgroundColor: tema.hex }} size="sm">
                          Salvar
                        </Button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setMeusAgendamentosModal(true)}
                          className="sm:hidden w-full text-left px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5 transition-colors"
                        >
                          Meus agendamentos
                        </button>
                        <button
                          onClick={() => { setNovoNome(clienteLogado.nome); setEditandoNome(true) }}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5 transition-colors"
                        >
                          Alterar nome
                        </button>
                        <button
                          onClick={() => { setPerfilAberto(false); setMeusPlanosModal(true) }}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5 transition-colors"
                        >
                          Meus planos
                        </button>
                        <button
                          onClick={sair}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          Sair
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => { if (isDemo) { loginDemoInstantaneo() } else { setLoginModal(true) } }}
                className="hidden sm:inline-flex px-3 py-1.5 min-h-11 text-sm font-semibold rounded-xl bg-transparent border-2 border-white/40 text-white hover:bg-white/10 transition-all"
              >
                Entrar
              </button>
            )}

            <button
              onClick={scrollParaAgendar}
              className="px-4 py-1.5 min-h-11 text-sm font-semibold rounded-xl border-2 border-white text-white hover:bg-white hover:text-[#0f0f0f] transition-all"
            >
              Agendar
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO ───────────────────────────────── */}
      <section className="relative px-4 pt-16 pb-14 text-center bg-gradient-to-b from-[#0f0f0f] to-[#161616]">
        <div className="max-w-2xl mx-auto flex flex-col items-center gap-5">
          <div className="w-40 h-40 rounded-full p-1" style={{ backgroundColor: tema.hex }}>
            <div className="w-full h-full rounded-full overflow-hidden bg-[#1a1a1a]">
              {prestadora.foto_url ? (
                <ImageWithSkeleton
                  src={prestadora.foto_url}
                  alt={prestadora.nome}
                  width={160}
                  height={160}
                  className="object-cover w-full h-full"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-5xl font-serif" style={{ color: tema.hex }}>
                  {prestadora.nome.charAt(0)}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="font-serif text-4xl sm:text-5xl font-bold text-white leading-tight tracking-wide">{prestadora.nome}</h1>

            <div className="flex items-center justify-center gap-2 flex-wrap">
              {prestadora.pagina_mostrar_texto_agendamento && prestadora.pagina_texto_agendamento && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold"
                  style={{ border: `1px solid ${hexComOpacidade(tema.hex, 0.3)}`, color: tema.hex }}
                >
                  <Star className="w-3.5 h-3.5" style={{ fill: tema.hex, color: tema.hex }} />
                  {prestadora.pagina_texto_agendamento}
                </span>
              )}
              {prestadora.pagina_mostrar_estrelas && mediaAvaliacoes !== null && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold"
                  style={{ border: `1px solid ${hexComOpacidade(tema.hex, 0.3)}`, color: tema.hex }}
                >
                  <Star className="w-3.5 h-3.5" style={{ fill: tema.hex, color: tema.hex }} />
                  {mediaAvaliacoes.toFixed(1)} ({avaliacoes.length} avaliaç{avaliacoes.length > 1 ? 'ões' : 'ão'})
                </span>
              )}
              {abertoHoje && (
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                  <Clock className="w-3.5 h-3.5" style={{ color: tema.hex }} />
                  Hoje: {formatHora(aberturaHoje)} – {formatHora(fechamentoHoje)}
                </span>
              )}
            </div>

            {prestadora.bio && (
              <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed">{prestadora.bio}</p>
            )}
          </div>

          <Button
            onClick={scrollParaAgendar}
            size="lg"
            className="!bg-white !text-[#0f0f0f] hover:!bg-gray-100 gap-2 font-semibold"
          >
            Agendar agora
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </section>

      {/* ── SERVIÇOS ───────────────────────────── */}
      {servicos.length > 0 && (
        <section className="bg-[#111111] px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-white mb-10 text-center">Serviços</h2>
            <div className="flex flex-wrap justify-center gap-4">
              {servicos.map((s) => {
                const IconeServico = getServicoIcone(s.icone)
                const fotoServico = s.foto_galeria_id
                  ? galeria.find((g) => g.id === s.foto_galeria_id && g.tipo === 'imagem')
                  : null
                return (
                  <button
                    key={s.id}
                    onClick={() => selecionarServicoEIrParaAgendar(s)}
                    className="w-full sm:w-[calc(50%_-_8px)] max-w-md text-left bg-[#1a1a1a] rounded-2xl p-5 transition-colors"
                    style={{ border: `1px solid ${hexComOpacidade(tema.hex, 0.3)}` }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = tema.hex }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = hexComOpacidade(tema.hex, 0.3) }}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="relative w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-[#111111]"
                        style={{ border: `1px solid ${hexComOpacidade(tema.hex, 0.2)}` }}
                      >
                        {fotoServico ? (
                          <ImageWithSkeleton src={fotoServico.url} alt={s.nome} fill className="object-cover" />
                        ) : (
                          <IconeServico className="w-5 h-5" style={{ color: tema.hex }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-white">{s.nome}</h4>
                        {s.descricao && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{s.descricao}</p>}
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          {s.duracao_minutos} min
                        </div>
                      </div>
                      <span className="font-bold text-lg shrink-0" style={{ color: tema.hex }}>{formatCurrency(s.preco)}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── GALERIA DE TRABALHOS ───────────────── */}
      {galeriaVisivel.length > 0 && (
        <section className="bg-[#0f0f0f] px-4 py-16">
          <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-white mb-10 text-center">Nossos trabalhos</h2>
          <GaleriaEditorial
            itens={galeriaVisivel.slice(0, 12)}
            altPrefixo="Trabalho"
            nomePrestadora={prestadora.nome}
            onItemClick={(i) => setLightbox({ lista: galeriaVisivel, index: i })}
          />
        </section>
      )}

      {/* ── PROFISSIONAIS ──────────────────────── */}
      {profissionais.length > 0 && (
        <section className="bg-[#111111] px-4 py-16">
          <div className="max-w-5xl mx-auto">
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-white mb-10 text-center">Nossa equipe</h2>
            <div className="flex flex-wrap justify-center gap-5">
              {profissionais.map((p) => (
                <div key={p.id} className="w-full sm:w-[calc(50%_-_10px)] lg:w-[calc(33.333%_-_14px)] max-w-sm bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 flex flex-col items-center text-center gap-3">
                  <div className="w-20 h-20 rounded-full p-0.5 shrink-0" style={{ backgroundColor: tema.hex }}>
                    <div className="w-full h-full rounded-full overflow-hidden bg-[#111111]">
                      {p.foto_url ? (
                        <Image src={p.foto_url} alt={p.nome} width={80} height={80} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl font-bold font-serif" style={{ color: tema.hex }}>
                          {p.nome.charAt(0)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-white">{p.nome}</p>
                    {p.bio && <p className="text-xs text-gray-400 mt-1 leading-relaxed">{p.bio}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── ESTABELECIMENTO + MAPA ─────────────── */}
      {(estabelecimentoFotos.length > 0 || prestadora.endereco) && (
        <section className="bg-[#0f0f0f] px-4 py-16">
          <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-white mb-10 text-center">
            {prestadora.pagina_estabelecimento_titulo || 'Nosso espaço'}
          </h2>
          {estabelecimentoFotos.length > 0 && (
            <div className="mb-6">
              <GaleriaEditorial
                itens={estabelecimentoFotos.slice(0, 9)}
                altPrefixo="Foto do espaço"
                nomePrestadora={prestadora.nome}
                onItemClick={(i) => setLightbox({ lista: estabelecimentoFotos, index: i })}
              />
            </div>
          )}
          {prestadora.endereco && (
            <div className="bg-[#1a1a1a] rounded-2xl p-4 flex items-center gap-3 max-w-xl mx-auto" style={{ border: `1px solid ${hexComOpacidade(tema.hex, 0.2)}` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#111111]">
                <MapPin className="w-5 h-5" style={{ color: tema.hex }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-0.5">Localização</p>
                <p className="text-sm text-gray-200 font-medium truncate">{prestadora.endereco}</p>
              </div>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(prestadora.endereco)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1 text-xs font-semibold hover:brightness-125 transition-all whitespace-nowrap"
                style={{ color: tema.hex }}
              >
                Como chegar
                <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </section>
      )}

      {/* ── AVALIAÇÕES ─────────────────────────── */}
      {avaliacoesExibidas.length > 0 && (
        <section className="bg-[#111111] px-4 py-16">
          <div className="max-w-5xl mx-auto">
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-white mb-10 text-center">O que dizem nossas clientes</h2>
            <div className="flex flex-wrap justify-center gap-4">
              {avaliacoesExibidas.map((av) => (
                <div key={av.id} className="w-full sm:w-[calc(33.333%_-_11px)] max-w-sm bg-[#1a1a1a] rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={i < av.nota ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5 text-gray-700'}
                          style={i < av.nota ? { fill: tema.hex, color: tema.hex } : undefined}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] text-gray-500">{formatDateShort(av.created_at)}</span>
                  </div>
                  {av.comentario && (
                    <p className="text-sm text-gray-300 leading-relaxed flex gap-1.5">
                      <Quote className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: tema.hex }} />
                      {av.comentario}
                    </p>
                  )}
                  {av.agendamentos?.clientes?.nome && (
                    <p className="text-xs text-gray-500 mt-1.5 text-right">— {av.agendamentos.clientes.nome}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <PlanosSection
        planos={planos}
        corTema={tema.hex}
        dark
        clienteLogado={clienteLogado}
        onRequireLogin={() => { if (isDemo) { loginDemoInstantaneo() } else { setLoginModal(true) } }}
      />

      {/* ── AGENDAMENTO INLINE ─────────────────── */}
      <section id="agendar" className="scroll-mt-20 bg-[#0f0f0f] px-4 py-16" style={{ borderTop: `2px solid ${tema.hex}` }}>
        <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-white mb-10 text-center">Agende seu horário</h2>

        <div className="max-w-lg mx-auto">
          {step === 'confirmado' && agendamentoFeito ? (
            <div className="bg-[#1a1a1a] rounded-2xl p-8 text-center space-y-5" style={{ border: `1px solid ${hexComOpacidade(tema.hex, 0.3)}` }}>
              <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center animate-check-pop" style={{ backgroundColor: hexComOpacidade(tema.hex, 0.1) }}>
                <CheckCircle2 className="w-12 h-12" style={{ color: tema.hex }} />
              </div>
              <div>
                <h3 className="font-serif text-2xl font-bold text-white">Agendado!</h3>
                <p className="text-sm text-gray-400 mt-1">Te esperamos, {agendamentoFeito.clientes?.nome?.split(' ')[0]}!</p>
              </div>
              <div className="rounded-xl p-4 text-sm text-left space-y-2 bg-[#111111]">
                <div className="flex justify-between">
                  <span className="text-gray-500">Serviço</span>
                  <span className="font-medium text-gray-200">{agendamentoFeito.servicos?.nome}</span>
                </div>
                {agendamentoFeito.profissionais && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Profissional</span>
                    <span className="font-medium text-gray-200">{agendamentoFeito.profissionais.nome}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Data e hora</span>
                  <span className="font-medium text-gray-200">{formatDateTime(agendamentoFeito.data_hora)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Valor</span>
                  <span className="font-medium" style={{ color: tema.hex }}>{formatCurrency(agendamentoFeito.servicos?.preco ?? 0)}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <a
                  href={buildGoogleCalendarUrl(agendamentoFeito, prestadora.nome)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-gray-200 hover:bg-white/5 transition-colors"
                >
                  <CalendarPlus className="w-4 h-4" />
                  Adicionar ao Google Calendar
                </a>
                <button
                  onClick={compartilharAgendamento}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-gray-200 hover:bg-white/5 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  Compartilhar
                </button>
              </div>

              <Button variant="outline" onClick={resetarFluxo} className="w-full !border-white/30 !text-white hover:!bg-white/10 !bg-transparent">
                Fazer outro agendamento
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 mb-2 flex-wrap">
                {progressSteps.map((label, i) => {
                  const active = i <= currentStepIndex
                  return (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className={active ? 'font-medium' : ''} style={active ? { color: tema.hex } : undefined}>{label}</span>
                      {i < progressSteps.length - 1 && (
                        <div
                          className="h-px w-3"
                          style={{ backgroundColor: active && i < currentStepIndex ? tema.hex : '#3f3f46' }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              {step === 'servico' && (
                <div className="space-y-3">
                  {servicos.length === 0 ? (
                    <p className="text-center text-gray-500 py-8 text-sm">Nenhum serviço disponível</p>
                  ) : (
                    servicos.map((s) => {
                      const IconeServico = getServicoIcone(s.icone)
                      const fotoServico = s.foto_galeria_id
                        ? galeria.find((g) => g.id === s.foto_galeria_id && g.tipo === 'imagem')
                        : null
                      return (
                      <div
                        key={s.id}
                        onClick={() => selecionarServico(s)}
                        className="bg-[#1a1a1a] rounded-2xl p-4 cursor-pointer transition-all duration-200"
                        style={{ border: `1px solid ${hexComOpacidade(tema.hex, 0.2)}` }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = hexComOpacidade(tema.hex, 0.6) }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = hexComOpacidade(tema.hex, 0.2) }}
                      >
                        <div className="flex items-center gap-4">
                          <div className="relative w-11 h-11 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-[#111111]">
                            {fotoServico ? (
                              <ImageWithSkeleton src={fotoServico.url} alt={s.nome} fill className="object-cover" />
                            ) : (
                              <IconeServico className="w-5 h-5" style={{ color: tema.hex }} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-white">{s.nome}</h4>
                            {s.descricao && <p className="text-xs text-gray-400 mt-0.5 truncate">{s.descricao}</p>}
                            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                              <Clock className="w-3 h-3" />
                              {s.duracao_minutos} min
                            </div>
                          </div>
                          <span className="font-bold text-lg shrink-0" style={{ color: tema.hex }}>{formatCurrency(s.preco)}</span>
                        </div>
                      </div>
                      )
                    })
                  )}
                </div>
              )}

              {step === 'profissional' && servicoSelecionado && (
                <div className="bg-[#1a1a1a] rounded-2xl p-4 space-y-4" style={{ border: `1px solid ${hexComOpacidade(tema.hex, 0.2)}` }}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setStep('servico')} className="text-gray-500 hover:text-white">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h3 className="font-medium text-white">Escolha a profissional</h3>
                    <Badge className="ml-auto" style={{ backgroundColor: hexComOpacidade(tema.hex, 0.1), color: tema.hex }}>{servicoSelecionado.nome}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {profissionaisDoServico.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => selecionarProfissional(p)}
                        className="flex flex-col items-center gap-3 p-4 rounded-2xl border border-white/10 hover:bg-white/5 transition-all text-center"
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = hexComOpacidade(tema.hex, 0.5) }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '' }}
                      >
                        <div className="w-16 h-16 rounded-full p-0.5" style={{ backgroundColor: hexComOpacidade(tema.hex, 0.5) }}>
                          <div className="w-full h-full rounded-full overflow-hidden bg-[#111111]">
                            {p.foto_url ? (
                              <Image src={p.foto_url} alt={p.nome} width={64} height={64} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xl font-bold font-serif" style={{ color: tema.hex }}>
                                {p.nome.charAt(0)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="font-semibold text-white text-sm">{p.nome}</p>
                          {p.bio && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.bio}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 'data' && servicoSelecionado && (
                <div className="bg-[#1a1a1a] rounded-2xl p-4" style={{ border: `1px solid ${hexComOpacidade(tema.hex, 0.2)}` }}>
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      onClick={() => setStep(temMultiplasProfissionais ? 'profissional' : 'servico')}
                      className="text-gray-500 hover:text-white"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h3 className="font-medium text-white">{servicoSelecionado.nome}</h3>
                      {profissionalSelecionada && (
                        <p className="text-xs" style={{ color: tema.hex }}>com {profissionalSelecionada.nome}</p>
                      )}
                    </div>
                    <Badge className="ml-auto" style={{ backgroundColor: hexComOpacidade(tema.hex, 0.1), color: tema.hex }}>{formatCurrency(servicoSelecionado.preco)}</Badge>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <button
                      onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                      disabled={weekOffset === 0}
                      className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-medium text-gray-300">
                      {format(weekStart, "MMMM yyyy", { locale: ptBR })}
                    </span>
                    <button onClick={() => setWeekOffset(weekOffset + 1)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500">
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
                            ${selecionado ? '' : 'text-gray-300 hover:bg-white/5'}
                            ${isToday(d) && !selecionado ? 'border' : ''}
                          `}
                          style={{
                            backgroundColor: selecionado ? tema.hex : undefined,
                            color: selecionado ? '#0f0f0f' : undefined,
                            borderColor: isToday(d) && !selecionado ? hexComOpacidade(tema.hex, 0.5) : undefined,
                          }}
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

              {step === 'horario' && servicoSelecionado && dataSelecionada && (
                <div className="bg-[#1a1a1a] rounded-2xl p-4" style={{ border: `1px solid ${hexComOpacidade(tema.hex, 0.2)}` }}>
                  <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => setStep('data')} className="text-gray-500 hover:text-white">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h3 className="font-medium text-white">{servicoSelecionado.nome}</h3>
                      <p className="text-xs text-gray-500">
                        {format(dataSelecionada, "EEEE, d 'de' MMMM", { locale: ptBR })}
                        {profissionalSelecionada && <span style={{ color: tema.hex }}> · {profissionalSelecionada.nome}</span>}
                      </p>
                    </div>
                  </div>

                  {loadingHorarios ? (
                    <div className="py-8 text-center text-gray-500 text-sm">Carregando horários...</div>
                  ) : horariosDisponiveis.length === 0 ? (
                    <div className="py-8 text-center text-gray-500 text-sm">
                      <Calendar className="w-6 h-6 mx-auto mb-2 opacity-40" />
                      Sem horários disponíveis neste dia
                      {profissionalSelecionada && temMultiplasProfissionais && (
                        <p className="text-xs mt-1">
                          <button
                            onClick={() => setStep('profissional')}
                            className="hover:underline"
                            style={{ color: tema.hex }}
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
                              selecionadoSlot ? '' : 'bg-[#111111] border-white/10 text-gray-300'
                            }`}
                            style={selecionadoSlot ? { backgroundColor: tema.hex, borderColor: tema.hex, color: '#0f0f0f' } : undefined}
                            onMouseEnter={(e) => { if (!selecionadoSlot) e.currentTarget.style.borderColor = hexComOpacidade(tema.hex, 0.5) }}
                            onMouseLeave={(e) => { if (!selecionadoSlot) e.currentTarget.style.borderColor = '' }}
                          >
                            {h}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {step === 'cliente' && servicoSelecionado && dataSelecionada && horarioSelecionado && (
                <div className="bg-[#1a1a1a] rounded-2xl p-4 space-y-4" style={{ border: `1px solid ${hexComOpacidade(tema.hex, 0.2)}` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <button onClick={() => setStep('horario')} className="text-gray-500 hover:text-white">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h3 className="font-medium text-white">Seus dados</h3>
                  </div>

                  <div className="rounded-xl p-3 text-sm space-y-1 bg-[#111111]">
                    <div className="flex justify-between text-gray-300">
                      <span>{servicoSelecionado.nome}</span>
                      <span className="font-medium">{formatCurrency(servicoSelecionado.preco)}</span>
                    </div>
                    {profissionalSelecionada && (
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: tema.hex }}>
                        <UserCircle2 className="w-3 h-3" />
                        {profissionalSelecionada.nome}
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      {format(dataSelecionada, "d 'de' MMMM", { locale: ptBR })} às {horarioSelecionado}
                    </div>
                  </div>

                  {clienteLogado ? (
                    <>
                      <div className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2.5 text-sm">
                        <span className="text-gray-300">
                          Agendando como <span className="font-medium text-white">{clienteLogado.nome}</span>
                          {' · '}{maskTelefone(clienteLogado.telefone)}
                        </span>
                        <button
                          onClick={() => setLoginModal(true)}
                          className="text-xs font-medium hover:underline shrink-0 ml-2"
                          style={{ color: tema.hex }}
                        >
                          Trocar
                        </button>
                      </div>

                      {assinaturaComCredito && (
                        <CreditoPlanoCard
                          assinatura={assinaturaComCredito}
                          usarCredito={usarCredito}
                          onChange={setUsarCredito}
                          dark
                        />
                      )}

                      {servicoSelecionado.aceitar_pagamento_online ? (
                        servicoSelecionado.sinal_obrigatorio ? (
                          <div className="space-y-3">
                            <div className="rounded-xl px-3 py-2.5" style={{ backgroundColor: hexComOpacidade(tema.hex, 0.1), border: `1px solid ${hexComOpacidade(tema.hex, 0.3)}` }}>
                              <p className="text-sm font-semibold" style={{ color: tema.hex }}>
                                Sinal: {formatCurrency(valorComDescontoDoPlano(calcularValorSinal(servicoSelecionado.preco, servicoSelecionado.sinal_tipo, servicoSelecionado.sinal_valor)))}
                              </p>
                              <p className="text-xs text-gray-300 mt-1">
                                Este pagamento é não reembolsável. Em caso de cancelamento, o valor não será devolvido.
                              </p>
                            </div>
                            <label className="flex items-start gap-2 text-xs text-gray-400 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={concordaNaoReembolsavel}
                                onChange={(e) => setConcordaNaoReembolsavel(e.target.checked)}
                                className="w-4 h-4 mt-0.5 rounded border-gray-600 shrink-0"
                                style={{ accentColor: tema.hex }}
                              />
                              Li e concordo que este pagamento não é reembolsável
                            </label>
                            <Button
                              onClick={pagarEIrParaCheckout}
                              disabled={!concordaNaoReembolsavel}
                              loading={agendando}
                              className="w-full text-[#0f0f0f] hover:brightness-95" style={{ backgroundColor: tema.hex }}
                              size="lg"
                            >
                              Pagar sinal e confirmar agendamento
                            </Button>
                          </div>
                        ) : !mostrarPagamentoOpcional ? (
                          <div className="space-y-2.5">
                            <Button
                              onClick={() => setMostrarPagamentoOpcional(true)}
                              className="w-full text-[#0f0f0f] hover:brightness-95" style={{ backgroundColor: tema.hex }}
                              size="lg"
                            >
                              Pagar agora ({formatCurrency(valorComDescontoDoPlano(servicoSelecionado.preco))})
                            </Button>
                            <Button
                              onClick={confirmarAgendamento}
                              loading={agendando}
                              variant="outline"
                              className="w-full !border-white/30 !text-white hover:!bg-white/10 !bg-transparent"
                              size="lg"
                            >
                              Pagar na hora do atendimento
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="rounded-xl px-3 py-2.5" style={{ backgroundColor: hexComOpacidade(tema.hex, 0.1), border: `1px solid ${hexComOpacidade(tema.hex, 0.3)}` }}>
                              <p className="text-xs text-gray-300">
                                Este pagamento é não reembolsável. Em caso de cancelamento, o valor não será devolvido.
                              </p>
                            </div>
                            <label className="flex items-start gap-2 text-xs text-gray-400 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={concordaNaoReembolsavel}
                                onChange={(e) => setConcordaNaoReembolsavel(e.target.checked)}
                                className="w-4 h-4 mt-0.5 rounded border-gray-600 shrink-0"
                                style={{ accentColor: tema.hex }}
                              />
                              Li e concordo que este pagamento não é reembolsável
                            </label>
                            <Button
                              onClick={pagarEIrParaCheckout}
                              disabled={!concordaNaoReembolsavel}
                              loading={agendando}
                              className="w-full text-[#0f0f0f] hover:brightness-95" style={{ backgroundColor: tema.hex }}
                              size="lg"
                            >
                              Pagar e confirmar agendamento
                            </Button>
                            <button
                              type="button"
                              onClick={() => setMostrarPagamentoOpcional(false)}
                              className="text-xs text-gray-500 hover:underline w-full text-center"
                            >
                              Voltar
                            </button>
                          </div>
                        )
                      ) : (
                        <Button
                          onClick={confirmarAgendamento}
                          loading={agendando}
                          className="w-full text-[#0f0f0f] hover:brightness-95" style={{ backgroundColor: tema.hex }}
                          size="lg"
                        >
                          Confirmar agendamento
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button
                      onClick={() => { if (isDemo) { loginDemoInstantaneo() } else { setPendingBooking(true); setLoginModal(true) } }}
                      className="w-full text-[#0f0f0f] hover:brightness-95" style={{ backgroundColor: tema.hex }}
                      size="lg"
                    >
                      Entrar para confirmar
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── FLOATING BUTTONS ───────────────────── */}
      {(waUrl || igHandle) && (
        <div className="fixed bottom-6 right-5 flex flex-col gap-3 z-40">
          {igHandle && (
            <a
              href={`https://instagram.com/${igHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`Instagram @${igHandle}`}
              className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:scale-110 transition-transform duration-200"
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

      {/* ── MODAL LOGIN / CADASTRO / RECUPERAÇÃO ── */}
      <Modal
        open={loginModal}
        onClose={fecharLoginModal}
        title={authMode === 'login' ? 'Entrar' : authMode === 'cadastro' ? 'Criar conta' : 'Recuperar senha'}
      >
        <div className="p-6 space-y-4">
          {authMode === 'login' && (
            <>
              <p className="text-sm text-gray-500">Para agendar, entre na sua conta.</p>

              <button
                onClick={loginComGoogle}
                className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-2xl py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.705 17.64 9.2z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Continuar com Google
              </button>

              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="flex-1 h-px bg-gray-100" />
                <span>ou entre com telefone</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              <Input
                label="WhatsApp"
                type="tel"
                placeholder="(11) 99999-9999"
                value={telefoneAuth}
                onChange={(e) => setTelefoneAuth(maskTelefone(e.target.value))}
              />
              <Input
                label="Senha"
                type="password"
                placeholder="••••••"
                value={senhaAuth}
                onChange={(e) => setSenhaAuth(e.target.value)}
              />
              <Button onClick={submitLogin} loading={enviandoAuth} className="w-full text-[#0f0f0f] hover:brightness-95" style={{ backgroundColor: tema.hex }}>
                Entrar
              </Button>
              <div className="flex items-center justify-between text-xs">
                <button
                  onClick={() => { setAuthMode('cadastro'); setAuthStep('inicio'); setSenhaAuth('') }}
                  className="hover:underline"
                  style={{ color: tema.hexDark }}
                >
                  Criar conta
                </button>
                <button
                  onClick={() => { setAuthMode('recuperacao'); setAuthStep('inicio'); setSenhaAuth('') }}
                  className="text-gray-400 hover:underline"
                >
                  Esqueci minha senha
                </button>
              </div>
            </>
          )}

          {authMode === 'recuperacao' && authStep === 'inicio' && numeroNaoEncontrado ? (
            <>
              <p className="text-sm text-gray-600">
                Não encontramos nenhuma conta com esse número. Verifique o número ou crie uma conta.
              </p>
              <Button
                onClick={() => { setAuthMode('cadastro'); setNumeroNaoEncontrado(false) }}
                className="w-full text-[#0f0f0f] hover:brightness-95" style={{ backgroundColor: tema.hex }}
              >
                Criar conta
              </Button>
              <button
                onClick={() => { setNumeroNaoEncontrado(false) }}
                className="text-xs text-gray-400 hover:underline w-full text-center"
              >
                Tentar outro número
              </button>
            </>
          ) : authMode !== 'login' && authStep === 'inicio' && (
            <>
              {googleEmail && authMode === 'cadastro' && (
                <div className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5 text-xs text-blue-700">
                  <svg width="14" height="14" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0" aria-hidden>
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.705 17.64 9.2z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                  <span>Google: <span className="font-medium">{googleEmail}</span> — confirme seu telefone para concluir.</span>
                </div>
              )}
              <p className="text-sm text-gray-500">
                {authMode === 'cadastro'
                  ? 'Digite seu telefone para receber um código de confirmação.'
                  : 'Digite o telefone da sua conta para receber um código.'}
              </p>
              <Input
                label="WhatsApp"
                type="tel"
                placeholder="(11) 99999-9999"
                value={telefoneAuth}
                onChange={(e) => setTelefoneAuth(maskTelefone(e.target.value))}
              />
              <Button onClick={enviarCodigo} loading={enviandoAuth} className="w-full text-[#0f0f0f] hover:brightness-95" style={{ backgroundColor: tema.hex }}>
                Enviar código
              </Button>
              <button
                onClick={() => { setAuthMode('login'); setAuthStep('inicio'); setGoogleEmail('') }}
                className="text-xs text-gray-400 hover:underline w-full text-center"
              >
                Voltar
              </button>
            </>
          )}

          {authMode !== 'login' && authStep === 'codigo' && (
            <>
              <p className="text-sm text-gray-500">
                Digite o código enviado por SMS para {maskTelefone(telefoneAuth)}.
              </p>
              <Input
                label="Código"
                inputMode="numeric"
                placeholder="123456"
                value={codigoAuth}
                onChange={(e) => setCodigoAuth(e.target.value.replace(/\D/g, ''))}
              />
              <Button onClick={verificarCodigo} loading={enviandoAuth} className="w-full text-[#0f0f0f] hover:brightness-95" style={{ backgroundColor: tema.hex }}>
                Confirmar
              </Button>
              <button
                onClick={() => setAuthStep('inicio')}
                className="text-xs text-gray-400 hover:underline w-full text-center"
              >
                Trocar número
              </button>
            </>
          )}

          {authMode === 'cadastro' && authStep === 'finalizar' && (
            <>
              <p className="text-sm text-gray-500">Falta pouco! Defina seu nome e uma senha.</p>
              <Input
                label="Seu nome"
                placeholder="Maria Silva"
                value={nomeAuth}
                onChange={(e) => setNomeAuth(e.target.value)}
              />
              <Input
                label="Crie uma senha"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={senhaAuth}
                onChange={(e) => setSenhaAuth(e.target.value)}
              />
              <Button onClick={finalizarCadastro} loading={enviandoAuth} className="w-full text-[#0f0f0f] hover:brightness-95" style={{ backgroundColor: tema.hex }}>
                Criar conta
              </Button>
            </>
          )}

          {authMode === 'recuperacao' && authStep === 'finalizar' && (
            <>
              <p className="text-sm text-gray-500">Código confirmado! Defina sua nova senha.</p>
              <Input
                label="Nova senha"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={senhaAuth}
                onChange={(e) => setSenhaAuth(e.target.value)}
              />
              <Button onClick={redefinirSenha} loading={enviandoAuth} className="w-full text-[#0f0f0f] hover:brightness-95" style={{ backgroundColor: tema.hex }}>
                Salvar nova senha
              </Button>
            </>
          )}
        </div>
      </Modal>

      <MeusPlanosModal
        open={meusPlanosModal}
        onClose={() => setMeusPlanosModal(false)}
        prestadoraId={prestadora.id}
        corTema={tema.hex}
      />

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
              <div key={a.id} className="p-3 bg-gray-50 rounded-xl space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{a.servicos?.nome}</p>
                    {a.profissionais && (
                      <p className="text-xs" style={{ color: tema.hexDark }}>{a.profissionais.nome}</p>
                    )}
                    <p className="text-xs text-gray-400">{formatDateTime(a.data_hora)}</p>
                  </div>
                  <Badge variant={a.status === 'confirmado' ? 'success' : 'danger'}>
                    {a.status === 'confirmado' ? 'Confirmado' : 'Cancelado'}
                  </Badge>
                </div>
                {a.status === 'confirmado' && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => setAgendamentoParaCancelar(a)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-white hover:bg-red-500 border border-red-200 hover:border-red-500 rounded-lg px-3 py-1.5 min-h-9 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* ── MODAL CONFIRMAR CANCELAMENTO ────────── */}
      <Modal
        open={!!agendamentoParaCancelar}
        onClose={() => setAgendamentoParaCancelar(null)}
        title="Cancelar agendamento"
      >
        {agendamentoParaCancelar && (
          <div className="p-6 space-y-5">
            <p className="text-sm text-gray-600">
              Tem certeza que deseja cancelar seu agendamento de{' '}
              <span className="font-semibold text-gray-900">{agendamentoParaCancelar.servicos?.nome}</span>
              {' '}em{' '}
              <span className="font-semibold text-gray-900">
                {format(new Date(agendamentoParaCancelar.data_hora), "d 'de' MMMM", { locale: ptBR })}
              </span>
              {' '}às{' '}
              <span className="font-semibold text-gray-900">
                {format(new Date(agendamentoParaCancelar.data_hora), 'HH:mm')}
              </span>
              ?
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <Button
                variant="outline"
                onClick={() => setAgendamentoParaCancelar(null)}
                className="flex-1"
              >
                Voltar
              </Button>
              <Button
                variant="danger"
                onClick={confirmarCancelamento}
                loading={cancelando}
                className="flex-1"
              >
                Sim, cancelar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── GALERIA LIGHTBOX ────────────────────── */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-xl transition-colors"
            onClick={() => setLightbox(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white p-2 hover:bg-white/10 rounded-xl transition-colors"
            onClick={(e) => { e.stopPropagation(); setLightbox({ ...lightbox, index: Math.max(0, lightbox.index - 1) }) }}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="max-w-xl w-full" onClick={(e) => e.stopPropagation()}>
            {lightbox.lista[lightbox.index].tipo === 'video' ? (
              <video src={lightbox.lista[lightbox.index].url} controls className="rounded-2xl w-full max-h-[80vh]" />
            ) : (
              <Image
                src={lightbox.lista[lightbox.index].url}
                alt={`Foto ${lightbox.index + 1} de ${prestadora.nome}`}
                width={600}
                height={600}
                className="rounded-2xl w-full max-h-[80vh] object-contain"
              />
            )}
          </div>
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white p-2 hover:bg-white/10 rounded-xl transition-colors"
            onClick={(e) => { e.stopPropagation(); setLightbox({ ...lightbox, index: Math.min(lightbox.lista.length - 1, lightbox.index + 1) }) }}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-xs">
            {lightbox.index + 1} / {lightbox.lista.length}
          </div>
        </div>
      )}
    </div>
  )
}
