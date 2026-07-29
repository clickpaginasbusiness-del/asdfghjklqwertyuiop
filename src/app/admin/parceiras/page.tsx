import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin'
import { liberarComissoesVencidas } from '@/lib/parceiras'
import ParceirasAdminClient from './ParceirasAdminClient'

export default async function ParceirasAdminPage() {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) redirect('/painel')

  const admin = createAdminClient()

  const { data: parceiras } = await admin
    .from('prestadoras')
    .select('id, nome, email, telefone, whatsapp, parceira_comissao_percentual, parceira_desde')
    .eq('e_parceira', true)
    .order('parceira_desde', { ascending: false })

  const ids = (parceiras ?? []).map((p) => p.id)

  if (ids.length > 0) {
    await liberarComissoesVencidas(admin)
  }

  const [{ data: comissoes }, { data: indicadas }] = await Promise.all([
    ids.length
      ? admin.from('parceiras_comissoes').select('parceira_id, status, valor_comissao').in('parceira_id', ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? admin.from('prestadoras').select('id, indicado_por, assinatura_ativa, e_trial').in('indicado_por', ids)
      : Promise.resolve({ data: [] }),
  ])

  const linhas = (parceiras ?? []).map((p) => {
    const minhasComissoes = (comissoes ?? []).filter((c) => c.parceira_id === p.id)
    const disponivel = minhasComissoes.filter((c) => c.status === 'disponivel').reduce((s, c) => s + c.valor_comissao, 0)
    const pendente = minhasComissoes.filter((c) => c.status === 'pendente').reduce((s, c) => s + c.valor_comissao, 0)
    const indicadasAtivas = (indicadas ?? []).filter((i) => i.indicado_por === p.id && i.assinatura_ativa && !i.e_trial).length

    return {
      id: p.id,
      nome: p.nome,
      email: p.email,
      telefone: p.telefone ?? p.whatsapp,
      comissaoPercentual: p.parceira_comissao_percentual ?? 20,
      disponivel: Math.round(disponivel * 100) / 100,
      pendente: Math.round(pendente * 100) / 100,
      indicadasAtivas,
    }
  })

  return <ParceirasAdminClient parceiras={linhas} />
}
