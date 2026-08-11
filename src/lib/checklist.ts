import type { SupabaseClient } from '@supabase/supabase-js'
import type { Prestadora } from '@/lib/types'

export type ChecklistItemId =
  | 'conta_criada'
  | 'telefone'
  | 'foto_perfil'
  | 'horarios'
  | 'servico'
  | 'compartilhar_link'
  | 'primeiro_agendamento'

export interface ChecklistItem {
  id: ChecklistItemId
  titulo: string
  completo: boolean
}

export interface ChecklistStatus {
  itens: ChecklistItem[]
  completos: number
  total: number
  percentual: number
  completo: boolean
}

export const TOTAL_ITENS_CHECKLIST = 7

/**
 * Checagem barata (sem consultas ao banco) pra descartar rápido o caso mais
 * comum — prestadora ainda no meio do onboarding, sem telefone/foto/link
 * compartilhado — sem precisar contar horários/serviços/agendamentos.
 */
export function podeEstarCompleto(prestadora: Prestadora): boolean {
  return Boolean(prestadora.telefone && prestadora.foto_url && prestadora.link_compartilhado_em)
}

export async function getChecklistStatus(supabase: SupabaseClient, prestadora: Prestadora): Promise<ChecklistStatus> {
  const [{ count: horarios }, { count: servicos }, { count: agendamentos }] = await Promise.all([
    supabase.from('horarios_funcionamento').select('id', { count: 'exact', head: true }).eq('prestadora_id', prestadora.id).eq('ativo', true),
    supabase.from('servicos').select('id', { count: 'exact', head: true }).eq('prestadora_id', prestadora.id),
    supabase.from('agendamentos').select('id', { count: 'exact', head: true }).eq('prestadora_id', prestadora.id).eq('agendamento_manual', false),
  ])

  const itens: ChecklistItem[] = [
    { id: 'conta_criada', titulo: 'Conta criada', completo: true },
    { id: 'telefone', titulo: 'Telefone verificado', completo: Boolean(prestadora.telefone) },
    { id: 'foto_perfil', titulo: 'Foto de perfil adicionada', completo: Boolean(prestadora.foto_url) },
    { id: 'horarios', titulo: 'Configure seus horários de atendimento', completo: (horarios ?? 0) > 0 },
    { id: 'servico', titulo: 'Pelo menos 1 serviço cadastrado', completo: (servicos ?? 0) > 0 },
    { id: 'compartilhar_link', titulo: 'Compartilhar o link da página pública', completo: Boolean(prestadora.link_compartilhado_em) },
    { id: 'primeiro_agendamento', titulo: 'Primeiro agendamento recebido', completo: (agendamentos ?? 0) > 0 },
  ]

  const completos = itens.filter((i) => i.completo).length

  return {
    itens,
    completos,
    total: TOTAL_ITENS_CHECKLIST,
    percentual: Math.round((completos / TOTAL_ITENS_CHECKLIST) * 100),
    completo: completos === TOTAL_ITENS_CHECKLIST,
  }
}

/** Versão barata pra decidir só se a aba do checklist deve aparecer na sidebar — evita as 3 consultas de contagem quando os itens obrigatórios de perfil ainda nem foram preenchidos. */
export async function checklistEstaCompleto(supabase: SupabaseClient, prestadora: Prestadora): Promise<boolean> {
  if (!podeEstarCompleto(prestadora)) return false
  const status = await getChecklistStatus(supabase, prestadora)
  return status.completo
}
