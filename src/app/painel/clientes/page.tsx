import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClientesClient from './ClientesClient'

export default async function ClientesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id, nome')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) redirect('/painel/login')

  // Busca todos os agendamentos com joins — sem filtro de status para ter histórico completo
  const [{ data: agendamentos }, { data: assinaturasAtivas }] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('id, data_hora, status, cliente_e_prestadora, servicos(nome, preco), clientes(id, nome, telefone, cliente_manual, data_nascimento, notas)')
      .eq('prestadora_id', prestadora.id)
      .order('data_hora', { ascending: false }),
    supabase
      .from('planos_assinaturas')
      .select('cliente_id')
      .eq('prestadora_id', prestadora.id)
      .eq('status', 'ativa'),
  ])

  const clientesComPlanoAtivo = new Set((assinaturasAtivas ?? []).map((a) => a.cliente_id))

  // Agrupa por cliente
  type AgItem = {
    id: string
    data_hora: string
    status: string
    servicos: { nome: string; preco: number } | null
  }
  type ClienteEntry = {
    cliente: { id: string; nome: string; telefone: string | null; cliente_manual: boolean; data_nascimento: string | null; notas: string | null }
    total: number               // confirmado + concluido
    gasto: number
    ultimaVisita: string        // qualquer agendamento (para exibição)
    ultimaVisitaAtiva: string | null  // só confirmado/concluido (para "ausente")
    ehPrestadora: boolean       // algum agendamento desse cliente bateu com o telefone da prestadora
    historico: AgItem[]
  }

  const clienteMap = new Map<string, ClienteEntry>()

  agendamentos?.forEach((a) => {
    const c = a.clientes as unknown as { id: string; nome: string; telefone: string | null; cliente_manual: boolean; data_nascimento: string | null; notas: string | null } | null
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
      if (a.cliente_e_prestadora) existing.ehPrestadora = true
      existing.historico.push(agItem)
    } else {
      clienteMap.set(c.id, {
        cliente: c,
        total: isAtivo ? 1 : 0,
        gasto: isAtivo ? ((a.servicos as any)?.preco ?? 0) : 0,
        ultimaVisita: a.data_hora,
        ultimaVisitaAtiva: isAtivo ? a.data_hora : null,
        ehPrestadora: Boolean(a.cliente_e_prestadora),
        historico: [agItem],
      })
    }
  })

  const clientes = Array.from(clienteMap.values())
    .map((c) => ({ ...c, planoAtivo: clientesComPlanoAtivo.has(c.cliente.id) }))
    .sort((a, b) => b.total - a.total)

  return <ClientesClient clientes={clientes} prestadoraNome={prestadora.nome} />
}
