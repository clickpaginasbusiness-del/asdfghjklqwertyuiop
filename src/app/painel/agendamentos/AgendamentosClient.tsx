'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { formatCurrency, formatDateTime, formatDateShort, maskTelefone, buildWhatsappUrl } from '@/lib/utils'
import { Calendar, Phone, Search, MessageCircle, ArrowDownAZ, ArrowUpAZ, Clock4, CheckCheck, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Agendamento, Profissional } from '@/lib/types'
import toast from 'react-hot-toast'

type FiltroStatus = 'todos' | 'confirmado' | 'concluido' | 'cancelado'
type Ordenacao = 'recente' | 'antigo' | 'proximo'

function buildMsgConfirmar(a: Agendamento): string {
  const prof = a.profissionais?.nome ? ` com ${a.profissionais.nome}` : ''
  const dt = formatDateShort(a.data_hora)
  return `Olá ${a.clientes?.nome}! Confirmando seu agendamento de ${a.servicos?.nome}${prof} no dia ${dt}. Te esperamos! 💅 - BelleBook`
}

function buildMsgCancelar(a: Agendamento): string {
  const dt = formatDateShort(a.data_hora)
  return `Olá ${a.clientes?.nome}, infelizmente precisamos cancelar seu agendamento de ${a.servicos?.nome} no dia ${dt}. Entre em contato para remarcar. - BelleBook`
}

const FILTROS_STATUS: { value: FiltroStatus; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'confirmado', label: 'Confirmados' },
  { value: 'concluido', label: 'Concluídos' },
  { value: 'cancelado', label: 'Cancelados' },
]

const ORDENACOES: { value: Ordenacao; label: string; icon: React.ElementType }[] = [
  { value: 'recente', label: 'Mais recente', icon: ArrowDownAZ },
  { value: 'antigo', label: 'Mais antigo', icon: ArrowUpAZ },
  { value: 'proximo', label: 'Próximos', icon: Clock4 },
]

function sortAgendamentos(list: Agendamento[], ordem: Ordenacao): Agendamento[] {
  const sorted = [...list]
  if (ordem === 'recente') {
    return sorted.sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime())
  }
  if (ordem === 'antigo') {
    return sorted.sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())
  }
  // proximo: futuros mais próximos primeiro, depois passados mais recentes
  const now = Date.now()
  return sorted.sort((a, b) => {
    const aTime = new Date(a.data_hora).getTime()
    const bTime = new Date(b.data_hora).getTime()
    const aFut = aTime >= now
    const bFut = bTime >= now
    if (aFut && bFut) return aTime - bTime
    if (!aFut && !bFut) return bTime - aTime
    return aFut ? -1 : 1
  })
}

