'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { formatCurrency } from '@/lib/utils'
import { Plus, Pencil, Trash2, Clock, Scissors } from 'lucide-react'
import type { Servico } from '@/lib/types'
import { demoToast } from '@/lib/demoData'

interface ServicoForm {
  nome: string
  preco: string
  duracao_minutos: string
  descricao: string
}

export type ServicoComProfissionais = Servico & {
  servico_profissionais: { profissional_id: string }[]
}

interface ProfissionalLite {
  id: string
  nome: string
}

const emptyForm: ServicoForm = { nome: '', preco: '', duracao_minutos: '', descricao: '' }

export default function ServicosDemoClient({
  servicos,
  profissionais,
}: {
  servicos: ServicoComProfissionais[]
  profissionais: ProfissionalLite[]
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<ServicoForm>(emptyForm)
  const [profissionaisSelecionadas, setProfissionaisSelecionadas] = useState<string[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  function toggleProfissional(id: string) {
    setProfissionaisSelecionadas((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  function openCreate() {
    setForm(emptyForm)
    setProfissionaisSelecionadas([])
    setEditId(null)
    setModalOpen(true)
  }

  function openEdit(s: ServicoComProfissionais) {
    setForm({
      nome: s.nome,
      preco: String(s.preco),
      duracao_minutos: String(s.duracao_minutos),
      descricao: s.descricao ?? '',
    })
    setProfissionaisSelecionadas(s.servico_profissionais.map((sp) => sp.profissional_id))
    setEditId(s.id)
    setModalOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    demoToast()
    setModalOpen(false)
  }

  function handleDelete() {
    demoToast()
    setDeleteId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold text-gray-900">Serviços</h1>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4" />
          Novo serviço
        </Button>
      </div>

      {servicos.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-16 text-gray-400">
              <Scissors className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum serviço cadastrado</p>
              <Button onClick={openCreate} variant="outline" size="sm" className="mt-4">
                Adicionar primeiro serviço
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {servicos.map((s) => (
            <Card key={s.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">{s.nome}</h3>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteId(s.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {s.descricao && <p className="text-xs text-gray-500 mb-3 leading-relaxed">{s.descricao}</p>}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-rose-600 font-bold text-lg">{formatCurrency(s.preco)}</span>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {s.duracao_minutos} min
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Editar serviço' : 'Novo serviço'}
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="Nome do serviço"
            placeholder="Ex: Manicure completa"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Preço (R$)"
              type="number"
              step="0.01"
              min="0"
              placeholder="50.00"
              value={form.preco}
              onChange={(e) => setForm({ ...form, preco: e.target.value })}
              required
            />
            <Input
              label="Duração (min)"
              type="number"
              min="15"
              step="15"
              placeholder="60"
              value={form.duracao_minutos}
              onChange={(e) => setForm({ ...form, duracao_minutos: e.target.value })}
              required
            />
          </div>
          <Textarea
            label="Descrição (opcional)"
            placeholder="Descreva o que está incluído..."
            rows={3}
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          />

          {profissionais.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-700">Quem realiza este serviço</label>
              <p className="text-xs text-gray-400 mt-0.5 mb-2">Se nenhuma for marcada, o serviço fica disponível para todas</p>
              <div className="space-y-1.5">
                {profissionais.map((p) => (
                  <label key={p.id} className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer min-h-9">
                    <input
                      type="checkbox"
                      checked={profissionaisSelecionadas.includes(p.id)}
                      onChange={() => toggleProfissional(p.id)}
                      className="w-4 h-4 rounded border-gray-300 text-rose-400 focus:ring-rose-300"
                    />
                    {p.nome}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">
              {editId ? 'Salvar' : 'Criar serviço'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Remover serviço?">
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">Agendamentos existentes não serão afetados.</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="flex-1">Cancelar</Button>
            <Button variant="danger" onClick={handleDelete} className="flex-1">
              Remover
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
