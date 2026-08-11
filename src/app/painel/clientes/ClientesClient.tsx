'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime, formatCurrency, maskTelefone, buildWhatsappUrl } from '@/lib/utils'
import { Users, MessageCircle, ChevronDown, Phone, Bell, Star, Pencil, Trash2, StickyNote } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VoceBadge } from '@/components/painel/VoceBadge'
import { ManualBadge } from '@/components/painel/ManualBadge'
import { logMissaoEvento } from '@/lib/missoesClient'
import toast from 'react-hot-toast'

type AgItem = {
  id: string
  data_hora: string
  status: string
  servicos: { nome: string; preco: number } | null
}

type ClienteEntry = {
  cliente: { id: string; nome: string; telefone: string | null; cliente_manual: boolean; data_nascimento: string | null; notas: string | null }
  total: number
  gasto: number
  ultimaVisita: string
  ultimaVisitaAtiva: string | null
  ehPrestadora: boolean
  historico: AgItem[]
  planoAtivo?: boolean
}

type FiltroCliente = 'todos' | 'frequentes' | 'ausentes'

const AVATAR_COLORS = [
  'from-rose-300 to-pink-500',
  'from-purple-300 to-violet-500',
  'from-amber-300 to-orange-500',
  'from-emerald-300 to-teal-500',
  'from-sky-300 to-blue-500',
  'from-fuchsia-300 to-pink-600',
]

const SEIS_MESES_MS = 6 * 30 * 24 * 60 * 60 * 1000

// String.fromCodePoint() em vez de emoji literal no source — caracteres de plano
// astral (fora do BMP) estavam sendo corrompidos para U+FFFD (�) no bundle de
// produção do Turbopack quando escritos como literal no código.
const NAIL_POLISH = String.fromCodePoint(0x1f485)
const STAR = String.fromCodePoint(0x1f31f)

function isAusente(ultimaVisitaAtiva: string | null): boolean {
  if (!ultimaVisitaAtiva) return true
  return Date.now() - new Date(ultimaVisitaAtiva).getTime() > SEIS_MESES_MS
}

function getColor(nome: string): string {
  return AVATAR_COLORS[nome.charCodeAt(0) % AVATAR_COLORS.length]
}

function statusLabel(s: string) {
  if (s === 'confirmado') return 'Confirmado'
  if (s === 'concluido') return 'Concluído'
  return 'Cancelado'
}

function statusVariant(s: string): 'success' | 'concluido' | 'danger' {
  if (s === 'confirmado') return 'success'
  if (s === 'concluido') return 'concluido'
  return 'danger'
}

