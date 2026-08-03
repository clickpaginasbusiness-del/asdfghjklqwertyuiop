'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wallet, Clock, TrendingUp, Landmark } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import type { ResumoCaixa } from '@/lib/caixa'
import toast from 'react-hot-toast'

const TIPO_LABEL: Record<string, string> = {
  sinal: 'Sinal',
  pagamento_servico: 'Pagamento do serviço',
  saque: 'Saque',
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'disponivel') return <Badge variant="success">Disponível</Badge>
  if (status === 'pendente') return <Badge variant="warning">Pendente</Badge>
  if (status === 'sacado') return <Badge variant="default">Sacado</Badge>
  if (status === 'reembolsado') return <Badge variant="danger">Reembolsado</Badge>
  return <Badge>{status}</Badge>
}

export default function CaixaClient({ resumo, podeSolicitarSaque }: { resumo: ResumoCaixa; podeSolicitarSaque: boolean }) {
  const router = useRouter()
  const [valor, setValor] = useState('')
  const [pixChave, setPixChave] = useState('')
  const [solicitando, setSolicitando] = useState(false)

  const ultimoSaque = resumo.historicoSaques[0] ?? null

  async function solicitarSaque(e: React.FormEvent) {
    e.preventDefault()
    setSolicitando(true)
    try {
      const res = await fetch('/api/caixa/sacar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor: parseFloat(valor), pixChave }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao solicitar saque')
        return
      }
      toast.success(data.mensagem ?? 'Saque solicitado!')
      setValor('')
      router.refresh()
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setSolicitando(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Wallet className="w-6 h-6 text-rose-400" />
        <h1 className="font-serif text-2xl font-semibold text-gray-900">Caixa</h1>
      </div>

      {/* Resumo financeiro */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-emerald-50 p-2 rounded-xl">
                <Wallet className="w-4 h-4 text-emerald-600" />
              </div>
              <Badge variant="success">Disponível</Badge>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(resumo.disponivelParaSaque)}</p>
            <p className="text-xs text-gray-400 mt-1">Disponível para saque</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-amber-50 p-2 rounded-xl">
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <Badge variant="warning">Pendente</Badge>
            </div>
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(resumo.pendente)}</p>
            <p className="text-xs text-gray-400 mt-1">Aguardando 7 dias</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-gray-100 p-2 rounded-xl">
                <TrendingUp className="w-4 h-4 text-gray-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(resumo.totalRecebidoHistorico)}</p>
            <p className="text-xs text-gray-400 mt-1">Total recebido historicamente</p>
          </CardContent>
        </Card>
      </div>

      {/* Solicitar saque */}
      <Card>
        <CardHeader>
          <CardTitle>Solicitar saque</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-gray-400">Mínimo R$20 · 1 saque por semana</p>
          {podeSolicitarSaque ? (
            <form onSubmit={solicitarSaque} className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <Input
                  label="Valor (R$)"
                  type="number"
                  step="0.01"
                  min="20"
                  max={resumo.disponivelParaSaque || undefined}
                  placeholder="20.00"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  required
                />
              </div>
              <div className="flex-1">
                <Input
                  label="Chave Pix"
                  placeholder="Email, telefone, CPF ou chave aleatória"
                  value={pixChave}
                  onChange={(e) => setPixChave(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" loading={solicitando} disabled={resumo.disponivelParaSaque < 20}>
                <Landmark className="w-4 h-4" />
                Solicitar saque
              </Button>
            </form>
          ) : (
            <p className="text-sm text-amber-600">
              Você já solicitou um saque nos últimos 7 dias. Tente novamente {ultimoSaque && formatDate(new Date(new Date(ultimoSaque.solicitado_em).getTime() + 7 * 24 * 60 * 60 * 1000))}.
            </p>
          )}

          {resumo.historicoSaques.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Histórico de saques</p>
              <div className="space-y-1.5">
                {resumo.historicoSaques.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm py-1.5">
                    <span className="text-gray-600">{formatDate(s.solicitado_em)}</span>
                    <span className="font-medium text-gray-900">{formatCurrency(s.valor)}</span>
                    <Badge variant={s.status === 'pago' ? 'success' : 'warning'}>
                      {s.status === 'pago' ? 'Pago' : 'Solicitado'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de transações */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de transações</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {resumo.historico.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Nenhuma transação ainda</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                    <th className="px-5 py-2.5 font-medium">Data</th>
                    <th className="px-5 py-2.5 font-medium">Tipo</th>
                    <th className="px-5 py-2.5 font-medium">Serviço</th>
                    <th className="px-5 py-2.5 font-medium text-right">Bruto</th>
                    <th className="px-5 py-2.5 font-medium text-right">Taxa</th>
                    <th className="px-5 py-2.5 font-medium text-right">Líquido</th>
                    <th className="px-5 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {resumo.historico.map((t) => (
                    <tr key={t.id}>
                      <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(t.created_at)}</td>
                      <td className="px-5 py-3 text-gray-700">{TIPO_LABEL[t.tipo] ?? t.tipo}</td>
                      <td className="px-5 py-3 text-gray-700">{t.servicoNome ?? '—'}</td>
                      <td className="px-5 py-3 text-gray-500 text-right whitespace-nowrap">{formatCurrency(t.valor_bruto)}</td>
                      <td className="px-5 py-3 text-gray-400 text-right whitespace-nowrap">{t.taxa_percentual}%</td>
                      <td className="px-5 py-3 font-semibold text-gray-900 text-right whitespace-nowrap">{formatCurrency(t.valor)}</td>
                      <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
