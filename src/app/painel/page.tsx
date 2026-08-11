import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { endOfYear, subDays } from 'date-fns'
import PainelDashboardClient from './PainelDashboardClient'

/** Próxima ocorrência do aniversário a partir de hoje (esse ano, ou o
 * próximo se já passou) — só mês/dia importam, o ano de nascimento em si é
 * ignorado pra esse cálculo. */
function proximoAniversario(dataNascimento: string, hojeZerado: Date): Date {
  const [, mes, dia] = dataNascimento.split('-').map(Number)
  let aniversario = new Date(hojeZerado.getFullYear(), mes - 1, dia)
  if (aniversario < hojeZerado) {
    aniversario = new Date(hojeZerado.getFullYear() + 1, mes - 1, dia)
  }
  return aniversario
}

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

  const [{ data: agendamentosAno }, { data: agendamentosComNascimento }] = await Promise.all([
    // 60 dias atrás → cobre filtros "30 dias" + resto do ano
    supabase
      .from('agendamentos')
      .select('id, data_hora, status, cliente_e_prestadora, agendamento_manual, servicos(nome, preco, duracao_minutos), clientes(id, nome, telefone), profissionais(nome), planos_assinaturas(planos_prestadora(nome))')
      .eq('prestadora_id', prestadora.id)
      .in('status', ['confirmado', 'concluido'])
      .gte('data_hora', subDays(hoje, 60).toISOString())
      .lte('data_hora', endOfYear(hoje).toISOString())
      .order('data_hora'),
    // Aniversariantes: só clientes com histórico com ESSA prestadora (não
    // qualquer cliente da base global) — daí o !inner pra filtrar direto no
    // join em vez de trazer tudo e filtrar depois.
    supabase
      .from('agendamentos')
      .select('clientes!inner(id, nome, telefone, data_nascimento)')
      .eq('prestadora_id', prestadora.id)
      .not('clientes.data_nascimento', 'is', null),
  ])

  const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const clientesUnicos = new Map<string, { id: string; nome: string; telefone: string | null; data_nascimento: string }>()
  for (const row of (agendamentosComNascimento ?? []) as unknown as { clientes: { id: string; nome: string; telefone: string | null; data_nascimento: string } | null }[]) {
    if (row.clientes && !clientesUnicos.has(row.clientes.id)) clientesUnicos.set(row.clientes.id, row.clientes)
  }

  const aniversariantes = Array.from(clientesUnicos.values())
    .map((c) => ({ ...c, proximoAniversario: proximoAniversario(c.data_nascimento, hojeZerado) }))
    .filter((c) => (c.proximoAniversario.getTime() - hojeZerado.getTime()) <= 7 * 86400000)
    .sort((a, b) => a.proximoAniversario.getTime() - b.proximoAniversario.getTime())
    .map((c) => ({ id: c.id, nome: c.nome, telefone: c.telefone, dataAniversario: c.proximoAniversario.toISOString() }))

  return (
    <PainelDashboardClient
      agendamentosAno={(agendamentosAno ?? []) as any}
      horarioAbertura={prestadora.hora_abertura}
      horarioFechamento={prestadora.hora_fechamento}
      prestadoraId={prestadora.id}
      nomeUsuario={prestadora.nome}
      msgConfirmacao={prestadora.mensagem_confirmacao}
      msgCancelamento={prestadora.mensagem_cancelamento}
      msgLembrete={prestadora.mensagem_lembrete}
      aniversariantes={aniversariantes}
    />
  )
}
