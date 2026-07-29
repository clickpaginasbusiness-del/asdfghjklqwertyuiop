import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin'
import { getResumoParceira } from '@/lib/parceiras'
import { RelatorioParceiraClient } from '@/components/parceiras/RelatorioParceiraClient'
import { AdminNav } from '@/components/admin/AdminNav'

export default async function ParceiraDetalheAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) redirect('/painel')

  const admin = createAdminClient()

  const { data: prestadora } = await admin
    .from('prestadoras')
    .select('id, nome, email, codigo_indicacao, e_parceira')
    .eq('id', id)
    .maybeSingle()

  if (!prestadora || !prestadora.e_parceira) notFound()

  const resumo = await getResumoParceira(admin, prestadora.id)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-10 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="font-serif text-xl font-bold text-rose-400">BelleBook</span>
          <span className="text-gray-300">|</span>
          <span className="text-sm font-semibold text-gray-700">Painel Admin</span>
        </div>
        <AdminNav />
        <Link href="/admin/parceiras" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>
      </header>

      <main className="max-w-4xl mx-auto p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{prestadora.nome}</h1>
          <p className="text-sm text-gray-400">{prestadora.email} · Relatório de parceira (somente leitura)</p>
        </div>

        <RelatorioParceiraClient resumo={resumo} codigoIndicacao={prestadora.codigo_indicacao} somenteLeitura />
      </main>
    </div>
  )
}
