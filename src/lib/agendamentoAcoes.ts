import { createClient } from '@/lib/supabase/client'
import { formatDateShort } from '@/lib/utils'

/** Formato mínimo aceito por cancelarAgendamento — estrutural de propósito
 * (em vez de amarrado ao tipo Agendamento inteiro) pra servir tanto a lista
 * de /painel/agendamentos quanto a grade de /painel/calendario, que buscam
 * colunas diferentes de clientes/servicos/profissionais. */
interface AgendamentoParaCancelar {
  id: string
  data_hora: string
  clientes?: { nome: string } | null
  servicos?: { nome: string } | null
  profissionais?: { nome: string } | null
}

/** Cancela um agendamento pelo lado da prestadora — mesma lógica usada em
 * /painel/agendamentos e /painel/calendario, extraída aqui pra não duplicar. */
export async function cancelarAgendamento(
  ag: AgendamentoParaCancelar,
  prestadoraId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient()
  const { error } = await supabase
    .from('agendamentos')
    .update({ status: 'cancelado', cancelado_por: 'prestadora' })
    .eq('id', ag.id)

  if (error) return { ok: false, error: 'Erro ao cancelar' }

  const profNome = ag.profissionais?.nome ? ` com ${ag.profissionais.nome}` : ''
  await supabase.from('notificacoes').insert({
    prestadora_id: prestadoraId,
    tipo: 'cancelamento',
    mensagem: `Você cancelou o agendamento de ${ag.clientes?.nome} - ${ag.servicos?.nome}${profNome} em ${formatDateShort(ag.data_hora)}`,
  })

  return { ok: true }
}

/** Marca um agendamento como concluído — mesma lógica usada em
 * /painel/agendamentos e /painel/calendario. */
export async function concluirAgendamento(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient()
  const { error } = await supabase.from('agendamentos').update({ status: 'concluido' }).eq('id', id)
  if (error) return { ok: false, error: 'Erro ao concluir' }
  return { ok: true }
}
