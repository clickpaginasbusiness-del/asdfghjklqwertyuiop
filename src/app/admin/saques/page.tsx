import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin'
import SaquesAdminClient from './SaquesAdminClient'

export default async function SaquesAdminPage() {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) redirect('/painel')

  const admin = createAdminClient()

  const { data: saques } = await admin
    .from('parceiras_saques')
    .select('id, valor, pix_chave, status, solicitado_em, pago_em, whatsapp_telefone, prestadoras(nome)')
    .order('solicitado_em', { ascending: false })

  const linhas = (saques ?? []).map((s) => ({
    id: s.id,
    valor: s.valor,
    pixChave: s.pix_chave,
    status: s.status as 'solicitado' | 'pago',
    solicitadoEm: s.solicitado_em,
    pagoEm: s.pago_em,
    whatsappTelefone: s.whatsapp_telefone,
    parceiraNome: (s.prestadoras as unknown as { nome: string } | null)?.nome ?? '—',
  }))

  return <SaquesAdminClient saques={linhas} />
}
