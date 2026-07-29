'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { CodigoIndicacaoCard } from '@/components/painel/CodigoIndicacaoCard'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { Wallet, Clock, TrendingUp, Sparkles, Users, UserCheck, UserX, Percent, Banknote } from 'lucide-react'
import type { ResumoParceira } from '@/lib/parceiras'
import toast from 'react-hot-toast'

const STATUS_COMISSAO: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }> = {
  pendente: { label: 'Pendente', variant: 'warning' },
  disponivel: { label: 'Disponível', variant: 'success' },
  pago: { label: 'Pago', variant: 'default' },
  cancelado: { label: 'Cancelado', variant: 'danger' },
}

const STATUS_SAQUE: Record<string, { label: string; variant: 'warning' | 'success' }> = {
  solicitado: { label: 'Solicitado', variant: 'warning' },
  pago: { label: 'Pago', variant: 'success' },
}

interface Props {
  resumo: ResumoParceira
  codigoIndicacao: string | null
  somenteLeitura?: boolean
}

export function RelatorioParceiraClient({ resumo, codigoIndicacao, somenteLeitura = false }: Props) {
  const [modalAberto, setModalAberto] = useState(false)
  const [valor, setValor] = useState('')
  const [pixChave, setPixChave] = useState(resumo.pixSalvo ?? '')
  const [enviando, setEnviando] = useState(false)

  async function solicitarSaque(e: React.FormEvent) {
    e.preventDefault()
    const valorNumero = parseFloat(valor.replace(',', '.'))
    if (!valorNumero || valorNumero <= 0) {
      toast.error('Informe um valor válido.')
      return
    }
    setEnviando(true)
    try {
      const res = await fetch('/api/parceiras/sacar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor: valorNumero, pixChave }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao solicitar saque.')
        return
      }
      toast.success(data.mensagem ?? 'Saque solicitado!')
      setModalAberto(false)
      setValor('')
    } catch {
      toast.error('Erro de conexão.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Resumo financeiro */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-emerald-600 mb-2">
              <Wallet className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Disponível para saque</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(resumo.disponivelParaSaque)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-amber-600 mb-2">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Pendente — aguardando 30 dias</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(resumo.pendente)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Total ganho</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(resumo.totalGanhoHistorico)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Comissão atual */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
                resumo.comissaoAtualPercentual === 30 ? 'bg-gradient-to-br from-amber-100 to-orange-100' : 'bg-rose-50'
              )}>
                <Percent className={cn('w-5 h-5', resumo.comissaoAtualPercentual === 30 ? 'text-orange-500' : 'text-rose-400')} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900">Comissão atual: {resumo.comissaoAtualPercentual}%</p>
                  {resumo.comissaoAtualPercentual === 30 && (
                    <Badge className="bg-gradient-to-r from-amber-400 to-orange-400 text-white flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Premium
                    </Badge>
                  )}
                </div>
                {resumo.comissaoAtualPercentual === 30 && resumo.periodoPremiumAte && (
                  <p className="text-xs text-orange-600 mt-0.5">
                    Período premium ativo até {formatDate(resumo.periodoPremiumAte)}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Progresso para 30%</p>
              <p className="text-sm font-semibold text-gray-700">{resumo.progressoPara30} de 10 assinaturas este período</p>
              <div className="w-40 h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1.5 ml-auto">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-400 to-orange-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, (resumo.progressoPara30 / 10) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      <Card>
        <CardHeader>
          <CardTitle>Estatísticas de indicação</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center">
            <Users className="w-4 h-4 text-gray-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-gray-900">{resumo.stats.cadastradas}</p>
            <p className="text-xs text-gray-400">Cadastradas</p>
          </div>
          <div className="text-center">
            <UserCheck className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-emerald-600">{resumo.stats.pagantesAtivas}</p>
            <p className="text-xs text-gray-400">Pagantes ativas</p>
          </div>
          <div className="text-center">
            <UserX className="w-4 h-4 text-gray-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-gray-500">{resumo.stats.canceladas}</p>
            <p className="text-xs text-gray-400">Cancelaram</p>
          </div>
          <div className="text-center">
            <TrendingUp className="w-4 h-4 text-rose-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-rose-500">{resumo.stats.taxaConversao}%</p>
            <p className="text-xs text-gray-400">Taxa de conversão</p>
          </div>
        </CardContent>
      </Card>

      {/* Histórico de comissões */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de comissões</CardTitle>
          <p className="text-xs text-gray-400">Por privacidade, não mostramos o nome das indicadas aqui.</p>
        </CardHeader>
        <CardContent className="p-0">
          {resumo.historico.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Nenhuma comissão registrada ainda</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {resumo.historico.map((c) => {
                const status = STATUS_COMISSAO[c.status] ?? STATUS_COMISSAO.pendente
                return (
                  <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 font-medium">
                        {formatCurrency(c.valor_comissao)}
                        <span className="text-gray-400 font-normal"> · {c.percentual}% de {formatCurrency(c.valor_assinatura)}</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(c.created_at)}</p>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saques */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>Saques</CardTitle>
            {!somenteLeitura && (
              <Button size="sm" onClick={() => setModalAberto(true)}>
                <Banknote className="w-4 h-4" />
                Solicitar saque
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {resumo.historicoSaques.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm px-6">
              Nenhum saque solicitado ainda. O valor mínimo é R$50.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {resumo.historicoSaques.map((s) => {
                const status = STATUS_SAQUE[s.status] ?? STATUS_SAQUE.solicitado
                return (
                  <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 font-medium">{formatCurrency(s.valor)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Solicitado em {formatDate(s.solicitado_em)}
                        {s.pago_em && <> · Pago em {formatDate(s.pago_em)}</>}
                      </p>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Código de indicação */}
      <Card>
        <CardHeader>
          <CardTitle>Código de indicação</CardTitle>
        </CardHeader>
        <CardContent>
          <CodigoIndicacaoCard codigoIndicacao={codigoIndicacao} />
        </CardContent>
      </Card>

      {!somenteLeitura && (
        <Modal open={modalAberto} onClose={() => setModalAberto(false)} title="Solicitar saque">
          <form onSubmit={solicitarSaque} className="p-6 space-y-4">
            <p className="text-sm text-gray-500">
              Disponível: <span className="font-semibold text-emerald-600">{formatCurrency(resumo.disponivelParaSaque)}</span>
            </p>
            <Input
              label="Valor (R$)"
              type="number"
              step="0.01"
              min="50"
              placeholder="50.00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              required
            />
            <Input
              label="Chave Pix"
              placeholder="CPF, e-mail, telefone ou chave aleatória"
              value={pixChave}
              onChange={(e) => setPixChave(e.target.value)}
              required
            />
            <p className="text-xs text-gray-400">
              Valor mínimo de R$50. Você só pode solicitar um novo saque 7 dias após o último.
              O saque será processado em até 7 dias úteis.
            </p>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalAberto(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" loading={enviando} className="flex-1">
                Confirmar saque
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
