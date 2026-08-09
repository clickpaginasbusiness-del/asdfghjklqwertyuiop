'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Sparkles, Loader2, ExternalLink, UserMinus, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AdminNav } from '@/components/admin/AdminNav'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

type ParceiraRow = {
  id: string
  nome: string
  email: string
  telefone: string | null
  comissaoPercentual: number
  disponivel: number
  pendente: number
  indicadasAtivas: number
}

export default function ParceirasAdminClient({ parceiras }: { parceiras: ParceiraRow[] }) {
  const router = useRouter()
  const [removendoId, setRemovendoId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const alvo = parceiras.find((p) => p.id === removendoId)

  async function confirmarRemocao() {
    if (!removendoId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/parceiras/${removendoId}/cargo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'remover' }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao remover cargo')
        return
      }
      toast.success('Cargo de parceira removido.')
      setRemovendoId(null)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-10 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="font-serif text-xl font-bold text-rose-400">BelleBook</span>
          <span className="text-gray-300">|</span>
          <span className="text-sm font-semibold text-gray-700">Painel Admin</span>
        </div>
        <AdminNav />
        <Link href="/painel" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar ao painel
        </Link>
      </header>

      <main className="max-w-6xl mx-auto p-6 lg:p-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Parceiras ({parceiras.length})</CardTitle>
            <p className="text-sm text-gray-400">
              Pra dar o cargo de parceira, acesse a página de detalhe da prestadora.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
                    <th className="pb-3 pl-5 pr-4 font-medium">Nome</th>
                    <th className="pb-3 pr-4 font-medium">Contato</th>
                    <th className="pb-3 pr-4 font-medium">Comissão</th>
                    <th className="pb-3 pr-4 font-medium">Disponível</th>
                    <th className="pb-3 pr-4 font-medium">Pendente</th>
                    <th className="pb-3 pr-4 font-medium">Indicadas ativas</th>
                    <th className="pb-3 pr-5 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {parceiras.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 pl-5 pr-4 font-medium text-gray-900 whitespace-nowrap">{p.nome}</td>
                      <td className="py-3 pr-4 text-gray-500">
                        <p>{p.email}</p>
                        {p.telefone && <p className="text-xs text-gray-400">{p.telefone}</p>}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={p.comissaoPercentual === 30
                          ? 'inline-flex items-center gap-1 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-xs font-bold px-2 py-0.5 rounded-full'
                          : 'inline-flex items-center bg-rose-50 text-rose-600 text-xs font-bold px-2 py-0.5 rounded-full'
                        }>
                          {p.comissaoPercentual === 30 && <Sparkles className="w-3 h-3" />}
                          {p.comissaoPercentual}%
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-semibold text-emerald-600 whitespace-nowrap">{formatCurrency(p.disponivel)}</td>
                      <td className="py-3 pr-4 font-medium text-amber-600 whitespace-nowrap">{formatCurrency(p.pendente)}</td>
                      <td className="py-3 pr-4 text-gray-600">{p.indicadasAtivas}</td>
                      <td className="py-3 pr-5">
                        <div className="flex items-center gap-3 whitespace-nowrap">
                          <Link
                            href={`/admin/parceiras/${p.id}`}
                            className="flex items-center gap-1 text-xs font-medium text-rose-500 hover:text-rose-700 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Ver relatório
                          </Link>
                          <button
                            onClick={() => setRemovendoId(p.id)}
                            className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                            Remover cargo
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {parceiras.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-gray-400 text-sm">
                        Nenhuma parceira ainda
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>

      {removendoId && alvo && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <UserMinus className="w-5 h-5 text-red-500" />
              </div>
              <button onClick={() => setRemovendoId(null)} disabled={loading} className="text-gray-400 hover:text-gray-600 disabled:opacity-40">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Remover cargo de parceira?</h3>
              <p className="text-sm text-gray-500 mt-1">
                <span className="font-medium text-gray-800">{alvo.nome}</span> volta pro Plano Start e perde o acesso ao relatório de parceira.
                Comissões já geradas continuam valendo.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setRemovendoId(null)} disabled={loading}>
                Cancelar
              </Button>
              <Button variant="danger" className="flex-1" onClick={confirmarRemocao} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Remover cargo'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
