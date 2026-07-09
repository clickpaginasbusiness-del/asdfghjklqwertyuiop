'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateTime, formatCurrency, maskTelefone, buildWhatsappUrl } from '@/lib/utils'
import { Users, MessageCircle, ChevronDown, Phone, Bell, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

type AgItem = {
  id: string
  data_hora: string
  status: string
  servicos: { nome: string; preco: number } | null
}

type ClienteEntry = {
  cliente: { id: string; nome: string; telefone: string }
  total: number
  gasto: number
  ultimaVisita: string
  ultimaVisitaAtiva: string | null
  historico: AgItem[]
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

function ClienteCard({ cliente, total, gasto, ultimaVisita, ultimaVisitaAtiva, historico, prestadoraNome }: ClienteEntry & { prestadoraNome: string }) {
  const [expanded, setExpanded] = useState(false)
  const isFrequente = total >= 3
  const ausente = isAusente(ultimaVisitaAtiva)

  // historico já vem ordenado do mais recente para o mais antigo — o primeiro
  // "concluido" encontrado é o último atendimento finalizado desse cliente.
  const ultimoConcluido = historico.find((h) => h.status === 'concluido')

  const msgLembrete = ausente
    ? `Olá ${cliente.nome}! Sentimos sua falta 💅 Que tal agendar um horário? Estamos com novidades te esperando!`
    : `Olá ${cliente.nome}! Temos horários disponíveis. Gostaria de agendar? 💅 - ${prestadoraNome}`

  const msgAvaliacao = ultimoConcluido
    ? `Olá ${cliente.nome}! Esperamos que tenha amado seu ${ultimoConcluido.servicos?.nome ?? 'atendimento'}. Poderia deixar uma avaliação sobre o atendimento? 🌟 ${typeof window !== 'undefined' ? window.location.origin : ''}/avaliar/${ultimoConcluido.id} - ${prestadoraNome}`
    : null

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
            <p className="font-semibold text-gray-900 text-sm">{cliente.nome}</p>
            {ausente ? (
              <Badge variant="warning" className="text-[10px] px-2 py-0.5">Ausente</Badge>
            ) : isFrequente ? (
              <Badge variant="pink" className="text-[10px] px-2 py-0.5">⭐ Frequente</Badge>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-gray-400 mr-1">
              <Phone className="w-3 h-3" />
              {maskTelefone(cliente.telefone)}
            </span>

            <a
              href={buildWhatsappUrl(cliente.telefone, msgLembrete)}
              target="_blank"
              rel="noopener noreferrer"
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
          </div>
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
    </div>
  )
}

const FILTROS: { value: FiltroCliente; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'frequentes', label: 'Frequentes' },
  { value: 'ausentes', label: 'Ausentes' },
]

export default function ClientesClient({ clientes, prestadoraNome }: { clientes: ClienteEntry[]; prestadoraNome: string }) {
  const [filtro, setFiltro] = useState<FiltroCliente>('todos')

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
                <ClienteCard key={c.cliente.id} {...c} prestadoraNome={prestadoraNome} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
