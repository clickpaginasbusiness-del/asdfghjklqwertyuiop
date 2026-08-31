import { redirect } from 'next/navigation'
import { addDays, startOfDay, endOfDay } from 'date-fns'
import { getPrestadoraAutenticada } from '@/lib/painelAuth'
import CalendarioClient from './CalendarioClient'

export default async function CalendarioPage() {
  const { supabase, prestadora } = await getPrestadoraAutenticada()
  if (!prestadora) redirect('/painel/login')

  const hoje = new Date()

  const [
    { data: horariosFuncionamento },
    { data: profissionais },
    { data: agendamentos },
    { data: dadosPrestadora },
  ] = await Promise.all([
    supabase
      .from('horarios_funcionamento')
      .select('*')
      .eq('prestadora_id', prestadora.id)
      .order('dia_semana'),
    supabase
      .from('profissionais')
      .select('id, nome, hora_abertura, hora_fechamento, dias_semana, intervalo_inicio, intervalo_fim')
      .eq('prestadora_id', prestadora.id)
      .eq('ativa', true)
      .order('nome'),
    supabase
      .from('agendamentos')
      .select('id, data_hora, status, cliente_id, profissional_id, cliente_e_prestadora, agendamento_manual, servicos(nome, preco, duracao_minutos), clientes(nome, telefone), profissionais(nome), planos_assinaturas(planos_prestadora(nome, desconto_tipo, desconto_valor)), caixa_prestadora(valor_bruto, status)')
      .eq('prestadora_id', prestadora.id)
      .neq('status', 'cancelado')
      .gte('data_hora', startOfDay(hoje).toISOString())
      .lte('data_hora', endOfDay(addDays(hoje, 7)).toISOString())
      .order('data_hora'),
    // notas é por prestadora+cliente, não uma coluna global em clientes.
    supabase
      .from('clientes_prestadora_dados')
      .select('cliente_id, notas')
      .eq('prestadora_id', prestadora.id),
  ])

  const notasPorCliente = new Map((dadosPrestadora ?? []).map((d) => [d.cliente_id, d.notas]))
  const agendamentosComNotas = (agendamentos ?? []).map((a) => ({
    ...a,
    clientes: a.clientes ? { ...(a.clientes as unknown as { nome: string; telefone: string | null }), notas: notasPorCliente.get(a.cliente_id) ?? null } : null,
  }))

  return (
    <CalendarioClient
      prestadora={prestadora}
      horariosFuncionamento={horariosFuncionamento ?? []}
      profissionais={(profissionais ?? []) as unknown as ProfissionalCalendario[]}
      agendamentos={agendamentosComNotas as unknown as AgendaSlotAg[]}
    />
  )
}

export type ProfissionalCalendario = {
  id: string
  nome: string
  hora_abertura: string | null
  hora_fechamento: string | null
  dias_semana: number[] | null
  intervalo_inicio: string | null
  intervalo_fim: string | null
}

export type AgendaSlotAg = {
  id: string
  data_hora: string
  status: 'confirmado' | 'cancelado' | 'concluido' | 'aguardando_pagamento'
  cliente_id: string
  profissional_id: string | null
  cliente_e_prestadora: boolean
  agendamento_manual: boolean
  servicos: { nome: string; preco: number; duracao_minutos: number } | null
  clientes: { nome: string; telefone: string | null; notas: string | null } | null
  profissionais: { nome: string } | null
  planos_assinaturas: { planos_prestadora: { nome: string; desconto_tipo?: 'percentual' | 'fixo'; desconto_valor?: number } | null } | null
  caixa_prestadora: { valor_bruto: number; status: string }[]
}
