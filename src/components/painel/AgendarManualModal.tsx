'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import {
  cn, formatCurrency, maskTelefone, generateTimeSlots,
  formatDateKey, formatTime, dateKeyToDate,
  computeHorasDoDia, diaIndisponivelParaAgendar,
} from '@/lib/utils'
import {
  Search, Plus, ChevronLeft, User, Phone, Scissors, UserCircle2, Calendar as CalendarIcon, Clock,
} from 'lucide-react'
import type { Agendamento, HorarioFuncionamento } from '@/lib/types'
import toast from 'react-hot-toast'

type Step = 'cliente' | 'novaCliente' | 'servico' | 'profissional' | 'data' | 'horario'

interface ClienteOption {
  id: string
  nome: string
  telefone: string | null
  cliente_manual: boolean
}

interface ServicoOption {
  id: string
  nome: string
  preco: number
  duracao_minutos: number
  servico_profissionais: { profissional_id: string }[]
}

interface ProfissionalOption {
  id: string
  nome: string
  hora_abertura: string | null
  hora_fechamento: string | null
  dias_semana: number[] | null
  intervalo_inicio: string | null
  intervalo_fim: string | null
}

interface Props {
  onClose: () => void
  prestadoraId: string
  onCriado: (agendamento: Agendamento) => void
}

