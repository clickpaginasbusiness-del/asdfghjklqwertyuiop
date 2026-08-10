import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { addDays, startOfDay, endOfDay } from 'date-fns'
import CalendarioClient from './CalendarioClient'

export default async function CalendarioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) redirect('/painel/login')

  const hoje = new Date()

  const [
    { data: horariosFuncionamento },
    { data: profissionais },
    { data: agendamentos },
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
      .select('id, data_hora, status, cliente_id, profissional_id, cliente_e_prestadora, agendamento_manual, servicos(nome, preco, duracao_minutos), clientes(nome, telefone), profissionais(nome), planos_assinaturas(planos_prestadora(nome))')
      .eq('prestadora_id', prestadora.id)
      .neq('status', 'cancelado')
      .gte('data_hora', startOfDay(hoje).toISOString())
      .lte('data_hora', endOfDay(addDays(hoje, 7)).toISOString())
      .order('data_hora'),
  ])

  return (
    <CalendarioClient
      prestadora={prestadora}
      horariosFuncionamento={horariosFuncionamento ?? []}
      profissionais={(profissionais ?? []) as unknown as ProfissionalCalendario[]}
      agendamentos={(agendamentos ?? []) as unknown as AgendaSlotAg[]}
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
  clientes: { nome: string; telefone: string | null } | null
  profissionais: { nome: string } | null
  planos_assinaturas: { planos_prestadora: { nome: string } | null } | null
}