function ClienteCard({
  cliente, total, gasto, ultimaVisita, ultimaVisitaAtiva, ehPrestadora, historico, planoAtivo, prestadoraNome,
  onEdited, onDeleted,
}: ClienteEntry & {
  prestadoraNome: string
  onEdited: (id: string, novo: Partial<ClienteEntry['cliente']>) => void
  onDeleted: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [notasModalOpen, setNotasModalOpen] = useState(false)
  const [nomeEdit, setNomeEdit] = useState(cliente.nome)
  const [telefoneEdit, setTelefoneEdit] = useState(cliente.telefone ?? '')
  const [nascimentoEdit, setNascimentoEdit] = useState(cliente.data_nascimento ?? '')
  const [notasEdit, setNotasEdit] = useState(cliente.notas ?? '')
  const [salvando, setSalvando] = useState(false)
  const [salvandoNotas, setSalvandoNotas] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const isFrequente = total >= 3
  const ausente = isAusente(ultimaVisitaAtiva)

  // historico já vem ordenado do mais recente para o mais antigo — o primeiro
  // "concluido" encontrado é o último atendimento finalizado desse cliente.
  const ultimoConcluido = historico.find((h) => h.status === 'concluido')

  const msgLembrete = ausente
    ? `Olá ${cliente.nome}! Sentimos sua falta ${NAIL_POLISH} Que tal agendar um horário? Estamos com novidades te esperando!`
    : `Olá ${cliente.nome}! Temos horários disponíveis. Gostaria de agendar? ${NAIL_POLISH} - ${prestadoraNome}`

  const msgAvaliacao = ultimoConcluido
    ? `Olá ${cliente.nome}! Esperamos que tenha amado seu ${ultimoConcluido.servicos?.nome ?? 'atendimento'}. Poderia deixar uma avaliação sobre o atendimento? ${STAR} ${process.env.NEXT_PUBLIC_APP_URL}/avaliar/${ultimoConcluido.id} - ${prestadoraNome}`
    : null

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault()
    const nome = nomeEdit.trim()
    if (nome.length < 2) {
      toast.error('Informe o nome da cliente.')
      return
    }
    setSalvando(true)
    try {
      const res = await fetch(`/api/clientes/${cliente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, telefone: telefoneEdit, data_nascimento: nascimentoEdit || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao editar cliente.')
        return
      }
      onEdited(cliente.id, { nome: data.cliente.nome, telefone: data.cliente.telefone, data_nascimento: data.cliente.data_nascimento })
      toast.success('Cliente atualizada!')
      setEditModalOpen(false)
    } catch {
      toast.error('Erro de conexão.')
    } finally {
      setSalvando(false)
    }
  }

  async function salvarNotas() {
    setSalvandoNotas(true)
    try {
      const res = await fetch(`/api/clientes/${cliente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notas: notasEdit, data_nascimento: nascimentoEdit || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao salvar.')
        return
      }
      onEdited(cliente.id, { notas: data.cliente.notas, data_nascimento: data.cliente.data_nascimento })
      toast.success('Dados salvos!')
      setNotasModalOpen(false)
    } catch {
      toast.error('Erro de conexão.')
    } finally {
      setSalvandoNotas(false)
    }
  }

  async function confirmarExclusao() {
    setExcluindo(true)
    try {
      const res = await fetch(`/api/clientes/${cliente.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao excluir cliente.')
        return
      }
      onDeleted(cliente.id)
      toast.success('Cliente excluída')
      setDeleteModalOpen(false)
    } catch {
      toast.error('Erro de conexão.')
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <div className="border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
        {/* Avatar */}
        <div
          className={cn(
            'w-12 h-12 rounded-full bg-gradient-to-br text-white font-bold text-xl flex items-center justify-center shrink-0 shadow-sm select-none',
            getColor(cliente.nome)
          )}
        >
          {cliente.nome.charAt(0).toUpperCase()}
        </div>

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm">
              {cliente.nome}
              {ehPrestadora && <VoceBadge />}
              {cliente.cliente_manual && <ManualBadge />}
            </p>
            <button
              type="button"
              onClick={() => { setNotasEdit(cliente.notas ?? ''); setNascimentoEdit(cliente.data_nascimento ?? ''); setNotasModalOpen(true) }}
              title={cliente.notas ? 'Ver/editar notas e preferências' : 'Adicionar notas e preferências'}
              className={cn(
                'shrink-0 transition-colors',
                cliente.notas ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 hover:text-gray-400'
              )}
            >
              <StickyNote className="w-3.5 h-3.5" />
            </button>
            {planoAtivo && <Badge variant="success" className="text-[10px] px-2 py-0.5">Plano ativo</Badge>}
            {ausente ? (
              <Badge variant="warning" className="text-[10px] px-2 py-0.5">Ausente</Badge>
            ) : isFrequente ? (
              <Badge variant="pink" className="text-[10px] px-2 py-0.5">⭐ Frequente</Badge>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-gray-400 mr-1">
              <Phone className="w-3 h-3" />
              {cliente.telefone ? maskTelefone(cliente.telefone) : 'Sem telefone'}
            </span>

            {cliente.telefone && (
              <>
                <a
                  href={buildWhatsappUrl(cliente.telefone, msgLembrete)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logMissaoEvento('lembrete', cliente.id)}
                  className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                >
                  <Bell className="w-3 h-3" />
                  Lembrete
                </a>

                {msgAvaliacao ? (
                  <a
                    href={buildWhatsappUrl(cliente.telefone, msgAvaliacao)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 border border-amber-100 text-amber-700 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                  >
                    <Star className="w-3 h-3" />
                    Pedir avaliação
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="Nenhum agendamento concluído ainda"
                    className="flex items-center gap-1 bg-gray-50 border border-gray-100 text-gray-300 rounded-full px-2.5 py-1 text-xs font-medium cursor-not-allowed"
                  >
                    <Star className="w-3 h-3" />
                    Pedir avaliação
                  </button>
                )}

                <a
                  href={buildWhatsappUrl(cliente.telefone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 bg-green-50 hover:bg-green-100 border border-green-100 text-green-600 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                >
                  <MessageCircle className="w-3 h-3" />
                  WhatsApp
                </a>
              </>
            )}

            {cliente.cliente_manual && (
              <>
                <button
                  type="button"
                  onClick={() => { setNomeEdit(cliente.nome); setTelefoneEdit(cliente.telefone ?? ''); setNascimentoEdit(cliente.data_nascimento ?? ''); setEditModalOpen(true) }}
                  className="flex items-center gap-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-500 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(true)}
                  className="flex items-center gap-1 bg-gray-50 hover:bg-red-50 border border-gray-200 hover:border-red-200 text-gray-500 hover:text-red-500 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Excluir
                </button>
              </>
            )}
          </div>

          {cliente.notas && (
            <p className="text-xs text-amber-700 mt-1.5 flex items-start gap-1">
              <span className="shrink-0">📝</span>
              <span className="line-clamp-1">{cliente.notas}</span>
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-gray-900">{total}× visita{total !== 1 ? 's' : ''}</p>
          <p className="text-xs text-emerald-600 font-medium">{formatCurrency(gasto)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {new Date(ultimaVisita).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
          </p>
        </div>

        {/* Expandir */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 text-gray-300 hover:text-gray-500 transition-colors shrink-0"
          title={expanded ? 'Fechar histórico' : 'Ver histórico'}
        >
          <ChevronDown className={cn('w-4 h-4 transition-transform duration-200', expanded && 'rotate-180')} />
        </button>
      </div>

      {/* Histórico expandido */}
      {expanded && (
        <div className="px-5 pb-4">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2 pl-16">
            Histórico completo ({historico.length} registro{historico.length !== 1 ? 's' : ''})
          </p>
          <div className="pl-16 space-y-2">
            {historico.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-gray-100 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 text-sm truncate">{h.servicos?.nome ?? '—'}</p>
                  <p className="text-xs text-gray-400">{formatDateTime(h.data_hora)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-sm font-semibold text-gray-700">{formatCurrency(h.servicos?.preco ?? 0)}</span>
                  <Badge variant={statusVariant(h.status)}>{statusLabel(h.status)}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editar cliente manual */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Editar cliente">
        <form onSubmit={salvarEdicao} className="p-6 space-y-4">
          <Input
            label="Nome"
            value={nomeEdit}
            onChange={(e) => setNomeEdit(e.target.value)}
            required
          />
          <Input
            label="Telefone (opcional)"
            placeholder="(11) 99999-9999"
            value={telefoneEdit}
            onChange={(e) => setTelefoneEdit(e.target.value)}
          />
          <Input
            label="Data de nascimento (opcional)"
            type="date"
            value={nascimentoEdit}
            onChange={(e) => setNascimentoEdit(e.target.value)}
          />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" loading={salvando} className="flex-1">
              Salvar
            </Button>
          </div>
        </form>
      </Modal>

      {/* Notas e preferências */}
      <Modal open={notasModalOpen} onClose={() => setNotasModalOpen(false)} title="Notas e preferências">
        <div className="p-6 space-y-4">
          <Input
            label="Data de nascimento (opcional)"
            type="date"
            value={nascimentoEdit}
            onChange={(e) => setNascimentoEdit(e.target.value)}
          />
          <Textarea
            label={`Notas sobre ${cliente.nome}`}
            placeholder="Ex: Prefere esmalte fosco, alérgica a acetona, gosta de conversar sobre viagens..."
            rows={5}
            value={notasEdit}
            onChange={(e) => setNotasEdit(e.target.value)}
          />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setNotasModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="button" onClick={salvarNotas} loading={salvandoNotas} className="flex-1">
              Salvar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Excluir cliente manual */}
      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Excluir cliente">
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Tem certeza que quer excluir <span className="font-semibold text-gray-900">{cliente.nome}</span>?
            Isso também exclui todo o histórico de agendamentos dela. Essa ação não pode ser desfeita.
          </p>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setDeleteModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="button" variant="danger" loading={excluindo} onClick={confirmarExclusao} className="flex-1">
              Excluir
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

const FILTROS: { value: FiltroCliente; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'frequentes', label: 'Frequentes' },
  { value: 'ausentes', label: 'Ausentes' },
]

export default function ClientesClient({ clientes: initialClientes, prestadoraNome }: { clientes: ClienteEntry[]; prestadoraNome: string }) {
  const [clientes, setClientes] = useState(initialClientes)
  const [filtro, setFiltro] = useState<FiltroCliente>('todos')

  function handleEdited(id: string, novo: Partial<ClienteEntry['cliente']>) {
    setClientes((prev) => prev.map((c) => c.cliente.id === id ? { ...c, cliente: { ...c.cliente, ...novo } } : c))
  }

  function handleDeleted(id: string) {
    setClientes((prev) => prev.filter((c) => c.cliente.id !== id))
  }

  const clientesFiltrados = useMemo(() => {
    if (filtro === 'frequentes') return clientes.filter((c) => c.total >= 3)
    if (filtro === 'ausentes') return clientes.filter((c) => isAusente(c.ultimaVisitaAtiva))
    return clientes
  }, [clientes, filtro])

  const totalAusentes = useMemo(
    () => clientes.filter((c) => isAusente(c.ultimaVisitaAtiva)).length,
    [clientes]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-serif text-2xl font-semibold text-gray-900">Clientes</h1>
        <div className="flex items-center gap-2">
          <Badge variant="pink">{clientes.length} cliente{clientes.length !== 1 ? 's' : ''}</Badge>
          {totalAusentes > 0 && (
            <Badge variant="warning">{totalAusentes} ausente{totalAusentes !== 1 ? 's' : ''}</Badge>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {FILTROS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              filtro === f.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {f.label}
            {f.value === 'ausentes' && totalAusentes > 0 && (
              <span className="ml-1.5 bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                {totalAusentes}
              </span>
            )}
          </button>
        ))}
      </div>

      {clientes.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-16 text-gray-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum cliente ainda</p>
            </div>
          </CardContent>
        </Card>
      ) : clientesFiltrados.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-16 text-gray-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">
                {filtro === 'frequentes' ? 'Nenhum cliente frequente ainda' : 'Nenhum cliente ausente'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {filtro === 'todos' ? 'Histórico de clientes' :
               filtro === 'frequentes' ? 'Clientes frequentes' : 'Clientes ausentes'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div>
              {clientesFiltrados.map((c) => (
                <ClienteCard key={c.cliente.id} {...c} prestadoraNome={prestadoraNome} onEdited={handleEdited} onDeleted={handleDeleted} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
