import ClientesClient from '@/app/painel/clientes/ClientesClient'
import { DEMO_AGENDAMENTOS, DEMO_PRESTADORA } from '@/lib/demoData'
import type { Agendamento } from '@/lib/types'

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

function buildClienteEntries(agendamentos: Agendamento[]): ClienteEntry[] {
  const map = new Map<string, ClienteEntry>()
  const ordenados = [...agendamentos].sort(
    (a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime()
  )

  for (const a of ordenados) {
    if (!a.clientes) continue
    const id = a.clientes.id
    let entry = map.get(id)
    if (!entry) {
      entry = {
        cliente: { id, nome: a.clientes.nome, telefone: a.clientes.telefone },
        total: 0,
        gasto: 0,
        ultimaVisita: a.data_hora,
        ultimaVisitaAtiva: null,
        historico: [],
      }
      map.set(id, entry)
    }
    entry.total += 1
    if (a.status !== 'cancelado') {
      entry.gasto += a.servicos?.preco ?? 0
      if (!entry.ultimaVisitaAtiva) entry.ultimaVisitaAtiva = a.data_hora
    }
    entry.historico.push({
      id: a.id,
      data_hora: a.data_hora,
      status: a.status,
      servicos: a.servicos ? { nome: a.servicos.nome, preco: a.servicos.preco } : null,
    })
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

export default function ClientesDemoPage() {
  const clientes = buildClienteEntries(DEMO_AGENDAMENTOS)

  return <ClientesClient clientes={clientes} prestadoraNome={DEMO_PRESTADORA.nome} />
}
