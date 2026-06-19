import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TABELAS_VINCULADAS = [
  'notificacoes',
  'dias_bloqueados',
  'visitas_pagina',
  'avaliacoes',
  'agendamentos',
  'galeria',
  'profissionais',
  'servicos',
  'horarios_funcionamento',
]

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { data: prestadora } = await supabaseAdmin
    .from('prestadoras')
    .select('id, stripe_subscription_id')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) {
    return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })
  }

  // Cancela a assinatura na Stripe antes de excluir qualquer dado, para evitar
  // que a cliente continue sendo cobrada após perder acesso à conta.
  if (prestadora.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(prestadora.stripe_subscription_id)
      if (sub.status !== 'canceled') {
        await stripe.subscriptions.cancel(prestadora.stripe_subscription_id)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (!msg.toLowerCase().includes('no such subscription')) {
        console.error('[delete-account] falha ao cancelar assinatura', prestadora.stripe_subscription_id, err)
        return NextResponse.json(
          { error: 'Não foi possível cancelar sua assinatura. Tente novamente ou contate o suporte.' },
          { status: 500 }
        )
      }
    }
  }

  // Remove arquivos do storage (melhor esforço — não bloqueia a exclusão)
  for (const bucket of ['avatars', 'galeria', 'profissionais'] as const) {
    try {
      const { data: files } = await supabaseAdmin.storage.from(bucket).list(prestadora.id)
      if (files && files.length > 0) {
        await supabaseAdmin.storage.from(bucket).remove(files.map((f) => `${prestadora.id}/${f.name}`))
      }
    } catch (err) {
      console.error(`[delete-account] falha ao limpar storage ${bucket}`, err)
    }
  }

  // Remove dados vinculados à prestadora. A maioria já cascateia ao excluir a
  // prestadora/usuário (ver supabase/schema.sql), mas removemos explicitamente
  // para não depender disso em tabelas adicionadas fora do schema versionado.
  for (const tabela of TABELAS_VINCULADAS) {
    const { error } = await supabaseAdmin.from(tabela).delete().eq('prestadora_id', prestadora.id)
    if (error) console.error(`[delete-account] falha ao limpar tabela ${tabela}`, error)
  }

  const { error: prestadoraError } = await supabaseAdmin
    .from('prestadoras')
    .delete()
    .eq('id', prestadora.id)

  if (prestadoraError) {
    console.error('[delete-account] falha ao deletar prestadora', prestadoraError)
    return NextResponse.json({ error: 'Erro ao excluir dados da conta' }, { status: 500 })
  }

  const { error: userError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
  if (userError) {
    console.error('[delete-account] falha ao deletar usuário', userError)
    return NextResponse.json(
      { error: 'Seus dados foram excluídos, mas houve um erro ao remover o login. Contate o suporte.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
