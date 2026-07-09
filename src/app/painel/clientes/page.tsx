import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClientesClient from './ClientesClient'

export default async function ClientesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) redirect('/painel/login')

  // Busca todos os agendamentos com joins — sem filtro de status para ter histórico completo
  const { data: agendamentos } = await supabase
    .from('agendamentos')
    .select('id, data_hora, status, servicos(nome, preco), clientes(id, nome, telefone)')
    .eq('prestadora_id', prestadora.id)
    .order('data_hora', { ascending: false })

  // Agrupa por cliente
  type AgItem = {
    id: string
    data_hora: string
    status: string
    servicos: { nome: string; preco: number } | null
  }
  type ClienteEntry = {
    cliente: { id: string; nome: string; telefone: string }
    total: number               // confirmado + concluido
    gasto: number
    ultimaVisita: string        // qualquer agendamento (para exibição)
    ultimaVisitaAtiva: string | null  // só confirmado/concluido (para "ausente")
    historico: AgItem[]
  }

  const clienteMap = new Map<string, ClienteEntry>()

  agendamentos?.forEach((a) => {
    const c = a.clientes as unknown as { id: string; nome: string; telefone: string } | null
    if (!c) return
    const isAtivo = a.status === 'confirmado' || a.status === 'concluido'
    const agItem: AgItem = {
      id: a.id,
      data_hora: a.data_hora,
      status: a.status,
      servicos: a.servicos as unknown as { nome: string; preco: number } | null,
    }

    const existing = clienteMap.get(c.id)
    if (existing) {
      if (isAtivo) {
        existing.total++
        existing.gasto += (a.servicos as any)?.preco ?? 0
        if (a.data_hora > (existing.ultimaVisitaAtiva ?? '')) {
          existing.ultimaVisitaAtiva = a.data_hora
        }
      }
      if (a.data_hora > existing.ultimaVisita) existing.ultimaVisita = a.data_hora
      existing.historico.push(agItem)
    } else {
      clienteMap.set(c.id, {
        cliente: c,
        total: isAtivo ? 1 : 0,
        gasto: isAtivo ? ((a.servicos as any)?.preco ?? 0) : 0,
        ultimaVisita: a.data_hora,
        ultimaVisitaAtiva: isAtivo ? a.data_hora : null,
        historico: [agItem],
      })
    }
  })

  const clientes = Array.from(clienteMap.values()).sort((a, b) => b.total - a.total)

  return <ClientesClient clientes={clientes} />
}
