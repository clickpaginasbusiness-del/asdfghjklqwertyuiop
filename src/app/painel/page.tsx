import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { endOfYear, subDays } from 'date-fns'
import PainelDashboardClient from './PainelDashboardClient'

export default async function PainelPage() {
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

  // 60 dias atrás → cobre filtros "30 dias" + resto do ano
  const { data: agendamentosAno } = await supabase
    .from('agendamentos')
    .select('id, data_hora, status, servicos(nome, preco, duracao_minutos), clientes(id, nome, telefone), profissionais(nome)')
    .eq('prestadora_id', prestadora.id)
    .in('status', ['confirmado', 'concluido'])
    .gte('data_hora', subDays(hoje, 60).toISOString())
    .lte('data_hora', endOfYear(hoje).toISOString())
    .order('data_hora')

  return (
    <PainelDashboardClient
      agendamentosAno={(agendamentosAno ?? []) as any}
      horarioAbertura={prestadora.hora_abertura}
      horarioFechamento={prestadora.hora_fechamento}
      prestadoraId={prestadora.id}
      nomeUsuario={prestadora.nome}
    />
  )
}
