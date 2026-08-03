'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, CheckCircle2, MessageCircle, Copy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AdminNav } from '@/components/admin/AdminNav'
import { formatCurrency, formatDate, buildWhatsappUrl } from '@/lib/utils'
import toast from 'react-hot-toast'

type SaqueRow = {
  id: string
  valor: number
  pixChave: string
  status: 'solicitado' | 'pago'
  solicitadoEm: string
  pagoEm: string | null
  whatsappTelefone: string | null
  prestadoraNome: string
}

export default function SaquesCaixaAdminClient({ saques }: { saques: SaqueRow[] }) {
  const router = useRouter()
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)
  const [recemConfirmados, setRecemConfirmados] = useState<Set<string>>(new Set())

  const pendentes = saques.filter((s) => s.status === 'solicitado')
  const pagos = saques.filter((s) => s.status === 'pago')

  async function confirmarPagamento(id: string) {
    setConfirmandoId(id)
    try {
      const res = await fetch(`/api/admin/caixa-saques/${id}/confirmar`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao confirmar saque')
        return
      }
      toast.success('Saque confirmado!')
      setRecemConfirmados((prev) => new Set(prev).add(id))
      router.refresh()
    } finally {
      setConfirmandoId(null)
    }
  }

  function mensagemComprovante(nome: string, valor: number) {
    return `Olá ${nome}! Seu saque do Caixa BelleBook de ${formatCurrency(valor)} foi processado! Segue o comprovante: [espaço para colar]`
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

      <main className="max-w-4xl mx-auto p-6 lg:p-8 space-y-6">
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle>Saques do Caixa solicitados ({pendentes.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {pendentes.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">Nenhum saque pendente</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {pendentes.map((s) => {
                  const jaConfirmado = recemConfirmados.has(s.id)
                  return (
                    <div key={s.id} className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-semibold text-gray-900">{s.prestadoraNome}</p>
                          <p className="text-2xl font-bold text-emerald-600 mt-0.5">{formatCurrency(s.valor)}</p>
                          <p className="text-xs text-gray-400 mt-1">Solicitado em {formatDate(s.solicitadoEm)}</p>
                        </div>
                        {!jaConfirmado && (
                          <Button size="sm" onClick={() => confirmarPagamento(s.id)} disabled={confirmandoId === s.id}>
                            {confirmandoId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Confirmar pagamento
                          </Button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 text-sm">
                        <span className="text-gray-400">Pix:</span>
                        <span className="font-mono text-gray-700 flex-1 truncate">{s.pixChave}</span>
                        <button
                          onClick={() => { navigator.clipboard.writeText(s.pixChave); toast.success('Chave Pix copiada!') }}
                          className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {jaConfirmado && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 space-y-2">
                          <p className="text-sm text-emerald-700 font-medium flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            Pagamento confirmado
                          </p>
                          {s.whatsappTelefone ? (
                            <a
                              href={buildWhatsappUrl(s.whatsappTelefone, mensagemComprovante(s.prestadoraNome, s.valor))}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-xl px-4 py-2.5 w-fit transition-colors"
                            >
                              <MessageCircle className="w-4 h-4" />
                              Enviar comprovante no WhatsApp
                            </a>
                          ) : (
                            <p className="text-xs text-amber-600">Sem telefone registrado pra essa prestadora.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de saques pagos ({pagos.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {pagos.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">Nenhum saque pago ainda</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {pagos.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{s.prestadoraNome} — {formatCurrency(s.valor)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Solicitado em {formatDate(s.solicitadoEm)}
                        {s.pagoEm && <> · Pago em {formatDate(s.pagoEm)}</>}
                      </p>
                    </div>
                    <Badge variant="success">Pago</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
