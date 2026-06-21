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
      .select('id, nome')
      .eq('prestadora_id', prestadora.id)
      .eq('ativa', true)
      .order('nome'),
    supabase
      .from('agendamentos')
      .select('id, data_hora, status, profissional_id, servicos(nome, preco, duracao_minutos), clientes(nome, telefone), profissionais(nome)')
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
      profissionais={profissionais ?? []}
      agendamentos={(agendamentos ?? []) as unknown as AgendaSlotAg[]}
    />
  )
}

export type AgendaSlotAg = {
  id: string
  data_hora: string
  status: 'confirmado' | 'cancelado' | 'concluido'
  profissional_id: string | null
  servicos: { nome: string; preco: number; duracao_minutos: number } | null
  clientes: { nome: string; telefone: string } | null
  profissionais: { nome: string } | null
}
