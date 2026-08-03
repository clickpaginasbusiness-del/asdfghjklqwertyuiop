import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin'
import SaquesCaixaAdminClient from './SaquesCaixaAdminClient'

export default async function SaquesCaixaAdminPage() {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) redirect('/painel')

  const admin = createAdminClient()

  const { data: saques } = await admin
    .from('caixa_saques')
    .select('id, valor, pix_chave, status, solicitado_em, pago_em, prestadoras(nome, whatsapp, telefone)')
    .order('solicitado_em', { ascending: false })

  const linhas = (saques ?? []).map((s) => {
    const prestadora = s.prestadoras as unknown as { nome: string; whatsapp: string | null; telefone: string | null } | null
    return {
      id: s.id,
      valor: s.valor,
      pixChave: s.pix_chave,
      status: s.status as 'solicitado' | 'pago',
      solicitadoEm: s.solicitado_em,
      pagoEm: s.pago_em,
      whatsappTelefone: prestadora?.whatsapp ?? prestadora?.telefone ?? null,
      prestadoraNome: prestadora?.nome ?? '—',
    }
  })

  return <SaquesCaixaAdminClient saques={linhas} />
}