export default function AgendamentosClient({
  agendamentos: initialAgendamentos,
  profissionais,
  prestadoraId,
}: {
  agendamentos: Agendamento[]
  profissionais: Profissional[]
  prestadoraId: string
}) {
  const [agendamentos, setAgendamentos] = useState(initialAgendamentos)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos')
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('proximo')
  const [filtroProfissional, setFiltroProfissional] = useState<string | null>(null)
  const [cancelando, setCancelando] = useState<string | null>(null)
  const [concluindoId, setConcluindoId] = useState<string | null>(null)
  const [confirmModalId, setConfirmModalId] = useState<string | null>(null)
  const [deleteModalId, setDeleteModalId] = useState<string | null>(null)
  const [waOpenId, setWaOpenId] = useState<string | null>(null)

  const filtrados = sortAgendamentos(
    agendamentos.filter((a) => {
      const q = busca.toLowerCase()
      const matchBusca =
        !busca ||
        a.clientes?.nome.toLowerCase().includes(q) ||
        a.clientes?.telefone.includes(q) ||
        a.servicos?.nome.toLowerCase().includes(q)

      const matchProfissional =
        filtroProfissional === null ||
        (filtroProfissional === 'sem' ? !a.profissional_id : a.profissional_id === filtroProfissional)

      const matchStatus = filtroStatus === 'todos' || a.status === filtroStatus

      return matchBusca && matchProfissional && matchStatus
    }),
    ordenacao
  )

  async function cancelar(id: string) {
    setCancelando(id)
    const supabase = createClient()
    const ag = agendamentos.find((a) => a.id === id)
    const { error } = await supabase
      .from('agendamentos')
      .update({ status: 'cancelado', cancelado_por: 'prestadora' })
      .eq('id', id)

    if (error) {
      toast.error('Erro ao cancelar')
      setCancelando(null)
      return
    }

    if (ag) {
      const profNome = ag.profissionais?.nome ? ` com ${ag.profissionais.nome}` : ''
      const dt = formatDateShort(ag.data_hora)
      await supabase.from('notificacoes').insert({
        prestadora_id: prestadoraId,
        tipo: 'cancelamento',
        mensagem: `Você cancelou o agendamento de ${ag.clientes?.nome} - ${ag.servicos?.nome}${profNome} em ${dt}`,
      })
    }

    setAgendamentos((prev) => prev.map((a) => a.id === id ? { ...a, status: 'cancelado' as const } : a))
    toast.success('Agendamento cancelado')
    setCancelando(null)
    setConfirmModalId(null)
  }

  async function concluir(id: string) {
    setConcluindoId(id)
    const supabase = createClient()
    const { error } = await supabase
      .from('agendamentos')
      .update({ status: 'concluido' })
      .eq('id', id)

    if (error) {
      toast.error('Erro ao concluir')
    } else {
      setAgendamentos((prev) => prev.map((a) => a.id === id ? { ...a, status: 'concluido' as const } : a))
      toast.success('Atendimento concluído! ✓')
    }
    setConcluindoId(null)
  }

  async function excluir(id: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('agendamentos')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error('Erro ao excluir')
    } else {
      setAgendamentos((prev) => prev.filter((a) => a.id !== id))
      toast.success('Agendamento excluído')
    }
    setDeleteModalId(null)
  }

  const statusVariant = (status: string): 'success' | 'concluido' | 'danger' | 'default' => {
    if (status === 'confirmado') return 'success'
    if (status === 'concluido') return 'concluido'
    if (status === 'cancelado') return 'danger'
    return 'default'
  }

  const statusLabel = (status: string) => {
    if (status === 'confirmado') return 'Confirmado'
    if (status === 'concluido') return 'Concluído'
    if (status === 'cancelado') return 'Cancelado'
    return status
  }

  const temProfissionais = profissionais.length > 0
  const confirmadosCount = agendamentos.filter(a => a.status === 'confirmado').length

  return (
    <div className="space-y-4" onClick={() => waOpenId && setWaOpenId(null)}>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold text-gray-900">Agendamentos</h1>
        <Badge variant="pink">{confirmadosCount} confirmados</Badge>
      </div>

      {/* Busca */}
      <Input
        placeholder="Buscar por cliente, telefone ou serviço..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        icon={<Search className="w-4 h-4" />}
      />

      {/* Filtro de status + ordenação */}
      <div className="flex flex-wrap gap-y-3 gap-x-4">
        {/* Status */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTROS_STATUS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFiltroStatus(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-medium transition-all border',
                filtroStatus === f.value
                  ? f.value === 'confirmado'
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : f.value === 'concluido'
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : f.value === 'cancelado'
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-rose-400 text-white border-rose-400'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-rose-200'
              )}
            >
              {f.value === 'confirmado' && filtroStatus !== 'confirmado' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 align-middle" />}
              {f.value === 'concluido' && filtroStatus !== 'concluido' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-700 mr-1.5 align-middle" />}
              {f.value === 'cancelado' && filtroStatus !== 'cancelado' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mr-1.5 align-middle" />}
              {f.label}
            </button>
          ))}
        </div>

        {/* Separador vertical — oculto no mobile */}
        <div className="hidden sm:block w-px bg-gray-200 self-stretch" />

        {/* Ordenação */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {ORDENACOES.map((o) => {
            const Icon = o.icon
            return (
              <button
                key={o.value}
                onClick={() => setOrdenacao(o.value)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border',
                  ordenacao === o.value
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {o.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Filtro por profissional */}
      {temProfissionais && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFiltroProfissional(null)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-sm font-medium transition-all',
              filtroProfissional === null
                ? 'bg-rose-400 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-rose-200'
            )}
          >
            Todas
          </button>
          {profissionais.map((p) => (
            <button
              key={p.id}
              onClick={() => setFiltroProfissional(p.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all',
                filtroProfissional === p.id
                  ? 'bg-rose-400 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-rose-200'
              )}
            >
              {p.foto_url && (
                <Image src={p.foto_url} alt={p.nome} width={18} height={18} className="rounded-full object-cover" />
              )}
              {p.nome}
            </button>
          ))}
          <button
            onClick={() => setFiltroProfissional('sem')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-sm font-medium transition-all',
              filtroProfissional === 'sem'
                ? 'bg-rose-400 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-rose-200'
            )}
          >
            Sem profissional
          </button>
        </div>
      )}

      {/* Lista */}
      <Card>
        <CardContent className="p-0">
          {filtrados.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum agendamento encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtrados.map((a) => {
                const passou = new Date(a.data_hora) < new Date()
                return (
                  <div key={a.id} className="flex items-start sm:items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
                    {/* Avatar profissional */}
                    {temProfissionais && (
                      <div className="shrink-0 mt-0.5 sm:mt-0">
                        {a.profissionais?.foto_url ? (
                          <Image
                            src={a.profissionais.foto_url}
                            alt={a.profissionais.nome}
                            width={36}
                            height={36}
                            className="rounded-full object-cover border border-rose-100"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-400 font-bold text-sm flex items-center justify-center">
                            {a.profissionais?.nome.charAt(0) ?? '?'}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Conteúdo principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="font-medium text-gray-900 text-sm">{a.clientes?.nome}</p>
                        <Badge variant={statusVariant(a.status)}>{statusLabel(a.status)}</Badge>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {a.servicos?.nome}
                        {a.profissionais && (
                          <span className="text-gray-400"> · {a.profissionais.nome}</span>
                        )}
                        <span className="text-gray-400"> · {formatDateTime(a.data_hora)}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {/* Telefone */}
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Phone className="w-3 h-3 shrink-0" />
                          <span>{a.clientes?.telefone ? maskTelefone(a.clientes.telefone) : '—'}</span>
                        </div>

                        {/* WhatsApp pill dropdown */}
                        {a.clientes?.telefone && (
                          <div className="relative">
                            <button
                              onClick={(e) => { e.stopPropagation(); setWaOpenId(waOpenId === a.id ? null : a.id) }}
                              className="flex items-center gap-1 bg-green-50 hover:bg-green-100 border border-green-100 text-green-600 rounded-full px-2 py-0.5 text-xs font-medium transition-colors"
                            >
                              <MessageCircle className="w-3 h-3" />
                              WhatsApp
                            </button>
                            {waOpenId === a.id && (
                              <div
                                className="absolute left-0 bottom-full mb-1 z-20 bg-white border border-gray-100 rounded-xl shadow-xl p-1.5 space-y-0.5 w-52"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <a
                                  href={buildWhatsappUrl(a.clientes!.telefone, buildMsgConfirmar(a))}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => setWaOpenId(null)}
                                  className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-green-50 rounded-lg transition-colors"
                                >
                                  ✅ Enviar confirmação
                                </a>
                                <a
                                  href={buildWhatsappUrl(a.clientes!.telefone, buildMsgCancelar(a))}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => setWaOpenId(null)}
                                  className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  ❌ Enviar cancelamento
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Preço + ações */}
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <p className="text-sm font-medium text-gray-900">{formatCurrency(a.servicos?.preco ?? 0)}</p>

                      {/* Ações para confirmados */}
                      {a.status === 'confirmado' && (
                        <div className="flex items-center gap-2">
                          {/* Botão Concluído */}
                          <button
                            onClick={() => passou && !concluindoId && concluir(a.id)}
                            disabled={!passou || concluindoId === a.id}
                            title={!passou ? 'Disponível após o horário do atendimento' : 'Marcar como concluído'}
                            className={cn(
                              'flex items-center gap-1 text-xs rounded-lg px-2 py-1 font-medium transition-all border',
                              passou
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 cursor-pointer'
                                : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                            )}
                          >
                            <CheckCheck className="w-3 h-3" />
                            {concluindoId === a.id ? '...' : 'Concluído'}
                          </button>
                          {/* Cancelar */}
                          <button
                            onClick={() => setConfirmModalId(a.id)}
                            className="text-xs text-red-400 hover:text-red-500 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}

                      {/* Ação para cancelados */}
                      {a.status === 'cancelado' && (
                        <button
                          onClick={() => setDeleteModalId(a.id)}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          Excluir
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal cancelar */}
      <Modal open={!!confirmModalId} onClose={() => setConfirmModalId(null)} title="Cancelar agendamento?">
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">Essa ação não pode ser desfeita.</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setConfirmModalId(null)} className="flex-1">
              Voltar
            </Button>
            <Button
              variant="danger"
              onClick={() => confirmModalId && cancelar(confirmModalId)}
              loading={!!cancelando}
              className="flex-1"
            >
              Cancelar agendamento
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal excluir */}
      <Modal open={!!deleteModalId} onClose={() => setDeleteModalId(null)} title="Excluir agendamento?">
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">O agendamento será removido permanentemente.</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setDeleteModalId(null)} className="flex-1">
              Voltar
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteModalId && excluir(deleteModalId)}
              className="flex-1"
            >
              Excluir permanentemente
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