// Renderizado só enquanto o modal está aberto (ver AgendarButton) — cada
// abertura monta uma instância nova, então não precisa resetar estado num
// effect: os useState abaixo já nascem limpos a cada montagem.
export function AgendarManualModal({ onClose, prestadoraId, onCriado }: Props) {
  const [step, setStep] = useState<Step>('cliente')
  const [carregandoDados, setCarregandoDados] = useState(true)

  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [servicos, setServicos] = useState<ServicoOption[]>([])
  const [profissionais, setProfissionais] = useState<ProfissionalOption[]>([])
  const [horariosFuncionamento, setHorariosFuncionamento] = useState<HorarioFuncionamento[]>([])
  const [diasBloqueados, setDiasBloqueados] = useState<string[]>([])
  const [horaAberturaPadrao, setHoraAberturaPadrao] = useState('09:00')
  const [horaFechamentoPadrao, setHoraFechamentoPadrao] = useState('18:00')

  const [busca, setBusca] = useState('')
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteOption | null>(null)

  const [novoNome, setNovoNome] = useState('')
  const [novoTelefone, setNovoTelefone] = useState('')
  const [criandoCliente, setCriandoCliente] = useState(false)

  const [servicoSelecionado, setServicoSelecionado] = useState<ServicoOption | null>(null)
  const [profissionalSelecionado, setProfissionalSelecionado] = useState<ProfissionalOption | null>(null)
  const [dataSelecionada, setDataSelecionada] = useState('')
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null)
  const [horariosOcupados, setHorariosOcupados] = useState<{ start: number; end: number }[]>([])
  const [carregandoHorarios, setCarregandoHorarios] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  // Carrega os dados necessários assim que o modal monta.
  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('agendamentos').select('clientes(id, nome, telefone, cliente_manual)').eq('prestadora_id', prestadoraId),
      supabase.from('servicos').select('id, nome, preco, duracao_minutos, servico_profissionais(profissional_id)').eq('prestadora_id', prestadoraId).eq('ativo', true).order('nome'),
      supabase.from('profissionais').select('id, nome, hora_abertura, hora_fechamento, dias_semana, intervalo_inicio, intervalo_fim').eq('prestadora_id', prestadoraId).eq('ativa', true).order('nome'),
      supabase.from('horarios_funcionamento').select('*').eq('prestadora_id', prestadoraId),
      supabase.from('dias_bloqueados').select('data').eq('prestadora_id', prestadoraId),
      supabase.from('prestadoras').select('hora_abertura, hora_fechamento').eq('id', prestadoraId).single(),
    ]).then(([agRes, servRes, profRes, horRes, bloqRes, prestRes]) => {
      const mapaClientes = new Map<string, ClienteOption>()
      for (const row of (agRes.data ?? []) as unknown as { clientes: ClienteOption | null }[]) {
        if (row.clientes && !mapaClientes.has(row.clientes.id)) mapaClientes.set(row.clientes.id, row.clientes)
      }
      setClientes(Array.from(mapaClientes.values()).sort((a, b) => a.nome.localeCompare(b.nome)))
      setServicos((servRes.data ?? []) as unknown as ServicoOption[])
      setProfissionais(profRes.data ?? [])
      setHorariosFuncionamento((horRes.data ?? []) as HorarioFuncionamento[])
      setDiasBloqueados((bloqRes.data ?? []).map((d) => d.data as string))
      if (prestRes.data) {
        setHoraAberturaPadrao(prestRes.data.hora_abertura)
        setHoraFechamentoPadrao(prestRes.data.hora_fechamento)
      }
      setCarregandoDados(false)
    })
  }, [prestadoraId])

  const clientesFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return clientes
    return clientes.filter((c) => c.nome.toLowerCase().includes(q) || c.telefone?.includes(q))
  }, [clientes, busca])

  const profissionaisDoServico = useMemo(() => {
    if (!servicoSelecionado) return []
    const ids = servicoSelecionado.servico_profissionais.map((sp) => sp.profissional_id)
    return ids.length === 0 ? profissionais : profissionais.filter((p) => ids.includes(p.id))
  }, [servicoSelecionado, profissionais])

  const horaMinima = formatDateKey(new Date())

  // Mesma lógica de disponibilidade da página pública (/n/[slug]), agora
  // compartilhada via @/lib/utils — já considera horário próprio da
  // profissional selecionada (quando ela tem um) e os dias que ela atende.
  function diaInfo(dataChave: string) {
    const diaSemana = dateKeyToDate(dataChave).getUTCDay()
    const indisponivel = diaIndisponivelParaAgendar(
      diaSemana, dataChave, diasBloqueados, horariosFuncionamento, profissionalSelecionado
    )
    const horas = computeHorasDoDia(
      diaSemana, horariosFuncionamento, profissionalSelecionado, horaAberturaPadrao, horaFechamentoPadrao
    )
    return { indisponivel, ...horas }
  }

  async function selecionarCliente(c: ClienteOption) {
    setClienteSelecionado(c)
    setStep('servico')
  }

  async function criarNovaCliente(e: React.FormEvent) {
    e.preventDefault()
    const nome = novoNome.trim()
    if (nome.length < 2) {
      toast.error('Informe o nome da cliente.')
      return
    }
    setCriandoCliente(true)
    try {
      const res = await fetch('/api/clientes/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, telefone: novoTelefone }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao criar cliente.')
        return
      }
      setClientes((prev) => prev.some((c) => c.id === data.cliente.id) ? prev : [...prev, data.cliente].sort((a, b) => a.nome.localeCompare(b.nome)))
      selecionarCliente(data.cliente)
    } catch {
      toast.error('Erro de conexão.')
    } finally {
      setCriandoCliente(false)
    }
  }

  function selecionarServico(s: ServicoOption) {
    setServicoSelecionado(s)
    const idsRestritos = s.servico_profissionais.map((sp) => sp.profissional_id)
    const disponiveis = idsRestritos.length === 0 ? profissionais : profissionais.filter((p) => idsRestritos.includes(p.id))
    if (disponiveis.length === 0) {
      // Nenhuma profissional disponível pra esse serviço — não tem o que
      // escolher, segue sem profissional definida.
      setProfissionalSelecionado(null)
      setStep('data')
      return
    }
    // A etapa sempre aparece (nunca pula), mas pré-seleciona quando só há uma
    // opção real — só pra facilitar o clique, não pra pular a confirmação.
    setProfissionalSelecionado(disponiveis.length === 1 ? disponiveis[0] : null)
    setStep('profissional')
  }

  function selecionarProfissional(p: ProfissionalOption | null) {
    setProfissionalSelecionado(p)
    setDataSelecionada('')
    setHorarioSelecionado(null)
    setStep('data')
  }

  async function selecionarData(dataChave: string) {
    if (diaInfo(dataChave).indisponivel) {
      toast.error('Esse dia não está disponível pra agendar.')
      return
    }
    setDataSelecionada(dataChave)
    setHorarioSelecionado(null)
    setCarregandoHorarios(true)
    setStep('horario')

    const params = new URLSearchParams({ prestadoraId, data: dataChave })
    if (profissionalSelecionado) params.set('profissionalId', profissionalSelecionado.id)

    try {
      const res = await fetch(`/api/agendamentos/horarios-ocupados?${params.toString()}`)
      const data = res.ok ? await res.json() : { ocupados: [] }
      setHorariosOcupados(data.ocupados ?? [])
    } catch {
      setHorariosOcupados([])
    } finally {
      setCarregandoHorarios(false)
    }
  }

  const infoDia = dataSelecionada ? diaInfo(dataSelecionada) : null

  // Cálculo simples e barato (não precisa de useMemo — e useMemo aqui violaria
  // a regra de pureza, já que "agora"/"hoje" mudam sem nenhuma dependência
  // do memo mudar junto). Mesmo padrão da página pública (/n/[slug]).
  const horariosDisponiveis = (() => {
    if (!servicoSelecionado || !dataSelecionada || !infoDia) return []
    const todosSlots = generateTimeSlots(
      infoDia.abertura, infoDia.fechamento, servicoSelecionado.duracao_minutos,
      infoDia.turno2Inicio, infoDia.turno2Fim
    )
    const semSobreposicao = todosSlots.filter((h) => {
      const [hh, mm] = h.split(':').map(Number)
      const [ano, mes, dia] = dataSelecionada.split('-').map(Number)
      const inicio = new Date(ano, mes - 1, dia, hh, mm).getTime()
      const fim = inicio + servicoSelecionado.duracao_minutos * 60000
      return !horariosOcupados.some(({ start, end }) => inicio < end && fim > start)
    })

    // Se a data escolhida é hoje (em horário de Brasília), esconde horários
    // que já passaram — comparar em UTC bugava perto da meia-noite/troca de
    // fuso, já que São Paulo está 3h atrás.
    if (dataSelecionada !== formatDateKey(new Date())) return semSobreposicao
    const horaAtual = formatTime(new Date())
    return semSobreposicao.filter((h) => h > horaAtual)
  })()

  async function confirmar() {
    if (!clienteSelecionado || !servicoSelecionado || !dataSelecionada || !horarioSelecionado) return
    setConfirmando(true)
    try {
      const [hh, mm] = horarioSelecionado.split(':').map(Number)
      const [ano, mes, dia] = dataSelecionada.split('-').map(Number)
      const dataHora = new Date(ano, mes - 1, dia, hh, mm).toISOString()

      const res = await fetch('/api/agendamentos/criar-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: clienteSelecionado.id,
          servicoId: servicoSelecionado.id,
          profissionalId: profissionalSelecionado?.id ?? null,
          dataHora,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao agendar.')
        return
      }
      toast.success('Agendamento criado!')
      onCriado(data.agendamento)
    } catch {
      toast.error('Erro de conexão.')
    } finally {
      setConfirmando(false)
    }
  }

  const diasSugeridos = useMemo(() => {
    const hoje = new Date()
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i)
      return formatDateKey(d)
    })
  }, [])

  return (
    <Modal open onClose={onClose} title="Novo agendamento" className="max-w-lg">
      {carregandoDados ? (
        <div className="py-16 text-center text-gray-400 text-sm">Carregando...</div>
      ) : (
        <div className="p-6">
          {/* ── Etapa 1: cliente ── */}
          {step === 'cliente' && (
            <div className="space-y-4">
              <Input
                icon={<Search className="w-4 h-4" />}
                placeholder="Buscar cliente por nome ou telefone..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setStep('novaCliente')}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-rose-200 text-rose-500 hover:bg-rose-50 rounded-xl py-3 text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nova cliente
              </button>
              <div className="max-h-80 overflow-y-auto -mx-2 px-2 space-y-1">
                {clientesFiltrados.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-6">Nenhuma cliente encontrada</p>
                ) : (
                  clientesFiltrados.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selecionarCliente(c)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-500 font-bold text-sm flex items-center justify-center shrink-0">
                        {c.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5 truncate">
                          {c.nome}
                          {c.cliente_manual && (
                            <span className="inline-flex items-center bg-violet-100 text-violet-700 rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0">
                              Manual
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">{c.telefone ? maskTelefone(c.telefone) : 'Sem telefone'}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── Nova cliente (mini-formulário) ── */}
          {step === 'novaCliente' && (
            <form onSubmit={criarNovaCliente} className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <button type="button" onClick={() => setStep('cliente')} className="text-gray-400 hover:text-gray-600">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="font-medium text-gray-900">Nova cliente</h3>
              </div>
              <Input
                icon={<User className="w-4 h-4" />}
                label="Nome"
                placeholder="Nome da cliente"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                required
              />
              <Input
                icon={<Phone className="w-4 h-4" />}
                label="Telefone (opcional)"
                placeholder="(11) 99999-9999"
                value={novoTelefone}
                onChange={(e) => setNovoTelefone(e.target.value)}
              />
              <Button type="submit" loading={criandoCliente} className="w-full">
                Salvar e continuar
              </Button>
            </form>
          )}

          {/* ── Etapa 2: serviço ── */}
          {step === 'servico' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <button type="button" onClick={() => setStep('cliente')} className="text-gray-400 hover:text-gray-600">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="font-medium text-gray-900">Escolha o serviço</h3>
                {clienteSelecionado && <span className="ml-auto text-xs text-gray-400">{clienteSelecionado.nome}</span>}
              </div>
              {servicos.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">Nenhum serviço cadastrado</p>
              ) : (
                <div className="max-h-96 overflow-y-auto space-y-2 -mx-1 px-1">
                  {servicos.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => selecionarServico(s)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-rose-200 hover:bg-rose-50/50 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                        <Scissors className="w-4 h-4 text-rose-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.nome}</p>
                        <p className="text-xs text-gray-400">{s.duracao_minutos} min</p>
                      </div>
                      <span className="text-sm font-semibold text-rose-500 shrink-0">{formatCurrency(s.preco)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Profissional ── */}
          {step === 'profissional' && servicoSelecionado && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <button type="button" onClick={() => setStep('servico')} className="text-gray-400 hover:text-gray-600">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="font-medium text-gray-900">Escolha a profissional</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {profissionaisDoServico.map((p) => {
                  const selecionada = profissionalSelecionado?.id === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selecionarProfissional(p)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors',
                        selecionada
                          ? 'border-rose-300 bg-rose-50 ring-2 ring-rose-200'
                          : 'border-gray-100 hover:border-rose-200 hover:bg-rose-50/50'
                      )}
                    >
                      <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-500 font-bold flex items-center justify-center">
                        {p.nome.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-sm font-medium text-gray-900 text-center">{p.nome}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Data ── */}
          {step === 'data' && servicoSelecionado && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => setStep(profissionaisDoServico.length > 0 ? 'profissional' : 'servico')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="font-medium text-gray-900">Escolha a data</h3>
              </div>
              <Input
                icon={<CalendarIcon className="w-4 h-4" />}
                type="date"
                min={horaMinima}
                value={dataSelecionada}
                onChange={(e) => e.target.value && selecionarData(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5">
                {diasSugeridos.slice(0, 8).map((d) => {
                  const { indisponivel } = diaInfo(d)
                  const label = dateKeyToDate(d)
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={indisponivel}
                      onClick={() => selecionarData(d)}
                      title={indisponivel ? 'Indisponível nesse dia' : undefined}
                      className={cn(
                        'flex flex-col items-center px-3 py-2 rounded-xl text-xs font-medium transition-all min-w-14',
                        dataSelecionada === d
                          ? 'bg-rose-400 text-white'
                          : indisponivel
                            ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      <span className="capitalize">{label.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' })}</span>
                      <span className="text-sm font-semibold">{label.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Horário ── */}
          {step === 'horario' && servicoSelecionado && dataSelecionada && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <button type="button" onClick={() => setStep('data')} className="text-gray-400 hover:text-gray-600">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h3 className="font-medium text-gray-900">Escolha o horário</h3>
                  <p className="text-xs text-gray-400">
                    {dateKeyToDate(dataSelecionada).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })}
                  </p>
                </div>
              </div>

              {carregandoHorarios ? (
                <div className="py-8 text-center text-gray-400 text-sm">Carregando horários...</div>
              ) : horariosDisponiveis.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">
                  <Clock className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  Sem horários disponíveis nesse dia
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                  {horariosDisponiveis.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHorarioSelecionado(h)}
                      className={cn(
                        'py-2.5 rounded-xl text-sm font-medium transition-all border',
                        horarioSelecionado === h
                          ? 'bg-rose-400 border-rose-400 text-white'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-rose-300 hover:bg-rose-50'
                      )}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              )}

              {/* Resumo + confirmar */}
              {horarioSelecionado && (
                <div className="pt-3 border-t border-gray-100 space-y-3">
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1 text-sm">
                    <p className="flex items-center gap-2 text-gray-700">
                      <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      {clienteSelecionado?.nome}
                    </p>
                    <p className="flex items-center gap-2 text-gray-700">
                      <Scissors className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      {servicoSelecionado.nome} · {formatCurrency(servicoSelecionado.preco)}
                    </p>
                    {profissionalSelecionado && (
                      <p className="flex items-center gap-2 text-gray-700">
                        <UserCircle2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        {profissionalSelecionado.nome}
                      </p>
                    )}
                  </div>
                  <Button onClick={confirmar} loading={confirmando} className="w-full">
                    Confirmar agendamento
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
