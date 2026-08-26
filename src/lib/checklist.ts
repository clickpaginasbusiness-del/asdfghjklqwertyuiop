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

const TITULOS: Record<ChecklistItemId, string> = {
  conta_criada: 'Conta criada',
  telefone: 'Telefone verificado',
  foto_perfil: 'Foto de perfil adicionada',
  horarios: 'Configure seus horários de atendimento',
  servico: 'Pelo menos 1 serviço cadastrado',
  compartilhar_link: 'Compartilhar o link da página pública',
  primeiro_agendamento: 'Primeiro agendamento recebido',
}

export async function getChecklistStatus(supabase: SupabaseClient, prestadora: Prestadora): Promise<ChecklistStatus> {
  // Uma vez completo, fica assim pra sempre (os itens não "voltam" a faltar
  // na prática) — evita rodar 3 queries de contagem em toda navegação do
  // painel pra prestadora já estabelecida, que é o caso comum.
  if (prestadora.checklist_completo) {
    const itens: ChecklistItem[] = (Object.keys(TITULOS) as ChecklistItemId[]).map((id) => ({
      id, titulo: TITULOS[id], completo: true,
    }))
    return { itens, completos: TOTAL_ITENS_CHECKLIST, total: TOTAL_ITENS_CHECKLIST, percentual: 100, completo: true }
  }

  const [{ count: horarios }, { count: servicos }, { count: agendamentos }] = await Promise.all([
    supabase.from('horarios_funcionamento').select('id', { count: 'exact', head: true }).eq('prestadora_id', prestadora.id).eq('ativo', true),
    supabase.from('servicos').select('id', { count: 'exact', head: true }).eq('prestadora_id', prestadora.id),
    supabase.from('agendamentos').select('id', { count: 'exact', head: true }).eq('prestadora_id', prestadora.id).eq('agendamento_manual', false),
  ])

  const itens: ChecklistItem[] = [
    { id: 'conta_criada', titulo: TITULOS.conta_criada, completo: true },
    { id: 'telefone', titulo: TITULOS.telefone, completo: Boolean(prestadora.telefone) },
    { id: 'foto_perfil', titulo: TITULOS.foto_perfil, completo: Boolean(prestadora.foto_url) },
    { id: 'horarios', titulo: TITULOS.horarios, completo: (horarios ?? 0) > 0 },
    { id: 'servico', titulo: TITULOS.servico, completo: (servicos ?? 0) > 0 },
    { id: 'compartilhar_link', titulo: TITULOS.compartilhar_link, completo: Boolean(prestadora.link_compartilhado_em) },
    { id: 'primeiro_agendamento', titulo: TITULOS.primeiro_agendamento, completo: (agendamentos ?? 0) > 0 },
  ]

  const completos = itens.filter((i) => i.completo).length
  const completo = completos === TOTAL_ITENS_CHECKLIST

  if (completo) {
    await supabase.from('prestadoras').update({ checklist_completo: true }).eq('id', prestadora.id)
  }

  return {
    itens,
    completos,
    total: TOTAL_ITENS_CHECKLIST,
    percentual: Math.round((completos / TOTAL_ITENS_CHECKLIST) * 100),
    completo,
  }
}
