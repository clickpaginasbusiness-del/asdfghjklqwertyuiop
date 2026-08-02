'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Tag } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { AdminNav } from '@/components/admin/AdminNav'
import { formatDate, cn } from '@/lib/utils'
import type { Cupom } from '@/lib/types'
import toast from 'react-hot-toast'

type TipoDesconto = 'percentual' | 'fixo'

const emptyForm = {
  codigo: '',
  tipo: 'percentual' as TipoDesconto,
  valor: '',
  maxUsos: '',
  expiraEm: '',
}

function formatDesconto(cupom: Cupom): string {
  if (cupom.percentual != null) return `${cupom.percentual}%`
  if (cupom.valor_fixo != null) return `R$${cupom.valor_fixo.toFixed(2).replace('.', ',')}`
  return '—'
}

export default function CuponsAdminClient({ cuponsIniciais }: { cuponsIniciais: Cupom[] }) {
  const router = useRouter()
  const [cupons, setCupons] = useState(cuponsIniciais)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  function openCreate() {
    setForm(emptyForm)
    setModalOpen(true)
  }

  async function criarCupom(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/admin/cupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: form.codigo,
          tipo: form.tipo,
          valor: Number(form.valor.replace(',', '.')),
          maxUsos: form.maxUsos ? Number(form.maxUsos) : null,
          expiraEm: form.expiraEm || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao criar cupom')
        return
      }
      setCupons((prev) => [data.cupom, ...prev])
      toast.success('Cupom criado!')
      setModalOpen(false)
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setSaving(false)
    }
  }

  async function alternarAtivo(cupom: Cupom) {
    setTogglingId(cupom.id)
    try {
      const res = await fetch(`/api/admin/cupons/${cupom.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !cupom.ativo }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao atualizar cupom')
        return
      }
      setCupons((prev) => prev.map((c) => c.id === cupom.id ? { ...c, ativo: !cupom.ativo } : c))
      toast.success(!cupom.ativo ? 'Cupom ativado' : 'Cupom desativado')
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setTogglingId(null)
    }
  }

  async function excluirCupom() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/cupons/${deleteId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao excluir cupom')
        return
      }
      setCupons((prev) => prev.filter((c) => c.id !== deleteId))
      toast.success('Cupom excluído')
      setDeleteId(null)
      router.refresh()
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setDeleting(false)
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

      <main className="max-w-5xl mx-auto p-6 lg:p-8 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-rose-400" />
                <CardTitle>Cupons ({cupons.length})</CardTitle>
              </div>
              <Button size="sm" onClick={openCreate}>
                <Plus className="w-4 h-4" />
                Novo Cupom
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {cupons.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Tag className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum cupom cadastrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
                      <th className="pb-3 pr-4 font-medium">Código</th>
                      <th className="pb-3 pr-4 font-medium">Desconto</th>
                      <th className="pb-3 pr-4 font-medium">Status</th>
                      <th className="pb-3 pr-4 font-medium">Usos</th>
                      <th className="pb-3 pr-4 font-medium">Expiração</th>
                      <th className="pb-3 pr-4 font-medium">Criado em</th>
                      <th className="pb-3 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {cupons.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 pr-4 font-mono font-semibold text-gray-900 whitespace-nowrap">{c.codigo}</td>
                        <td className="py-3 pr-4 text-gray-700 whitespace-nowrap">{formatDesconto(c)}</td>
                        <td className="py-3 pr-4">
                          <Badge variant={c.ativo ? 'success' : 'default'}>{c.ativo ? 'Ativo' : 'Inativo'}</Badge>
                        </td>
                        <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">
                          {c.usos}{c.max_usos != null ? `/${c.max_usos}` : ' (ilimitado)'}
                        </td>
                        <td className="py-3 pr-4 text-gray-400 whitespace-nowrap">
                          {c.expira_em ? formatDate(c.expira_em) : 'Sem expiração'}
                        </td>
                        <td className="py-3 pr-4 text-gray-400 whitespace-nowrap">{formatDate(c.created_at)}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => alternarAtivo(c)}
                              disabled={togglingId === c.id}
                              className={cn(
                                'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                                c.ativo
                                  ? 'border-gray-200 text-gray-600 hover:bg-gray-100'
                                  : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                              )}
                            >
                              {c.ativo ? 'Desativar' : 'Ativar'}
                            </button>
                            <button
                              onClick={() => setDeleteId(c.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                              title="Excluir cupom"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo Cupom">
        <form onSubmit={criarCupom} className="p-6 space-y-4">
          <Input
            label="Código"
            placeholder="Ex: COPA2026"
            value={form.codigo}
            onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
            className="uppercase tracking-widest font-mono"
            required
          />

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Tipo de desconto</label>
            <div className="inline-flex rounded-xl border border-gray-200 p-1 bg-gray-50">
              {(['percentual', 'fixo'] as const).map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setForm({ ...form, tipo })}
                  className={cn(
                    'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    form.tipo === tipo ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  {tipo === 'percentual' ? 'Percentual (%)' : 'Valor fixo (R$)'}
                </button>
              ))}
            </div>
          </div>

          <Input
            label={form.tipo === 'percentual' ? 'Valor do desconto (%)' : 'Valor do desconto (R$)'}
            type="number"
            step={form.tipo === 'percentual' ? '1' : '0.01'}
            min="0"
            max={form.tipo === 'percentual' ? '100' : undefined}
            placeholder={form.tipo === 'percentual' ? '20' : '10.00'}
            value={form.valor}
            onChange={(e) => setForm({ ...form, valor: e.target.value })}
            required
          />

          <Input
            label="Máximo de usos (opcional)"
            type="number"
            min="1"
            placeholder="Vazio = ilimitado"
            value={form.maxUsos}
            onChange={(e) => setForm({ ...form, maxUsos: e.target.value })}
          />

          <Input
            label="Data de expiração (opcional)"
            type="date"
            value={form.expiraEm}
            onChange={(e) => setForm({ ...form, expiraEm: e.target.value })}
          />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" loading={saving} className="flex-1">
              Criar cupom
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Excluir cupom?">
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">Essa ação não pode ser desfeita. O código deixa de funcionar imediatamente.</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="flex-1">Cancelar</Button>
            <Button variant="danger" onClick={excluirCupom} loading={deleting} className="flex-1">
              Excluir
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
